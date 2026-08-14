# PHASE4 PRE-IMPLEMENTATION AUDIT

> Phase4 착수 전 사전 분석 문서다. **코드/Schema/RLS/컴포넌트를 전혀 생성·수정하지 않았다** — 아래 내용은 전부 실제 문서 원문, 실제 마이그레이션 SQL, 실제 코드(`app/`, `components/`, `lib/`, `proxy.ts`)를 직접 읽고 교차검증한 결과다. "있을 것이다"로 서술한 항목은 없으며, 존재를 주장하는 모든 파일/컬럼/정책은 이 Task에서 직접 열어 확인했다.

---

## 1. Executive Summary

1. **Phase4의 정체는 명확하다 — "행운 다이어리(틀)"다.** [[EXECUTION_PLAN]]이 이 프로젝트가 실제로 따라온 유일한 세분화 로드맵이며(Phase0 설정→Phase1 DB→Phase2 인증→Phase3 UI가 정확히 이미 완료된 순서와 일치), 그 Phase4는 "행운 다이어리(틀)" — 번호생성(Phase5)도 운세도 아니다. 그런데 [[ROADMAP]]은 완전히 다른 상위 단위 번호 체계를 쓰며 그 "Phase 4"는 **커뮤니티**를 가리킨다 — 이는 실제 구현 순서와 무관한 별개 로드맵이라 지금 당장 혼동을 일으키지는 않지만, 문서 간 명백한 충돌이므로 §10에 기록했다.
2. **DB/RLS/라우팅 인프라는 Phase4가 필요로 하는 만큼 이미 준비되어 있다.** `user_numbers`(0002)·`dream_journal_entries`(0004)·`fortune_results`(0005)·`user_period_stats`(0005) 전부 테이블·RLS·인덱스까지 실제 마이그레이션으로 존재하며 컬럼도 Phase4가 표시해야 할 정보(히스토리/당첨확인/캘린더 골격/꿈기록/운세이력)를 충분히 담는다. `proxy.ts`도 `/my` 접두사 전체를 이미 보호하고 있어 Phase4가 새 보호 경로를 추가로 등록할 필요가 없다.
3. **그러나 구조적으로 반드시 먼저 결정해야 할 충돌을 하나 발견했다(Critical).** [[INFORMATION_ARCHITECTURE]] §1.2와 [[EXECUTION_PLAN]] Phase4 완료 기준은 "비로그인 상태로 다이어리 진입 시 **가치설명 화면**을 보여준다(단순 리다이렉트 아님)"를 명시하는데, 실제 `proxy.ts`는 `/my/*` 전체를 예외 없이 `/login`으로 즉시 리다이렉트한다. 이 상태로는 다이어리 홈(`/my/journal`)이 비로그인 사용자에게 절대 렌더링될 수 없다 — Phase4가 시작되자마자 이 요구사항을 만족시키려면 `proxy.ts`(Auth 레이어) 변경이 필요하고, 이는 이번 Task 범위(Auth 수정 금지) 밖의 결정이다. **Phase4 착수 전 반드시 승인이 필요하다.**
4. **Fortune(운세) 기능은 여전히 어느 Phase에도 배정되어 있지 않다(High, 기존에 이미 발견된 사안 재확인).** [[PHASE3_UI_ARCHITECTURE_PLAN]] §7-2가 이미 지적했고 지금도 그대로다 — DB(`fortune_results`)는 있지만 `/fortune` 페이지를 만드는 EXECUTION_PLAN Phase가 없다. Phase4(다이어리 틀)의 `fortune-history` 페이지는 "골격"만 요구하므로 Phase4 자체는 이 공백에 막히지 않지만, 승인 없이 이 공백을 메우지 않았다.
5. **Phase3 잔여 사항 중 하나(`color-danger`/`color-success` WCAG 문제)가 Phase4에서 처음으로 실제 노출된다.** 지금까지는 `/ui-preview`에서만 보이던 잠재적 결함이었지만, Phase4의 "당첨확인 결과 카드"가 당첨/미당첨을 `Badge`(success/danger variant)로 표시하는 순간 실제 사용자에게 노출된다 — Phase4 착수 전 결정을 권장한다(High).
6. **결론: CONDITIONAL READY.** 코드 골격을 만들기 시작하는 것 자체는 막혀 있지 않지만, §15에 나열한 항목(특히 proxy.ts/가치설명 화면 충돌)을 먼저 결정하지 않으면 Phase4 도중 라우팅 구조를 다시 손대야 하는 재작업이 발생할 가능성이 높다.

---

## 2. Phase4 목표

