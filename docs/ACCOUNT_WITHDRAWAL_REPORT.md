# Phase10-8 — Account Withdrawal (회원탈퇴)

목표: 로그인한 사용자가 자신의 Luck Platform 계정을 직접 탈퇴할 수 있고, 탈퇴 후 인증/개인
데이터가 더 이상 정상 사용자 계정으로 남지 않도록 하는 안전한 회원탈퇴 flow를 완성한다.
운영자 admin 계정은 이 flow로 삭제되지 않는다.

---

## 1. 기존 Account Architecture

- 인증: Supabase Auth(`auth.users`), 카카오 REST API + Admin API 방식(`lib/auth/kakao.ts`) — 카카오
  고유 ID로부터 결정론적 synthetic 이메일(`kakao-{id}@users.noreply.luckplatform.local`)을 만들어
  `auth.users`의 식별자로 사용한다. 같은 카카오 계정은 항상 같은 이메일로 매핑된다.
- 세션 확인: `lib/auth/session.ts`의 `getCurrentUser()` — `getSession()`이 아니라 `getUser()`를 써서
  매 요청마다 Supabase Auth 서버에 재검증을 요청한다. 이 성질이 이번 탈퇴 기능의 세션 무효화(§16)를
  별도 구현 없이 보장해준다.
- 애플리케이션 프로필: `public.profiles`가 `auth.users`를 1:1로 확장한다(`profiles.id = auth.users.id`).
- 관리자: `public.admins`(`user_id → auth.users(id)`, UNIQUE) — `profiles`가 아니라 `auth.users`를
  직접 참조한다. `lib/auth/isAdmin.ts`가 본인 세션 기준으로만 판정한다.

## 2. User-owned Table Inventory / FK·Cascade Map

migration 0001~0019 전수 확인(`create table public.*` 17개 전체, `user_id`/`auth.users` 참조 grep) 결과:

| 테이블 | 참조 컬럼 | 참조 대상 | ON DELETE | NULL 허용 | RLS DELETE(client) |
|---|---|---|---|---|---|
| `profiles` | `id` | `auth.users(id)` | NO ACTION(기본값) | - | 없음(정책 없음=차단) |
| `user_numbers` | `user_id` | `profiles(id)` | NO ACTION | nullable | 본인만 허용(0008) |
| `dream_journal_entries` | `user_id` | `profiles(id)` | NO ACTION | NOT NULL | 본인만 허용(0008) |
| `fortune_results` | `user_id` | `profiles(id)` | NO ACTION | nullable | 없음(service_role 전용) |
| `user_period_stats` | `user_id` | `profiles(id)` | NO ACTION | NOT NULL | 없음(service_role 전용) |
| `notifications` | `user_id` | `profiles(id)` | NO ACTION | NOT NULL | 없음(service_role 전용) |
| `notification_deliveries` | `notification_id` | `notifications(id)` | **CASCADE** | NOT NULL | 없음(service_role 전용) |
| `share_cards` | `user_id` | `profiles(id)` | NO ACTION | nullable | 없음(INSERT만 본인 허용) |
| `admins` | `user_id` | `auth.users(id)` | NO ACTION | NOT NULL, UNIQUE | 없음(service_role 전용) |

공개/운영 콘텐츠 테이블(`draws`, `dreams`, `dream_number_mappings`, `winning_cases`, `stores`,
`store_win_records`, `content_entries`, `dream_situations`)에는 `user_id`/`auth.users` 참조가
전혀 없다 — 전수 grep으로 확인, 탈퇴 로직이 손댈 이유가 없다.

**핵심 발견**: `notification_deliveries → notifications` 단 하나만 `ON DELETE CASCADE`이고, 나머지는
전부 `NO ACTION`(Postgres 기본값)이다. 즉 "FK cascade로 자동 정리"되는 관계가 사실상 없어 —
`profiles`/`auth.users`를 지우려면 자식 테이블을 애플리케이션 코드가 먼저 명시적으로 지워야 한다
(§9 참조).

## 3. 기존 문서의 Withdrawal 설계 확인 — 실제 구현과의 차이

