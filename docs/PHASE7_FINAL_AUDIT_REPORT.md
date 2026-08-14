# Phase7-5 Final Audit — 꿈해몽

> 이 감사는 새 기능을 구현하지 않는다. Phase7-0~7-4가 이미 결정·검증한 사항(카테고리 taxonomy, `saveUserNumbers()` 확장 방식, 개인 기록 작성 경로 구조 등)은 재조사하지 않고 그대로 인용했다. 실제로 고친 것은 lint 경고 1건(§9)뿐이며, 그 외에는 전부 실측 검증만 수행했다.

---

## 1. 감사 범위

- Dream 콘텐츠 조회(`/dream`, `/dream/category/[category]`, `/dream/[keyword]`)
- Dream → Generate 연동(`/dream/[keyword]` → `/generate?dream=<id>` → 저장)
- Dream Journal 작성(`/dream/[keyword]` → `/my/journal/dreams/new` → 저장 → `/my/journal/dreams`)
- User A/B 개인 데이터 격리(실제 Supabase, 2개 테스트 계정)
- Phase7 범위 이탈 여부(통계/공유/커뮤니티/AI/외부 API/당첨확인 신규/관리자/멤버십)
- Phase5/6 회귀(번호 생성/저장, 관리자 API, 기존 다이어리 조회)
- 보안(user_id/ownerId 결정 방식, service_role 노출, RLS 우회)
- DB/Migration/RLS 계약 대조
- UX/SEO/접근성(h1, 404, EmptyState, noindex, metadata, 긴 텍스트, GNB/BottomNav)
- lint/type-check/test/build

Migration/RLS/`proxy.ts`/관리자 기능/`lib/api/dreams.ts`/`lib/api/numbers.ts`의 정상 동작 코드는 전혀 수정하지 않았다.

---

## 2. Phase7 요구사항 대비 구현 현황

`docs/EXECUTION_PLAN.md` Phase7의 **완료 기준 4개** 대조:

| 완료 기준 | 상태 |
|---|---|
| 시드 콘텐츠 20~30건 정상 렌더링 | **충족** — 실제 25건, `/dream`·`/dream/category/[category]`·`/dream/[keyword]` 전부 200 실측(§3) |
| 꿈별 추천번호 → 번호생성 자연 연결 | **충족** — `/dream/[keyword]` → `/generate?dream=<id>` → `generateNumbers()` → 저장 전 과정 실측(§3) |
| 개인 꿈 기록이 다이어리에 실제로 쌓임 | **충족** — `/my/journal/dreams/new` 저장 → `/my/journal/dreams` 즉시 반영 실측(§4) |
| **꿈해몽 페이지 SSG/ISR 적용** | **미충족** — `npm run build` 결과 `/dream`·`/dream/[keyword]`·`/dream/category/[category]` 전부 `ƒ`(Dynamic)로 표시됨(§9-1, Phase7-2에서 이미 발견되고 의도적으로 이월된 이슈, 이번 감사에서 재확인만 함) |

`구현 순서` 5단계 중 "내부링크(연관 꿈 키워드) 구현"도 실제 코드에 없음을 확인했다(§9-2) — 완료 기준에는 포함되지 않은 구현 순서 항목이라 완료 기준 충족 여부와는 별도로 기록한다.

**결론: 핵심 기능 3/4 충족, SSG/ISR 1건 미충족.** 이 미충족 항목은 기능 결함이 아니라 성능/캐싱 최적화이며, Phase7-2가 `lib/api/dreams.ts`를 범위 제한 대상으로 유지하며 의도적으로 이월한 것으로 이번 감사에서 새로 발견한 문제가 아니다.

---

## 3. Dream → Generate 흐름 검증

코드 검토(`lib/api/numbers.ts`, `app/api/numbers/route.ts`, `app/generate/page.tsx`, `components/generate/*`) + 실제 Supabase 재검증:

- `/dream/[keyword]`의 "이 꿈으로 번호 생성하기" → `/generate?dream=<id>` → 서버가 `getDreamById()`로 표시용 검증(실패해도 일반 생성으로 조용히 폴백) → `generateNumbers()`로 **항상 새로 생성**(꿈의 추천번호 `dream_number_mappings.numbers`를 그대로 읽어 저장하는 코드 경로 없음, `app/generate/page.tsx`가 `getDreamNumbers()`를 호출하지 않음을 재확인) → 로그인 사용자는 자동 저장.
- 실측: User A가 `numbers:[3,7,12,21,34,45]` + `generationMethod:"dream"` + `relatedDreamId:1`로 저장 → service_role 직접 조회로 `generation_method:'dream'`, `related_dream_id:1`, `numbers`가 요청 그대로 저장됨을 확인. 일반 저장(`numbers:[1,2,3,4,5,6]`, dream 없음)도 `generation_method:'auto'`, `related_dream_id:null`로 정상 저장.
- **화면에 보인 번호 = 저장된 번호**: 서버(`saveUserNumbers`)가 번호를 재생성하지 않고 클라이언트가 보낸 배열을 그대로 검증·저장하는 구조(Phase5 원칙 유지, Phase7이 이를 변경하지 않음)를 코드로 재확인.
- 관련 없는 회귀 없음: dream 쿼리파라미터 없는 일반 `/generate` 저장 경로도 동일 세션에서 함께 실측, 기존과 동일하게 동작.

---

## 4. Dream Journal 작성 흐름 검증

- `/dream/[keyword]`의 "이 꿈 기록하기" → `/my/journal/dreams/new?dream=<id>`(비로그인 시 `/login?next=%2Fmy%2Fjournal%2Fdreams%2Fnew`로 리다이렉트, 페이지 레벨 인증) → 저장 → `/my/journal/dreams`.
- 실측(실제 Supabase): `linkedDreamId=1`로 저장 → `linked_dream_id:1` 확인. dream 연결 없는 자유 기록(`/my/journal/dreams`에서 직접 진입 시나리오와 동일) → `linked_dream_id:null` 확인.
- 경계값: 2000자 저장 성공, 2001자 `400 VALIDATION_ERROR`(Phase7-4에서 이미 실측, 이번 세션에서 boundary 로직은 코드 재검토로 재확인, 실측은 Phase7-4 보고서 참조 — 동일 검증을 반복 실행하지 않음).
- 저장 직후 `/my/journal/dreams`에 반영: 실측으로 재확인(§5).

---

## 5. User A/B 데이터 격리 결과 (실제 Supabase)

Phase2/Phase7-3/Phase7-4가 이미 검증한 것과 동일한 방법(`establishKakaoSupabaseSession()` 재사용, 임시 `app/api/jtest/route.ts` 생성 후 검증 종료 즉시 삭제)으로 **이번 감사에서 새로 계정 2개를 만들어 dream_journal_entries + user_numbers를 함께 재검증**했다.

| 테스트 | 결과 |
|---|---|
| User A: 꿈 기록 저장(`linkedDreamId=1`) | `201`, `user_id`=A |
| User A: 꿈 연동 번호 저장(`relatedDreamId=1`) | `201`, `generation_method:'dream'`, `related_dream_id:1`, `user_id`=A |
| User A: 일반 번호 저장 | `201`, `generation_method:'auto'`, `user_id`=A |
| User B: 꿈 기록 저장 시 `user_id` 위조(body에 A의 uid) | `201` 성공했지만 **실제 저장된 `user_id`는 B**(service_role 직접 조회로 확인) |
| User B: 번호 저장 시 `user_id`/`ownerId`/`otherUserId` 위조(전부 A의 uid) | `201` 성공했지만 **실제 저장된 `user_id`는 B** |
| User B: `relatedDreamId=1`(A와 동일한 공개 꿈)로 저장 시도 | `201` 성공 — `dreams.id`는 공개 콘텐츠 참조이지 사용자 데이터가 아니므로 두 사용자가 같은 값을 공유해도 데이터 격리 위반이 아님(§6에서 근거 재확인) |
| User A `/my/journal/dreams` 렌더 | A 자신의 기록만 표시 |
| User B `/my/journal/dreams` 렌더 | B 자신의 기록만 표시, A의 기록 없음 |
| User A `/my/journal/history` 렌더 | `200` (본인 번호 목록만, service_role 직접 조회 결과와 대조해 개수 일치 확인) |
| User B `/my/journal/history` 렌더 | `200` (본인 번호 목록만) |

