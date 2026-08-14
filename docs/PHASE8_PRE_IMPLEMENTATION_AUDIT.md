# Phase8-0 Pre-Implementation Audit — 당첨번호 자동 수집(외부 데이터)

> 이 감사는 코드/Migration/RLS/UI를 전혀 수정하지 않는다(전수 확인: `git status`에 신규 변경 없음, 본 보고서 1개만 추가). Phase3~7이 이미 결정·검증한 사항은 재조사하지 않고 인용했다. 외부 웹 조사(WebSearch/WebFetch)를 병행해 "공식 API 없음"을 추정이 아니라 실측으로 확인했다.

---

## 0. 결론 먼저 — 가장 중요한 발견

**"Phase8"이 정확히 무엇을 가리키는지부터 문서 간에 충돌한다.** 이 충돌을 해소하지 않으면 이번 감사가 조사한 내용 전체의 위치가 흔들린다. §1에서 상세히 다루지만, 핵심만 먼저 밝힌다:

- `docs/EXECUTION_PLAN.md`(이 세션이 Phase0~7을 실제로 실행해 온 기준 문서) 자신의 **"Phase 8" 섹션은 "SEO"**다. 의존성은 "Phase 7 완료"뿐이고, Phase7은 이미 CONDITIONAL PASS로 끝나 **지금 바로 착수 가능한 상태**다.
- 반면 `docs/ROADMAP.md`(거시적 로드맵)의 **"Phase 8"은 "AI 자동화 운영 고도화 (지속)"**이며, 그 안에 "당첨번호 자동 수집(공공데이터 API)"이 포함된다. 이 Phase는 ROADMAP의 Phase 1(MVP)~Phase 7(멤버십)이 **전부 끝난 뒤에도 계속되는 최장기 과제**로 그려져 있다(§1 타임라인 다이어그램, "전 기간 지속").
- 그런데 `ADMIN_REQUIREMENTS.md`/`CONTENT_STRATEGY.md`/`DATABASE_SCHEMA.md`/`FEATURE_SPEC.md`/`IMPLEMENTATION_PLAN.md`/Phase6의 두 감사 보고서(`PHASE6_PRE_IMPLEMENTATION_AUDIT.md`, `PHASE6_DATA_ARCHITECTURE_DECISION.md`)는 **전부** "Phase8"을 EXECUTION_PLAN의 "SEO" 섹션이 아니라 **ROADMAP의 "외부 API 자동화"를 가리키는 의미로** 써 왔다(예: `draws.source` 컬럼 주석 "Phase8 자동수집 도입 시", `PHASE6_PRE_IMPLEMENTATION_AUDIT.md`의 "외부 API 자동 수집 | 제외 — Phase8").
- **이번 Task 지시문("Phase8-0") 자체도 이 관행을 그대로 따르고 있다** — 지시문 전체(§3~§13)가 외부 데이터 자동 수집을 전제로 작성되어 있다.
- 지시문 §1이 준 규칙("문서 간 번호 체계가 다르면 실제 구현 순서와 EXECUTION_PLAN을 우선 기준으로 사용")을 그대로 적용하면: "실제 구현 순서"는 이미 Phase6~7에서 반복적으로 "Phase8=외부 자동화"로 취급해 왔고(스키마 주석까지 이 전제로 작성됨), 이는 EXECUTION_PLAN.md 자신의 "Phase 8 — SEO" 섹션 표기와 충돌한다.
- **추가로 결정적인 근거**: `docs/IMPLEMENTATION_PLAN.md` §4.3이 "Supabase Edge Functions+pg_cron(자동 수집에 필요한 인프라) 도입 시점"을 **명시적으로 "ROADMAP Phase 5(쇼핑몰) 이후"**로 못박아 두었다. 이 프로젝트는 아직 ROADMAP의 Phase 1(MVP)조차 완전히 끝내지 못한 단계다(ROADMAP Phase1 = EXECUTION_PLAN Phase0~10 전체, 지금 EXECUTION_PLAN Phase7까지만 완료). 즉 **외부 자동 수집에 필요한 배치 인프라 자체를 지금 도입하는 것은 이 프로젝트가 스스로 정해둔 원칙과 정면으로 충돌한다.**

**따라서 이번 감사의 결론은 다음 세 가지를 동시에 만족해야 한다**:
1. 사용자가 지시한 조사(외부 데이터 소스/아키텍처 후보/DB 계약/idempotency)는 **전부 수행한다** — 지시문 §6이 "결론은 선택하되 구현은 하지 않는다"고 이미 명시했으므로, 지금 조사해 두는 것 자체는 유효하고 안전하다.
2. 그러나 **"이게 Phase8이니 다음으로 바로 구현한다"는 전제는 이 프로젝트 자신의 문서(IMPLEMENTATION_PLAN §4.3, ROADMAP 타임라인)와 충돌**한다는 사실을 분명히 기록한다.
3. **EXECUTION_PLAN.md의 실제 "Phase 8"(SEO)은 지금 당장 착수 가능한, 의존성이 이미 충족된 작업**이라는 대안을 함께 제시한다.

이 판단에 대한 최종 선택은 사용자에게 맡긴다(§19/§16 참조) — 이 감사 보고서 자체는 구현하지 않으므로 어느 쪽을 골라도 이번 Task의 산출물(본 보고서)은 무효화되지 않는다.

---

## 1. Phase8 공식 범위 — 3개 정의 대조

