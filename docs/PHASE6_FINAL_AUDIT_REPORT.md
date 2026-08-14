# Phase6 Final Audit Report

> 이 감사는 새 기능을 추가하거나 코드를 개선하지 않는다. Phase6-0~6-4-2에서 이미 실제 HTTP/실제 Supabase로 검증된 사실은 재검증하지 않고 인용했으며, 이번 Task에서 새로 확인이 필요했던 항목(완료 기준 매칭, UI 연결 상태, Known Issue 현재 상태, 최종 lint/type-check/test/build, 읽기 전용 DB 상태 확인)만 실측했다. 이번 Task로 수정된 프로덕션 코드는 없다.

---

## 1. Audit Scope

`lib/logic/matchNumbers.ts`, `lib/types/winning.ts`, `lib/api/admin/draws.ts`, `lib/api/notifications.ts`, `lib/auth/isAdmin.ts`, `app/api/admin/draws/route.ts`, `proxy.ts`(`/api/admin/*` 보호), `supabase/migrations/0012_admin_access.sql`, `draws`/`user_numbers`/`notifications`/`admins` 4개 테이블, Phase4(`lib/api/journal.ts`, `/my/journal/*`)·Phase5(`lib/logic/generateNumbers.ts`, `lib/api/numbers.ts`, `/generate`)와의 상호작용. 기준 문서: `EXECUTION_PLAN.md` Phase6, `ROADMAP.md`, `DATABASE_SCHEMA.md`, `docs/PHASE6_*` 전체(7개 보고서: PRE_IMPLEMENTATION_AUDIT, WINNING_LOGIC_REPORT, DATA_ARCHITECTURE_DECISION, ADMIN_DRAW_PROCESSING_REPORT, ADMIN_AUTH_DECISION, ADMIN_AUTH_IMPLEMENTATION_REPORT, ADMIN_DRAW_ROUTE_REPORT). 실제 코드/DB 상태를 최종 기준으로 판단했다.

---

## 2. Phase6 완료 기준 — 항목별 판정

| # | 기준 | 판정 | 근거 |
|---|---|---|---|
| 1 | 관리자가 실제 당첨 회차를 등록할 수 있다 | **PASS** | `docs/PHASE6_ADMIN_DRAW_ROUTE_REPORT.md` §8/§9 — 실제 HTTP + 실제 Supabase로 `201` 응답과 `draws` 행 생성 확인 완료. 코드는 완전히 준비돼 있고, 실제 운영 관리자 계정만 아직 없음(§11에서 별도 논의 — 코드 결함 아님) |
| 2 | 비로그인 사용자는 관리자 API를 호출할 수 없다 | **PASS** | 실측: `401 UNAUTHORIZED`, `draws` 변경 없음(`PHASE6_ADMIN_DRAW_ROUTE_REPORT.md` §8 Test C) |
| 3 | 일반 로그인 사용자는 관리자 API를 호출할 수 없다 | **PASS** | 실측: `403 FORBIDDEN`(Test B) |
| 4 | 관리자만 당첨 회차 등록이 가능하다 | **PASS** | `isAdmin()`이 Route에서 재검증(service_role 미사용, `admins` RLS 기반), 실측 확인 |
| 5 | 중복 회차는 DB/API 레벨에서 차단된다 | **PASS** | `draws.round UNIQUE`(DB) + `DuplicateRoundError`→`409`(API), 실측 확인(Test E). 재시도해도 기존 판정 결과 훼손 없음 확인 |
| 6 | 당첨번호/보너스번호 입력 검증이 작동한다 | **PASS** | `matchNumbers.ts`의 `assertValidNumberSet`/`assertValidBonusNumber` 재사용, `parseAdminDrawsInput` 단위테스트 17건 + 실측 Test D(`400`) |
| 7 | 기존 `user_numbers` 중 대상 데이터를 회차에 연결한다 | **PASS** | `target_round IS NULL AND checked_at IS NULL AND user_id IS NOT NULL` 배치, 실제 Supabase로 User A/B 동시 판정 검증(Phase6-3/6-4-2) |
| 8 | `matchNumbers()`를 통해 등수를 판정한다 | **PASS** | Route→`registerDrawAndMatchUserNumbers()`→`matchNumbers()` 호출 경로 코드 확인, 판정 로직 복제 없음 |
| 9 | `target_round`/`match_count`/`win_rank`/`checked_at`가 정확하게 반영된다 | **PASS** | 실제 DB 재조회로 확인 완료(`PHASE6_ADMIN_DRAW_ROUTE_REPORT.md` §9) |
| 10 | 당첨자에게만 `win_result` notification이 생성된다 | **PASS** | 실측: 당첨자 1건 생성 확인 |
| 11 | 낙첨자에게는 당첨 알림이 생성되지 않는다 | **PASS** | 실측: 낙첨자 0건 확인, 코드도 `result.winRank !== null` 조건으로 명시적 분기 |
| 12 | 기존 Phase4 다이어리에서 해당 결과가 정상적으로 조회될 수 있는 구조다 | **CONDITIONAL** | §7에서 상세 — 데이터 레이어(`lib/api/journal.ts`의 `getRecentUserNumbers()`가 `select("*")`로 `win_rank`/`match_count`/`checked_at`/`target_round`를 이미 반환하고 `onlyChecked` 필터도 이미 존재)는 완전히 준비돼 있으나, 실제 페이지(`app/my/journal/history/page.tsx`)는 이 필드들을 화면에 렌더링하지 않는다. Phase6의 모든 하위 Task가 "UI 구현 안 함"을 명시적으로 반복했으므로 이는 결함이 아니라 **의도된 범위 경계** — 후속 작업으로 명확히 분리한다(§13) |
| 13 | Phase5 번호 생성/저장 기능이 회귀되지 않는다 | **PASS** | §6에서 상세 — 파일 mtime/코드 대조로 무변경 확인, 119개 테스트 전체 통과 |