검증 종료 후 `dream_journal_entries`/`user_numbers`/`profiles`의 테스트 계정 관련 행과 Supabase Auth 사용자 2개를 전부 삭제하고, 세 테이블 모두 **잔여 0건**을 응답으로 직접 재확인했다. 임시 라우트(`app/api/jtest/route.ts`)도 삭제 완료(`git status`로 흔적 없음 확인).

**결론: User A/B 데이터 격리, 3개 위조 시나리오(journal user_id, numbers user_id/ownerId/otherUserId) 전부 정상 차단.**

---

## 6. 보안 감사 결과

코드 기준(전수 확인, `Grep`으로 재확인):

| 항목 | 확인 결과 |
|---|---|
| client input으로 `user_id` 결정 | **없음** — `parseDreamJournalInput`/`parseNumbersInput`/`parseDreamContext` 전부 `user_id` 필드를 아예 읽지 않음. 두 Route Handler 모두 `getCurrentUser()`가 반환한 세션의 `user.id`만 사용 |
| client input으로 `ownerId` 신뢰 | **없음** — 이 프로젝트 어디에도 `ownerId`라는 필드를 읽는 코드가 없음(§5 위조 시도로 실측 재확인) |
| `service_role`이 Client Component에 노출 | **없음** — `lib/supabase/service.ts`를 import하는 파일 9개(`proxy.ts`(주석에만 언급, 실제 import 아님), `lib/api/admin/draws.ts`, `lib/api/notifications.ts`, `lib/supabase/server.ts`(주석), `lib/auth/kakao.ts`, `lib/auth/profile.ts`, `lib/supabase/service.ts` 자신) 전수 확인, `"use client"` 파일(`components/journal/DreamJournalForm.tsx`, `components/generate/NumberGenerator.tsx` 등) 중 어느 것도 포함되지 않음 |
| Dream ID만으로 다른 사용자 개인 데이터 조회 가능 | **불가능** — `linked_dream_id`/`related_dream_id`는 `dreams.id`(공개 콘텐츠)만 가리킨다. `dream_journal_entries`/`user_numbers` 자체의 SELECT는 RLS(`auth.uid() = user_id`)로 걸려 있어, dream id를 안다고 타인의 journal/numbers 행을 조회할 경로가 없음(FK가 dreams→journal/numbers 방향이 아니라 journal/numbers→dreams 방향이라 구조적으로도 불가능) |
| `POST /api/journal/dreams`가 세션 사용자 기준 저장 | **확인**(§5 실측) |
| `POST /api/numbers`가 세션 사용자 기준 저장 | **확인**(§5 실측) |
| 기존 RLS 우회 접근 | **없음** — `lib/api/dreams.ts`/`lib/api/journal.ts`/`lib/api/numbers.ts` 전부 `lib/supabase/server.ts`(anon key+쿠키 세션)만 사용, `service_role`은 이번 감사의 임시 검증 라우트에서만 사용하고 삭제 완료 |

**Critical/High 결함 없음.**

---

## 7. DB/RLS/Migration 감사

Migration을 만들지 않고 기존 계약만 대조했다.

