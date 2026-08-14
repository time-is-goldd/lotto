# Phase9-4 관리자 대시보드 핵심 지표 구현 보고서

> Phase6/7/9-1~9-3에서 이미 검증된 관리자 인증(`isAdmin()`, `app/admin/layout.tsx`)과 기존 테이블만 재사용했다. 새 DB 테이블/migration/RLS를 만들지 않았고, 회원관리·커뮤니티·매출·신고 등 범위 밖 지표를 추가하지 않았다.

---

## 1. 생성/수정 파일

**신규**: `lib/api/admin/dashboard.ts`(집계 서비스), `lib/api/admin/dashboard.test.ts`(유닛테스트), 본 보고서.

**수정**: `app/admin/page.tsx` — placeholder를 실제 대시보드로 교체(KPI 7개 + 최근 활동 + 관리 화면 링크).

**미변경**: `lib/api/dreams.ts`, `lib/api/admin/dreams.ts`, `lib/api/admin/draws.ts`, `app/admin/layout.tsx`, `lib/auth/isAdmin.ts`, `proxy.ts`, `app/admin/draws/**`, `app/admin/dreams/**`(목록/생성/수정 화면 자체), Migration/RLS — 전부 무수정(`git status`로 확인). **새 API Route를 만들지 않았다** — 대시보드 데이터는 서버 컴포넌트(`app/admin/page.tsx`)가 직접 가져온다(지시문 §6/§8).

검증 중 임시로 사용하고 전부 삭제한 것(흔적 없음): `app/api/jtest/route.ts`, Supabase 테스트 계정 2개, 테스트 꿈 콘텐츠, 테스트 회차(99101), 그 과정에서 생성된 `user_numbers`/`dream_journal_entries`/`notifications` 행.

---

## 2. 실제 DB/schema 조사 결과

migration 원문(재조사가 아니라 이번 Task에서 정밀도를 위해 직접 재확인)을 기준으로 판단했다.

| 테이블 | 확인한 내용 |
|---|---|
| `dreams` / `dream_number_mappings` | Phase7-1/9-3이 이미 확인한 그대로. `created_at`으로 최근 정렬 가능 |
| `user_numbers` | `generation_method`(enum, `'dream'` 값 포함), `checked_at timestamptz`(NULL 허용), `win_rank smallint`(NULL 허용, 1~5만 유효, `matchNumbers()`가 낙첨을 `null`로 반환 — Phase6-1 로직 재확인), `target_round` |
| `dream_journal_entries` | `user_id uuid not null`, RLS "본인만" — 개인 기록 테이블, "회원 수"가 아니라 "작성된 꿈 기록 수"로 정확히 명명(지시문 §2 KPI7 요구사항) |
| RLS | `user_numbers`/`dream_journal_entries` 둘 다 `auth.uid() = user_id`(본인만 SELECT) — 전체 사용자 합계를 구하려면 `service_role`이 **실제로 필요**함을 확인(§4). `dreams`/`dream_number_mappings`는 전체 공개 SELECT라 `service_role` 불필요 |

**결론: 새 migration/RLS가 필요하지 않다** — 7개 KPI 전부 기존 컬럼의 단순 count로 계산 가능함을 확인했다.

---

## 3. 최종 KPI 목록과 정의

지시문 §2가 제시한 7개를 전부 채택했다(§15 "경우 B"에 해당하는, 의미가 불명확해 제외해야 할 지표는 없었다).

| KPI | 정의 | 비고 |
|---|---|---|
| 꿈해몽 콘텐츠 | `count(dreams)` | |
| 추천번호 매핑 | `count(dream_number_mappings)` | |
| 생성된 번호 | `count(user_numbers)` | |
| 당첨 확인 완료 | `count(user_numbers) where checked_at is not null` | |
| **당첨 건수** | `count(user_numbers) where win_rank is not null` | 지시문 예시 라벨("당첨자 수")을 그대로 쓰지 않고 "당첨 건수"로 명명했다 — 이 값은 **행(번호 게임) 단위** 집계이지 **사람 단위**가 아니다(한 사용자가 여러 번 당첨되면 여러 번 잡힘). "당첨자 수"라고 표기하면 실제 의미와 다른 오해를 유발할 수 있어 지시문 §2 자체가 요구한 "실제 타입/의미를 확인한 뒤 계산"을 라벨에도 반영했다 |
| 꿈 기반 번호 생성 | `count(user_numbers) where generation_method = 'dream'` | |
| 작성된 꿈 기록 | `count(dream_journal_entries)` | "회원 수"로 표현하지 않음(지시문 §2 요구사항 그대로) |