| 항목 | 내용 |
|---|---|
| Phase4 목표 | [[EXECUTION_PLAN]] Phase4 — "다이어리의 DB 조회 함수·API·화면(빈 상태 포함)을 완성해, Phase5부터는 실제 데이터가 여기 흘러들어오기만 하면 되는 상태를 만든다." 번호생성·운세 기능 자체는 만들지 않는다 |
| 사용자 가치 | [[ROADMAP]] §0 원칙 1 "행운 다이어리가 핵심이지, 번호 생성이 핵심이 아니다" — 그릇(다이어리)을 먼저 완성해 Phase5(번호생성)·Phase6(당첨확인)·Phase7(꿈해몽)이 "이 데이터를 어디에 꽂을지" 매번 고민하지 않게 한다([[EXECUTION_PLAN]] Phase4 "왜 지금") |
| 구현해야 할 페이지 | `app/(my/journal 계열)`: 다이어리 홈, 히스토리, 당첨확인, 캘린더(골격), 꿈기록(골격), 운세이력(골격) — 전부 [[SITEMAP]] §1의 실제 경로 |
| 구현해야 할 기능 | 다이어리 홈 요약 카드(빈 상태 EmptyState), 히스토리 목록 UI 틀, 당첨확인 결과 카드 틀, 비로그인 시 가치설명 화면. **실제 번호 생성/운세 계산/당첨 대조 로직은 이 Phase 범위가 아니다** — `lib/api/journal.ts` 함수는 지금은 빈 배열/널을 반환하도록 설계 |
| 필요한 DB 테이블 | `user_numbers`(0002, 이미 존재)·`dream_journal_entries`(0004, 이미 존재)·`fortune_results`(0005, 이미 존재)·`user_period_stats`(0005, 이미 존재). **Phase4에서 새 테이블/컬럼을 만들 필요가 없다** — 전부 Phase1에서 이미 생성됨 |
| 필요한 API | `lib/api/journal.ts`(`getHistory()`/`getResults()`/`getSummary()` 등, 지금은 빈 값 반환), `app/api/journal/summary/route.ts`(선택) — **신규 작성 필요, 현재 存在하지 않음**(실제 확인, `app/api/`에는 `auth/*`·`profile/route.ts`뿐) |
| 필요한 인증 상태 | 로그인 필수(비로그인은 가치설명 화면). `getCurrentUser()`(`lib/auth/session.ts`)로 충분하며 `getProfile()`(`lib/auth/profile.ts`)까지는 필요 없어 보인다(다이어리 진입에 온보딩 완료까지 강제할지는 결정 필요, §5) |
| 필요한 UI 컴포넌트 | 기존 재사용: `Card`/`EmptyState`/`Badge`/`Button`/`Container`/`Main`/`PageShell`(전부 Phase3에서 이미 구현·검증됨). 신규 필요: `components/journal/JournalSummaryCard.tsx`, `NumberHistoryList.tsx`, `ResultCard.tsx`(§9 상세) |
| 필요한 route | `/my/journal`, `/my/journal/history`, `/my/journal/results`, `/my/journal/calendar`, `/my/journal/dreams`, `/my/journal/fortune-history` — 전부 [[SITEMAP]] §1에 이미 정의되어 있고 실제 코드에는 아직 하나도 존재하지 않음(Glob으로 `app/` 실제 확인, `my` 폴더 자체가 없음) |
| 필요한 RLS | **신규 RLS 불필요.** 대상 테이블 4종 모두 `0008_rls_policies.sql`에서 이미 "본인만 SELECT" 정책이 활성화되어 있음(§8) |
| 완료 조건 | [[EXECUTION_PLAN]] Phase4 §6: 로그인 후 다이어리 진입 시 에러 없이 빈 상태 정상 표시 / `lib/api/journal.ts` 함수가 실제 DB(Phase1 테이블)를 조회하도록 연결(지금은 빈 값) / 비로그인 시 가치설명 화면 노출 |

**Fortune/번호생성 여부 재확인**: [[EXECUTION_PLAN]] Phase0~10 전체를 원문 대조한 결과 Phase4는 "행운 다이어리(틀)"이고, 번호생성은 Phase5, 당첨확인은 Phase6, 꿈해몽은 Phase7이다. **운세(`/fortune` 자체 입력·계산 페이지)는 Phase0~10 어디에도 명시적으로 배정되어 있지 않다** — Phase4가 만드는 것은 `/my/journal/fortune-history`(운세 **이력** 조회, 골격만)이지 `/fortune`(운세를 실제로 보는 화면) 자체가 아니다. 이 둘은 다른 페이지다.

---

## 3. 현재 구현 상태

### `app/` (Glob으로 직접 확인, 10개 파일)
```
app/api/profile/route.ts
app/api/auth/kakao/{login,callback}/route.ts
app/api/auth/logout/route.ts
app/onboarding/{page.tsx, OnboardingForm.tsx}
app/login/page.tsx
app/ui-preview/page.tsx        ← 개발 전용, noindex
app/page.tsx, app/layout.tsx
```
`app/my/*`, `app/generate/`, `app/dream/`, `app/fortune/` 등은 **전혀 존재하지 않는다.** `(protected)` route group 폴더도 없다(계획은 있었으나 실제로 만들어진 적 없음, §10-3).

### `components/` (Glob으로 직접 확인, 17개 파일)
```
components/layout/{Container,Footer,Header,Main,PageShell}.tsx
components/navigation/{BottomNavigation,GlobalNav}.tsx
components/auth/{LoginButton,LogoutButton,ProfileMenu}.tsx
components/ui/{Badge,Button,Card,EmptyState,Input,Label,Spinner,Textarea}.tsx
```
`components/journal/`, `components/lotto/`, `components/dream/`, `components/fortune/`는 **존재하지 않는다.**

### `lib/` (Glob으로 직접 확인)
```
lib/auth/{kakao,logout,profile,session,index}.ts (+2 test)
lib/supabase/{client,server,service}.ts
lib/constants/index.ts, lib/types/{database,index}.ts, lib/utils/{env,index}.ts (+1 test)
```
`lib/api/`(journal.ts 등), `lib/logic/`(generateNumbers.ts 등)는 **존재하지 않는다** — Phase4/5가 처음 만드는 대상이다.

### `supabase/migrations/` (12개 파일, 실제 SQL 원문 확인)
`0001_profiles` → `0002_draws_user_numbers` → `0003_dreams` → `0004_dream_journal_entries` → `0005_fortune_results_user_period_stats` → `0006_notifications` → `0007_winning_cases_stores` → `0008_rls_policies` → `0009_share_cards_storage` → `0010_seed_data` → `0011_profiles_auth_protection` → `0013_profiles_status_default`. **`0012`는 존재하지 않는다** — [[EXECUTION_PLAN]] Phase9가 `0012_admin_flag.sql`로 예약해둔 번호이며, 아직 Phase9가 시작되지 않아 비어 있는 것이 정상이다(결번 아님, 예약 상태).

`lib/types/database.ts`에 위 마이그레이션이 생성한 14개 테이블 전부가 타입으로 존재함을 확인했다(`grep`으로 테이블명 14개 전수 대조).

---