**13개 기준 중 12개 PASS, 1개 CONDITIONAL(설계상 의도된 범위 경계, 결함 아님).**

---

## 3. Security Audit

이미 실측된 사실은 재검증하지 않고 종합했다(출처 명시).

### 인증
`/api/admin/draws`에 대해 비로그인→`401`, 일반 사용자→`403`, 관리자→`201` — 전부 실제 HTTP로 검증됨(`PHASE6_ADMIN_DRAW_ROUTE_REPORT.md` §8).

### 권한 상승
| 경로 | 결과 |
|---|---|
| 클라이언트가 `user_id` 전달 | **차단됨(실측)** — `parseAdminDrawsInput()`이 화이트리스트 방식이라 `user_id` 필드 자체를 읽지 않는다. 실제로 위조된 `user_id`를 포함한 요청을 보내 조용히 무시됨을 확인(Test F, §8) |
| 다른 사용자의 user_id 위조 | 위와 동일 — 애초에 읽지 않으므로 위조 여지 없음 |
| `admins` 직접 INSERT(self/other-promotion) | **차단됨(실측)** — `admins_select_own` 외 client 정책이 없어 전부 거부(`PHASE6_ADMIN_AUTH_IMPLEMENTATION_REPORT.md` §10, 실제 Supabase 공격 시나리오 테스트) |
| `admins` UPDATE | **차단됨(실측)** — 관리자 본인조차 UPDATE 불가(client 정책 없음) |
| `admins` DELETE | **차단됨(실측)** — 타 사용자가 관리자 행 삭제 시도 시 0행 영향, 대상 행 보존 확인 |
| `role` 조작 | **차단됨** — UPDATE 자체가 불가능하므로 `role` 값 변경 경로가 없음 |

### 데이터 위조
`match_count`/`win_rank`/`checked_at`/`target_round`는 `AdminDrawInput` 타입에 애초에 존재하지 않아 관리자 API를 통해서는 클라이언트가 지정할 방법이 없다(코드 재확인). **단, 이것과 별개로 이미 알려진 이슈가 하나 있다**: 일반 사용자는 `user_numbers_update_own` RLS(본인 소유 행에 대해 컬럼 단위 제한 없음)를 통해 **자기 자신의** 위 네 필드를 직접 위조할 수 있다 — 이는 Phase6-2에서 최초 발견되고 Phase6-4-0/6-4-1에서 재확인된 **기존 이슈**이며, 이번 감사가 새로 발견한 것이 아니다. 이번 감사에서 재확인한 결론: 이 문제는 **관리자 API의 공격 표면과는 무관**하다(관리자 API는 이 필드를 서버에서만 계산하고, 배치는 `service_role`로 다른 사용자의 행까지 갱신하지만 이는 RLS를 우회하는 정상적인 권한이지 취약점이 아니다). 자기 행 위조 문제 자체의 실제 영향(개인 다이어리 전용, 금전적 이득 없음)과 처리 시점(Phase7 공유 기능 설계 시 재검토)은 기존 Decision 그대로 유지한다.