**제외한 지표**: 전체 회원 수/DAU-MAU/전환율/매출/신고/리텐션/퍼널/그래프 — 전부 지시문 §3/§9가 명시적으로 금지했고, 이번 조사에서도 "미처리 신고"에 필요한 `reports` 테이블 자체가 없음을 재확인했다(Phase9-1 감사가 이미 확인한 것과 동일).

---

## 4. KPI 집계 방식

`lib/api/admin/dashboard.ts`의 `getAdminDashboardStats()` 하나로 통합했다.

- **꿈 콘텐츠 2개 + 최근 5건**: `lib/supabase/server.ts`(anon 세션)만 사용 — `dreams`/`dream_number_mappings`는 전체 공개 SELECT라 `service_role`이 필요 없다.
- **`user_numbers` 4개 카운트(전체/확인완료/당첨/꿈기반) + `dream_journal_entries` 1개**: `lib/supabase/service.ts`(`service_role`) 사용 — RLS가 "본인만"이라 관리자 세션이어도 anon 클라이언트로는 전체 합계를 구조적으로 얻을 수 없다(§2). **이것이 이 파일에서 `service_role`이 실제로 필요한 유일한 지점**이다(지시문 §10).
- 모든 카운트는 `select("*", { count: "exact", head: true })`만 쓴다 — 행 데이터를 전부 가져와 JS에서 세지 않는다(지시문 §7). `user_numbers`의 조건별 카운트 4개를 하나의 쿼리로 합치지 않은 이유: PostgREST가 하나의 요청에서 서로 다른 조건의 count를 동시에 반환하지 않고, 이를 위해 새 RPC(DB 함수)를 만드는 것은 지시문이 금지한 범위 확장이다(§15 경우 C) — 현재 규모(수십~수백 행)에서 단순 count 쿼리 4개로 충분함을 실측(§9)으로 확인했다.
- `Promise.all`로 8개 쿼리를 병렬 실행한다(꿈 콘텐츠 3개 + user_numbers 4개 + 꿈기록 1개).

---

## 5. 관리자 인증/보안 검증

- `app/admin/layout.tsx`(무수정)가 `/admin` 전체의 1차 방어선이다.
- **Phase9-1 §7-1의 발견(레이아웃이 `notFound()`를 던져도 자식 페이지의 RSC payload 자체는 이미 계산될 수 있음)을 이번에 처음으로 실제 반영했다** — `app/admin/page.tsx`가 `getAdminDashboardStats()`를 호출하기 **직전에** `isAdmin()`을 다시 확인하고, `false`면 실제 통계를 조회하지 않고 즉시 `null`을 반환한다. 정상 흐름(관리자)에서는 layout이 이미 통과시킨 뒤라 이 확인이 다시 `false`가 될 일이 없지만, 이 페이지 컴포넌트 함수 자체가 프레임워크 특성상 비관리자 요청에서도 평가될 가능성에 대비해, 실제 데이터에 닿기 전에 반드시 이 확인을 통과하게 만들었다.
- **별도 공개 API를 만들지 않았다** — 대시보드 데이터를 요청할 수 있는 HTTP 엔드포인트 자체가 없으므로 Test D(§6)가 공격할 대상 자체가 존재하지 않는다.
- 클라이언트 번들(`.next/static/chunks/`)을 `grep -rl "SUPABASE_SERVICE_ROLE_KEY\|service_role"`로 전수 검사해 **0건** 확인.

---

## 6. 대시보드 UI 구현

`app/admin/page.tsx`(Server Component, `async`로 전환): KPI 7개(2열/4열 반응형 그리드의 `StatCard`, 페이지 내 지역 함수로만 정의 — 7번만 반복되는 표시 단위라 `components/`에 새 공용 컴포넌트를 만들지 않았다), 최근 등록된 꿈해몽(최대 5건, `EmptyState` 재사용), 관리 화면 바로가기(회차 관리/꿈해몽 관리/FAQ·가이드 — 기존 카드 패턴 그대로). 새 색상 토큰/새 디자인 시스템 없음 — `Card`/`Badge`/`EmptyState` 전부 기존 컴포넌트.

---

## 7. 최근 활동 구현 여부

**"최근 등록된 꿈해몽"(최대 5건, `created_at` 내림차순) 하나만 구현했다.** "최근 번호 생성"/"최근 당첨 확인"은 구현하지 않았다 — 이유: `user_numbers`는 RLS상 개인 데이터라, 관리자가 이를 목록으로 보려면 어떤 사용자의 어떤 번호인지까지 노출하게 되는데 지시문 어디에도 이 표시 방식(익명화 여부, 표시 범위)이 정의돼 있지 않다. 반면 `dreams`는 애초에 전체 공개 콘텐츠라 "최근 활동"으로 보여줘도 노출 문제가 전혀 없다(지시문 §4 "실제 timestamp 컬럼이 있고 조회가 자연스러운 경우에만 구현"). 복잡한 activity log 시스템은 만들지 않았다.