| 정의 | 내용 | 근거 |
|---|---|---|
| **EXECUTION_PLAN.md 자신의 Phase 8** | SEO(sitemap/robots/메타태그/구조화 데이터/canonical) | `docs/EXECUTION_PLAN.md:517` "## Phase 8 — SEO", 의존성 "Phase 7 완료"(이미 충족) |
| **ROADMAP.md의 거시적 Phase 8** | "AI 자동화 운영 고도화 (지속)" — 당첨번호 자동 수집(공공데이터 API)+관리자 승인, 콘텐츠 AI 초안, 커뮤니티 스팸필터 고도화, 운영 대시보드 자동 리포트 | `docs/ROADMAP.md:114-118`, 타임라인상 ROADMAP Phase1(MVP)~Phase7(멤버십) 전체 뒤에도 계속되는 "전 기간 지속" 과제(`:133`) |
| **기존 문서에서 "Phase8"로 명시적으로 미뤄둔 기능(관행)** | 위 ROADMAP의 항목을 그대로 가리키되, EXECUTION_PLAN 번호 체계를 참조하지 않고 관행적으로 "Phase8"이라고만 지칭 | `ADMIN_REQUIREMENTS.md`(§3.1 "자동화 경로(Phase 8): 공공데이터포털 로또 API로 자동 수집"), `CONTENT_STRATEGY.md`, `DATABASE_SCHEMA.md`(`source` 컬럼), `FEATURE_SPEC.md`, `IMPLEMENTATION_PLAN.md`(§ 목차 "8. 자동화 파이프라인... (Phase 8, 지속)"), `PHASE6_PRE_IMPLEMENTATION_AUDIT.md`, `PHASE6_DATA_ARCHITECTURE_DECISION.md`, `supabase/migrations/0002_draws_user_numbers.sql`의 `source` 컬럼 주석 |

**본 감사가 실제로 조사한 대상은 세 번째 정의(외부 API 자동 수집)다** — 지시문이 이를 전제로 작성됐고, 이 프로젝트의 기존 관행과도 일치하기 때문이다. 다만 이것이 EXECUTION_PLAN.md 자신의 "Phase 8" 섹션과 이름이 겹치면서 내용이 다르다는 충돌은 §0/§19에서 명확히 별도로 기록한다.

---

## 2. Phase8/ROADMAP 번호 체계 차이 (Phase7-0 발견 패턴의 재현)

Phase7-0 감사(`docs/PHASE7_PRE_IMPLEMENTATION_AUDIT.md` §1)가 이미 겪은 것과 같은 유형의 충돌이 Phase8에서도 반복된다 — 다만 이번엔 더 심하다: Phase7 충돌은 "같은 숫자, 다른 단위"(EXECUTION_PLAN=세부 실행순서, ROADMAP=사업 단계) 정도였지만, **Phase8은 EXECUTION_PLAN 자신의 내부 섹션명("SEO")과, 그 외 사실상 모든 지원 문서가 관행적으로 써 온 의미("외부 자동화")가 정면으로 다르다.** 이는 EXECUTION_PLAN.md가 v2.0 ROADMAP 개정(2026-08-05, `IMPLEMENTATION_PLAN.md` v2.1 변경 이력에 명시된 날짜) 이전에 작성된 이전 버전의 관행이 다른 문서들에 남아있고, EXECUTION_PLAN.md만 그 이후 "Phase 0~10" 세부 실행 순서로 재편되면서 번호가 밀렸는데 다른 문서들의 "Phase8" 참조가 갱신되지 않은 것으로 추정된다(추정이며, 확인 불필요 — 문서 정리 자체는 이번 Task 범위가 아니다).

---

## 3. 현재 구현 상태 (Phase8에서 실제 구현할 기능 기준)

지시문 §3의 5개 질문을 외부 자동 수집 기능에 적용한다.

| 질문 | 답 |
|---|---|
| 1. 현재 이미 구현되어 있는가? | **아니오.** `app/api/admin/draws/route.ts`는 관리자가 폼으로 입력한 값을 받는 POST 하나뿐이다. 외부 API를 호출하는 코드, cron 설정(`vercel.json`에 `crons` 없음, 전수 확인), Edge Function(`supabase/functions/` 디렉터리 자체가 없음, 전수 확인)이 전혀 없다. |
| 2. DB 스키마가 이미 존재하는가? | **핵심 컬럼은 이미 존재, 자동화 전용 컬럼은 없음.** `draws.source varchar(50) DEFAULT 'manual'`가 이미 있어 값만 `'api'` 등으로 바꾸면 된다(§5). 자동 수집 실행 이력을 남길 별도 테이블(예: `draw_fetch_logs`)은 없다 — §14에서 신규 필요성을 판단한다. |
| 3. 필요한 API/service가 이미 존재하는가? | **판정/저장 로직은 100% 재사용 가능.** `lib/api/admin/draws.ts`의 `registerDrawAndMatchUserNumbers()`/`parseAdminDrawsInput()`이 이미 "회차 저장 + 대조 + 알림"을 한 번에 처리한다(§8). 외부 데이터를 가져오는 fetch 계층만 없다. |
| 4. RLS/security가 이미 준비되어 있는가? | **준비됨, 변경 불필요.** `draws_select_public`(전체 공개 SELECT) + INSERT/UPDATE 정책 없음(=service_role 전용)이 이미 `0008_rls_policies.sql`에 있다(§5). 자동 수집이든 수동 입력이든 같은 RLS를 그대로 통과한다. |
| 5. 새 migration이 실제로 필요한가? | **draws/RLS 자체는 불필요.** 실행 이력 로깅 테이블은 "필요하다고 확정된 것"이 아니라 "있으면 좋은 것"이라 이번 감사에서 신규 migration을 제안하지 않는다(§14). |

**결론: 관리자 수동 입력 경로(Phase6)를 그대로 재사용할 수 있는 여지가 매우 크다.** 새로 만들 것은 "외부 데이터를 가져와서 기존 함수가 원하는 입력 형태로 변환하는 얇은 계층" 하나뿐이다.

---

## 4. 현재 draws 구조 감사

`supabase/migrations/0002_draws_user_numbers.sql`(원문 직접 확인, Phase6-2가 이미 확정한 내용과 동일 — 재조사 아님, 재인용):