## 4. Phase4 요구사항 vs 현재 상태

| [[EXECUTION_PLAN]] Phase4 파일 목록 | 현재 상태 | 비고 |
|---|---|---|
| `lib/api/journal.ts` | **없음** | 신규 작성 대상 |
| `app/api/journal/summary/route.ts` | **없음** | 선택 사항으로 명시되어 있음 |
| `components/journal/JournalSummaryCard.tsx` 등 3종 | **없음** | 신규 작성 대상, §9 |
| `app/(journal)/my/journal/page.tsx` 등 페이지 6종 | **없음** | 신규 작성 대상 |
| `app/(journal)/layout.tsx` | **없음** | §10-3의 route group 결정과 연동 |
| `lib/types/journal.ts` | **없음** | 신규 작성 대상 |
| `lib/api/journal.test.ts` | **없음** | 신규 작성 대상 |
| `components/layout/BottomTabBar.tsx`("다이어리" 탭 연결) | **이미 존재하고 이미 연결되어 있음** — `components/navigation/BottomNavigation.tsx`가 "다이어리" 탭에서 `/my/journal`로 링크(Phase3-6에서 이미 구현) | 문서의 "수정할 파일" 항목이 이미 선행 완료된 상태 — Phase4가 다시 손댈 필요 없음 |
| `components/navigation/GlobalNav.tsx`("다이어리" 메뉴) | **이미 존재하고 이미 연결되어 있음**(Phase3-7) | 상동 |

**결론**: Phase4가 실제로 새로 만들어야 하는 것은 DB/RLS/네비게이션이 아니라 **API 함수 계층 + 페이지 + journal 전용 컴포넌트 3종뿐**이다 — 이는 Phase4 착수 리스크가 낮다는 신호다(§15).

---

## 5. Routing 검증

- **SITEMAP 존재 여부**: Phase4가 필요로 하는 6개 경로(`/my/journal`, `/history`, `/results`, `/calendar`, `/dreams`, `/fortune-history`) 전부 [[SITEMAP]] §1에 이미 정의되어 있다. 신규 URL 설계가 필요 없다.
- **proxy.ts 보호 여부**: `proxy.ts` 실제 코드(`PROTECTED_PATHS = ["/onboarding", "/my"]`, `matchesPath()`가 `/my`로 시작하는 모든 경로를 매칭)를 확인했다 — 위 6개 경로 전부 이미 보호 대상이다. **Phase4는 `proxy.ts`의 `PROTECTED_PATHS` 배열을 수정할 필요가 없다.**
- **`/my/*` 구조 일치 여부**: [[PHASE3_UI_ARCHITECTURE_PLAN]] §7-1이 지적했던 "`proxy.ts`가 `/mypage`·`/dream-journal`·`/notifications`라는 실재하지 않는 경로를 보호하던" 문제는 **이미 해결되어 있다**(현재 `proxy.ts` 주석이 [[PHASE3_PROXY_ROUTE_FIX_REPORT]]를 직접 인용하며 `/my` 접두사로 통일했음을 명시, 실제 코드로도 확인). Phase4 착수 전 별도 조치 불필요.
- **기존 route와 충돌 여부**: `/my/journal*`은 현재 코드의 어떤 기존 경로(`/login`, `/onboarding`, `/ui-preview`, `/api/*`)와도 겹치지 않는다.
- **⚠️ Critical — 리다이렉트 방식과 가치설명 화면 요구사항의 충돌**: `proxy.ts`는 `/my`로 시작하는 모든 요청에 대해 비로그인이면 **무조건** `/login?next=...`로 307 리다이렉트한다(예외 없음, 실제 코드 확인). 그런데 [[INFORMATION_ARCHITECTURE]] §1.2는 "비로그인 상태에서 '다이어리' 탭 클릭 시 빈 화면 대신... 안내 화면 + 로그인 CTA 노출(**단순 리다이렉트보다 가치 설명 우선**)"이라고 명시하며, [[EXECUTION_PLAN]] Phase4 완료 기준도 "비로그인 시 가치설명 화면 노출"을 요구한다. **현재 구조에서는 비로그인 사용자가 `/my/journal`에 요청을 보내는 순간 `proxy.ts`가 페이지 컴포넌트를 실행하기도 전에 `/login`으로 보내버리므로, 어떤 "가치설명 화면"도 렌더링될 기회 자체가 없다.** 이는 추측이 아니라 `proxy.ts`의 실제 리다이렉트 로직(37~61행)을 직접 읽고 확인한 사실이다. §11/§15에서 Critical로 재기록한다.
- **`next` 파라미터 왕복 미구현(재확인, Phase2 잔여)**: [[PHASE2_COMPLETION_REPORT]] §5가 이미 "OAuth 콜백이 `next` 값을 왕복시키지 않아 로그인 후 항상 `/`로만 이동한다"를 기록했다. Phase4에서 다이어리 안쪽 링크(예: `/my/journal/history`)에 비로그인 상태로 직접 접근했다가 로그인하면, 원래 보려던 페이지가 아니라 홈으로 이동한다 — Phase2 때는 영향이 적었지만(보호 대상 페이지가 `/onboarding`뿐이었음), Phase4부터 보호 대상 콘텐츠 페이지가 실제로 생기면 사용자 경험에 처음으로 영향을 준다. Medium.

---

## 6. Authentication 검증

