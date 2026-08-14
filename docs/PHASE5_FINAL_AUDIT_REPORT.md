# PHASE5 FINAL AUDIT REPORT — 번호 생성 MVP 종합 감사

> Phase5(Phase5-0 사전감사~5-3 UI)의 전체 구현을 Phase6 착수 전에 종합 감사한 결과다. 프로덕션 코드/Migration/RLS/Schema/proxy.ts/API/컴포넌트를 전혀 수정하지 않았다 — 아래 내용은 전부 실제 소스 재확인, 실제 HTTP 요청, 실제 Supabase 프로젝트 실측(검증 후 전량 삭제)의 결과다.

---

## 1. 감사 범위

`lib/logic/generateNumbers.ts`(Phase5-1), `app/api/numbers/route.ts`+`lib/api/numbers.ts`(Phase5-2), `app/generate/page.tsx`+`components/generate/*`(Phase5-3), 그리고 이들과 Phase4(다이어리)·Phase3(공통 UI)·proxy.ts의 상호작용. Phase6(당첨확인) 이후 기능은 감사 대상이 아니다.

### 기준 문서 (전부 원문 재확인)

`docs/EXECUTION_PLAN.md`, `docs/ROADMAP.md`, `docs/SITEMAP.md`, `docs/INFORMATION_ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/PHASE5_PRE_IMPLEMENTATION_AUDIT.md`, `docs/PHASE5_GENERATE_LOGIC_REPORT.md`, `docs/PHASE5_NUMBERS_API_REPORT.md`, `docs/PHASE5_GENERATE_UI_REPORT.md`.

---

## 2. Phase5 요구사항 대비 구현 현황

[[EXECUTION_PLAN]] Phase5 완료 기준 3가지를 이번 Task에서 실측으로 재확인했다(신규 테스트 계정 사용, 검증 후 삭제):

| 완료 기준 | 확인 결과 |
|---|---|
| 비로그인 생성 정상 동작(저장 없이) | `/generate` 비로그인 접근 `200`, 번호 6개 SSR 즉시 표시. `POST /api/numbers` 비로그인 시도 → `401 UNAUTHORIZED`(저장 시도 자체가 코드 경로상 발생하지 않음) |
| 로그인 생성 시 다이어리 히스토리에 즉시 반영 | User A 저장(`[4,9,18,27,33,41]`) 직후 `/my/journal/history`에서 실데이터로 확인(재실측) |
| CHECK 제약 위반 데이터가 생성되지 않음 | Phase5-1 단위 테스트(7건) + Phase5-2 실측(범위초과/중복/미정렬/타입오류 등 400 거부, DB 미도달) — 이번 Task에서 재실행한 67개 테스트 전체 통과로 재확인 |

**범위 이탈 여부**: 번호 삭제/수정/당첨확인/통계/공유/커뮤니티/AI추천/꿈·운세 연동/커스텀 생성/여러 게임/`session_id`/rate limit 관련 코드가 `app/generate/`, `components/generate/`, `lib/api/numbers.ts`, `app/api/numbers/` 어디에도 없음을 grep으로 재확인했다 — Phase6/7 또는 미배정 기능이 실수로 포함되지 않았다.

---

## 3. 보안 감사

### 코드 재확인

- `getCurrentUser()`(`lib/auth/session.ts`, 미수정)로만 인증 확인 — `app/api/numbers/route.ts` 재확인.
- 클라이언트 요청 본문의 `user_id`는 `parseNumbersInput()`이 아예 읽지 않는다(구조적 차단, 코드 재확인).
- `service_role`/`SUPABASE_SERVICE_ROLE_KEY`: `app/generate`, `app/api/numbers`, `components/generate`, `lib/api/numbers.ts`, `lib/logic` 전체에 grep — 0건(주석 포함 전혀 없음).
- 입력 검증(`parseNumbersInput`)이 `saveUserNumbers()`(DB INSERT) 호출보다 먼저 실행되어, 잘못된 값은 DB에 도달하지 않는다(코드 순서 재확인 + 실측 재확인, 아래).
- DB CHECK(`is_valid_lotto_numbers`, `0002_draws_user_numbers.sql`, 미수정)가 애플리케이션 검증을 이중으로 보완한다 — 애플리케이션 레벨 버그가 있어도 DB가 최종 방어선.

### 실제 Supabase 실측 (이번 Task에서 신규 실행)