### 민감정보 노출
- `SUPABASE_SERVICE_ROLE_KEY`/`lib/supabase/service` import: `lib/supabase/service.ts`, `lib/auth/kakao.ts`, `lib/auth/profile.ts`, `lib/api/admin/draws.ts`, `lib/api/notifications.ts`와 그 테스트 파일에서만 발견됨(전수 grep) — 전부 서버 전용 파일. `proxy.ts`는 주석에서 `service.ts`를 언급할 뿐 실제로 import하지 않음(직접 확인).
- 프로젝트 전체에서 `"use client"` 지시어가 있는 파일은 `app/onboarding/OnboardingForm.tsx` 1개뿐이며, 이 파일은 Phase2 온보딩 폼으로 admin/service_role 코드를 전혀 참조하지 않는다.
- 관리자 UID/이메일 하드코딩, 비밀번호/secret 하드코딩: 전수 검색 결과 없음(`isAdmin()`은 인자 없이 세션만 참조, `admins` 테이블 기반 판정).

**Critical/High 보안 결함 없음.**

---

## 4. RLS/DB Audit

실제 migration 원문(`0012_admin_access.sql`)과 `npx supabase migration list`(local/remote `0001~0013` 완전 일치, 이번에도 재확인)를 대조했다.

| 테이블 | RLS 상태 | 검증 방식 |
|---|---|---|
| `admins` | `admins_select_own`(본인만 SELECT)만 존재, INSERT/UPDATE/DELETE 정책 없음 | 실제 공격 시나리오 테스트(Self/Other-promotion, Update, Delete attack) — `PHASE6_ADMIN_AUTH_IMPLEMENTATION_REPORT.md` §10, 재검증 없이 인용 |
| `draws` | 전체 공개 SELECT, client 쓰기 정책 없음(`0008`, 변경 없음) | Phase6-2에서 실제 anon INSERT 시도 `403` 확인, 이번 Phase6-4-2에서도 관리자 외 등록 불가 재확인 |
| `user_numbers` | 본인만 SELECT/INSERT/UPDATE/DELETE(`0008`, 변경 없음) | Phase6-2 실제 User A/B 격리 테스트로 이미 검증, 이번 Task에서 재검증하지 않음(중복 회피) |
| `notifications` | 본인만 SELECT/UPDATE(`is_read`), INSERT는 client 정책 없음(`0006`+`0008`, 변경 없음) | 관리자 배치가 `service_role`로만 INSERT — 실측(Test A) |

**원칙 검증**:
- 일반 사용자가 admin 권한을 스스로 만들 수 없는가? → **불가능(실측 확인)**.
- 다른 사람의 admin 권한을 수정할 수 없는가? → **불가능(실측 확인, client UPDATE 정책 자체가 없음)**.
- 일반 사용자가 자신의 `user_numbers` 결과 필드를 위조할 수 있는 현재 구조의 위험성을 정확히 기록했는가? → **그렇다** — Phase6-2 §9, Phase6-4-0 §11, Phase6-4-1이 이미 상세히 기록했고 이번 §3에서 재확인만 했다.
- 현재 Phase6 범위에서 실제 보안 취약점으로 이어지는가? → **아니다.** 자기 행 위조는 (1) 실제 금전적 보상이 없는 개인 다이어리 표시용 데이터, (2) 다른 사용자나 관리자 배치 결과에 영향 없음, (3) 이미 Phase7(공유 기능) 재검토로 명시적 Decision이 내려져 있다 — 새로운 문제가 아니므로 이번에도 같은 결론을 유지한다.

읽기 전용으로 실제 DB 상태를 재확인했다(신규 테스트 데이터 생성 없음): `admins` 0행(운영 관리자 미등록, 정상), `draws` 15행(`0010_seed_data.sql`의 합성 데이터, `BACKLOG.md` 항목 B로 이미 추적 중, Phase6과 무관), `user_numbers`/`notifications` 0행(이전 Phase들의 테스트 데이터 정리가 전부 완료된 상태, 잔여물 없음).

---

## 5. Case C 안정성 검토

재설계·RPC 도입 없이 **현재 구현이 지시문의 4개 질문을 만족하는지만** 코드로 감사했다.