| 테이블/컬럼 | 실제 스키마 | 코드 계약과 일치 여부 |
|---|---|---|
| `dreams`/`dream_number_mappings` | `0003_dreams.sql`, 무수정 | 일치 — `lib/api/dreams.ts` 조회 전용, 쓰기 없음 |
| `dream_journal_entries`(`user_id`/`entry_date`/`dream_text`/`linked_dream_id`) | `0004_dream_journal_entries.sql`, 무수정 | 일치 — `createDreamJournalEntry()`의 INSERT payload가 실제 컬럼과 정확히 대응, `entry_date`(NOT NULL, DEFAULT 없음)를 서버가 UTC 기준으로 채움 |
| `user_numbers.related_dream_id`/`generation_method` | `0002_draws_user_numbers.sql`, 무수정. `related_dream_id`는 **FK 제약 없음**(애플리케이션 레벨 참조, 의도적 설계) | 일치 — `saveUserNumbers()`가 INSERT 전 `getDreamById()`로 존재 여부를 애플리케이션 레벨에서 검증해 FK 부재를 보완 |
| RLS: `dreams_select_public`/`dream_number_mappings_select_public` | `0008_rls_policies.sql` §5, 무수정 | 일치 — 비로그인 포함 전체 SELECT 허용 |
| RLS: `dream_journal_entries_*_own`(4개) | `0008_rls_policies.sql` §6, 무수정 | 일치 — 본인만 SELECT/INSERT/UPDATE/DELETE. Phase2에서 이미 anon key+2-JWT로 행동 검증 완료(`docs/PHASE2_RLS_REAL_USER_TEST_REPORT.md`), 이번 감사에서 실제 API 경로로 재확인(§5) |
| RLS: `user_numbers_*_own`(4개) | `0008_rls_policies.sql` §4, 무수정 | 일치 — 동일 |

**Migration/RLS 변경이 이번에도 필요하지 않았다는 Phase7-0의 판단이 Phase7-4 완료 시점까지 그대로 유효함을 재확인했다.**

---

## 8. UX/SEO/접근성 감사

실제 렌더링(dev 서버) 기준:

| 항목 | 결과 |
|---|---|
| h1 정확히 1개 | `/dream`, `/dream/[keyword]`, `/dream/category/[category]`, `/generate`, `/my/journal/dreams`, `/my/journal/dreams/new` 전부 `h1_count=1` 실측 |
| 404 처리 | 존재하지 않는 keyword → `404`(Next.js 기본, `notFound()`) 실측 |
| EmptyState | 코드 검토로 확인(`/my/journal/dreams` 빈 목록, `/dream/[keyword]` 추천번호 없음) — Phase7-4 실측에서 실제 EmptyState 렌더링(User B 빈 목록)도 함께 확인됨(§5) |
| 긴 꿈 내용 줄바꿈 | `whitespace-pre-wrap break-words`(Phase4 패턴 재사용) 코드 확인, Phase7-4에서 2000자 텍스트 실제 저장·렌더링까지 실측 완료 |
| dynamic metadata | `/dream/돼지꿈` → `<title>돼지꿈 해몽</title>` 실측, `/dream/category/동물` → "동물 꿈해몽"(Phase7-2 실측 재인용) |
| noindex 정책 | `/my/journal/dreams/new` → `noindex, nofollow` 실측 확인(`docs/SITEMAP.md` §4 `/my/journal/*` 정책과 일치). `/dream/*`는 noindex 없음(공개 SEO 콘텐츠, 정책과 일치) |
| CTA | `/dream/[keyword]`에 "이 꿈으로 번호 생성하기"(`href="/generate?dream=1"`)와 "이 꿈 기록하기"(`href="/my/journal/dreams/new?dream=1"`) 둘 다 실측 확인, 버튼 텍스트가 곧 접근 가능한 이름(별도 `aria-label` 불필요) |
| 모바일 레이아웃 | 실제 브라우저/헤드리스 도구 부재로 시각적 확인 불가(Phase7-2와 동일한 한계) — 반응형 클래스(`Container`, `grid-cols-1 sm:grid-cols-2`) 코드 검토로만 확인 |
| GNB/BottomNavigation 일관성 | `GlobalNav.tsx`에 "꿈해몽→/dream" 존재. `BottomNavigation.tsx`는 4탭(홈/번호생성/운세/다이어리)으로 Phase3에서 이미 확정, "꿈해몽"을 탭에 넣지 않는 것은 기존 IA 결정이지 Phase7이 만든 불일치가 아님 |
| `/generate`↔`/dream` CTA 흐름 | 양방향 자연스러움 확인: `/dream/[keyword]`→`/generate?dream=<id>`(번호 생성), `/dream/[keyword]`→`/my/journal/dreams/new?dream=<id>`(기록) |
| 새 색상 토큰 | 추가되지 않음(전수 grep 확인, 기존 `text-h1`/`bg-primary`/`Card`/`Badge`/`EmptyState`만 사용) |