| 검증 | 결과 |
|---|---|
| 비로그인 → `POST /api/numbers` | `401 UNAUTHORIZED` |
| 로그인+profile없음 → `/generate` | `200` 접근 가능, "온보딩을 마치면" 안내 문구 확인(저장 시도 없음) |
| User A 정상 저장 | `201`, `numbers=[4,9,18,27,33,41]` |
| **User B가 `/my/journal/history`에서 User A 번호 조회 시도** | `EmptyState`만 표시, User A 데이터 노출 없음 |
| **User B가 User A의 `user_id`를 요청 본문에 위조해 저장 시도** | `201` 성공(요청 자체는 거부 안 됨) — **service_role로 직접 재조회한 결과 저장된 행의 `user_id`는 User B 본인의 실제 uuid** — User A 소유로 저장되지 않음 확인 |

테스트 계정 2개와 관련 데이터는 검증 직후 전량 삭제했다(`auth.users` `200`, 나머지 테이블 전부 `204`). 임시 라우트(`app/api/dev-test-login`)도 삭제했다.

---

## 4. 데이터 격리 검증

§3의 실측 결과가 곧 데이터 격리 검증이다 — **User A/B 교차 접근 가능성 없음**(SELECT/저장 양쪽 모두), **위조된 `user_id`가 실제 저장에 반영되지 않음**을 재확인했다. RLS(`0008_rls_policies.sql`)와 애플리케이션 레벨 검증(`parseNumbersInput`이 `user_id` 필드를 아예 읽지 않음) 두 계층이 동시에 이 결과를 보장한다.

---

## 5. UX/접근성/반응형 감사

| 항목 | 근거 | 결과 |
|---|---|---|
| SSR 최초 생성이 hydration mismatch를 일으키는가 | 코드 재확인(`app/generate/page.tsx`가 `generateNumbers()`를 서버에서 1회 호출해 prop으로 전달, Client Component는 `useState(initialNumbers)`로만 받음 — 클라이언트가 독립적으로 재계산하지 않음) | **일으키지 않음**. 실제 응답 HTML에도 번호 6개가 로딩 상태 없이 즉시 포함됨을 재확인 |
| 최초 진입→표시→자동저장→다시 생성 흐름 | 코드 재확인 + §3 실측 | 정상 동작 |
| 비로그인/profile없음/profile있음 문구·동작 | 실측 재확인(§3) | Phase5 정책과 일치 |
| 저장 실패 시 UX | 코드 재확인(`saveStatus`가 `numbers`와 독립된 state, 실패해도 번호 미삭제) | 적절함(재확인, 이번 Task에서 신규 실패 재현은 하지 않음 — Phase5-3에서 이미 코드로 확인된 사항 재검토만 수행) |
| 번호 생성과 저장 실패의 독립성 | 코드 재확인 | 독립적으로 처리됨 |
| `<h1>` 개수 | 실제 응답 HTML `grep -c '<h1'` | 정확히 1개 |
| nav landmark 중복 | 실제 응답 HTML `aria-label` 전수 확인 | "생성된 번호"/"주요 메뉴"/"하단 메뉴"/"정책 및 안내" 각 1회, 중복 없음 |
| BottomNavigation/GNB와 `/generate`의 충돌 | 실제 응답 HTML에서 `md:hidden`/`md:flex` 클래스 존재 확인, `PageShell`/`Header`/`Footer`/`BottomNavigation` 미수정 | 충돌 없음 |
| 버튼 접근성 | 실제 응답 HTML `<button type="button">...다시 생성하기` 확인 | 실제 버튼 요소, focus-visible 클래스 포함 |
| 모바일 375px 레이아웃 | 코드/컴파일 클래스 검증(`flex flex-wrap justify-center gap-3`, 고정폭 요소 없음) — 실제 브라우저 렌더링은 이 환경에서 불가하여 시각적 확인이 아님을 명시 | 구조적으로 overflow 없음 |
| 768px/1440px | `Container`(`max-w-content`, 미수정) 재사용 확인 | 기존 정책 그대로 |

---

## 6. 디자인 시스템 감사

- 번호 배지: `bg-primary`/`text-white`/`text-button`(전부 기존 `@theme` 토큰) — grep으로 새 색상 클래스(`bg-[#...]` 등 임의 값) 없음을 재확인.
- **`DESIGN_SYSTEM.md` §4.2(번호 구간별 5색: 1-10 노랑/11-20 파랑/21-30 빨강/31-40 회색/41-45 초록)는 미구현 상태다.** 이 5개 색상이 `app/globals.css`의 `@theme`에 CSS 변수로 정의된 적이 없음을(Phase3부터 지속) 재확인했다 — Phase5-3이 새 색상을 만들지 않기 위해 `primary` 토큰 하나로 6개 번호를 동일하게 표시한 것은 **의도된 최소 구현이지 실수가 아니다.** 이번 Audit에서도 새 색상 토�큰을 만들지 않았다.
- `color-danger`/`color-success`: `app/generate`, `components/generate` 전체 grep — **0건.** Phase5는 이 두 토큰을 전혀 사용하지 않아 기존 WCAG 미달 문제(`docs/PHASE3_MAINTENANCE_REPORT.md`)가 Phase5에서 노출되지 않는다(재확인, 신규 발견 아님).
- 저장 상태 문구(저장중/완료/실패)는 색상이 아니라 텍스트로만 구분됨을 코드로 재확인(`text-text-secondary` 하나만 사용).