---

## 8. 성능/쿼리 구조

| 항목 | 결과 |
|---|---|
| `select("*")`로 전체 행을 가져오는 쿼리 | 0건 — count는 전부 `head: true`, 목록은 "최근 5건"만 `limit(5)`로 제한 |
| 총 쿼리 수 | 8개(꿈 콘텐츠 카운트 2 + 최근 목록 1 + `user_numbers` 카운트 4 + 꿈기록 카운트 1), `Promise.all`로 병렬 실행 |
| RPC/materialized view/cron/캐시/별도 analytics DB | 전부 도입하지 않음(지시문 §7/§15 경우 C 그대로 준수) — 현재 규모에서 단순 count 쿼리로 충분함을 실측 확인(§9) |

---

## 9. 실제 DB와 KPI 숫자 대조 결과 (production build, 실제 Supabase)

| 시점 | 꿈해몽 | 매핑 | 번호생성 | 확인완료 | 당첨건수 | 꿈기반생성 | 꿈기록 |
|---|---|---|---|---|---|---|---|
| 기준(baseline) | 25 | 25 | 0 | 0 | 0 | 0 | 0 |
| 테스트 꿈(매핑 포함) 생성 후 | **26**(+1) | **26**(+1) | 0 | 0 | 0 | 0 | 0 |
| 그 꿈과 연동된 번호 저장 + 꿈 기록 작성 후 | 26 | 26 | **1**(+1) | 0 | 0 | **1**(+1) | **1**(+1) |
| 그 번호와 정확히 일치하는 테스트 회차(99101) 등록 후 | 26 | 26 | 1 | **1**(+1) | **1**(+1) | 1 | 1 |

**7개 KPI 전부, 실제 데이터 변화와 정확히 1:1로 대응함을 실측으로 확인했다.** "최근 등록된 꿈해몽" 목록에도 새로 만든 테스트 꿈이 즉시 나타났다.

---

## 10. 실제 Supabase 통합 테스트

| 테스트 | 결과 |
|---|---|
| **Test A**: 비로그인 → `/admin` | `307` → `/login?next=%2Fadmin`(Phase9-1과 동일) |
| **Test B**: 일반 사용자 → `/admin` | `404`(Phase9-1과 동일) |
| **Test C**: 관리자 → `/admin` | `200`, 대시보드 정상 렌더링, KPI 7개 baseline 정확히 표시(25/25/0/0/0/0/0) |
| KPI 실시간 반영 | §9 표 전체 |
| **Test D**: 별도 공개 endpoint 존재 여부 | 해당 없음으로 설계(§5) — `/api/admin/dashboard` 같은 경로 자체가 없고, `/api/admin/*` 네임스페이스는 `proxy.ts`가 이미 통째로 보호해 존재하지 않는 하위 경로도 비로그인 요청에 `401`을 반환함을 실측으로 재확인(부수적 발견) |
| 계정 삭제 후 세션 무효화 | 테스트 관리자 계정 삭제 직후 같은 쿠키로 `/admin` 재요청 시 `307`(재인증 필요) 확인 — 정리가 실제로 완전했음을 재확인 |

검증 종료 후 테스트 계정 2개, `admins`/`profiles`/`user_numbers`/`dream_journal_entries`/`notifications` 테스트 행, 테스트 꿈 콘텐츠, 테스트 회차(99101)를 전부 삭제하고 **잔여 0건**을 재확인했다. 임시 검증 라우트도 삭제 완료.

**실측 중 발견하고 즉시 수정한 것**: 첫 정리 시도에서 `profiles` 1건이 삭제되지 않고 남았다 — 원인은 테스트 회차 등록으로 생성된 당첨 알림(`notifications`)이 `profiles`를 참조해 FK가 삭제를 막았기 때문이다(임시 검증 라우트의 정리 로직에 `notifications` 삭제가 빠져 있었음). 정리 로직에 `notifications` 삭제를 추가해 재실행, 잔여 0건을 확인했다 — **애플리케이션 코드의 결함이 아니라 이번 검증용 임시 스크립트 자체의 누락**이었다.

---

## 11. Phase6~8 회귀 검증