| 컬럼 | 타입 | 제약 | 자동 수집 관점 |
|---|---|---|---|
| `round` | int | **UNIQUE NOT NULL** | 중복 회차 INSERT를 DB가 원천 차단(Postgres `23505` → 애플리케이션이 `DuplicateRoundError`로 매핑, 이미 구현됨) — **재실행/중복 트리거에 대한 1차 방어선이 이미 완성되어 있다** |
| `numbers`(당첨번호 6개) | int[] | CHECK `is_valid_lotto_numbers`(6개/1~45/중복없음) | 외부 데이터가 형식을 어겨도 DB가 최종적으로 거부한다(`23514`) — 다만 사용자에게 원시 에러를 그대로 보여주지 않으려면 애플리케이션 레벨에서 먼저 걸러야 한다(기존 `assertValidNumberSet` 재사용 가능, §8) |
| `bonus_number` | int | CHECK 1~45 | 동일 |
| `first_prize_amount`/`first_prize_count` | bigint/int | NOT NULL, DEFAULT 없음(의도적) | 외부 데이터에 이 필드가 없거나 파싱 실패하면 INSERT 자체가 불가능 — §7에서 "일부 필드 누락" 시나리오로 다룸 |
| `source` | varchar(50) | NOT NULL DEFAULT `'manual'` | **이미 자동화를 염두에 두고 만들어진 컬럼**(`DATABASE_SCHEMA.md` 주석 "Phase8에서... 'api' 등으로 구분 예정") — 스키마 변경 없이 INSERT 시 `'api'`/`'api_pending_review'` 등 다른 문자열만 넣으면 됨 |
| `created_at` | timestamptz | NOT NULL DEFAULT `now()` | 등록 시각. 실제 추첨일(`draw_date`) 컬럼은 없음(`BACKLOG.md` 항목 A, 기존 Known Issue, Phase8과 무관하게 이미 별도로 기록되어 있음) |

**RLS**(`0008_rls_policies.sql` §3, 원문 직접 재확인): `draws_select_public`(전체 공개 SELECT) + INSERT/UPDATE/DELETE 정책 없음(= `service_role`만 쓰기 가능). **변경 불필요.**

**관리자 service_role 쓰기 구조**: `lib/api/admin/draws.ts`가 `lib/supabase/service.ts`(`service_role`)로 `draws` INSERT + `user_numbers` 일괄 UPDATE를 수행하고, 호출 상위 계층(`app/api/admin/draws/route.ts`)이 `getCurrentUser()` → `isAdmin()` 순서로 인가한다.

**기존 관리자 수동 입력과의 충돌 여부**: **충돌 없음.** 자동 수집이 도입되어도 `POST /api/admin/draws`(수동 폼 제출)는 그대로 남아 동작한다 — `round UNIQUE`가 "누가 먼저 넣었든" 같은 방식으로 중복을 막아주므로, 자동 수집이 이미 등록한 회차를 관리자가 실수로 다시 수동 입력해도 `409 DUPLICATE_ROUND`로 안전하게 막힌다(반대 방향도 동일). **기존 관리자 수동 입력 기능을 삭제·변경하지 않는다는 지시(§5)를 지킬 수 있다 — 오히려 이 기능은 자동 수집의 fallback이자 검증 채널로 그대로 유지해야 한다.**

---

## 5. 필요한 API/Service

| 계층 | 재사용 가능 여부 | 근거 |
|---|---|---|
| 입력 검증(`parseAdminDrawsInput`) | **100% 재사용** | round/`assertValidNumberSet`/`assertValidBonusNumber`/금액·인원 검증이 이미 있다. 외부 데이터를 이 함수가 받는 형태(`AdminDrawInput`)로만 매핑하면 됨 |
| 저장+대조+알림(`registerDrawAndMatchUserNumbers`) | **100% 재사용, 복제 금지 원칙과 일치**(§8) | draws INSERT → `user_numbers` 대조 → `createWinNotification` 전부 이미 한 함수 안에 있다 |
| 외부 데이터 조회 | **신규 필요** | 이 계층만 새로 작성해야 한다 — 외부 소스에서 값을 가져와 `AdminDrawInput` 형태로 정규화하는 순수 매핑 함수 하나 |
| 신뢰 검증(외부 데이터가 실제로 유효한 회차 결과인지) | **신규 필요(얇게)** | "이번 주 회차가 아직 발표 전"/"필드 누락" 등은 기존 `parseAdminDrawsInput`이 검증하는 형식 문제와 다른 종류의 문제라 별도 사전 필터가 필요(§7) |

**새 API Route(엔드포인트) 자체가 필요한지는 아키텍처 결정(§6~§8)에 따라 달라진다** — "온디맨드 조회 보조" 방식을 택하면 조회 전용 GET 하나만 있으면 되고, "cron 완전 자동" 방식을 택하면 별도 secret 인증이 붙은 POST가 필요하다(§10). 이번 Task는 실제 Route를 만들지 않는다.

---

## 6. 외부 데이터 소스 조사 결과 (실측)

### 공식 데이터 접근 방식

**공식 API 없음.** 실제 웹 조사(WebSearch) 결과:

- **공공데이터포털(data.go.kr)**: "온라인복권 1등 당첨 판매점 현황"(재정경제부), "온라인복권 판매점 주소"(기획재정부) 데이터셋은 존재하지만, 이는 **1등 배출 판매점 정보**이지 **회차별 당첨번호 6개+보너스+당첨금액/인원**을 제공하는 데이터셋이 아니다. `draws` 테이블이 필요로 하는 데이터(회차별 당첨번호)를 공식적으로 제공하는 API는 이번 조사에서 확인되지 않았다.
- **동행복권(dhlottery.co.kr) 공식 Open API**: 존재하지 않는다. 공식 문서화된 API 상품이 없다.

### 비공식 접근 방식

- **`https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=<회차>`**: 동행복권 자체 웹페이지가 내부적으로 쓰는 JSON 응답 엔드포인트로, 오랫동안 커뮤니티에서 비공식적으로 활용해 온 방식이다(GitHub `roeniss/dhlottery-api` 등 비공식 래퍼 다수 존재). **공식 지원/문서화/SLA가 없다.**
- **실측으로 확인한 리스크**:
  1. **해외 IP 차단**: "현재 접속하신 아이피에서는 접속이 불가능합니다" 메시지로 국내 IP가 아니면 접속 자체가 차단된다는 다수의 실사용 보고를 확인했다. Vercel/Supabase의 기본 실행 리전이 한국이 아니면 이 엔드포인트 자체를 호출할 수 없을 위험이 있다(§8 아키텍처 결정에 직접 영향).
  2. **불안정성**: 커뮤니티 게시물(2026년 게시물 포함)에서 "아래 코드는 막혀 있습니다"라는 언급이 반복적으로 발견됨 — 특정 시점에 이 엔드포인트가 동작하지 않게 된 사례가 실제로 있었다는 뜻이다. 언제든 예고 없이 형식이 바뀌거나 막힐 수 있다.
  3. **약관/저작권**: `dhlottery.co.kr/robots.txt`를 실제로 확인한 결과 `/resources/`, `/winImages/`만 차단하고 있어 `common.do`/`gameResult.do` 경로 자체는 크롤러 차단 대상이 아니다(robots 관점에서는 명시적 금지가 없음). 다만 이용약관(`/trms/home`) 페이지를 실제로 조회했으나 **자동 수집을 명시적으로 금지/허용하는 조항을 이번 조사에서는 발견하지 못했다**(SPA 렌더링으로 전체 약관 본문을 확보하지 못한 조사 한계 — "약관상 명시적으로 허용됨"으로 확정하지 않는다).