---

## 7. 테스트/빌드 결과 (이번 Task에서 재실행)

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | **67개 전체 통과**(`generateNumbers` 7 + `numbers.ts` 19 + `generatorSaveLogic` 5 + 기존 Phase2~4분 36) |
| `npm run build` | 통과. 라우트 17개 전부 예상과 일치(`/generate`, `/api/numbers` 포함, 예상 밖 라우트 없음) |
| 기존 페이지 회귀(`/`, `/login`, `/ui-preview`, `/onboarding`, `/my/journal` 계열) | 전부 기존과 동일한 응답 재확인 |
| `proxy.ts` 인증 동작 | `/onboarding`·`/my/journal/history` 비로그인 시 `307` 재확인, `/generate`는 애초에 `PROTECTED_PATHS`에 없어 인증 불필요(재확인) |
| Phase4 다이어리 데이터 조회 | User A가 Phase5로 저장한 데이터가 Phase4의 `getRecentUserNumbers()`로 즉시 조회됨을 재확인(코드 무변경) |
| `/api/numbers` | §3 실측 재확인 |

---

## 8. 문서 충돌 감사

새로 발견된 문서 충돌은 없다. Phase5-0~5-3이 이미 발견·기록한 충돌 1건을 재확인했다:

- **`/generate` vs `/generate/auto`**([[SITEMAP]] §1 트리 vs 실제 코드+[[EXECUTION_PLAN]]) — 실제 코드가 이미 `/generate`로 통일되어 있고 이번 Audit도 그 상태를 그대로 확인했다. 미해결 상태 유지(§10-1).

그 외 [[ROADMAP]]/[[EXECUTION_PLAN]]/[[INFORMATION_ARCHITECTURE]]/[[DESIGN_SYSTEM]] 상호 간에 Phase5 범위에서 새로 모순되는 서술은 발견하지 못했다.

---

## 9. Critical / High / Medium / Low 이슈

### Critical
없음.

### High
없음.

### Medium
- **M1. `DESIGN_SYSTEM.md` §4.2 번호 구간별 5색 미구현**(§6, Phase5-3에서 신규 발견, 이번 Task 재확인). 새 색상 토큰 추가가 필요한 디자인 결정 사안 — 기능적 결함 아님.
- **M2. `color-danger`/`color-success` WCAG AA 미달**(기존 이슈, `docs/PHASE3_MAINTENANCE_REPORT.md`). Phase5에서는 미사용이라 노출되지 않지만, Phase6(당첨확인)이 성공/실패 상태를 표시하기 시작하면 이 문제를 처음으로 실사용자에게 노출시킬 가능성이 높다.
- **M3. `proxy.ts` vs `docs/PHASE4_ARCHITECTURE_DECISION.md` 문서 불일치**(기존 이슈, `docs/PHASE4_DIARY_PAGES_REPORT.md` §12). 실제 보안 영향 없음(페이지 레벨에서 이미 보완됨), 문서 정정만 필요.

### Low
- **L1. `/generate` vs `/generate/auto` 경로 표기 불일치**(§8) — 문서 정정만 필요, 코드 영향 없음.
- **L2. `NumberGenerator`의 React 상태/이펙트 오케스트레이션에 대한 자동화된 컴포넌트 테스트 부재**(`docs/PHASE5_GENERATE_UI_REPORT.md` §14) — jsdom/RTL 미설치로 의도적으로 범위 밖 처리, 실제 Supabase 실측과 코드 리뷰로 보완됨.
- **L3. Fortune 기능 Phase 미배정**(기존 이슈, `docs/PHASE4_ARCHITECTURE_DECISION.md` §7) — Phase5와 무관, 지속 이월.
- **L4. GNB/BottomNavigation 메뉴 구성 차이(꿈해몽) 및 "더보기" 미구현**(기존 이슈, Phase3) — Phase5와 무관, 지속 이월.
- **L5. `destructive` variant hover 미정의**(기존 이슈, Phase3) — Phase5는 destructive 버튼을 쓰지 않아 무관.