---

## 9. 발견된 문제

### 9-1. `/dream/*`가 SSG/ISR이 아니라 완전 동적 렌더링 (Phase7-2에서 이미 발견, 이번 감사에서 재확인만 함)

`npm run build` 결과 `/dream`, `/dream/[keyword]`, `/dream/category/[category]` 전부 `ƒ`(Dynamic)로 표시된다. 원인은 Phase7-2가 이미 규명한 그대로다: `lib/api/dreams.ts`가 쓰는 `lib/supabase/server.ts`의 `createClient()`가 항상 `next/headers`의 `cookies()`를 호출해, 인증이 필요 없는 완전 공개 페이지도 동적 렌더링으로 강제 전환된다. `EXECUTION_PLAN.md` Phase7의 4개 완료 기준 중 하나에 해당하는 항목이라(§2), 이 감사에서 다시 확인했다.

**이번 감사에서 고치지 않았다.** 이유: (1) 기능/보안 결함이 아니라 성능 최적화 항목이다(페이지는 정상 동작하고 검색엔진 색인도 막히지 않는다 — Phase7-2가 이미 이렇게 판단했고 재검토해도 같은 결론이다). (2) 해결하려면 `lib/api/dreams.ts`가 쿠키 없는 별도 공개 전용 Supabase 클라이언트를 쓰도록 바꿔야 하는데, 이는 "정상 동작하는 코드를 감사 중에 고치지 않는다"(§9 지시)는 이번 Task의 원칙과 "이미 결정된 사항을 다시 결정하지 않는다"는 반복 원칙에 부합하지 않는 리팩터링이다. 후속 Phase(또는 명시적 성능 개선 Task)에서 `lib/supabase/server.ts`와 별개로 공개 전용 클라이언트를 도입하는 결정이 필요하다.

### 9-2. "내부링크(연관 꿈 키워드)" 미구현 (신규 발견, `EXECUTION_PLAN.md` 구현순서 5번 항목)

`app/dream/[keyword]/page.tsx`에 관련/연관 꿈 키워드로 이동하는 내부링크가 없다(`Grep`으로 확인). `EXECUTION_PLAN.md` Phase7의 "완료 기준" 4개에는 포함되지 않은 "구현 순서" 항목이라 §2의 완료 기준 충족 여부에는 영향이 없지만, Phase7의 "왜 지금"(`꿈해몽은 SEO 최우선 콘텐츠 클러스터`) 근거와 직접 관련된 SEO 내부링크 구조라 기록해둔다. 이번 감사에서 구현하지 않았다(§9 "새 기능 추가 금지" 원칙).

### 9-3. lint 경고 1건 (발견 즉시 최소 수정함)

`lib/api/journal.test.ts`의 `mockInsertResult` 헬�/파일에서 `insert.mock.calls[0][0]` 접근을 위해 Phase7-4가 추가한 파라미터 타입 주석이 `@typescript-eslint/no-unused-vars` 경고를 유발했다(`_payload` 언더스코어 접두사가 이 프로젝트 eslint 설정에서 무시되지 않음). `vi.fn<(payload: ...) => ReturnType>(...)` 제네릭 표기로 바꿔 실제 파라미터 없이 타입만 지정하는 방식으로 수정 — 테스트 동작/커버리지 변화 없음, `npm run lint` 경고 0건 재확인.

이 외 새로 발견된 Critical/High/Medium 결함은 없다.

---

## 10. Phase5/6 회귀 테스트

실제 HTTP + 기존 테스트 병행:

| 항목 | 결과 |
|---|---|
| `/generate` 일반 진입(dream 쿼리 없음) | `200`, h1=1, 실측 |
| 번호 생성 + 로그인 사용자 자동 저장(dream 없음) | `201`, `generation_method:'auto'`, `related_dream_id:null` 실측(§3/§5) |
| `POST /api/numbers`(기존 `{numbers}`만 보내는 요청) | 정상 동작, 스키마 변화 없음 |
| Phase6 관리자 인증(`isAdmin()`) | 비로그인 → `401`, 로그인했지만 비관리자 → `403` 실측(정상 차단, 회귀 없음) |
| `POST /api/admin/draws` | 비로그인/비관리자 차단 실측, Phase7이 이 파일을 전혀 건드리지 않음(`git status`/mtime 확인) |
| 기존 `/my/journal` 조회(`getRecentDreamJournalEntries`/`getRecentUserNumbers`/`getRecentFortuneResults`/`getDiarySummary`) | 기존 테스트 전부 무수정 통과, 실측으로도 정상 렌더링 확인 |
| `lib/api/numbers.ts`의 기존 `parseNumbersInput`/`canAutoSave`/`toSaveKey`/`saveUserNumbers`(auto 경로) | 테스트 무수정 통과(Phase7-3이 이미 확인, 이번 감사에서 `npm test` 재실행으로 재확인) |

**회귀 없음.**

---

## 11. 범위 이탈 여부

`app/dream/**`, `app/api/journal/**`, `components/journal/**`, `components/dream/**`, `lib/api/dreams.ts`, `lib/api/journal.ts`, `lib/api/numbers.ts`(Phase7 관련 확장분)를 대상으로 다음 키워드를 grep했다: `share`/`공유`/`커뮤니티`/`community`/`통계`/`stats`/`membership`/`멤버십`/`subscription`/`구독`/`admin`/`isAdmin`.

**전부 0건.** 관리자 기능(`isAdmin`, `/api/admin/*`)은 Phase6 파일에만 존재하고 Phase7 파일 어디에서도 참조되지 않는다. 외부 로또 API 연동, AI 추천, 꿈 기반 번호 자체의 알고리즘(추천번호를 그대로 쓰는 로직)도 존재하지 않는다 — `/generate`는 항상 `generateNumbers()`(순수 랜덤)로 새로 생성하고, 꿈은 표시/연결(`related_dream_id`) 정보로만 쓰인다. 당첨확인 기능의 신규 구현도 없다(`checked_at`/`win_rank`/`match_count` 컬럼을 Phase7 코드가 전혀 참조하지 않음, §7).

새로운 migration/RLS 변경도 없다(§7).

**범위 이탈 없음.**

---

## 12. Critical / High / Medium / Low

| 등급 | 건수 | 내용 |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 1 | §9-1: `/dream/*` SSG/ISR 미적용(EXECUTION_PLAN 완료 기준 1건 미충족, 기능/보안 영향 없음) |
| Low | 1 | §9-2: 연관 꿈 키워드 내부링크 미구현(완료 기준 아님, SEO 개선 여지) |

lint 경고 1건(§9-3)은 이번 감사 중 발견 즉시 수정 완료해 최종 목록에서 제외했다.

---

## 13. Known Issues와 Phase7의 관계