- **HTML 스크래핑**(`gameResult.do?method=byWin` 등): 기술적으로 가능하지만 마크업 구조 변경에 취약하고, 위와 같은 지역 차단/불안정성 리스크를 그대로 안는다. JSON 엔드포인트보다 얻는 이점이 없다.

### 안정성/장애 시 fallback

- **안정성: 낮음~중간.** 공식 지원이 없는 비공식 엔드포인트에 의존하는 구조는 언제든 조용히 깨질 수 있다.
- **Fallback: 이미 존재한다.** Phase6이 만든 관리자 수동 입력 폼(`POST /api/admin/draws`)이 자동 수집 실패 시 100% 그대로 대체 가능한 fallback이다 — **이 fallback을 유지하는 것이 자동화 도입의 전제조건**이어야 한다(ADMIN_REQUIREMENTS.md §3.1이 이미 "완전 자동입력이 아닌 승인 단계"를 원칙으로 못박아 둔 것과 정확히 일치).

**결론(지시문 §4 요구대로 명확히 기록): "공식 API 없음."** 비공식 엔드포인트를 채택하더라도 "보조 자동화"(관리자 확인/승인 필수, 실패 시 수동 입력 무영향)로만 취급해야 하며, 이를 서비스의 핵심 신뢰 경로로 격상시키지 않는다.

---

## 7. 자동화 아키텍처 후보 비교

| 후보 | 유지보수 비용 | 1인 개발 적합성 | Free Tier 영향 | 실패 감지 | service_role 노출 위험 | 기존 구조 호환성 |
|---|---|---|---|---|---|---|
| **A. Vercel Cron → 내부 Route Handler** | 낮음(기존 Vercel 배포에 포함) | 높음(추가 계정/서비스 없음) | Hobby 플랜: cron 최대 2개, **1일 1회 빈도 제한**(실측 확인, §7-부록) — 주 1회 발표되는 로또 특성상 충분 | Vercel 대시보드 Cron 실행 로그로 확인 가능 | 서버 사이드 Route Handler 안에서만 `service_role` 사용 → 노출 없음. 단, cron 트리거에는 세션이 없어 **기존 `isAdmin()`(쿠키 기반)을 못 씀** → 별도 secret 인증 필요(§10) | 높음 — 기존 Next.js API Route 패턴 그대로 |
| **B. Supabase Edge Function → 외부 수집** | 중간(별도 배포·모니터링 지점 추가) | **낮음 — `IMPLEMENTATION_PLAN.md` §4.3이 "ROADMAP Phase5 이후 도입"으로 명시적으로 유보한 인프라** | pg_cron/pg_net 활성화 필요(Supabase 무료 티어에서도 가능하나 별도 설정) | Supabase Functions 로그, 별도 대시보드 확인 필요 | Edge Function 자체는 서버 실행 환경이라 노출 없음. 다만 이 프로젝트가 지금까지 "MVP는 Edge Function 도입 안 함" 원칙을 지켜왔다는 점과 정면 충돌 | **낮음 — 이 프로젝트에 Edge Function이 단 하나도 없는 상태에서 처음 도입하는 것이 됨(전례 없음)** |
| **C. 별도 외부 Cron 서비스**(cron-job.org, GitHub Actions 등) | 중간(제3의 계정/서비스 추가 관리 필요) | 낮음 — "1인 운영 관리 지점 최소화" 원칙(`ROADMAP.md` §4)과 배치 | 무관(별도 서비스) | 그 서비스 자체의 알림 기능에 의존, 이 프로젝트 관측성과 분리됨 | 호출 대상 엔드포인트에 secret 인증 필요(A와 동일 문제) | 낮음 — 관리 지점이 하나 더 늘어남 |
| **D. 수동 입력 fallback + 자동 수집 보조** | — (독립 옵션이 아니라 **A/B/C 어느 것을 택하든 반드시 함께 적용해야 하는 설계 원칙**) | — | — | — | — | `ADMIN_REQUIREMENTS.md` §3.1이 이미 이 원칙(승인 단계 유지)을 확정해 둠 |
| **E. 온디맨드 조회 보조(신규 제안, cron 없음)** | **가장 낮음** — 새 스케줄러/배포 지점 자체가 없음 | **가장 높음** | 영향 없음(요청 시에만 외부 호출) | 관리자가 직접 화면에서 즉시 확인(성공/실패가 그 자리에서 보임) | **cron 인증 문제 자체가 발생하지 않음** — 항상 로그인한 관리자의 브라우저 요청이므로 기존 `isAdmin()`을 그대로 재사용 가능 | **가장 높음** — 기존 `POST /api/admin/draws`를 전혀 변경하지 않고 그 앞에 "미리 채우기" 조회 하나만 추가 |

### 비교 기준 상세

- **중복 회차 방지**: A~E 어느 것을 택해도 `draws.round UNIQUE`가 최종 방어선이라 동일하게 안전하다(§4).
- **재실행 안전성**: `registerDrawAndMatchUserNumbers()`가 이미 "같은 회차 재등록 시 `DuplicateRoundError`로 즉시 중단"하므로(§8), 트리거 방식과 무관하게 재실행 안전성은 기존 함수가 이미 보장한다.
- **service_role 노출 위험**: A/B/C/E 전부 서버 사이드에서만 `service_role`을 쓰므로 "클라이언트에 노출"되는 위험 자체는 없다. 진짜 차이는 "누가 이 엔드포인트를 트리거할 수 있는가"의 인증 방식이다 — cron 기반(A/B/C)은 세션이 없어 새로운 secret 메커니즘이 필요하고, 온디맨드(E)는 기존 관리자 세션 인증을 그대로 쓸 수 있어 새로운 인증 계층 자체가 필요 없다.