**신규로 발견된 문제는 M1 하나뿐이며, 나머지는 기존 이슈의 재확인이다.**

---

## 10. 미결정 사항 (최종 분류)

| # | 항목 | 분류 |
|---|---|---|
| 1 | `/generate` vs `/generate/auto` | **후속 처리 가능** — 문서 정정만 필요(SITEMAP을 실제 구현에 맞춤), 코드 변경 불필요 |
| 2 | 여러 게임 동시 생성 여부 | **후속 Phase** — 제품 결정 사안, 현재 단일 게임으로 MVP 완결 |
| 3 | 번호 구간별 5색 토큰 | **후속 Phase** — 디자인 토큰 추가 결정 필요(M1) |
| 4 | 저장 개수/생성 횟수 제한 | **후속 Phase** — `docs/PHASE5_PRE_IMPLEMENTATION_AUDIT.md` §13에서 이미 MVP 비필수로 분석됨, 실사용 데이터로 재판단 |
| 5 | `session_id` 사용 여부 | **후속 Phase** — 현재 미사용 상태로도 기능 완결, 비회원 추적이 실제로 필요해지는 시점에 결정 |
| 6 | 카카오 공유 기능의 Phase 배정 | **후속 Phase** — 신규 Phase 신설이 필요한 별개 사안, Phase6과 무관 |
| 7 | Fortune 기능의 Phase 배정 | **후속 Phase** — Phase6과 무관, 장기 이월 항목 |
| 8 | Phase4 proxy 문서 불일치 | **후속 처리 가능** — 문서 또는 `proxy.ts` 둘 중 하나 정정, 실사용 영향 없음 |
| 9 | `color-danger`/`color-success` WCAG 문제 | **Phase6 작업 중 결정 권장** — 착수 자체를 막지는 않지만, 당첨확인 UI를 설계하는 시점에 곧바로 마주치게 됨(M2) |
| 10 | GNB/BottomNavigation 메뉴 차이 및 "더보기" 미구현 | **후속 Phase** — Phase3부터 지속된 별개 사안 |

**Phase6 착수 전 반드시 해결해야 하는 항목은 없다.**

---

## 11. Phase5 최종 판정

### **CONDITIONAL PASS**

Critical/High 이슈가 전혀 없고, [[EXECUTION_PLAN]] Phase5의 완료 기준 3가지 전부와 보안 시나리오(인증/입력검증/`user_id` 위조/RLS 격리) 전부를 이번 Task에서 실측 재확인했다. `CONDITIONAL PASS`인 이유는 §10의 10개 항목이 여전히 열려 있기 때문이다 — 이 중 어느 것도 기술적 결함이 아니라 제품/디자인 결정 사안이며, Phase6 착수를 막지 않는다.

---

## 12. Phase6 착수 가능 여부

**가능하다.**

- Phase6(당첨확인)이 필요로 하는 `user_numbers`(대조 대상)는 Phase5가 이미 실제 데이터로 채우는 경로를 완성했다(§2, §4).
- Phase5-3까지 발견된 이슈 중 Phase6의 핵심 작업(회차 결과 입력 API, `matchNumbers()` 순수 함수, `match_count`/`win_rank` UPDATE)을 기술적으로 막는 것은 없다.
- **Phase6 착수 전에 반드시 해결해야 하는 문제**: 없음.
- **Phase6 작업 중 함께 결정하는 것을 권장하는 문제**: M2(`color-danger`/`color-success`) — 당첨/미당첨 표시가 이 색상을 쓸 가능성이 높으므로, Phase6-0(있다면) 또는 Phase6 착수 초기에 토큰 조정 여부를 먼저 확인하는 것을 권장한다.
- **후속 Phase에서 처리해도 되는 문제**: 나머지 9개 전부(§10).

---

## 13. 다음 작업 권장안

**Phase6-0(당첨확인 Pre-Implementation Audit)을 권장한다** — 이번 Phase5 시리즈와 동일한 패턴(사전감사 → 로직 → API → UI → 최종감사)을 그대로 반복한다. 그 사전감사의 최우선 점검 항목으로 M2(`color-danger`/`color-success`)를 명시적으로 포함시킬 것을 권장한다 — Phase6이 당첨/미당첨을 시각적으로 구분해야 하는 첫 Phase이기 때문이다. 그 외 §10의 나머지 항목들은 Phase6 사전감사에서 "Phase6과 무관"으로 재확인하고 넘어가면 충분하다.