- `getCurrentUser()`(`lib/auth/session.ts`) — 매 요청 `supabase.auth.getUser()`로 재검증. Phase4 페이지가 로그인 여부만 확인하면 되는 경우 그대로 재사용 가능.
- `getProfile()`/`profileExists()`(`lib/auth/profile.ts`) — service_role 기반. `Header.tsx`가 이미 이 패턴(Server Component에서 `getCurrentUser()` → `getProfile()` 순차 호출)을 쓰고 있어 Phase4 페이지도 동일 패턴을 그대로 재사용할 수 있다. **새 인증 헬퍼를 만들 필요가 없다.**
- `logout()`(`lib/auth/logout.ts`) — Phase4와 직접 관련 없음(Header에서 이미 사용 중).
- **결정 필요 사항 1**: 다이어리 진입에 "로그인"만 요구할지, "로그인 + 온보딩 완료(profile 존재)"까지 요구할지가 [[EXECUTION_PLAN]] Phase4 문서 원문에 명시되어 있지 않다. `proxy.ts`는 현재 `/my` 전체에 대해 로그인 여부만 확인하고 profile 존재 여부는 확인하지 않는다(그 판단은 `/onboarding` 자체 경로에만 있음) — 즉 이론상 "로그인했지만 아직 온보딩을 안 한" 사용자가 `/my/journal`에 접근할 수 있다. 이 상태에서 다이어리 화면이 무엇을 보여줘야 하는지(온보딩으로 재유도 vs 그대로 빈 다이어리 표시) 결정이 필요하다.
- **proxy.ts 서비스 롤 미사용 원칙과의 정합성**: Phase4가 만들 `lib/api/journal.ts`는 사용자 본인 데이터만 다루므로 [[DATABASE_SCHEMA]] §6의 "본인만 SELECT" RLS를 그대로 통과할 수 있다 — anon/authenticated 클라이언트(`lib/supabase/server.ts`)로 충분하며 **service_role을 새로 쓸 필요가 없다.** (service_role이 필요한 경우가 생긴다면 그것 자체가 이번 감사가 찾던 "보고 대상"이었을 텐데, 현재 설계상 그런 경우를 발견하지 못했다.)

---

## 7. Database/Schema 검증

Phase4가 참조할 4개 테이블의 실제 컬럼(마이그레이션 SQL 원문 확인)과 [[DATABASE_SCHEMA]] 문서를 대조했다 — **불일치 없음.**

| 테이블 | 실제 컬럼(요약) | Phase4 활용 |
|---|---|---|
| `user_numbers` | `numbers`, `generation_method`, `related_dream_id`/`related_fortune_id`(FK 없음), `recommendation_reason`, `is_purchased`, `purchase_amount`, `memo`, `target_round`, `match_count`, `win_rank`, `checked_at`, `created_at` | 히스토리 리스트·당첨확인 카드가 그대로 쓸 수 있는 컬럼이 이미 다 있다 |
| `dream_journal_entries` | `user_id`, `entry_date`, `dream_text`, `linked_dream_id`, `created_at` | 꿈기록 골격에 충분 |
| `fortune_results` | `user_id`(NULL 허용), `input_birth_date`, `overall_fortune`, `luck_score`, `recommended_numbers`, `share_id`, `created_at` 등 | 운세이력 골격에 충분 |
| `user_period_stats` | `user_id`, `period_type`, `period_key`, `total_generated` 등, `(user_id, period_type, period_key)` UNIQUE | 통계 골격(향후 Phase)에 활용 가능 |

- **NOT NULL 제약이 온보딩/생성 과정에서 문제를 일으킬 가능성**: 4개 테이블 모두 Phase4가 "빈 값/빈 배열 반환" 수준으로만 조회하므로 INSERT 경로가 없다 — NOT NULL 제약이 Phase4 자체에서 문제를 일으킬 지점은 없다(Phase5~7에서 실제 INSERT가 생길 때 재검토 대상).
- **timestamp 전략 일관성**: `created_at`은 전 테이블 `timestamptz not null default now()`로 일관적이다. `user_numbers`/`fortune_results`/`dream_journal_entries`는 `updated_at`이 없고(설계상 의도, §3.0 공통 규칙), `user_period_stats`만 `updated_at`을 갖고 트리거로 관리된다 — 문서(§3.0)와 실제 SQL이 정확히 일치한다.
- **user_id FK 구조**: `user_numbers`/`fortune_results`는 `user_id`가 NULL 허용(비회원 생성 지원), `dream_journal_entries`/`user_period_stats`는 NOT NULL(완전 회원 전용 기능) — 이 차이는 문서(§3.3, §3.6, §3.7, §3.8)와 실제 SQL이 정확히 일치하며, Phase4가 "로그인 필수" 전제로 4개 테이블을 조회하는 데 지장이 없다.
- **UNIQUE/PK**: `user_period_stats(user_id, period_type, period_key)` UNIQUE 존재 확인(SQL 원문). 나머지는 단순 PK만 필요하고 실제로 그렇게 되어 있다.
- **`0012` 결번**: §3에서 설명했듯 예약된 번호(Phase9)이며 Phase4와 무관하다.

---

## 8. RLS 검증

`0008_rls_policies.sql`/`0011_profiles_auth_protection.sql` 원문을 직접 읽고 Phase4가 쓸 4개 테이블의 정책을 확인했다.

| 테이블 | SELECT 정책(실제 SQL) | Phase4 관점 판단 |
|---|---|---|
| `user_numbers` | `auth.uid() = user_id`, `to authenticated` | 본인 데이터만 조회됨 — 안전 |
| `dream_journal_entries` | `auth.uid() = user_id`, `to authenticated` | 상동 |
| `fortune_results` | **`using (true)`, `to anon, authenticated`** — 사실상 전체 공개 | ⚠️ 아래 상세 |
| `user_period_stats` | `auth.uid() = user_id`, `to authenticated` | 본인 데이터만 조회됨 — 안전 |