---

## 8. 최종 아키텍처 결정

**결론을 하나 선택한다(지시문 §6). 실제 구현은 이번 Task에서 하지 않는다.**

### 선택: E. 온디맨드 조회 보조 + D. 승인 단계 유지 (조합)

**"관리자가 회차 입력 화면에 진입 시, 서버가 그 요청 안에서 비공식 외부 엔드포인트를 조회해 폼 초기값을 채워주고, 관리자가 확인 후 기존 `POST /api/admin/draws`로 저장한다. 별도 cron/스케줄러/Edge Function을 도입하지 않는다."**

### 선택 이유

1. **`IMPLEMENTATION_PLAN.md` §4.3과 정면으로 충돌하지 않는 유일한 후보다.** A(Vercel Cron)와 B(Edge Function)는 모두 "정해진 시각에 사람 개입 없이 실행되는 배치"이고, 이는 이 문서가 명시적으로 "ROADMAP Phase5 이후"로 유보해 둔 정확히 그 인프라다. E는 "관리자 액션이 트리거하는 동기 처리"라 Phase6이 이미 확립한 원칙(`app/api/admin/draws/route.ts`가 요청 안에서 동기 처리)과 **완전히 같은 패턴**이다.
2. **`isAdmin()` 재사용 문제가 아예 생기지 않는다.** cron 기반 방식은 세션이 없어 기존 관리자 인증(`getCurrentUser()`+쿠키)을 쓸 수 없고 별도 secret 메커니즘을 새로 설계해야 한다(§10) — 이는 "기존 `/api/admin/*` 관리자 인증과 혼동하지 않는다"는 지시(§10)를 지키기 위해 추가 설계·문서화 부담이 필요하다는 뜻이다. E는 항상 로그인한 관리자의 브라우저 요청이므로 이 문제 자체가 없다.
3. **비공식 엔드포인트의 낮은 안정성(§6)과 정확히 맞는 신뢰 수준이다.** 완전 무인 자동화(A/B/C)는 "장애 시 아무도 모르게 조용히 실패"할 위험이 있는데(모니터링 인프라를 갖추지 않은 1인 개발에서 특히 위험), E는 실패하면 관리자가 그 자리에서 바로 보고 기존 수동 입력으로 전환하면 된다 — **장애 감지 인프라를 별도로 만들 필요가 없다.**
4. **1인 개발 적합성이 가장 높다.** 새 배포 파이프라인, 새 모니터링 대시보드, 새 시크릿 관리 지점이 전혀 늘어나지 않는다.

### 향후 확장 경로(지금 채택하지 않음, 기록만)

ROADMAP Phase5(쇼핑몰) 이후 실제로 "완전 무인 자동화"가 필요해지는 시점이 오면, 그때는 **A(Vercel Cron)**를 우선 검토한다 — 이미 Vercel을 쓰고 있어 계정 추가가 없고, Vercel이 서울 리전(`icn1`)을 지원해 §6의 해외 IP 차단 리스크를 완화할 수 있다는 이점이 B(Supabase Edge Function)보다 크다. 이 결정은 지금 확정하지 않는다 — 그 시점의 실제 요구(§8-원문 인용: "user_numbers 대조가 동기 처리로 감당 안 될 만큼 증가" 등, `IMPLEMENTATION_PLAN.md` §4.3의 4개 트리거 조건)를 그때 다시 확인해야 한다.

---

## 9. 데이터 검증 규칙

지시문 §7이 요구한 시나리오를 "DB가 이미 막아주는 것"과 "애플리케이션이 별도로 막아야 하는 것"으로 분리한다.

| 시나리오 | DB가 막아주는가 | 애플리케이션이 막아야 하는가 |
|---|---|---|
| 이미 존재하는 round 재등록 | **막아줌**(`round UNIQUE` → `23505`) | 없음 — 기존 `DuplicateRoundError` 매핑 그대로 재사용 |
| 같은 회차를 두 번 수집(정확히 동일 요청 중복) | **막아줌**(위와 동일 메커니즘) | 없음 |
| 외부 데이터가 잘못 들어옴(숫자가 아님, 45 초과 등) | **부분적으로 막아줌**(`is_valid_lotto_numbers` CHECK, `23514`) | **필요** — DB가 원시 에러를 던지기 전에 `assertValidNumberSet`/`assertValidBonusNumber`(이미 존재, 재사용)로 먼저 걸러 사용자 친화적 에러 메시지를 만들어야 함 |
| 네트워크 실패(외부 호출 자체가 실패) | 해당 없음(DB에 도달 전 단계) | **필요** — fetch 실패를 명확한 에러로 관리자 화면에 표시하고, "폼을 비워둔 채 수동 입력으로 전환" 가능해야 함(E 아키텍처가 이를 자연스럽게 지원, §8) |
| 일부 필드 누락(예: 1등 당첨금 필드가 응답에 없음) | **막아줌**(`first_prize_amount`/`first_prize_count` NOT NULL, DEFAULT 없음) | **필요** — DB CHECK 위반(`23502`)으로 떨어지기 전에 애플리케이션이 먼저 "필드 누락"으로 명확히 보고해야 함 |
| winning number 형식 오류(6개가 아님, 중복 등) | **막아줌**(CHECK) | 위와 동일하게 사전 검증 권장 |
| bonus number가 본번호와 중복 | **DB CHECK로는 안 막아줌**(`bonus_number`는 1~45 범위만 CHECK, 본번호와의 중복 비교는 CHECK 표현식에 없음) | **필요** — 다행히 `lib/logic/matchNumbers.ts`의 `assertValidBonusNumber(bonusNumber, winningNumbers)`가 **이미 이 규칙을 구현하고 재사용 중**이다(`lib/api/admin/draws.ts:64`에서 이미 호출됨) — 새로 작성할 필요가 없다 |
| 잘못된 round(오타로 비정상적으로 큰 값 등) | **부분적**(정수 여부는 타입, 상한은 없음) | `parseAdminDrawsInput`이 이미 `MAX_ROUND=100_000` 상한 검증을 하고 있어(§4/§8 재확인) 재사용 가능 |
| 과거 회차 재수집(이미 지난 회차를 다시 가져옴) | round UNIQUE로 결과적으로 막힘(이미 등록된 값이면 `DuplicateRoundError`) | 미등록 과거 회차(예: 데이터 초기 적재)라면 오히려 정상 시나리오 — 별도 차단 불필요 |
| 현재 회차가 아직 발표되지 않음 | 해당 없음(외부 API가 애초에 데이터를 안 줌) | **필요, 신규 판단 로직** — 외부 응답이 "아직 추첨 전"임을 나타내는 값(예: 동행복권 응답의 `returnValue: "fail"`류 필드로 알려진 관행, §6 조사에서 정확한 필드명까지는 확정하지 못함)을 감지해 "아직 발표되지 않음"으로 명확히 표시하고 폼을 비워두는 로직이 필요 — 이는 형식 검증이 아니라 **새로 작성해야 하는 유일한 로직**이다 |