`docs/DATABASE_SCHEMA.md` §7("데이터 보존/삭제 정책", v2.1 A안)에 과거 설계가 있었다:
**"탈퇴는 `profiles`를 UPDATE로 익명화(`status='withdrawn'`)하고 `auth.users`는 삭제하지 않는다"**.
0001/0008/0011 migration의 주석도 이 설계를 전제로 `profiles` DELETE RLS를 아예 만들지 않았다.

그러나 이 설계는 **실제로 구현된 적이 없다**(회원탈퇴 코드 자체가 이번 Task 이전엔 존재하지
않았음 — 전수 grep으로 확인) — 문서만 있고 코드는 없는 상태였다. 이번 Task의 성공 조건은
명시적으로 "탈퇴 완료 후 자신의 개인 기록과 **인증 계정**이 더 이상 남지 않으며"를 요구해,
`auth.users`를 보존하는 옛 A안과 정면으로 배치된다. 지시문 원칙("문서와 실제 구현이 다르면 실제
구현에 맞춘다", "실제 코드가 source of truth")에 따라, **이번 Task는 옛 A안(익명화 보존)을 채택하지
않고 실제 삭제(auth.users + 모든 개인 데이터 DELETE) 방식으로 새로 구현했다** — 이 결정과 근거를
명확히 기록해둔다. `docs/DATABASE_SCHEMA.md` §7은 이번 Task에서 수정하지 않았다(DB 설계 문서
자체를 고치는 것은 이번 Task 범위 밖으로 판단 — 필요하면 별도 Task에서 갱신 권장).

## 4. 삭제 vs 익명화 결정

| 데이터 | 분류 | 처리 |
|---|---|---|
| `auth.users` | 계정 인증 데이터 | **삭제**(`admin.deleteUser`) |
| `profiles` | 직접 개인 데이터 | **삭제** |
| `user_numbers` | 개인 기록 | **삭제** |
| `dream_journal_entries` | 개인 기록 | **삭제** |
| `fortune_results` | 개인 기록(생년월일 포함, 개인정보 성격 강함) | **삭제** |
| `user_period_stats` | 개인 통계 캐시 | **삭제** |
| `notifications`/`notification_deliveries` | 개인 알림 | **삭제**(deliveries는 CASCADE로 자동) |
| `share_cards` | 개인 공유 카드 | **삭제**(방어적 — 실사용 코드 0건 확인, §5) |
| `admins` | 관리자 권한 | **이번 Task로 삭제하지 않음** — 애초에 admin이면 탈퇴 자체를 차단(§6) |
| `draws`/`dreams`/공개 콘텐츠 | 운영 데이터 | **영향 없음**(user_id 없음) |

**법 조항을 근거로 한 "보관 의무"를 임의로 만들지 않았다** — 모든 개인 데이터를 삭제로
분류했고, 어떤 테이블도 "법적으로 보존해야 한다"는 임의 주장을 하지 않는다. 익명 보존이
필요한 데이터도 없다고 판단했다(운영 통계는 별도 집계 테이블이 없고, `user_period_stats` 자체가
개인 캐시라 익명화 대상이 아니라 그냥 삭제 대상이다).

## 5. share_cards에 대한 별도 확인

`share_cards` 테이블은 `0017_fortune_results_privacy.sql`의 조사 기록(전수 grep)에 따르면 **실제
애플리케이션 코드 어디에서도 쓰이지 않는다** — INSERT/SELECT 어느 경로도 없다. 따라서 실제로
지워질 행이 있을 가능성은 낮지만, `user_id` 컬럼이 존재하는 이상 방어적으로 삭제 대상에
포함시켰다(존재하지 않는 행을 지우는 것은 no-op이라 안전).

## 6. Admin 계정 보호

`lib/api/account/deleteAccount.ts`의 `deleteAccount()`가 가장 먼저 `admins` 테이블에서
`user_id = 대상`을 조회하고, 행이 있으면 **어떤 데이터도 건드리기 전에** `AdminAccountProtectedError`를
던지고 종료한다. API(`app/api/account/route.ts`)는 이를 `403 ADMIN_ACCOUNT_CANNOT_SELF_DELETE`로
매핑한다. UI(`app/my/account/page.tsx`)도 `isAdmin()`으로 미리 확인해 관리자에게는 탈퇴 버튼 자체를
숨기고 "관리자 계정은 여기서 탈퇴할 수 없습니다."를 보여준다 — **API guard가 source of truth이고
UI는 추가 방어선**이라는 지시문 원칙 그대로다. 실제 temp admin 계정으로 실측 검증 완료(§22).

## 7. 탈퇴 UX 위치

새 route `/my/account`(§37 권장안 그대로) 하나만 추가했다. `proxy.ts`의 `/my` 접두사 보호가 이미
비로그인 접근을 `/login`으로 리다이렉트하므로 별도 인증 로직을 만들지 않았다(서버 컴포넌트
내부에서도 재확인). `components/auth/ProfileMenu.tsx`(Header 드롭다운)에 "계정 설정" 링크 하나를
추가해 진입점을 열었다 — 새로운 대형 설정 시스템은 만들지 않았다.

**발견한 사전 이슈(이번 Task 범위 밖)**: `ProfileMenu`가 이미 "마이페이지" 링크를 `/my/profile`로
걸어두고 있는데, 그 route는 코드베이스에 존재하지 않는다(`app/my/profile/page.tsx` 없음 — 이번 조사
중 발견, 이번 Task 이전부터 있던 문제라 수정하지 않았다). 참고로 남겨둔다.

## 8. 탈퇴 확인 UX

`components/account/AccountWithdrawalForm.tsx`(Client Component): 페이지에 진입하면 항상 설명
문구("Luck Platform 계정을 삭제합니다.", "탈퇴하면 저장한 번호, 꿈 기록, 오늘의 행운 등 계정과
연결된 정보가 삭제됩니다. 탈퇴 후 저장된 개인 기록은 복구할 수 없습니다.")가 보이고, 체크박스
("삭제되는 내용을 확인했습니다.")를 체크해야만 "회원탈퇴" 버튼이 활성화된다. 2단계 확인이며,
5단계 이상의 dark pattern이나 숨김 처리는 두지 않았다.

## 9. API

`DELETE /api/account`(§8 권장안). 서버 흐름: ① `getCurrentUser()`로 세션 재검증(getUser() 기반)
② 세션에서 얻은 `user.id`만 `deleteAccount()`에 전달 ③ `AdminAccountProtectedError` → 403,
그 외 오류 → 500(raw error 미노출) ④ 성공 시 `logout()`으로 쿠키 정리 ⑤ `{ success: true }`.
**request body를 전혀 파싱하지 않는다** — `request.json()` 호출 자체가 코드에 없어, 클라이언트가
어떤 `userId`를 body에 실어 보내도 도달할 경로가 구조적으로 없다(§29 "client-provided user_id
절대 신뢰 금지"를 런타임 검증이 아니라 애초에 입력을 안 읽는 방식으로 충족).

## 10. Service — lib/api/account/deleteAccount.ts

책임을 이 파일 하나에 모았다(§21): admin guard → 자식 테이블 삭제 → `profiles` 삭제 →
`auth.users` 삭제. `service_role`만 사용한다(`profiles`/`fortune_results`/`user_period_stats`/
`notifications`는 client DELETE RLS가 아예 없고, `auth.users` 삭제는 애초에 Admin API 없이는
불가능하다).

## 11. 삭제 순서(atomicity 판단)

FK가 전부 `NO ACTION`(§2)이라 부모를 지우려면 자식을 먼저 지워야 한다. 순서:
`notifications`(→ `notification_deliveries` CASCADE) → `user_numbers` → `dream_journal_entries` →
`fortune_results` → `user_period_stats` → `share_cards` → `profiles` → `auth.users`.

## 12. Atomicity 한계 — 실제 제약 확인

Supabase Admin API(`auth.admin.deleteUser`)와 Postgres 테이블 DELETE를 하나의 DB 트랜잭션으로
묶을 수 없다(Admin API는 별도 HTTP 호출이다) — 새 RPC/DB 함수를 만들지 않는다는 원칙과도 맞물려
클라이언트 트랜잭션을 인위적으로 구성하지 않았다. 대신 **각 단계가 `.eq(컬럼, userId)` 조건 하나로
완결되는 개별 원자적 DELETE라 순서만 지키면 중간 실패 후 재시도가 안전하다(idempotent)** — 이미
지워진 테이블에 같은 삭제를 다시 실행해도 0행 매칭으로 조용히 성공한다. 실제 실패 시나리오
6종(admin 보호, admins 조회 오류, 정상 삭제 순서, 자식 테이블 중간 실패, auth 삭제 실패,
재시도 idempotency)을 전부 유닛 테스트로 확인했다(§26).

## 13. profiles

`deleteAccount()`가 자식 테이블을 모두 지운 뒤 `profiles.id = userId` 행을 삭제한다. 실제 DB
테스트(§22)로 삭제 후 0건임을 확인했다.

## 14. user_numbers

동일하게 `user_id = userId` 조건으로 삭제. 탈퇴 후 `/my/journal/results`에서 이전 번호가 다시
보이지 않는다 — 행 자체가 없으므로 복구될 데이터가 없다(§17 요구사항 충족).

## 15. fortune_results

`input_birth_date`(실제 생년월일)를 포함해 개인정보 성격이 가장 강한 테이블이라 삭제를
우선했다(§16 요구사항 그대로). `0017_fortune_results_privacy.sql`의 본인 전용 SELECT RLS는
이번 Task로 전혀 건드리지 않았다.

## 16. dream_journal_entries

개인 꿈 기록 삭제. 공개 콘텐츠 `dreams`/`dream_number_mappings`(꿈해몽 사전)는 `user_id`가 없는
완전히 별개 테이블이라 영향 없음을 스키마 레벨에서 이미 보장한다(§19 요구사항 확인).

## 17. notifications

`notifications` 삭제 시 `notification_deliveries`는 `ON DELETE CASCADE`로 자동 정리된다(§2).
실제 DB 테스트로 발송 기록(`notification_deliveries`)까지 0건이 되는 것을 확인했다(§22).

## 18. Session Cleanup

`getCurrentUser()`가 `getUser()`(매 요청 재검증)를 쓰므로, `auth.users` 삭제 즉시 **기존 access
token으로 어떤 요청을 보내도 서버가 "존재하지 않는 사용자"로 판정한다** — 실제 실측: 삭제 전
발급한 access token으로 삭제 후 `getUser()`를 호출하면 `User from sub claim in JWT does not
exist` 오류가 즉시 발생했다(§22 실제 로그). API는 추가로 `logout()`을 호출해 쿠키까지 정리한다
(쿠키 정리가 실패해도 위 세션 무효화가 이미 보안 경계이므로 치명적이지 않다).

## 19. Kakao Relationship

이 기능은 **Luck Platform 계정 삭제**이며, 카카오 계정 자체를 삭제하거나 연결을 끊지 않는다.
UI(§8 설명 문구)와 보고서 어디에도 "카카오 계정을 삭제한다"는 표현을 쓰지 않았다. 카카오
연결 끊기(unlink) API 연동은 MVP 범위가 아니라 구현하지 않았다(현재 OAuth 아키텍처가 REST API
기반 최소 동의항목만 사용해 unlink까지 확장하려면 별도 검토가 필요 — 이번 Task 범위 밖).

## 20. 재가입(Re-registration) Semantics

`lib/auth/kakao.ts`의 `deriveKakaoSyntheticEmail(kakaoId)`는 카카오 고유 ID로부터 결정론적
이메일을 만든다. `auth.users`가 실제로 삭제되므로, 탈퇴 후 같은 카카오 계정으로 다시 로그인하면
**같은 synthetic 이메일로 완전히 새로운 `auth.users` 행(새 UUID)이 생성**되고, `profiles`가 없으니
온보딩부터 다시 진행된다 — 삭제된 개인 기록은 새 UUID와 연결될 방법이 없어 복구된 것처럼
보이지 않는다.

**실제 검증(Admin API 레벨, §22)**: 삭제 전 UUID와 재가입 후 UUID가 다름을 확인했고, 재가입한
새 UUID로 `profiles`를 조회하면 없음(자동 복원 없음)을 확인했다. 다만 이 검증은 `admin.createUser`
+ `admin.generateLink`로 실제 Auth 서버에 대해 수행한 것이며, **실제 브라우저로 카카오 OAuth
전체 흐름(로그인 버튼 클릭 → 카카오 동의 → 콜백)을 다시 밟아본 것은 아니다** — 그 부분은
`PENDING_REAL_REJOIN_VERIFICATION`으로 정직하게 남긴다. Launch Blocker는 아니라고 판단한다
(재가입 로직 자체는 코드 경로가 동일하고 Admin API 레벨에서 핵심 성질이 이미 실증됐기 때문 —
브라우저 E2E는 운영자가 원할 때 언제든 직접 재현 가능한 낮은 위험도의 검증이다).

## 21. Privacy 페이지 수정

`app/privacy/page.tsx` §3("보관 및 삭제"), §6("이용자의 권리")을 실제 구현에 맞게 최소
수정했다 — "별도 화면을 제공하지 않는다"는 기존 문구를 "로그인 후 계정 설정 화면에서 직접
탈퇴 가능, 관리자 계정은 이 화면으로 삭제되지 않음"으로 교체했다. 법률 조항이나 보존기간을
새로 만들지 않았고, 실제 구현된 사실만 반영했다.

## 22. Terms 수정 여부

`app/terms/page.tsx` §7("서비스 중단 및 이용계약 해지")의 기존 문구("이용자는 언제든지 서비스
이용을 중단할 수 있습니다")는 실제 구현과 **충돌하지 않는다** — "탈퇴 화면이 없다"고 단정하지
않았으므로 그대로 두었다. 전체 재작성은 하지 않았다(지시문 §26 원칙).

## 23. RLS / Security

- 기존 RLS를 하나도 느슨하게 만들지 않았다 — `fortune_results`/`user_numbers`/`dream_journal_entries`
  own-select, `admins` 본인 SELECT 전부 이번 Task에서 수정하지 않았다(git diff로 재확인, §14).
- **client user_id injection 무시**: API가 request body를 아예 읽지 않으므로 구조적으로 불가능
  (§9). 이 성질은 코드 리뷰로 확인했다 — "가짜 body를 실제 HTTP로 보내봤을 때 무시되는지"까지는
  별도 HTTP 레벨 테스트를 만들지 않았다(라우트 핸들러가 body 파싱 자체를 하지 않는다는 것이
  런타임 테스트보다 더 강한 보장이라고 판단).
- **cross-user 데이터 보존 실측**(§30 Real DB Integration에서 함께 수행): 동시에 존재하는 두
  temp 사용자(B: 보존 대상, C: 삭제 대상) 중 C만 `deleteAccount(C)`로 삭제하고, B의 `profiles`/
  `user_numbers`가 정확히 그대로 남아있음을 실제 DB에서 확인했다 — "조건 누락으로 다른 사용자
  행까지 삭제되는" 버그 클래스를 실제로 배제했다.
- **anon 탈퇴 API 호출 불가**: `getCurrentUser()`가 null이면 401 — anon 세션은 이 지점에서
  걸러진다(코드 경로상 자명, 기존 `app/api/profile/route.ts`와 동일 패턴).
- **service_role client 노출 0**: `lib/supabase/service.ts`는 `window !== undefined`에서 즉시
  throw하는 기존 가드를 그대로 쓰고, 이번 Task가 만든 파일 중 Client Component
  (`AccountWithdrawalForm.tsx`)는 `fetch("/api/account")`만 호출할 뿐 service 모듈을 import하지
  않는다.
- **CSRF**: DELETE 메서드 + SameSite 쿠키 아키텍처는 기존 `POST /api/auth/logout`과 동일한
  보호 수준이다(이번 Task에서 새로 도입한 위험이 아니다).

## 24. Real DB Integration (temp user)

운영자 실제 계정은 전혀 사용하지 않았다. `_tmp_p108_withdrawal_test.ts`(실행 후 즉시 삭제,
저장소에 커밋되지 않음)를 `npx tsx`로 실행해 실제 Supabase 프로젝트에 대해 검증했다 —
`lib/supabase/service.ts`/`lib/api/account/deleteAccount.ts` 실제 코드를 그대로 import했다.

**시딩한 temp 사용자 A**(kakao id `999000001`, 삭제 후 UUID 비공개 처리 없이 로그에는 남겼으나
이 보고서에는 요약만 기록): `profiles`/`user_numbers`/`dream_journal_entries`/`fortune_results`/
`user_period_stats`/`notifications`+`notification_deliveries`/`share_cards` **7개 데이터 유형
전부**를 실제로 생성한 뒤 `deleteAccount()`를 호출했다.

**실제 결과(전부 기대대로)**:

| 확인 항목 | 결과 |
|---|---|
| 삭제 전 세션 유효 | `true` |
| `deleteAccount()` 완료 | `true` |
| Orphan 개수 (profiles/user_numbers/dream_journal_entries/fortune_results/user_period_stats/notifications/share_cards) | 전부 `0` |
| `notification_deliveries` orphan | `0`(CASCADE 정상 동작) |
| 삭제 후 `auth.users` 존재 여부 | `false`(실제로 삭제됨) |
| 삭제 전 발급 access token으로 삭제 후 재확인 | `실패` — `"User from sub claim in JWT does not exist"` |
| 재가입(같은 kakao id) 시 새 UUID 생성 여부 | `true`(기존 UUID와 다름) |
| 재가입한 새 UUID에 기존 profile 자동 복원 여부 | `false`(복원 없음) |

## 25. Cross-user Test

§23에서 설명한 대로 B(보존)/C(삭제) 동시 존재 시나리오로 실제 DB에서 확인 — 결과 `true`
(B의 `profiles` 존재 + `user_numbers` 정확히 1건 그대로).

## 26. Admin Protection Test

temp admin 사용자(kakao id `999000002`, 운영자 실제 admin 계정과 무관)를 생성해 `admins`에
직접 행을 넣고 `deleteAccount()` 호출 — 결과: `AdminAccountProtectedError` 발생(`true`),
`admins` 행 보존(`true`), `auth.users` 보존(`true`) — **어떤 데이터도 삭제되지 않고 정확히
차단됨**을 실제 DB로 확인했다. 이후 별도 cleanup 절차(admins 행 삭제 → auth 사용자 직접 삭제)로
temp admin을 제거했다(`deleteAccount()`는 admin이라 다시 호출해도 계속 막히므로 사용하지 않음).

## 27. Public Data Preservation

`draws`(10건, 1236회까지)와 `dreams`/`dream_situations`/`content_entries` 등 공개 콘텐츠는
이번 Task의 어떤 코드 경로도 참조하지 않는다(§2 테이블 인벤토리로 스키마 레벨에서 이미 보장) —
실제 테스트 전후 `draws` count도 10건 그대로였다(§29 프로덕션 데이터 안전 스냅샷 참조).

## 28. Tests / Build

- 신규 유닛 테스트: `lib/api/account/deleteAccount.test.ts` 6건(admin 보호, admins 조회 오류
  전파, 정상 순서 검증, 자식 테이블 중간 실패 시 중단, auth 삭제 실패 시 오류, 재시도
  idempotency).
- 전체 테스트: **549/549 PASS**(기존 baseline 543 + 신규 6).
- Lint: PASS. Type-check: PASS. `npm run build`: PASS(`/api/account`, `/my/account` 라우트
  정상 생성 확인).
- 로컬 dev 서버로 회귀 라우트 재확인(§40 목록 전부): `/`, `/login`, `/fortune`, `/generate`,
  `/dream`, `/my/journal`, `/my/journal/results`(307), `/my/account`(307, 비로그인 시
  `/admin`과 동일하게 보호됨), `/admin`(307), `/admin/draws`(307), `/admin/dreams`(307),
  `/privacy`(200), `/terms`(200), `/sitemap.xml`(200) — 전부 기대한 상태 코드.

## 29. Migration

**0개 추가.** 기존 FK(`NO ACTION`)를 그대로 두고, 애플리케이션 코드가 올바른 순서로 명시적
DELETE를 실행하는 방식을 택했다(§11) — schema 변경이 필요하지 않았다. `supabase/migrations`는
여전히 0001~0019, 19개 파일 그대로다.

## 30. Production Data Safety

작업 전/후 스냅샷 비교(Supabase REST, service_role):

| 테이블 | 작업 전 | 작업 후 | 비고 |
|---|---|---|---|
| `draws` | 10 | 10 | 동일 |
| `profiles` | 1 | 1 | 동일(운영자 프로필) |
| `admins` | 1 | 1 | 동일(운영자 admin) |
| `user_numbers` | 21 | 21 | 동일 |
| `dream_journal_entries` | 0 | 0 | 동일 |
| `fortune_results` | 1 | 1 | 동일 |
| `notifications` | 0 | 0 | 동일 |
| `user_period_stats` | 0 | 0 | 동일 |
| `share_cards` | 0 | 0 | 동일 |

**운영자 실제 데이터는 전혀 변경되지 않았다.** 실제 DB 테스트에 사용한 모든 temp 사용자
(A, A 재가입, admin, B, C)는 테스트 스크립트 안에서 전부 생성·삭제까지 완결했고, 스크립트
자체도 실행 직후 삭제해 저장소에 남기지 않았다.

## 31. 남은 Launch Blockers

1. 회원탈퇴 기능 없음 — **이번 Task로 해결됨.**
2. 운영자/법적 정보 및 공개 연락처 미확정 — **미해결**(이번 Task 범위 아님).
3. 최종 custom domain + Kakao production redirect URI 미확정 — **미해결**(Phase10-7에서 임시
   도메인 기준으로만 등록됨, `PENDING_FINAL_DOMAIN`).
4. (신규 기록) 카카오 재가입의 **실제 브라우저 OAuth E2E**는 `PENDING_REAL_REJOIN_VERIFICATION`
   — Launch Blocker로 분류하지는 않았으나 운영자가 원하면 직접 재현 검증 가능.

## 32. 다음 작업 추천

운영자/법적 정보(사업자 정보, 공개 연락처)를 확정해 남은 Launch Blocker 2번을 해소하는 작업을
다음으로 추천합니다.

---

## TASK REPORT — Account Withdrawal

- **Account Settings Route**: `/my/account` (신규)
- **Withdrawal UI**: 설명 + 체크박스 확인 + "회원탈퇴" 버튼(2단계 확인)
- **Auth Required**: YES (`getCurrentUser()` 세션 재검증, proxy.ts `/my` 보호)
- **Admin Self-delete**: BLOCKED (`403 ADMIN_ACCOUNT_CANNOT_SELF_DELETE`, 실제 DB로 검증)
- **Client user_id Trusted**: NO (API가 request body를 아예 읽지 않음)
- **Profile Deleted**: YES (실측 확인)
- **User Numbers Deleted**: YES (실측 확인)
- **Fortune Results Deleted**: YES (실측 확인)
- **Dream Journal Deleted**: YES (실측 확인)
- **Notifications Deleted**: YES (notification_deliveries 포함, 실측 확인)
- **Public Content Preserved**: YES (draws/dreams 등 무관, 스키마 레벨 보장 + 실측)
- **Draws Preserved**: YES (10건 그대로)
- **Auth User Deleted**: YES (`admin.deleteUser`, 실측 확인)
- **Session Cleared**: YES (삭제 후 기존 access token 즉시 무효, 실측 확인 + `logout()` 쿠키 정리)
- **Same Provider Re-registration**: YES, 새 UUID로 생성(Admin API 레벨 실측) / 실제 브라우저
  카카오 OAuth E2E는 `PENDING_REAL_REJOIN_VERIFICATION`
- **Cross-user Protection**: YES (동시 존재 사용자 데이터 보존 실측 확인)
- **Privacy Updated**: YES (§3, §6 최소 수정)
- **Terms Updated**: NO (기존 문구와 충돌 없어 변경 불필요)
- **Migration**: 0개 추가(기존 FK 구조로 충분, 애플리케이션 레벨 순서 삭제)
- **Tests**: 549/549 PASS (기존 543 + 신규 6)
- **Build**: PASS
- **Production Operator Data Changed**: NO (전/후 스냅샷 완전 동일)
- **Account Withdrawal**: **PASS**
- **Remaining Launch Blockers**: (1) 운영자 법적/사업자 정보 없음, (2) 최종 도메인 미정으로
  Kakao redirect `PENDING_FINAL_DOMAIN`
- **다음 작업**: 운영자 법적/사업자 정보(연락처 포함)를 확정해 Launch Blocker를 추가로 해소한다