- **`fortune_results`가 구조적으로 SELECT 전체 공개인 이유**: 정책 SQL 자체의 주석(0008 원문)이 명시하듯, Postgres RLS는 "행 내용"만으로 가시성을 판단할 수 있고 "요청이 특정 `share_id`를 아는지"는 판단할 수 없다 — 공유 링크 패턴(`/fortune/[shareId]`)의 구조적 필연이다. 이는 [[BACKLOG]] F9에 이미 기록된, **문서와 실제가 일치하는 의도된 설계**이며 새로 발견된 결함이 아니다. Phase4가 이 테이블을 "본인 운세 이력"으로 조회할 때는 애플리케이션 레벨에서 `WHERE user_id = auth.uid()` 조건을 반드시 직접 걸어야 한다 — RLS가 그 필터링을 대신 해주지 않는다는 점을 Phase4 구현 시 반드시 인지해야 한다(RLS가 있으니 안전하다고 문서만 보고 판단하지 말라는 이번 Task 원칙과 정확히 관련된 지점).
- **User A/B/비로그인/공개 데이터 관점 재확인**: [[PHASE2_RLS_REAL_USER_TEST_REPORT]]가 실제 Supabase 프로젝트에서 두 개의 실제 authenticated JWT로 `user_numbers`/`dream_journal_entries`를 포함해 이미 이 격리를 실측 검증했다(2026-08-06). 이번 Task는 코드 변경이 없어 재검증하지 않았고, 그 결과가 여전히 유효하다고 판단한다(RLS 정책 자체가 그 이후 변경되지 않았음을 마이그레이션 파일 목록으로 확인).
- **service_role 신규 사용 필요 여부**: 위 4개 테이블 전부 authenticated 세션(anon key + 쿠키)만으로 "본인 데이터 조회"가 가능하다 — Phase4에서 service_role을 새로 도입해야 하는 지점을 찾지 못했다.

---

## 9. UI/Design System 연결

| Phase4 UI | 기존 컴포넌트 재사용 | 신규 필요 여부 | 이유 |
|---|---|---|---|
| 다이어리 홈 요약 카드 | `Card`, `CardHeader`/`CardContent`/`CardFooter` | 신규: `JournalSummaryCard`(합성 컴포넌트) | `Card`는 범용 컨테이너일 뿐 "이번달 N번 생성" 같은 다이어리 전용 데이터 바인딩 로직이 없다 |
| 빈 상태(히스토리/캘린더/꿈기록 등 전부) | `EmptyState`(이미 Phase3에서 구현·`/ui-preview`에서 검증됨) | 불필요 | `title`/`description` props만으로 Phase4가 요구하는 "빈 상태" 전부 충족 가능 |
| 히스토리 목록 항목 | `Card` 또는 순수 리스트 + `Badge`(번호/생성방식 표시) | 신규: `NumberHistoryList`(합성) | 번호 6개 배열을 표시하는 로직 자체가 신규(LottoBall류 컴포넌트가 아직 없음, §11 참조) |
| 당첨확인 결과 카드 | `Card`, `Badge`(success/danger — **§14 참조, 대비 문제 있음**) | 신규: `ResultCard`(합성) | 당첨/미당첨 상태 분기 로직이 신규 |
| CTA 버튼(로그인 유도, 기록하기 등) | `Button`/`buttonClassName()`(이미 Home에서 검증된 패턴) | 불필요 | 그대로 재사용 가능 |
| 페이지 레이아웃 | `Container`, `Main`, `PageShell`(Root Layout에 이미 적용됨) | 불필요 | 별도 다이어리 전용 레이아웃 wrapper가 필요하면 `app/(protected)/my/layout.tsx` 수준에서 `Container`만 감싸면 충분 |
| 네비게이션(다이어리 탭 활성 표시) | `BottomNavigation`, `GlobalNav`(이미 `/my/journal` 링크·active state 구현 완료) | 불필요 | Phase3-6/3-7에서 이미 완성, 실측 검증됨 |
| 번호 6개 시각 표시(로또 볼) | 없음 | **신규**: `LottoBall`류 컴포넌트가 현재 `components/ui/`에 전혀 없음 | [[DESIGN_SYSTEM]] §4.2가 "시그니처 컴포넌트"로 지정했지만 Phase3 구현 범위에서 실제로 만들어진 적이 없다(Phase3 각 보고서에 언급 없음, `components/ui/` 실제 파일 목록에도 없음) — Phase4가 히스토리/결과 카드에서 번호를 표시하려면 이 컴포넌트가 필요할 가능성이 높다 |

**새 컴포넌트는 이번 Task에서 생성하지 않았다** — 위 표는 식별만 한 것이다.

---

## 10. 문서 불일치