---

## 10. 중복/재실행/idempotency 전략

- **회차 단위 idempotency는 이미 완성되어 있다.** `registerDrawAndMatchUserNumbers()`가 draws INSERT를 항상 먼저 시도하고, 실패(중복)하면 대조/알림 루프 자체에 진입하지 않는다(`lib/api/admin/draws.ts:121-138`, 원문 재확인) — **즉 같은 회차로 몇 번을 재시도해도 부작용은 "최초 1회"로 고정된다.**
- **E(온디맨드) 아키텍처를 선택했으므로 cron 중복 실행(동시성) 문제 자체가 사실상 없다** — 관리자가 화면을 두 번 새로고침해도 각각은 "조회"일 뿐 "저장"은 관리자가 명시적으로 확인 버튼을 눌러야 발생하고, 그 저장 요청도 기존 `round UNIQUE`로 보호된다.
- 만약 향후 A(Vercel Cron)로 전환한다면 추가로 고려할 것: Vercel Cron은 "정시 근처 1시간 이내" 느슨한 타이밍 보장만 하므로(§7 실측) 이론적으로 겹쳐 실행될 가능성은 낮지만 0은 아니다 — 그래도 `round UNIQUE`가 이미 최종 방어선이라 **새로운 락/트랜잭션을 추가로 설계할 필요는 없다**(Phase6-2가 이미 "불필요하게 복잡한 transaction 도입 금지" 원칙을 확정했고, 이번 조사도 같은 결론에 도달했다 — 재확인).

---

## 11. Phase6 연동 전략

지시문 §8이 요구한 항목을 대조한다.

- **`target_round` 연결**: `registerDrawAndMatchUserNumbers()`가 이미 `target_round IS NULL AND checked_at IS NULL AND user_id IS NOT NULL`인 행을 조회해 새 `draw.round`로 연결한다 — 자동 수집이 채워주는 것은 이 함수의 입력(`AdminDrawInput`)뿐이므로 연결 로직 자체는 손댈 필요가 없다.
- **`matchNumbers()`**: 그대로 재사용(`lib/logic/matchNumbers.ts`, 무수정).
- **`match_count`/`win_rank`/`checked_at`**: 동일 함수 안에서 그대로 채워짐.
- **`notifications`**: `createWinNotification()` 그대로 재사용.
- **`registerDrawAndMatchUserNumbers()` 재사용 가능 여부**: **가능, 그리고 재사용해야 한다(지시문 "판정 로직을 복제하지 않는다").** 새로 작성할 코드는 "외부 데이터 → `AdminDrawInput` 매핑" 한 겹뿐이며, 이 함수의 시그니처(`AdminDrawInput` 입력)를 그대로 만족시키기만 하면 된다.

**결론: Phase6의 판정 로직은 자동 수집 도입 여부와 무관하게 단 한 줄도 바뀌지 않는다.**

---

## 12. 알림 중복 방지 전략

- `notifications`/`notification_deliveries`(`0006_notifications.sql`, 원문 재확인)에는 `(user_id, round, type)` 같은 UNIQUE 제약이 없다 — 이론적으로 `createWinNotification()`이 같은 유저·회차에 두 번 불리면 중복 알림 행이 생길 수 있는 구조다.
- **그러나 이번 조사에서 이것이 자동화 때문에 새로 생기는 위험이 아님을 확인했다.** `createWinNotification()`은 `registerDrawAndMatchUserNumbers()`의 대조 루프 안에서만 호출되고, 그 루프는 draws INSERT가 성공한 이후에만 도달 가능하다(§10) — 즉 "같은 회차를 두 번 등록 시도"는 **이미 draws INSERT 단계에서 막혀 대조 루프에 진입조차 못 하므로 중복 알림 경로 자체가 없다.**
- 남는 이론적 위험은 "한 번의 등록 실행 안에서 같은 사용자 행이 두 번 매칭되는 경우"인데, 대조 대상 조회 자체가 `user_numbers.id` 단위 SELECT라 같은 행이 한 루프 안에서 두 번 나올 수 없다 — **애플리케이션 로직상 발생 불가능.**
- **현재 구조로 충분하다.** DB 변경(UNIQUE 제약 추가)이 필요하다고 확정할 근거를 찾지 못했으므로 migration을 제안하지 않는다(지시문 §9 "migration은 실제 필요성이 확인된 경우에만 제안"). 다만 이는 "이번 Task가 도입하려는 E(온디맨드) 아키텍처+기존 `registerDrawAndMatchUserNumbers()` 재사용" 전제하의 결론이다 — 만약 향후 판정 로직 자체를 재작성하거나 다른 경로로 알림을 발생시키는 코드가 추가되면 이 결론을 다시 검증해야 한다.

---

## 13. 보안 구조

지시문 §10의 원칙을 각각 확인한다.