| 항목 | 결과 |
|---|---|
| `POST /api/admin/draws`(비로그인) | `401` 유지 |
| `/dream`, `/dream/category/동물`, `/dream/돼지꿈` | 전부 `200` |
| `/dream/돼지꿈` metadata/canonical/`og:site_name` | Phase8과 동일하게 유지 |
| `/dream/돼지꿈` JSON-LD 개수 | 2개(WebSite+BreadcrumbList), 변화 없음 |
| `/robots.txt`/`/sitemap.xml` | 응답·URL 개수(35개) 변화 없음 |
| `/generate`, `/login`, `/my/journal` | 전부 `200` |

---

## 12. Phase9-3 관리자 CRUD 회귀 검증

| 항목 | 결과 |
|---|---|
| `/admin/draws` | `307`(비로그인, 정상) |
| `/admin/dreams` | `307`(비로그인, 정상) |
| `/admin/dreams/new` | `307`(비로그인, 정상) |
| 실제 CRUD 자체 | 이번 대시보드 검증 과정에서 `POST /api/admin/dreams`(생성)를 실사용해 정상 동작을 재확인(§9) — 회귀 없음 |

---

## 13. lint/type-check/test/build 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과, 경고 0건 |
| `npm run type-check` | 통과 |
| `npm test` | 통과 — 16 test files, **234 tests**(기존 227 + 신규 7: `lib/api/admin/dashboard.test.ts` — 정상 집계/빈 데이터/`count: null` 처리/각 쿼리 에러 전파 4종/컬럼 조건 검증) |
| `npm run build` | 통과 — 라우트 **28개**(Phase9-3과 동일, 신규 API Route 없음) |
| 클라이언트 번들 `service_role` 검사 | 0건 |

---

## 14. migration/RLS 변경 여부

**둘 다 변경하지 않았다.** §2/§3에서 이미 확인했듯 7개 KPI 전부 기존 컬럼의 단순 count로 계산 가능했고, 새 테이블이 필요한 지표(FAQ/가이드 관련 등)는애초에 이번 KPI 목록에 없었다.

---

## 15. 발견된 문제

새로 발견된 Critical/High 문제는 없다.

- **(수정 완료, 검증 도구 한정) 임시 정리 스크립트의 `notifications` 삭제 누락** — §10에 상세 기록. 애플리케이션 코드가 아니라 이번 Task의 검증용 임시 라우트에서만 발생했고, 발견 즉시 수정해 재검증까지 완료했다.
- **(설계 결정, 기록) "당첨 건수"를 "당첨자 수"로 표기하지 않았다** — §3에 근거 기록. `win_rank`는 사용자별이 아니라 번호 게임(행)별 값이라, "당첨자"라는 사람 단위 표현을 쓰면 실제 의미와 어긋날 수 있어 더 정확한 라벨을 선택했다.

이번 Task와 무관한 기존 Known Issues(`/login?next=` 고정, `/admin/*` title template 미적용, robots.txt `/admin` 미포함, FAQ/가이드 스키마 미확정, Case C 원자성, `user_numbers` 컬럼 위조 가능성, WCAG, SSG/ISR)는 재조사·재해결하지 않았다.

---

## 16. 기존 Known Issues와 신규 이슈 구분

이번 Task에서 새로 발견한 이슈는 없다(위 §15의 임시 스크립트 이슈는 애플리케이션 코드가 아니라 검증 도구 자체의 문제라 "Known Issue"로 등록할 대상이 아니다). Phase9-0~9-3이 이미 기록한 이슈들은 이번 대시보드 구현과 접점이 없어 그대로 두었다.

---

## 17. Phase9-5 Final Audit 착수 가능 여부

**READY.** Critical/High 문제 없음. 7개 KPI 전부 실제 DB 데이터 변화와 1:1로 대응함을 실측 검증했고, 관리자 인증(Phase9-1)·회차 등록(Phase9-2)·꿈해몽 CRUD(Phase9-3)·Phase6~8 기능에 회귀가 없다. `service_role` 클라이언트 노출 없음, 새 migration/RLS 없음.

---

## 18. 다음 작업 추천

**Phase9-5 Final Audit** — Phase9-0(사전 감사)부터 9-4(대시보드)까지 전체를 종합 검증할 시점이다. `docs/PHASE9_PRE_IMPLEMENTATION_AUDIT.md`가 정의한 EXECUTION_PLAN Phase9 완료 기준 3개(관리자 접근제어/회차입력+꿈해몽 CRUD/대시보드) 중 FAQ·가이드를 제외한 전부가 이번 Task로 충족됐으므로, Phase8-5(SEO Final Audit)와 동일한 형식으로 Phase9 전체의 PASS/CONDITIONAL PASS/FAIL을 판정하고 FAQ/가이드 스키마 결정(BLOCKER)을 다음 단계로 명확히 이관하는 것을 권장한다.