| # | 불일치 | 근거(실제 확인) | 심각도 |
|---|---|---|---|
| 1 | **`proxy.ts`의 무조건 리다이렉트 vs [[INFORMATION_ARCHITECTURE]]/[[EXECUTION_PLAN]]의 "가치설명 화면" 요구** | `proxy.ts` 37~61행 직접 확인(예외 없는 307 리다이렉트) vs [[INFORMATION_ARCHITECTURE]] §1.2 원문("단순 리다이렉트보다 가치 설명 우선") | **Critical** |
| 2 | **[[ROADMAP]]과 [[EXECUTION_PLAN]]의 Phase 번호 체계가 서로 다른 대상을 가리킴** | [[ROADMAP]] §2의 "Phase 4"는 커뮤니티, [[EXECUTION_PLAN]]의 "Phase 4"는 행운 다이어리(틀) — 원문 대조로 확인. [[EXECUTION_PLAN]]이 실제 진행 순서(Phase0~3 완료 이력)와 정확히 일치하므로 이 프로젝트의 "Phase4"는 [[EXECUTION_PLAN]] 기준으로 해석해야 한다 | High(해석 오류 위험은 낮지만 문서 자체는 정정 필요) |
| 3 | **Fortune(운세) 기능이 [[EXECUTION_PLAN]] 어떤 Phase에도 배정되어 있지 않음** | [[PHASE3_UI_ARCHITECTURE_PLAN]] §7-2가 이미 발견(원문 재확인), 이번 Task에서 [[EXECUTION_PLAN]] 전체 재검색으로도 `/fortune` 페이지 구현 Phase를 찾지 못해 재확인됨 | High(기존 발견, 미해결 지속) |
| 4 | **`(protected)` route group이 계획에만 있고 실제로 없음** | [[PHASE3_UI_ARCHITECTURE_PLAN]] §2.1 "확정 구조"가 `app/(protected)/my/`를 명시했으나, 실제 `app/` 디렉터리(Glob 확인)에 해당 폴더가 없다. `proxy.ts`는 route group과 무관하게 경로 문자열(`/my`)만으로 보호하므로 URL/보안에는 영향이 없지만, Phase4가 파일을 어디에 만들지(route group 사용 여부) 결정되지 않은 상태 | Medium |
| 5 | **GNB(꿈해몽 포함 4개)와 BottomNavigation(꿈해몽 제외 4개)의 메뉴 구성 차이** | [[PHASE3_GNB_REPORT]] §6에 이미 기록된 기존 발견 — 재확인만 함, Phase4와 직접 관련 없음(다이어리 탭은 양쪽에 이미 동일하게 존재) | Medium(기존 발견) |
| 6 | **"더보기" 메뉴가 GNB/BottomNavigation 양쪽에서 미구현** | [[PHASE3_BOTTOM_NAVIGATION_REPORT]]/[[PHASE3_GNB_REPORT]]에 이미 기록 — Phase4 범위와 무관 | Low(기존 발견) |
| 7 | **`next` 파라미터 OAuth 왕복 미구현** | [[PHASE2_COMPLETION_REPORT]] §5에 이미 기록. Phase4부터 실제 영향이 생김(§5) | Medium |
| 8 | **[[EXECUTION_PLAN]]의 "번호는 Phase1이 0010까지 사용" 각주와 실제 `0011`/`0013` 존재** | [[EXECUTION_PLAN]] Phase4 §3 각주가 "0011_journal_summary_view.sql"을 Phase4 몫으로 예약해뒀는데, 실제로는 `0011`이 이미 `profiles_auth_protection.sql`(Phase2 산출물)로 사용되어 있다(마이그레이션 원문 확인). Phase4가 `0011_journal_summary_view.sql`을 만들려면 실제로는 `0012`+ 번호를 새로 골라야 한다(단, `0012`는 Phase9가 예약한 `admin_flag.sql` 몫이라 이것도 이미 선점됨 — Phase4 착수 시 사용 가능한 실제 다음 번호는 `0014`) | High(번호 재확인 없이 진행하면 실제 마이그레이션 충돌 발생) |

---

## 11. Risk Register

### Critical
- **R1. `proxy.ts`의 무조건 리다이렉트가 Phase4의 "비로그인 가치설명 화면" 요구사항을 구조적으로 불가능하게 만든다**(§5, §10-1). Phase4 착수 전 다음 중 하나를 결정해야 한다: (a) `/my/journal`(다이어리 홈만)을 `proxy.ts` 보호 대상에서 제외하고 페이지 자체가 `getCurrentUser()`로 분기해 비로그인 시 가치설명 콘텐츠를 렌더링하도록 변경, (b) "가치설명 화면" 요구사항을 철회하고 현재처럼 단순 로그인 리다이렉트로 확정. 이는 Auth 레이어(`proxy.ts`) 변경을 수반하므로 이번 Task 범위 밖이며 별도 승인이 필요하다.

### High
- **R2. Fortune 기능 Phase 미배정**(§10-3). Phase4의 `fortune-history`(이력 골격)는 영향받지 않지만, `/fortune` 자체를 언제 만들지 결정하지 않으면 GNB/BottomNavigation의 "운세" 메뉴가 무기한 404로 남는다.
- **R3. `color-danger`/`color-success` WCAG AA 미달이 Phase4에서 처음 실사용자에게 노출될 가능성**(§9, §14). `ResultCard`가 당첨/미당첨을 `Badge`(success/danger)로 표시하면 [[PHASE3_MAINTENANCE_REPORT]]가 보고만 하고 넘어갔던 대비 문제가 처음으로 실제 화면에 등장한다.
- **R4. 마이그레이션 번호 충돌 위험**(§10-8). [[EXECUTION_PLAN]] 문서가 안내하는 "Phase4는 0011번을 쓴다"는 서술이 이제 틀렸다 — 실제로 다음 사용 가능 번호는 `0014`다. 문서를 갱신하지 않고 그대로 따르면 실제로는 이미 존재하는 `0011_profiles_auth_protection.sql`과 이름이 겹치거나 Supabase CLI가 혼란을 일으킬 수 있다.
- **R5. [[ROADMAP]]/[[EXECUTION_PLAN]] Phase 번호 체계 불일치**(§10-2)가 향후 다른 세션/작업자에게 "Phase4가 뭔지" 다시 헷갈리게 만들 수 있다.

### Medium
- **R6. `(protected)` route group 사용 여부 미결정**(§10-4) — Phase4 파일을 어느 경로에 만들지 착수 전 확정 필요(단순 파일 배치 문제, 로직에는 영향 없음).
- **R7. `next` 파라미터 미왕복**(§5, §10-7)이 Phase4부터 실제 UX에 영향을 준다(로그인 후 항상 홈으로 이동, 원래 보려던 다이어리 하위 페이지로 못 돌아옴).
- **R8. 로그인은 했지만 온보딩 미완료(profile 없음) 상태의 다이어리 접근 시나리오가 정의되어 있지 않음**(§6).

### Low
- **R9. GNB/BottomNavigation 메뉴 구성 차이(꿈해몽)**(기존 발견, §10-5) — Phase4와 무관, 문서 정리 수준.
- **R10. "더보기" 메뉴 미구현**(기존 발견, §10-6) — Phase4와 무관.
- **R11. `LottoBall` 컴포넌트 부재**(§9) — Phase4가 번호를 표시할 때 필요해질 수 있으나, 텍스트만으로 우선 구현하고 나중에 교체하는 것도 가능해 차단 요인은 아니다.

---