| 원칙 | 확인 결과 |
|---|---|
| `service_role`은 서버 전용 | E 아키텍처는 기존 `app/api/admin/draws/route.ts`와 동일하게 서버 사이드(Route Handler)에서만 `lib/supabase/service.ts`를 사용 — 새로운 노출 지점 없음 |
| 클라이언트에서 `service_role` 접근 금지 | 동일 — 조회 전용 엔드포인트도 서버에서만 외부 API를 호출하고 결과만 클라이언트(관리자 화면)에 내려준다 |
| 외부 요청값으로 `user_id` 결정 금지 | 이 기능은 애초에 특정 사용자 대상 쓰기가 아니라 `draws`(공개 데이터) 쓰기라 `user_id` 개념 자체가 없음 — 해당 없음 |
| 일반 사용자가 자동 수집 endpoint를 호출해 관리자 작업을 실행할 수 없어야 함 | **E 아키텍처의 핵심 장점** — 조회 전용 endpoint도 기존 `isAdmin()` 검사를 그대로 통과해야만 응답하도록 설계하면 되고(저장은 어차피 기존 `POST /api/admin/draws`가 재검증), 일반 사용자는 관리자 인증 단계에서 이미 차단됨 |
| cron/secret 인증이 필요한 경우 적절한 방식으로 보호 | **E 아키텍처는 cron이 없어 이 항목 자체가 해당 없음.** 향후 A(Vercel Cron)로 전환 시에는 Vercel 공식 관행(요청 헤더의 `Authorization: Bearer <CRON_SECRET>` 검증, 환경변수로 관리)을 도입해야 하며, 이는 **`isAdmin()`과는 완전히 다른 별도 인증 경로**로 설계해야 한다(다음 항목과 직결) |
| 기존 `/api/admin/*` 관리자 인증과 혼동하지 않음 | E 아키텍처는 오히려 **기존 관리자 인증을 그대로 재사용**하므로 혼동 자체가 발생하지 않는다 — 이것이 A/B/C 대비 E를 선택한 핵심 이유 중 하나(§8) |

---

## 14. Migration 필요 여부

**필요 없음.** 근거:

- `draws.source`가 이미 자동화 값을 담을 자리로 준비되어 있다(§4).
- RLS 변경 불필요(§4).
- 실행 이력 로깅 테이블(예: 외부 fetch 성공/실패 기록)은 "있으면 진단에 유용"하지만, E 아키텍처(관리자가 그 자리에서 성공/실패를 직접 봄)에서는 **필수가 아니다** — 나중에 A(Cron)로 전환할 때 재검토할 사항으로 남겨둔다. 지금 이 결론을 뒤집을 근거가 없으므로 migration을 제안하지 않는다.

---

## 15. Phase8 세부 구현 단계 (실제 착수 시 참고용, 이번 Task에서 실행하지 않음)

1. 외부 데이터 조회 → `AdminDrawInput` 매핑 순수 함수 작성(`lib/api/admin/draws.ts` 확장 또는 신규 파일, 기존 `parseAdminDrawsInput`/`registerDrawAndMatchUserNumbers`는 무수정).
2. "아직 미발표" 상태를 명확히 구분하는 응답 처리(§9).
3. 조회 전용 Route Handler(기존 `isAdmin()` 재사용) — 저장은 하지 않고 폼 초기값만 반환.
4. 관리자 화면(이 시점에 `/admin/*`이 아직 없다면 Phase9 관리자 UI와 함께, 또는 임시로 기존 관리자 전용 방식 유지)에서 "자동 조회" 버튼 → 폼 미리 채움 → 기존 저장 흐름 그대로.
5. 실제 Supabase/외부 API 대상 실측 검증(성공/실패/미발표 3가지 케이스).

---

## 16. Critical / High / Medium / Low

| 등급 | 건수 | 내용 |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 1 | §0/§1: "Phase8" 정의가 EXECUTION_PLAN.md 자신의 섹션명과 이 프로젝트의 실제 관행(다른 7개 문서) 사이에서 충돌 — 구현 방향을 결정하기 전에 반드시 사용자 확인 필요 |
| Low | 1 | 비공식 외부 데이터 소스의 낮은 안정성(§6) — E 아키텍처(승인 단계 필수)로 이미 완화됨, 추가 조치 불필요 |

이번 Task는 조사만 수행했으므로 코드 결함은 발견될 수 없다(수정 대상 코드가 없음).

---

## 17. 기존 Known Issues 영향도

지시문 §12가 나열한 항목 중 Phase8과 직접 관련된 것만 판단한다.

| 이슈 | Phase8 관련성 |
|---|---|
| `/generate` vs `/generate/auto` 문서 불일치 | 무관 |
| `proxy.ts` vs Architecture Decision 문서 불일치 | 무관 — 자동 수집 endpoint는 `/api/admin/*`이 아닌 새 경로를 쓰더라도 E 아키텍처는 기존 `isAdmin()` 인증 패턴을 그대로 따르므로 `proxy.ts` 변경이 필요 없다(전수 확인: `proxy.ts`의 `PROTECTED_API_PATHS`가 이미 `/api/admin` 전체를 포함하므로, 새 엔드포인트를 `/api/admin/draws/*` 하위에 두면 별도 `proxy.ts` 수정 없이 기존 보호를 그대로 상속받는다) |
| `color-danger`/`color-success` WCAG | 무관 |
| 번호 구간 5색 | 무관 |
| Fortune Phase 미배정 | 무관 |
| 카카오 공유 Phase 미배정 | 무관 |
| **Case C 완전 원자성**(부분 실패 시 일부 `user_numbers` 미대조) | **직접 관련— 그러나 자동화가 이 문제를 악화시키지 않는다.** §11에서 확인했듯 자동 수집도 동일한 `registerDrawAndMatchUserNumbers()`를 그대로 쓰므로 기존 한계(실패한 행은 다음 회차 때 재시도됨, `PHASE6_ADMIN_DRAW_PROCESSING_REPORT.md` §10에 이미 기록)가 그대로 상속될 뿐 새로운 위험이 추가되지 않는다. 다시 해결하지 않는다 |
| `user_numbers` 판정 컬럼 위조 가능성 | 무관 — 자동 수집은 `draws` 쓰기 경로이지 `user_numbers.match_count`/`win_rank`를 클라이언트가 직접 조작하는 경로가 아니다 |
| `admin_audit_logs` 미구현 | **간접 관련** — 자동 수집이 도입되면 "누가/무엇이 이 회차를 등록했는가"(관리자 수동 vs 자동 승인)를 감사 로그로 남기고 싶어질 수 있으나, `admin_audit_logs` 자체는 Phase9로 이미 이월 확정된 사항이라 이번에도 다시 끌어오지 않는다. `draws.source` 값만으로 최소한의 구분은 가능(§4) |
| Phase7 SSG/ISR | 무관 |