| 이슈 | 분류 |
|---|---|
| `/generate` vs `/generate/auto` 문서 불일치 | **4. 이미 해결됨** — 실제 코드는 Phase5-0부터 `/generate`로 일관, Phase7도 동일 경로만 확장(새 라우트 생성 없음). 문서(`SITEMAP.md`) 갱신은 남아있으나 코드 동작 자체는 확정 |
| `proxy.ts` vs Architecture Decision 문서 불일치 | **2. Phase7 무관** — Phase2/4에서 이미 식별된 기존 불일치, Phase7은 `/dream/*`(애초에 보호 대상 아님)와 `/my/journal/*`(기존 `PUBLIC_EXCEPTIONS` 그대로 재사용)만 다뤄 새로운 불일치를 만들지 않음, `proxy.ts` 무수정 |
| `color-danger`/`color-success` WCAG | **2. Phase7 무관** — 꿈해몽 콘텐츠 화면 어디에도 당첨/미당첨 이분법 표시가 없음(Phase7-0/7-2 판단 유지) |
| 번호 구간별 5색 미구현 | **2. Phase7 무관** — 추천번호 표시는 기존 `/generate` 번호 볼 스타일 재사용, 새 색상 요구 없음 |
| Fortune 기능 Phase 미배정 | **2. Phase7 무관** — Phase7 코드가 `fortune_results`를 전혀 참조하지 않음 |
| 카카오 공유 Phase 미배정 | **2. Phase7 무관** — Phase7 어떤 파일에도 공유 기능 없음(§11) |
| `user_numbers` 판정 컬럼(`checked_at`/`win_rank`/`match_count`) 위조 가능성 | **3. 후속 Phase에서 해결** — Phase7이 INSERT 시점에 쓰는 컬럼(`related_dream_id`/`generation_method`)과 무관, 이 컬럼들에 대한 쓰기 제어 강화는 별도 보안 하드닝 Task 필요 |
| `admin_audit_logs` 미구현 | **3. 후속 Phase에서 해결** — Phase6-4-1에서 이미 Phase9로 이월 확정, Phase7과 무관 |
| Case C 완전 원자성(RPC 필요 여부) | **2. Phase7 무관** — Phase6 관리자 배치 로직, Phase7 접점 없음 |

Phase7이 새로 만든 항목은 §9-1(SSG/ISR)과 §9-2(내부링크)뿐이며, 둘 다 Phase7-2에서 이미 식별했거나(9-1) 이번 감사에서 새로 발견(9-2)한 것으로, 위 9개 기존 Known Issues 목록과는 별개다.

---

## 14. lint/type-check/test/build 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | **통과, 경고 0건**(§9-3 수정 후) |
| `npm run type-check` | 통과 |
| `npm test` | 통과 — 12 test files, **168 tests** 전부 통과 |
| `npm run build` | 통과, 21개 라우트(`/dream`, `/dream/[keyword]`, `/dream/category/[category]`, `/api/journal/dreams`, `/my/journal/dreams/new` 포함) 정상, 임시 감사 라우트(`/api/jtest`) 잔존 없음(`git status` 확인) |

기존 테스트를 수정해서 통과시킨 사례는 없다 — §9-3의 1건은 새 기능 코드가 아니라 테스트 파일 자체의 타입 경고를 해결한 것이며, 검증 로직/단언(assertion)은 전혀 바꾸지 않았다.

---

## 15. 실제 Supabase 검증 결과

§3~§6에서 서술한 내용을 종합하면:

- 테스트 계정 2개(User A/B)로 dream_journal_entries + user_numbers 양쪽 모두 실제 저장/조회/격리를 실측했다(Phase7-3/7-4가 각각 개별로 검증한 것을 이번 감사에서 두 흐름을 한 세션에서 함께 재확인).
- `user_id`/`ownerId`/`otherUserId` 위조 시도 3건 전부 무시되고 실제 세션 사용자로 저장됨을 service_role 직접 조회로 확인했다.
- 검증 종료 후 `dream_journal_entries`/`user_numbers`/`profiles` 전부 **잔여 0건** 확인, 테스트 Auth 계정 2개 삭제 확인, 임시 라우트(`app/api/jtest/route.ts`) 삭제 확인(`git status`로 흔적 없음 재확인).

---

## 16. Phase7 최종 판정

### CONDITIONAL PASS

Critical/High 결함이 없고 Phase7 핵심 흐름(콘텐츠 조회, 꿈→번호 생성 연동, 꿈→개인 기록 작성, User A/B 데이터 격리) 전부가 실제 Supabase 환경에서 정상 동작함을 실측으로 확인했다. 다만 `EXECUTION_PLAN.md`가 Phase7의 명시적 완료 기준으로 못박은 4개 항목 중 "꿈해몽 페이지 SSG/ISR 적용" 1건이 아직 충족되지 않았고(§9-1), 이를 해결하려면 이번 감사 범위를 넘어서는 코드 변경(`lib/api/dreams.ts`의 공개 전용 클라이언트 분리)이 필요해 BLOCKED이 아니라 CONDITIONAL PASS로 판정한다 — 기능/보안/데이터 무결성 문제가 아니라 성능 최적화가 남은 상태이기 때문이다.