## 12. Phase4 구현 순서 (제안)

기존 [[EXECUTION_PLAN]] Phase4 §5(구현 순서)를 그대로 복사하지 않고, 이번 감사에서 발견한 R1(가치설명 화면 충돌)·R4(마이그레이션 번호)를 반영해 재구성한다.

### Phase4-0. Gate — R1/R4/R6/R8 결정
- **목적**: 코드를 짜기 전 구조적 재작업을 유발할 4개 결정(§11 R1/R4/R6/R8)을 확정한다.
- **예상 파일**: 없음(결정 문서만, 필요 시 `docs/PHASE4_GATE_DECISION.md`)
- **선행조건**: 본 감사 보고서 승인
- **검증**: 사용자 승인 기록
- **완료조건**: R1(가치설명 화면 처리 방식)·R4(다음 마이그레이션 번호)·R6(route group 여부)·R8(온보딩 미완료 처리) 4가지 전부 결정됨
- **위험요소**: 이 단계를 건너뛰고 코드부터 짜면 R1 때문에 페이지 라우팅 구조를 통째로 다시 짜야 할 수 있다(가장 큰 재작업 위험)

### Phase4-1. API 계약 확정
- **목적**: `lib/api/journal.ts`의 함수 시그니처(반환 타입)를 먼저 고정한다 — [[EXECUTION_PLAN]] Phase4 자신도 "반환 타입 설계에 시간을 아끼지 않는다"고 명시
- **예상 파일**: `lib/types/journal.ts`, `lib/api/journal.ts`(빈 배열/널 반환 스텁), `lib/api/journal.test.ts`
- **선행조건**: Phase4-0 완료
- **검증**: `npm test`(빈 상태 반환값 테스트)
- **완료조건**: 모든 함수가 실제 테이블 스키마(§7)와 일치하는 타입을 반환
- **위험요소**: 여기서 타입을 잘못 잡으면 Phase5~7이 이 계약을 그대로 물려받아 나중에 전부 다시 고쳐야 한다(EXECUTION_PLAN 자신의 경고)

### Phase4-2. 페이지 골격 + EmptyState
- **목적**: 6개 라우트에 최소 페이지(EmptyState만 표시)를 만들어 라우팅/보호/네비게이션이 실제로 맞물리는지 먼저 확인
- **예상 파일**: `app/my/journal/page.tsx`(또는 Phase4-0 결정에 따라 `app/(protected)/my/journal/page.tsx`), `history/`, `results/`, `calendar/`, `dreams/`, `fortune-history/` 각 `page.tsx`
- **선행조건**: Phase4-1
- **검증**: `npm run build` 후 라우트 목록에 6개 신규 경로 확인, 비로그인/로그인 각 상태로 실제 접근해 리다이렉트/렌더링 확인
- **완료조건**: 로그인 후 6개 페이지 모두 에러 없이 EmptyState 표시, 비로그인 시 Phase4-0에서 결정한 방식대로 동작
- **위험요소**: Phase4-0의 R1 결정이 여기서 실제로 검증된다 — 결정이 틀렸다면 이 단계에서 드러난다

### Phase4-3. journal 전용 컴포넌트
- **목적**: `JournalSummaryCard`/`NumberHistoryList`/`ResultCard` 구현(기존 `Card`/`Badge`/`EmptyState` 조합)
- **예상 파일**: `components/journal/*.tsx`
- **선행조건**: Phase4-1(타입), Phase4-2(페이지 골격)
- **검증**: 더미 데이터로 렌더링 확인(단위 테스트 또는 `/ui-preview`류 임시 확인 화면)
- **완료조건**: 3개 컴포넌트가 Phase4-1의 타입을 props로 받아 정상 렌더링
- **위험요소**: `ResultCard`가 `Badge` success/danger를 쓴다면 R3(대비 문제)를 그대로 물려받는다 — Phase4-0에서 R3 처리 방향도 함께 결정하는 것을 권장

### Phase4-4. 실 데이터 연결
- **목적**: `lib/api/journal.ts`가 실제로 4개 테이블을 조회하도록 구현 전환(빈 값 → 실제 쿼리)
- **예상 파일**: `lib/api/journal.ts`(구현 채움)
- **선행조건**: Phase4-1~3
- **검증**: 실제 Supabase 프로젝트에 테스트 데이터를 넣고(Phase2에서 이미 검증된 카카오 우회 로그인 방식 재사용) 본인 데이터만 조회되는지 확인
- **완료조건**: [[EXECUTION_PLAN]] Phase4 완료 기준 3개 전부 충족
- **위험요소**: §8에서 지적한 `fortune_results`의 "RLS가 필터링해주지 않음" 함정 — `WHERE user_id = ` 조건을 애플리케이션에서 누락하면 타인의 운세 결과까지 노출된다

### Phase4-5. Audit
- **목적**: Phase3-8과 동일한 형식의 감사(반응형/접근성/UI일관성/네비게이션 충돌/불필요한 코드) 수행
- **예상 파일**: `docs/PHASE4_AUDIT_REPORT.md`
- **선행조건**: Phase4-0~4 전체 완료
- **검증**: lint/type-check/test/build + 실제 로그인 상태별 렌더링
- **완료조건**: Critical 없음 확인, Phase5 착수 가능 선언
- **위험요소**: 없음(정례 점검)

---

## 13. 테스트 전략

### 인증
- 비로그인으로 `/my/journal` 접근 → Phase4-0 R1 결정에 따른 화면 확인
- 로그인 + profile 없음 → Phase4-0 R8 결정에 따른 화면 확인
- 로그인 + profile 있음 → 실제 다이어리 화면(빈 상태 또는 실 데이터) 확인
- 로그아웃 후 재접근 → 다시 보호되는지 확인