| 질문 | 결과 |
|---|---|
| 잘못된 행에 회차가 연결되지 않는가? | **정상.** 각 행은 `matchNumbers(row.numbers, sortedWinningNumbers, input.bonusNumber)`로 **이번 요청의 회차 정보**와만 짝지어 판정된다. 다른 회차 데이터가 섞일 코드 경로가 없다 |
| 이미 처리된 행을 다시 처리하지 않는가? | **정상.** 조회 조건(`target_round IS NULL`)과 UPDATE 조건(`.is("target_round", null)`)이 이중으로 걸려 있어, 한 번 `target_round`가 채워진 행은 이후 어떤 회차 등록에도 다시 선택되지 않는다 |
| UPDATE가 0건이어도 성공처럼 오인하지 않는가? | **정상(Phase6-4-2에서 이미 수정 완료).** `.select("id")`로 실제 영향받은 행 수를 확인해 `updatedRows.length === 0`이면 `failedUpdateIds`에 포함시킨다 — 코드 재확인 완료, 새로 고치지 않음 |
| 부분 실패 발생 시 데이터가 다음 회차에 잘못 연결될 가능성 | **알려진 한계(버그 아님).** 실패한 행은 `target_round`가 계속 `NULL`로 남아 **다음번 다른 회차** 등록 시 그 회차와 대조된다 — "이번 회차와는 대조되지 못했다"는 한계이지, 데이터가 침묵 속에 손상되거나 잘못된 값으로 확정되는 것은 아니다(실패 자체가 `failedUpdateIds`로 명시적으로 드러나고 로그에 남는다). 이 한계는 Phase6-3/6-4-0/6-4-2에서 이미 문서화됐고, 완전한 해결(RPC)은 의도적으로 미룬 상태다 |

**결론: 버그 없음, 알려진 한계 1건(문서화 완료, 재작업 대상 아님).**

---

## 6. Phase4/5 Regression Audit

파일 시스템 mtime과 실제 코드 내용을 대조했다(수정 이력이 없다면 회귀 위험 자체가 없다는 것이 가장 확실한 증거).

| 파일 | 마지막 수정 | Phase6에서 수정 여부 |
|---|---|---|
| `lib/api/journal.ts`/`journal.test.ts`(Phase4) | 8월 8일 | **미수정** |
| `lib/logic/generateNumbers.ts`/`.test.ts`(Phase5) | 8월 9일 오전(Phase5 시점) | **미수정**(Phase6-1이 `export` 상수만 재사용, 파일 자체는 그대로) |
| `lib/api/numbers.ts`/`numbers.test.ts`(Phase5) | 8월 9일 오전(Phase5 시점) | **미수정** |
| `app/generate/page.tsx`, `app/my/journal/*`(Phase4/5 UI) | — | **미수정**(Phase6 전 구간에서 `app/*` 중 `app/api/admin/draws/route.ts` 신규 생성 외에는 손대지 않음) |

`user_numbers` 결과 컬럼(UPDATE)이 Phase5 저장 데이터와 충돌하는지: Phase5의 `saveUserNumbers()`는 INSERT 시 `target_round`/`match_count`/`win_rank`/`checked_at`을 아예 지정하지 않는다(컬럼 DEFAULT `NULL`). Phase6의 배치는 이 네 컬럼만 UPDATE하고 `numbers`/`user_id`/`generation_method`/`created_at` 등 Phase5가 채운 컬럼은 전혀 건드리지 않는다 — 두 Phase가 서로 다른 컬럼 집합에만 쓰기 때문에 충돌 여지가 구조적으로 없다.

`npm test` 119개 전체 통과(Phase4/5 테스트 포함) — **회귀 없음.**

---

## 7. API/Route Audit + UI/UX 연결 상태

### Route
`app/api/admin/draws/route.ts` 1개만 신규 추가됐고, `app/api/numbers/route.ts`/`app/api/profile/route.ts`/`app/api/auth/kakao/*`는 미수정. `npm run build` 라우트 목록에 의도하지 않은 변화 없음(§8).

### UI/UX 연결 상태 (지시문 §7 요구사항)
`lib/api/journal.ts`의 `getRecentUserNumbers()`는 `select("*")`로 조회하므로 `Tables<"user_numbers">`의 전체 컬럼(`win_rank`/`match_count`/`checked_at`/`target_round` 포함)을 이미 반환한다. `UserNumbersListOptions.onlyChecked`도 이미 존재해 "확인된 결과만" 필터링이 가능하다 — **데이터 조회 구조 자체는 Phase6 이전부터 이미 준비돼 있었다.**