### PASS 대신 CONDITIONAL PASS를 선택한 근거

- PASS 기준("Critical/High 없음 + Phase7 핵심 흐름 정상")은 충족한다.
- 그러나 EXECUTION_PLAN이 정의한 완료 기준을 100% 충족하지 못한 상태에서 "완전히 끝났다"고 선언하면, 이후 SSG/ISR 전환 시점에 `lib/api/dreams.ts`를 다시 열어야 한다는 사실이 감사 보고서에만 남고 프로젝트 상태에는 반영되지 않는 위험이 있다. CONDITIONAL PASS로 명시해 "기술 부채가 남아있다"는 사실을 다음 단계로 이월한다.

---

## 17. Phase8 착수 가능 여부

**가능하다.** Phase8이 SSG/ISR 미적용 상태에 의존하지 않는 한(즉 Phase7 콘텐츠의 "동적 렌더링" 자체가 Phase8의 전제조건을 깨지 않는 한) 착수를 막을 이유가 없다. Phase7의 데이터 계약(`dream_journal_entries`, `user_numbers.related_dream_id`/`generation_method`)이 안정적으로 확정됐고, RLS/보안도 실측으로 재확인됐다.

---

## 18. 다음 단계 권장안

1. **(선택, 성능)** `lib/api/dreams.ts` 전용 공개 Supabase 클라이언트(쿠키 미사용) 도입 후 `/dream/*` 3개 라우트를 SSG/ISR로 전환 — 별도 Task로 분리 권장(이번 Task 범위 밖 리팩터링이라 지금 하지 않음).
2. **(선택, SEO)** 연관 꿈 키워드 내부링크(`EXECUTION_PLAN.md` 구현순서 5번) — 콘텐츠 SEO 클러스터 강화 목적, 우선순위는 제품 판단 필요.
3. Known Issues 목록의 "후속 Phase에서 해결" 2건(`user_numbers` 판정 컬럼 위조 가능성, `admin_audit_logs` 미구현)은 Phase7과 무관하게 이미 이월 확정된 사항으로 그대로 유지.

---

## TASK REPORT

1. **감사 범위**: Phase7-0~7-4 전체(콘텐츠 조회/생성 연동/개인 기록 작성/데이터 격리/보안/DB/UX/SEO), 실제 Supabase 2-계정 검증 포함.
2. **Phase7 요구사항 대비 구현 현황**: 완료 기준 4개 중 3개 충족, SSG/ISR 1건 미충족(§2/§9-1).
3. **Dream → Generate 흐름**: 정상, 꿈 추천번호를 그대로 저장하지 않고 `generateNumbers()`로 항상 재생성함을 재확인(§3).
4. **Dream Journal 작성 흐름**: 정상, dream 연결/자유 기록 둘 다 실측(§4).
5. **User A/B 데이터 격리**: dream_journal_entries + user_numbers 양쪽 모두 실측 PASS, 위조 시도 3건 전부 차단, 테스트 데이터 전량 삭제 후 잔여 0건 확인(§5).
6. **Phase5/6 회귀**: 없음(§10).
7. **테스트/Validation**: lint 통과(경고 0건)/type-check 통과/test 168/168 통과/build 통과(§14).
8. **발견된 문제**: SSG/ISR 미적용(Medium, 재확인), 연관 꿈 내부링크 미구현(Low, 신규 발견), lint 경고 1건(즉시 수정 완료)(§9).
9. **Phase7-5 판정**: **CONDITIONAL PASS**(§16) — Critical/High 없음, 핵심 흐름 전부 정상, EXECUTION_PLAN 완료 기준 1건(SSG/ISR)만 미충족.
10. **Phase8 착수 가능 여부**: 가능(§17).