### 데이터 격리 (실제 Supabase 프로젝트 대상, [[PHASE2_RLS_REAL_USER_TEST_REPORT]] 방식 재사용 권장)
- 카카오 API만 우회(`establishKakaoSupabaseSession()`)하는 임시 Route Handler로 User A/B 세션 발급
- User A로 `user_numbers`/`dream_journal_entries` 더미 행 생성(service_role로 직접 INSERT하거나 실제 API 경로 사용)
- User A 세션으로 조회 → 본인 데이터만 보이는지 확인
- User B 세션으로 동일 엔드포인트 조회 → User A 데이터가 전혀 보이지 않는지 확인(특히 `fortune_results`는 RLS가 걸러주지 않으므로 애플리케이션 쿼리 자체를 테스트해야 함, §8)
- 검증 후 테스트 계정/데이터 전량 삭제(이 세션에서 이미 확립된 절차 재사용)

### UI
- 375px: 다이어리 홈 요약 카드, 히스토리 리스트가 오버플로우 없이 표시되는지(특히 `ResultCard`의 번호 6개 표시 영역)
- 768px: GNB active state가 "다이어리" 메뉴에 정확히 반영되는지
- 1440px: `Container`의 `max-w-content` 제한이 다이어리 페이지에도 동일하게 적용되는지

### 품질
- `npm run lint` / `npm run type-check` / `npm test` / `npm run build` — 이번 Task에서 4개 전부 통과 확인(§0 아래 기록), Phase4 각 하위 단계마다 반복 실행 권장

---

## 14. Phase3 잔여사항의 Phase4 영향

| 항목 | 분류 | 근거 |
|---|---|---|
| `color-danger`/`color-success` WCAG AA 미달 | **Phase4와 병행 가능, 단 Phase4-3(ResultCard) 착수 전 결정 권장** | 지금까지는 `/ui-preview`에만 노출되던 잠재 결함이었지만, Phase4의 `ResultCard`가 당첨/미당첨에 `Badge` success/danger를 쓰는 순간 실사용자에게 노출된다. 색상 토큰 자체를 바꾸는 문제라 이번 Task도, Phase4-3도 임의로 정할 수 없다 — Phase4-0 Gate에서 함께 결정하는 것을 권장 |
| `destructive` variant hover 미정 | **Phase4와 무관하게 병행 가능** | Phase4 어떤 화면도 destructive 버튼(삭제 등)을 요구하지 않는다(히스토리 삭제 같은 기능은 Phase4 범위 밖, "틀"만 만듦) |
| GNB/BottomNavigation 메뉴 구성 차이(꿈해몽) | **Phase4와 무관, Phase4 이후 문서 정리** | 다이어리 탭은 양쪽에 이미 동일하게 존재해 Phase4에 영향 없음 |
| 4탭 vs DESIGN_SYSTEM 5개 항목("더보기") | **Phase4와 무관, Phase4 이후 문서 정리** | 다이어리 탭 자체와는 무관 |
| 더보기 미구현 | **Phase4와 무관, Phase4 이후 문서 정리** | 상동 |

---

## 15. Implementation Gate

### **CONDITIONAL READY**

Phase4 착수 자체를 막는 기술적 결함(DB/RLS/기존 네비게이션 결함)은 없다 — 그 부분은 이미 준비되어 있다(§3, §4, §7, §8). 그러나 아래 항목을 먼저 결정하지 않으면 Phase4 도중 라우팅 구조를 다시 손대야 하는 재작업이 발생할 가능성이 높다("Phase4를 빨리 시작하는 것"보다 "구조적 재작업 방지"가 이 감사의 목적이라는 원칙에 따라 CONDITIONAL로 판단한다).

**Phase4 착수 전 반드시 결정/승인이 필요한 것 (우선순위 순)**:

1. **(R1, Critical)** `proxy.ts`의 무조건 리다이렉트와 "비로그인 가치설명 화면" 요구사항 충돌을 어떻게 풀지 — `/my/journal`을 보호 대상에서 부분적으로 제외할지, 요구사항 자체를 철회할지.
2. **(R4, High)** Phase4가 실제로 사용할 다음 마이그레이션 번호를 `0014`로 확정(문서 서술 `0011`은 이미 다른 용도로 선점됨).
3. **(R2, High)** Fortune(`/fortune`) 기능을 어느 Phase에 배정할지 — Phase4 범위에는 포함되지 않지만, 방치할수록 GNB/BottomNavigation의 "운세" 메뉴가 계속 404로 남는다.
4. **(R3, High)** `color-danger`/`color-success` 토큰 조정 여부 — Phase4-3(`ResultCard`) 착수 전까지는 결정하지 않아도 되지만, 그 시점 전에는 반드시 필요하다.
5. **(R6, Medium)** `(protected)` route group을 실제로 만들지, 기존 `/login`·`/onboarding`처럼 flat 구조로 갈지.
6. **(R8, Medium)** 로그인했지만 온보딩 미완료 상태의 다이어리 접근 처리 방식.

위 6가지 중 1번(R1)이 가장 결정이 늦어졌을 때의 재작업 비용이 크다 — proxy.ts 보호 방식이 바뀌면 이미 만든 페이지의 인증 분기 로직을 전부 다시 짜야 하기 때문이다. 나머지는 Gate 단계(Phase4-0)에서 함께 정리하면 순연 없이 진행 가능하다.

---

## Validation 결과 (이번 Task 자체)

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 16개 테스트 통과 |
| `npm run build` | 통과, 라우트 목록 변경 없음 |
| `git status` | 이번 Task에서 신규 생성된 파일은 본 보고서(`docs/PHASE4_PRE_IMPLEMENTATION_AUDIT.md`) 하나뿐임을 확인. 기존 미커밋 변경사항(이전 Phase들의 작업물)은 그대로 유지, 추가 수정 없음 |

이번 Task는 읽기 전용 조사만 수행했으므로 위 결과는 조사 시작 전 상태와 동일하다 — 코드 변경이 없었음을 재확인한 것이다.