그러나 `app/my/journal/history/page.tsx`를 직접 읽어 확인한 결과, 이 페이지는 `created_at`/`generation_method`/`numbers`만 렌더링하고 **`win_rank`/`match_count`/`checked_at`/`target_round`는 화면에 전혀 표시하지 않는다.** 즉 "데이터는 저장·조회되지만 사용자에게 보이지는 않는다."

**이것은 결함이 아니라 명시적 범위 경계다** — Phase6-1(`docs/PHASE6_WINNING_LOGIC_REPORT.md`)부터 Phase6-4-2까지 모든 보고서가 "`/my/journal` 당첨 결과 UI 구현 안 함"을 반복해서 명시했다. 이번 감사는 새 UI를 만들지 않고, 이 공백을 **후속 작업으로 명확히 분리**한다(§13).

---

## 8. Test/Build 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 통과 — **11 test files, 119 tests**(Phase6-4-2 종료 시점과 동일, 이번 Task는 코드를 수정하지 않아 변화 없음) |
| `npm run build` | 통과 |
| `npx supabase migration list` | local/remote **완전 일치**(`0001~0013`) |

라우트 목록(`npm run build` 실측): `/`, `/_not-found`, `/api/admin/draws`, `/api/auth/kakao/callback`, `/api/auth/kakao/login`, `/api/auth/logout`, `/api/numbers`, `/api/profile`, `/generate`, `/login`, `/my/journal`, `/my/journal/dreams`, `/my/journal/fortune-history`, `/my/journal/history`, `/onboarding`, `/ui-preview`, Proxy(Middleware) — Phase6-4-2 종료 시점과 **완전히 동일**, 의도하지 않은 변화 없음.

---

## 9. 발견사항 (Critical / High / Medium / Low)

### Critical
없음.

### High
없음.

### Medium
없음(이번 감사에서 새로 발견된 Medium 이상 결함 없음).

### Low
- **L1. `/my/journal/history` UI가 당첨 결과 필드를 표시하지 않음**(§7) — 결함이 아니라 명시적으로 범위 밖으로 남겨둔 후속 작업.
- **L2. Case C 부분 실패 시 실패 행이 다음 회차와 대조될 수 있는 한계**(§5) — 이미 문서화된 알려진 한계, 운영 규율(회차 정기 입력)로 완화 중.

---

## 10. Known Issues / Deferred Items

Phase6과 무관하며 이번 Task에서 해결하지 않는다(기존 상태 재확인만):

| 이슈 | 현재 상태 | Phase6에서의 영향 |
|---|---|---|
| `/generate` vs `/generate/auto` 문서 불일치 | 미해결(Phase5-0부터) | Phase6 어떤 코드도 이 경로를 참조하지 않아 무관 |
| `proxy.ts` vs Architecture Decision 문서 불일치 | 미해결(Phase4부터) | Phase6-4-2가 `proxy.ts`에 `/api/admin/*` 블록만 추가했을 뿐, 기존 `/my/journal` 관련 불일치 로직은 건드리지 않음 — 무관 |
| `color-danger`/`color-success` WCAG AA 미달 | 미해결(Phase3부터) | Phase6은 어떤 UI도 만들지 않아(§7) 이 토큰을 전혀 사용하지 않음 — 노출되지 않음 |
| `DESIGN_SYSTEM.md` 번호 구간별 5색 미구현 | 미해결(Phase5부터) | 위와 동일 이유로 무관 |
| Fortune(`/fortune`) 기능 Phase 미배정 | 미해결(Phase4부터) | Phase6과 무관 |
| 여러 게임 동시 생성 여부 | 미결정(제품 결정 사안) | Phase6과 무관(Phase5 영역) |
| 카카오 공유 기능 구현 Phase 미배정 | 미해결(FEATURE_SPEC §9.1 Must이나 실행 Phase 없음) | Phase6과 무관 |
| `user_numbers` 결과 필드(자기 행) 위조 가능성 | 기록됨, Phase7 재검토로 Decision 완료(Phase6-2/6-4-0/6-4-1) | 이번 감사 §3/§4에서 재확인, 새로운 조치 없음 |
| `admin_audit_logs` 미구현 | **Phase6 내에서 명시적으로 Option A(구현 안 함) 결정 완료**(Phase6-4-1) | Phase9로 이월 확정, Phase6 완료 기준에 영향 없음 |

---

## 11. 실제 Supabase 검증 결과 (이번 Task에서 수행한 부분만)