---

## 18. Phase8-1에서 정확히 무엇을 구현할지

**이 절은 "Phase8 = 외부 자동 수집"으로 확정될 경우"에 한정한 제안이다.** §0/§19에서 다루는 정의 충돌이 먼저 해소되어야 한다.

가장 작은 구현 단위 하나만 제안한다(지시문 §16-C와 동일한 요구를 이 절에서도 반복):

**외부 데이터 조회 → `AdminDrawInput` 매핑 순수 함수 하나만 작성한다.** API Route도, UI도, cron도 만들지 않는다 — `lib/api/admin/draws.ts`에 인접한 신규 파일(예: `lib/api/admin/drawSource.ts`)에 "회차 번호를 받아 외부 엔드포인트를 호출하고, 성공하면 `AdminDrawInput` 형태로, 실패/미발표면 명확한 에러 타입으로 반환하는" 함수 하나와 그 유닛 테스트(외부 호출은 mock)만 작성한다. 이 함수는 아직 어디에서도 호출되지 않는 "격리된 유틸"이라 Phase8의 나머지(Route/UI)가 무엇으로 결정되든 재사용 가능하고, 잘못되어도 기존 시스템에 영향을 주지 않는다.

---

## 19. Phase8 Ready 판정

### 두 갈래로 나누어 판정한다 — "Phase8"의 정의가 확정되지 않았기 때문이다(§0).

**(A) Phase8 = EXECUTION_PLAN.md의 "SEO"라면**: **READY.** 의존성(Phase7 완료)이 이미 충족됐고, Critical/High 이슈가 없다. 별도 사전 감사 없이 바로 착수 가능한 상태다(단, EXECUTION_PLAN.md 자신이 이 감사 대상이 아니었으므로 착수 직전 별도의 Phase8-0류 SEO 감사가 필요할 수 있음 — 이번 Task 범위 밖).

**(B) Phase8 = 외부 당첨번호 자동 수집(이번 Task가 실제로 조사한 대상)이라면**: **CONDITIONAL READY.** 기술적으로는 Critical/High 결함이 없고(§16), 아키텍처 결정(§8)까지 끝났으며, 필요한 서비스 로직(`registerDrawAndMatchUserNumbers`)이 이미 100% 재사용 가능한 상태다. 그러나:
- 이 프로젝트 자신의 `IMPLEMENTATION_PLAN.md` §4.3이 "관련 인프라(Edge Function/cron) 도입은 ROADMAP Phase5 이후"라고 명시적으로 유보해 둔 시점을 이 프로젝트가 아직 지나지 않았다(단, 이번 감사가 채택한 E 아키텍처는 그 인프라 자체를 요구하지 않으므로 이 유보 조항과 직접 충돌하지는 않는다 — §8 참조).
- ROADMAP 타임라인상 "외부 API 자동화"는 Phase1(MVP)~Phase7(멤버십)이 전부 끝난 뒤에도 계속되는 최장기 과제로 위치해 있어, 지금(ROADMAP Phase1도 진행 중) 착수하는 것이 이 프로젝트의 우선순위 설계와 맞는지는 **기술 문제가 아니라 제품 우선순위 결정 문제**다.

**Critical/High 문제가 없으므로 (B) 해석을 택하더라도 기술적으로 Phase8-1 착수를 막을 이유는 없다** — 다만 "지금 이것부터 할 것인가"는 이번 감사의 조사 범위를 넘는 제품 판단이다.

---

## 가장 중요한 출력

### A. Phase8에서 실제로 만들 것 (Phase8 = 외부 자동 수집으로 확정될 경우)

- `lib/api/admin/drawSource.ts`(신규, 최소): 외부 엔드포인트 → `AdminDrawInput` 매핑 순수 함수 + "아직 미발표" 판별 로직.
- (그 다음 단계, Phase8-1 이후) 조회 전용 Route Handler(기존 `isAdmin()` 인증 재사용) — 저장은 하지 않음.
- (그 다음 단계) 관리자 화면의 "자동 조회로 채우기" 버튼 — 기존 `POST /api/admin/draws` 저장 흐름은 무수정.
- `lib/api/admin/draws.ts`(`parseAdminDrawsInput`/`registerDrawAndMatchUserNumbers`), `matchNumbers.ts`, `draws` 테이블/RLS는 전부 **무수정 재사용**.

### B. Phase8에서 만들지 않을 것

- Vercel Cron, Supabase Edge Function, pg_cron, 외부 Cron 서비스 — 어느 것도 지금 도입하지 않는다(§8, `IMPLEMENTATION_PLAN.md` §4.3과 충돌).
- 새 migration/RLS 변경 — 불필요(§14).
- `admins`/관리자 UI(`/admin/*`) 신규 구현 — Phase9 범위, 끌어오지 않는다.
- 통계/커뮤니티/공유/카카오공유/멤버십/AI추천/`admin_audit_logs`/번호 생성 알고리즘 변경/Dream 기능 추가/디자인 전면 개편 — 전부 범위 밖(지시문 §11 그대로 준수, 이번 조사에서 실제로 끌어온 항목 없음).
- 기존 `POST /api/admin/draws`, `registerDrawAndMatchUserNumbers()`, `isAdmin()`, `proxy.ts` — 전부 무수정.

### C. 다음 Claude Code 작업

**두 가지 선택지가 있으며, 어느 쪽을 다음 작업으로 할지는 사용자 결정이 필요하다(§0/§19):**

1. **EXECUTION_PLAN.md 원문 그대로 "Phase 8 — SEO"를 다음 작업으로 진행** — 의존성 충족, 즉시 착수 가능(READY).
2. **외부 자동 수집을 "Phase8-1"로 이어서 진행** — 가장 작은 단위는 §18에 제안한 `lib/api/admin/drawSource.ts`(외부 조회→매핑 순수 함수 + 유닛테스트만, Route/UI/cron 없음) 하나뿐이다.

Critical/High 문제는 어느 경로든 없으므로, 사용자가 방향을 선택하면 그 즉시 **READY**로 착수할 수 있다.