기존에 이미 실제 HTTP+DB로 충분히 검증된 항목(인증 흐름, RLS 공격 시나리오, 배치 판정 정확성)은 반복하지 않았다. 이번 Task에서 새로 수행한 것은 **읽기 전용 상태 확인**뿐이다:

- `npx supabase migration list` — local/remote `0001~0013` 완전 일치 재확인.
- `admins`/`draws`/`user_numbers`/`notifications` 행 수 조회(읽기 전용, 데이터 생성/삭제 없음) — `admins` 0행(운영 관리자 미등록), `draws` 15행(기존 seed, Phase6과 무관), `user_numbers`/`notifications` 0행(이전 Phase들의 테스트 데이터가 전부 정리된 깨끗한 상태).
- `profiles`에서 "테스트/E2E/IT" 패턴 닉네임 잔여 여부 조회 — **0건**, 이전 모든 Phase의 테스트 계정 정리가 완전했음을 재확인.

이번 Task에서 생성한 테스트 계정/데이터는 없다(불필요하다고 판단해 생성하지 않음 — 지시문도 "필요하다면"으로 조건부 허용했을 뿐 필수로 요구하지 않음). 임시 스크립트(읽기 전용 확인용) 2개는 실행 직후 삭제했다.

---

## 12. Phase6 최종 판정

### CONDITIONAL PASS

판정 기준 대조:
- Critical 없음 — 충족.
- High 없음 — 충족.
- Phase6 완료 기준 충족 — 13개 중 12개 PASS, 1개는 기술적 결함이 아니라 **명시적으로 범위 밖으로 남겨둔 UI 작업**(§2 항목 12, §7).
- 관리자 인증/권한 정상 — 충족(실측 완료).
- 당첨번호 등록→대조→저장→알림 전체 흐름 정상 — 충족(실측 완료).
- Phase4/5 회귀 없음 — 충족.
- lint/type-check/test/build 모두 통과 — 충족.

**CONDITIONAL PASS로 판정하는 이유**: 기술적 결함이나 보안 문제는 없지만, "Phase4 다이어리에서 당첨 결과가 사용자에게 실제로 보이는가"라는 제품 완결성 관점의 후속 작업(UI 미구현, §7/§13)이 남아 있다 — 이는 처음부터 Phase6-1~6-4-2 전 구간이 의도적으로 범위 밖에 둔 것이므로 "미완성"이 아니라 "다음 단계로 명확히 분리된 작업"이다.

---

## 13. Phase7 착수 가능 여부

**Phase7(꿈해몽) 자체는 착수 가능(Phase6 완료와 독립적인 영역).** 다만 Phase6이 남긴 다음 후속 작업은 Phase7과 별개로, Phase6의 실제 "제품으로서의 완결"을 위해 누군가(사용자 결정에 따라 별도 Phase 번호로) 처리해야 한다:

1. **`/my/journal` 당첨 결과 UI 연결**(§7, §9 L1) — 데이터는 이미 준비됨, 화면 표시만 남음. `color-danger`/`color-success` WCAG 이슈(§10)가 이 작업 착수 시 반드시 함께 결정돼야 한다(Phase4/5 감사가 이미 여러 번 권고한 그대로).
2. **운영 관리자 계정 등록**(§2 항목1, 코드 아닌 SQL 1줄) — 실제 회차 입력을 시작하려면 필요.
3. **`draws` 합성 seed 데이터 교체**(`BACKLOG.md` 항목 B, Phase6과 무관하지만 실서비스 오픈 전 필수).

이 3가지는 Phase7 착수를 막지 않는다 — Phase7은 완전히 다른 파일/기능 영역(꿈해몽)이라 독립적으로 진행 가능하다.

---

## 14. Phase7 착수 전 반드시 필요한 결정사항

Phase7 자체에는 없지만, **Phase6을 실제로 "제품 완결" 상태로 만들려면** 다음 결정이 필요하다(Phase7 착수의 선행조건은 아님, 별도 트랙):

1. `/my/journal` 당첨 결과 UI를 언제, 어느 Phase 번호로 만들지.
2. `color-danger`/`color-success` 토큰 값을 조정할지, 아니면 기존 "큰 텍스트만 danger 허용, success는 아이콘+텍스트로 대체" 우회 정책을 그대로 채택할지(Phase3/4/5 감사가 반복 권고, 실제로 노출되는 시점은 바로 이 당첨결과 UI다).
3. Case C의 완전한 원자성(RPC)이 실제로 필요한 시점 — 지금은 불필요하다고 판단했지만, 사용자 규모가 커지면 재검토 필요.
