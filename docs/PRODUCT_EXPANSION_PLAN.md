# Product Expansion Plan — 제품 경험 개선 및 향후 핵심 기능 확장 방향

> 이번 문서는 Phase10(출시 준비) 상태를 깨뜨리지 않는 것을 최우선으로 한다. **실제 코드로 구현한 것은 PART A(번호 생성 UX)뿐**이며, 나머지(꿈해몽 세분화/오늘의 행운/추가 로그인/커뮤니티/수익화)는 조사와 설계만 수행했다. DB/Auth/Community/Payment는 이번 Task에서 임의로 구현하지 않았다 — 전부 "제안"이며 마이그레이션은 없다.

---

## 1. 번호 생성 UX 변경 (실제 구현)

### 1.1 변경 파일

- `components/generate/NumberGenerator.tsx`(수정) — 셔플→공개 2단계 연출 추가.
- `components/generate/generatorSaveLogic.ts`(수정) — 연출 타이밍 순수 함수/상수 추가(`getShuffleDurationMs`/`getRevealDurationMs`/`getTotalAnimationDurationMs`).
- `components/generate/generatorSaveLogic.test.ts`(수정) — 타이밍 검증 테스트 5건 추가.

`generateNumbers()`(`lib/logic/generateNumbers.ts`), `app/api/numbers/route.ts`, `lib/api/numbers.ts`, `app/generate/page.tsx`는 **전혀 수정하지 않았다**(git 상태로 확인).

### 1.2 연출 설계

버튼 클릭(또는 첫 진입) → **셔플 단계**(decoy 숫자가 90ms 간격으로 빠르게 바뀌며 "행운 번호를 섞고 있어요" 문구 표시) → **공개 단계**(실제 번호 6개가 150ms 간격으로 하나씩 scale/opacity 전환되며 나타남) → **완료**("행운 번호가 완성됐어요." 문구 + 저장/공유 상태 표시).

| 구간 | 첫 생성 | 다시 생성 |
|---|---|---|
| 셔플 | 1000ms | 500ms |
| 공개(6개 × 150ms) | 900ms | 900ms |
| **총합** | **1900ms(≈1.9초)** | **1400ms(≈1.4초)** |

지시문 §A-1(전체 1.5~2.5초, 5초 이내) · §A-2(첫 생성 ~2초, 재생성 ~1~1.5초)를 실제 상수로 만족시키고, 단위 테스트로 이 범위를 고정했다(§15). decoy 숫자는 `generateNumbers()`를 그대로 재사용한다 — 새 난수 로직을 만들지 않았다. `prefers-reduced-motion`이 설정된 브라우저는 연출을 전혀 재생하지 않고 결과가 즉시 나타난다(마운트 시 `window.matchMedia` 확인, DESIGN_SYSTEM.md §6 기존 원칙 재사용).

### 1.3 버튼 우선순위 (§A-3) — 조사 결과와 판단

실제 코드를 확인한 결과: **로그인 사용자에게는 저장이 이미 자동으로 이루어지고(별도 "저장하기" 버튼 없음), 공유 기능은 아직 구현되어 있지 않다**(전수 확인 — `share_cards` 테이블은 존재하나 공유 UI/API 코드 없음). 즉 이 화면에 실제로 존재하는 유일한 버튼은 "다시 생성하기"뿐이라 **승격시킬 실제 Primary 행동이 없다.** 가짜 버튼을 추가하지 않고, 대신 (1) 완성된 결과(번호 6개 + 완료 문구)가 연출을 통해 화면의 시각적 중심이 되도록 하고, (2) "다시 생성하기"는 기존과 동일한 `secondary` variant를 유지했다. 다만 raw `<button>+buttonClassName()`을 실제 `Button` 컴포넌트로 교체해 연출 중 `disabled` 시각 상태(회색 처리)를 얻었다 — 이전에는 이 상태 자체가 없었다.

### 1.4 중복 클릭 방지 (§A-4)

`phase !== "done"`일 때 `Button`의 `disabled` prop으로 막는다(브라우저가 disabled 버튼의 click/keyboard 이벤트 자체를 발생시키지 않아 이벤트 핸들러 방어보다 근본적이다) + `handleRegenerate` 내부에서도 동일 조건으로 한 번 더 확인(기존 코드베이스의 `requestIdRef` 방어적 이중 확인 스타일과 동일).

### 1.5 저장 계약 (§A-5) — 변경 없음, 근거

`numbers` 상태(저장 이펙트가 구독하는 값)는 **연출 이전, 클릭과 같은 tick에 즉시 갱신된다** — 셔플 애니메이션은 별도의 `shuffleDisplay` 로컬 상태로만 표시되고 `numbers`에는 전혀 관여하지 않는다. 저장 `useEffect`(의존성 배열: `[numbers, authState, dreamContext]`)는 Phase5 이래 로직을 한 글자도 바꾸지 않았다 — 저장 요청이 발생하는 시점은 기존과 정확히 동일하다. 유일하게 바뀐 것은 **"이미 계산된 저장 상태 문구(저장 중.../저장했어요)를 화면에 언제 그리는가"**뿐이다 — `phase === "done"`일 때만 렌더링해, 번호가 하나씩 나타나는 도중에 상태 문구가 먼저 나타나는 산만함을 없앴다. 이는 API 계약이나 DB 저장 로직 변경이 아니라 순수 렌더링 타이밍 조정이다. `user_id`/`generation_method`/`related_dream_id`/로그인·비로그인 분기는 전부 무변경.

### 1.6 마이크로카피 (§A-6)

"행운 번호를 섞고 있어요"(셔플 중) / "행운 번호가 완성됐어요."(완료) — 당첨 가능성/확률 관련 표현을 전혀 쓰지 않았다.

---

## 2. 꿈해몽 확장 문제점

현재 구조(`supabase/migrations/0003_dreams.sql`, `lib/api/dreams.ts`, `app/dream/**`, `components/dream/DreamCard.tsx` 전수 확인):

- `dreams`: `id`/`keyword`(varchar 50)/`category`(nullable)/`interpretation`(text 1개 블록)/`image_url`/`created_at`/`updated_at`. **꿈 하나 = 해석 텍스트 1개.** "돼지를 잡는 꿈"/"돼지가 집에 들어오는 꿈" 같은 하위 상황을 표현할 자리가 없다.
- `dream_number_mappings`: `dream_id`(FK cascade) + `numbers`(int[], **정확히 6개** CHECK, `is_valid_lotto_numbers()` 강제) + `created_at`. **추천 번호는 항상 6개**여야 하고, 스키마상 여러 행이 가능하지만 실제 코드(`getDreamNumbers()`)는 첫 번째 행만 사용한다.
- `/dream/[keyword]`: `dream.interpretation` 전체를 한 덩어리로 렌더링, 추천번호는 `getDreamNumbers()` 결과(6개 또는 없음) 하나만 표시.
- 관리자 CRUD(`lib/api/admin/dreams.ts`): 폼 하나에 keyword/category/interpretation/numbers(선택, 있으면 6개) — 상황별 필드가 없다.
- sitemap(`app/sitemap.ts`): `dreams.keyword`+`updated_at` 기준으로 꿈 1건 = URL 1개.

**결론: 현재 구조로는 "상황별 세분화"도, "0~2개처럼 6개 미만 추천번호"도 표현할 수 없다.** 스키마 확장 없이는 불가능하다.

---

## 3. 꿈해몽 권장 데이터 구조

### 비교표

| 기준 | A. `dreams.interpretation`에 전부 텍스트로 | B. 신규 `dream_situations` 하위 테이블 | C. `dream_number_mappings` 확장(컬럼 추가) |
|---|---|---|---|
| SEO | 낮음(단일 텍스트 블록, 롱테일 키워드 URL 불가) | 높음(상황별 URL로 확장 여지) | 높음(B와 데이터 능력 동일) |
| 관리자 입력 편의 | 낮음(거대 textarea 1개에 8개 상황 욱여넣기) | 높음(상황별 필드 분리, FAQ/Guide 관리자 CRUD 패턴 재사용 가능) | 높음(B와 동일) |
| 확장성 | 낮음 | 높음(순수 신규 테이블, 향후 상황별 필드 추가 자유로움) | 중간(테이블 이름·의미가 "단순 번호 매핑"에서 벗어나 향후 코드 독해에 혼선 소지) |
| 1인 운영 유지보수 | 높음(변경 없음) | 중간(테이블 1개 증가하지만 `dream_number_mappings`/`notification_deliveries`와 동일한 기존 패턴 재사용이라 학습비용 0) | 높음(테이블 수 불변) — 단, 기존 25건 매핑을 "상황 0"으로 재해석해야 하는 의미 재정의 필요 |
| 추천 숫자 0~6개 지원 | 사실상 불가 | 지원 가능(신규 CHECK 함수) | 지원 가능(신규 CHECK 함수, B와 동일) |
| 기존 Dream → Generate 연동 | 무관 | 무관(현재 `dream.id` 단위 연동 유지) | 무관 |
| sitemap | 무변화 | 1단계(아코디언)는 무변화, 2단계(개별 URL)만 확장 필요 | 동일 |
| URL 구조 | 무변화 | 유연(단일 페이지 아코디언 또는 상황별 서브 URL 둘 다 가능) | 동일 |
| 현재 schema 변경 규모 | 0 | 중간(신규 테이블 1개 + FK + 인덱스 + RLS) | 작음(기존 테이블에 컬럼 2개 + CHECK 함수 1개) |

**A는 SEO/입력편의/숫자지원 3개 기준에서 명백히 부적합해 제외한다.**

### 최종 권고: **B(신규 `dream_situations` 테이블)**

C가 schema 변경 규모는 더 작지만, 결정적 약점이 있다: 현재 `dream_number_mappings` 25건은 제목/상황 개념이 전혀 없는 "그냥 번호 매핑"이다. C를 택하면 이 25건을 "상황 0(대표 케이스)"으로 의미를 재정의해야 하고, 테이블 이름(`dream_number_mappings`)이 새 역할("상황+번호 페어")과 맞지 않아 향후 코드를 읽는 사람이 혼란을 겪을 여지가 크다. 반대로 B는 **기존 25건 매핑을 전혀 건드리지 않고**(대표 추천번호 역할 그대로 유지) 상황별 세부 콘텐츠가 필요한 꿈에만 신규 테이블에 행을 추가하는 순수 additive 확장이다 — 기존 `getDreamNumbers()`/공개 조회/관리자 CRUD 어느 것도 영향받지 않는다.

**제안 스키마(마이그레이션 아님, 제안만)**:

```text
table: dream_situations
  id             bigint generated always as identity primary key
  dream_id       bigint not null references dreams(id) on delete cascade  -- dream_number_mappings와 동일한 FK 패턴
  title          varchar(100) not null   -- 예: "돼지를 잡는 꿈"
  body           text not null           -- 상황별 상세 해석
  numbers        int[] null, check(is_valid_partial_lotto_numbers(numbers))  -- 0~6개 허용(§5)
  display_order  int not null default 0  -- content_entries(FAQ/Guide)가 이미 쓰는 패턴 재사용
  created_at     timestamptz not null default now()
  updated_at     timestamptz not null default now()  -- set_updated_at() 트리거 재사용
```

인덱스: `dream_situations_dream_id_idx`(FK 컬럼 기본 인덱스 원칙 재사용).

---

## 4. 세부 꿈 URL/SEO 전략

**1단계(권고, Shortly After Launch)**: 별도 URL을 만들지 않는다. `/dream/[keyword]` 한 페이지 안에서 상황들을 `<h2>`/`<h3>` 계층 구조를 갖춘 섹션(또는 아코디언, `/faq` 페이지가 이미 쓰는 `<details>/<summary>` 패턴 재사용 가능)으로 전부 SSR 렌더링한다. 이것만으로도 검색엔진이 "돼지를 잡는 꿈" 같은 문구를 이미 인덱싱된 `/dream/돼지꿈` 페이지 본문에서 발견할 수 있어, 새 URL 없이 상당한 롱테일 이득을 얻는다. sitemap/canonical/JSON-LD(BreadcrumbList) 전부 무변경.

**2단계(조건부, After Validation)**: 특정 상황의 검색 유입이 실제로 확인되면(Search Console 데이터 등) 그 상황만 선별적으로 개별 URL(`/dream/[keyword]/[situationSlug]` 또는 유사 구조)로 승격하는 것을 검토한다. 지금 URL 네임스페이스를 미리 설계하는 것은 이 프로젝트가 반복적으로 경계해 온 "추측성 인프라 선투자"에 해당해 권장하지 않는다 — 데이터가 구조를 정하게 한다.

---

## 5. 추천 숫자 0~6개 구조

`dream_number_mappings`가 이미 재사용 중인 `is_valid_lotto_numbers()`(정확히 6개 강제)를 건드리지 않고, **새 CHECK 함수를 별도로 추가하는 것을 제안한다**(기존 함수를 완화하면 `draws`/`user_numbers`/`fortune_results`처럼 "항상 정확히 6개"여야 하는 다른 테이블의 무결성까지 함께 느슨해지는 회귀 위험이 있어 절대 공유하면 안 된다):

```sql
create or replace function public.is_valid_partial_lotto_numbers(numbers int[])
returns boolean language sql immutable as $$
  select numbers is null
    or (
      array_length(numbers, 1) between 1 and 6
      and (select bool_and(n between 1 and 45) from unnest(numbers) as n)
      and (select count(distinct n) from unnest(numbers) as n) = array_length(numbers, 1)
    );
$$;
```

`NULL` = 추천 숫자 없음(0개)으로 취급한다. 번호 생성기가 부족분을 보완하는 기능(예: 2개만 지정된 상황에서 나머지 4개를 `generateNumbers()`로 채우기)은 **이번 설계에서 구현하지 않는다** — `/generate?dream=<id>&situation=<id>` 같은 확장 여지만 열어두고, 실제 병합 로직은 별도 Task로 미룬다(추측성 조기 구현 방지).

---

## 6. 오늘의 행운 기능 설계

### 조사 결과 — 스키마가 이미 대부분 준비되어 있다

`profiles`에 실제 존재: `birth_date`(NOT NULL), `nickname`. `birth_time`/`gender`는 존재하지만 **선택 입력이라 없는 사용자가 있을 수 있어 MVP 필수 입력으로 전제할 수 없다.**

**중요 발견**: `fortune_results`(`0005_fortune_results_user_period_stats.sql`)가 이미 이번에 요청된 항목과 거의 1:1로 대응한다 — `overall_fortune`(종합운세)/`luck_score`(행운지수)/`recommended_numbers`(추천 로또 번호)/`today_energy`/`money_luck`(금전운)/`action_guide`(하면 좋은 행동)/`things_to_avoid`(피할 행동)/`lucky_color`/`lucky_direction`/`lucky_time`/`share_id`(공유). **새 컬럼을 거의 만들 필요가 없다** — `FEATURE_SPEC.md` §3.2가 이미 "생년월일 → 띠 계산 + 템플릿 조합" MVP를 설계해 뒀고, 이번 요청은 그 설계를 실제로 구현하는 것과 사실상 동일한 범위다.

**MVP는 `birth_date` + 오늘 날짜만으로 가능하다** — 띠(12지) 계산은 생년월일만으로 충분하고(생시/성별 불필요), 나머지 항목은 "띠 + 오늘 요일/날짜"를 키로 미리 작성해 둔 템플릿 문구를 조합하면 된다.

### 필요한 최소 schema 변경(제안만, 마이그레이션 없음)

```text
alter table fortune_results add column result_date date not null default current_date;
alter table fortune_results add constraint fortune_results_user_result_date_key unique (user_id, result_date);
```

`result_date`가 없으면 "하루 1회"를 서버가 판단할 조회 키가 없다(`created_at`의 날짜 부분만으로는 타임존 경계 문제가 생김). `UNIQUE(user_id, result_date)`가 로그인 사용자 기준 하루 1회를 **DB 레벨에서** 보장한다. 비회원(`user_id NULL`)은 이 제약의 적용을 받지 않는다 — 비회원의 "하루 1회"는 세션 추적이 없어 서버가 강제할 방법이 없다는 점을 명시해 둔다(과장해서 보장하지 않는다).

### 하루 1회 재사용 흐름(제안)

1. 로그인 사용자가 진입 → 서버가 `fortune_results WHERE user_id=본인 AND result_date=오늘(KST)` 조회.
2. 있으면 그 행을 그대로 반환 — **재계산하지 않는다.** 이 자체가 "같은 사용자+같은 날짜=같은 결과"를 보장하는 가장 단순한 방법이다(별도 seed 고정 알고리즘이 필요 없다).
3. 없으면: `profiles.birth_date` → 띠 계산(순수 함수) → 템플릿 조합 → `recommended_numbers`는 기존 `generateNumbers()` 재사용(새 난수 로직 금지) → INSERT.

---

## 7. AI vs Rule-based 결정

| 기준 | A. Rule/Template | B. AI API |
|---|---|---|
| 비용 | 사실상 무료(서버 CPU만) | 요청당 과금, 방문자 증가에 선형 비례 |
| 속도 | 즉시(수 ms) | 네트워크 왕복 + 생성 시간(수백 ms~수 초) |
| 유지보수 | 관리자가 템플릿 문구만 미리 작성(FAQ/Guide 관리자 CRUD 패턴 재사용 가능) | 프롬프트 튜닝 + API 키 관리 + 외부 장애 대응 필요 |
| 방문자 증가 시 비용 | 무관 | 트래픽 증가가 곧 비용 증가 — 예측 불가 리스크 |
| 결과 일관성 | 완벽(deterministic, 저장 후 재사용) | 동일 프롬프트도 재호출 시 다를 수 있어 "하루 동안 동일 결과" 요구를 만족하려면 결국 첫 호출 결과를 저장/캐시해야 함(AI의 장점을 살릴 여지가 적음) |
| 1인 운영 | 부담 최소 | 부담 큼 |

### 결정: **MVP는 rule/template 기반**

`FEATURE_SPEC.md` §3.2가 이미 이 방향을 확정해 두었고, 이번 지시문도 동일한 결론을 권장한다. AI API는 "템플릿 문구의 다양성/품질이 실사용에서 명백히 부족하다고 검증된 뒤"(After Validation 이후)에만 검토 후보로 남긴다 — 그 경우도 "매 요청 생성"이 아니라 "하루 1회만 호출해 저장"하는 구조(§6)를 유지해야 비용이 통제된다.

---

## 8. 필요한 DB 구조 (요약, 전부 제안만 — 이번 Task에서 생성하지 않음)

1. `dream_situations` 신규 테이블(§3) + `is_valid_partial_lotto_numbers()` 신규 함수(§5).
2. `fortune_results.result_date`(date, NOT NULL DEFAULT CURRENT_DATE) + `UNIQUE(user_id, result_date)`(§6).

두 변경 모두 기존 테이블/컬럼을 수정하지 않는 순수 추가(ALTER ADD COLUMN / CREATE TABLE)이며, Schema Freeze 원칙(신규 migration만 사용, 기존 파일 무수정)과 충돌하지 않는다. **실제 migration 파일은 이번 Task에서 만들지 않았다.**

---

## 9. 수익화 전략

가장 자연스러운 수익화 포인트는 **"오늘의 행운"(§6)이 실제 재방문 습관을 만든 이후**다 — 전환할 습관 자체가 없는 상태에서 결제 화면을 보여주는 것은 의미가 없다.

| 등급 | 내용 |
|---|---|
| 무료 | 오늘의 행운 요약 3항목(종합운세/행운지수/추천번호, `FEATURE_SPEC` MVP 정의 그대로), 번호생성, 꿈해몽 열람, 행운 다이어리 히스토리 |
| Premium(제안) | 오늘의 행운 상세 7항목 전체(`today_energy`~`lucky_time`), 주간/월간 리포트, 연말 Luck Report 고급판, 히스토리 무제한/고급 통계, 공유 카드 디자인 옵션 |
| 후원("행운모으기" 등) | 실제 성격이 후원이면 UI에 "이 결제는 서비스 운영을 응원하는 후원입니다. 당첨 확률·더 좋은 번호와는 무관합니다." 같은 명확한 고지가 **필수** — MASTER_PRD 비목표(사행성 조장 금지)와 직결 |

**MVP에서 결제를 넣어야 하는 시점**: "오늘의 행운"이 실사용자 데이터로 재방문 효과가 검증된 이후(After Validation). 지금은 전환 대상 기능 자체가 없고, PG 연동/구독 관리/환불 정책이라는 지속적 운영 부담(수수료 2.5~3.5%대, 해지/환불 CS)을 검증되지 않은 수요에 먼저 투입하는 것은 리스크 대비 보상이 낮다.

**사용자가 돈을 낼 이유**는 반드시 실용적 근거(더 상세한 콘텐츠, 무제한 보관 등)여야 하며, "당첨 확률이 올라간다"는 암시는 어떤 형태로도 근거가 될 수 없다.

---

## 10. 추가 로그인 추천 방식

현재 실제 `/login`에는 카카오 버튼만 있다(이메일 폼 UI 없음, 전수 확인). `profiles.provider` enum에 `'email'`이 이미 존재하고 `resolveProfileProvider()`가 이를 구분하지만 실제로 쓰이지 않는다.

| 기준 | A. email+password | B. email OTP | C. magic link | D. 카카오만 유지 |
|---|---|---|---|---|
| 구현 난이도 | 중간 | 낮음(**이 프로젝트가 이미 검증한 `generateLink`+`verifyOtp({type:"email"})` 배관을 그대로 재사용 가능**, `lib/auth/kakao.ts`가 정확히 이 메커니즘을 카카오 세션 발급에 이미 쓰고 있음) | 낮음(A와 유사 배관) | 0(변경 없음) |
| 비밀번호 reset | 필요(신규 이메일 발송 인프라 도입 필요 — 현재 프로젝트에 이메일 발송 코드 자체가 없음) | 불필요(비밀번호 자체가 없음) | 불필요 | 해당 없음 |
| 이메일 verification | 필요 | 코드 입력 자체가 검증 | 링크 클릭 자체가 검증 | 해당 없음 |
| 보안 | 브루트포스/재사용 비밀번호 리스크 | 낮음(코드 유효시간 짧음) | 중간 | 해당 없음 |
| 스팸 | 가짜 이메일 대량 가입 방지 필요 | 발송 rate limit만 고려 | 동일 | 해당 없음 |
| 유지보수 | 가장 큼(비밀번호 CS가 실사용 최다 문의 유형) | 낮음 | 낮음 | 최소 |
| 기존 프로젝트와의 궁합 | 낮음(신규 인프라) | **높음**(이미 검증된 코드 재사용) | 중간 — **이 프로젝트가 이미 실측으로 발견한 문제 재현 위험**: `lib/auth/kakao.ts` 주석에 "magiclink 타입은 verifyOtp에서 deprecated, 신규 사용자 최초 로그인 시 otp_expired(403)로 실패"가 실제로 기록돼 있다 | 최고(변경 없음) |

### 권고: **B(email OTP)**

비밀번호 관리 부담이 전혀 없고(A의 최대 약점 회피), 이 프로젝트가 카카오 로그인 구현 과정에서 이미 실전 검증한 `generateLink`+`verifyOtp({type:"email"})` 파이프라인을 그대로 확장하면 된다 — 사실상 "합성 이메일 대신 실제 이메일을 받는" 변형에 가까워 신규 리스크가 가장 적다. C(magic link)는 이 프로젝트가 이미 겪은 `deprecated` 타입 문제를 반복할 위험이 있어 제외한다.

**단, 이번 Task에서는 Auth 코드를 전혀 변경하지 않았다** — 카카오 로그인 실제 브라우저 E2E가 아직 launch blocker로 남아 있는 상태에서 인증 표면을 넓히는 것은 기존 blocker 위에 새 blocker를 쌓는 것과 같다. 이 권고는 **카카오 E2E 완료 이후**에만 착수할 것을 명시적으로 권장한다.

---

## 11. 커뮤니티 최소 MVP

**핵심 안전장치**: `user_numbers`의 `match_count`/`win_rank`/`checked_at`은 현재 RLS(`user_numbers_update_own`)가 행 소유권만 확인하고 컬럼 단위 제한이 없어, 사용자가 자신의 행에 대해 이 값들을 직접 위조할 수 있다는 Known Issue가 이미 문서화되어 있다(`docs/PHASE6_DATA_ARCHITECTURE_DECISION.md` §9). **따라서 커뮤니티에 사용자가 작성한 "당첨 후기/인증" 게시글을 `win_rank` 값과 자동 대조해 "검증된 당첨" 배지를 부여하는 기능은 절대 만들지 않는다.** 사용자가 자유 텍스트로 당첨을 주장하는 것 자체는 막을 수 없지만, 서비스가 그 주장을 자동으로 보증해서는 안 된다. 향후 정말 필요해지면 클라이언트 값을 신뢰하지 않고 서버가 `draws` 원본으로 재검증한 뒤에만 배지를 부여하는 구조로 가야 한다(Phase6-2가 이미 제안해 둔 방향).

### 최소 MVP 범위

| 항목 | MVP 포함 여부 | 근거 |
|---|---|---|
| `posts`(자유 게시판 1개, 카테고리 세분화 없음) | 포함 | 최소 뼈대 |
| `comments` | 포함 | 최소 상호작용 |
| `likes` | **제외** | 어뷰징 방지 로직까지 딸려와 부담 증가, 조회수만으로도 초기엔 충분 |
| `images` | **제외** | Storage 버킷/업로드 UI/용량 제한 등 부가 인프라, 텍스트 전용으로 시작 |
| `reports` | 포함 | `DATABASE_SCHEMA.md` §3.15가 이미 스키마 설계(target_type/target_id/reporter_id/reason/status) — 그대로 재사용 제안 |
| moderation | 최소 자동화만 | "신고 5건 누적 시 자동 임시비공개"가 이미 §3.15에 설계됨 — 그대로 재사용 |
| delete | 작성자 본인만 | `dream_journal_entries`가 이미 증명한 "본인만 RLS" 패턴 재사용 |
| block(사용자 차단) | **제외** | 초기 사용자 수 대비 필요성 낮고 노출 필터링 복잡도만 증가 |
| admin management | 최소(강제 비공개/삭제만) | Phase9 FAQ/Guide 관리자 CRUD와 동일한 서비스+API+UI 3분할 패턴 재사용 |
| spam 대응 | 최소 금지어 필터 | `ADMIN_REQUIREMENTS.md` §8이 이미 계획한 "사행성 금지어 리스트"를 게시글 본문에도 재사용 |

---

## 12. 각 기능 점수 (1~5, 모든 열은 "높을수록 유리"로 통일 — 구현난이도/유지보수부담/출시지연위험은 "리스크가 낮을수록 5점")

| 기능 | 사용자가치 | 재방문효과 | SEO효과 | 수익화가능성 | 구현난이도(낮을수록5) | 유지보수부담(낮을수록5) | 출시지연위험(낮을수록5) |
|---|---|---|---|---|---|---|---|
| 1. 번호 생성 UX | 3 | 3 | 1 | 1 | 5(완료) | 5 | 5(완료) |
| 2. 꿈해몽 세분화 | 4 | 3 | 5 | 2 | 3 | 3(콘텐츠 작성 부담↑) | 4 |
| 3. 오늘의 행운 | 5 | 5 | 2(비공개 개인화, noindex) | 4 | 3(스키마 대부분 기재) | 3 | 3 |
| 4. 추가 로그인 | 3 | 2 | 1 | 1 | 3 | 3 | 2(카카오 E2E 미완 위에 신규 인증표면 추가 리스크) |
| 5. 커뮤니티 | 3 | 3 | 3(초기엔 낮음) | 1 | 2 | 2(신고/스팸 대응 지속 부담) | 1 |
| 6. Premium/후원 | 2 | 2 | 1 | 5 | 1(PG+구독+환불) | 1(정산/CS 지속 부담) | 1 |

---

## 13. Before Launch

**1. 번호 생성 UX 개선 — 완료.** 추가로 넣을 항목 없음(이미 출시 준비 상태를 깨뜨리지 않는 선에서 완결).

## 14. Shortly After Launch

**3. 오늘의 행운 → 2. 꿈해몽 세분화** 순서(가설 순서를 실제 분석 후 뒤집음, §16 근거 참조).

## 15. After Validation

**4. 추가 로그인(카카오 E2E 완료 직후 우선) → 6. Premium/후원 → 5. 커뮤니티** 순서(가설의 5/6 순서를 실제 분석 후 뒤집음, §16 근거 참조).

---

## 16. 정확한 구현 순서 (가설을 실제 분석으로 재검증한 최종 결론)

지시문이 제시한 가설(Before: UX만 / Shortly After: 꿈해몽→오늘의행운 / After Validation: 로그인→커뮤니티→Premium)을 실제 코드 구조·점수(§12)로 재검증한 결과, **2개 지점에서 가설과 다른 순서를 권고한다**:

1. **오늘의 행운을 꿈해몽 세분화보다 먼저** 넣는다. 이유: (a) `fortune_results` 스키마가 이미 요청 항목의 90% 이상을 갖추고 있어 실제 구현 난이도가 낮다(§6/§8, 필요한 변경은 컬럼 1개+UNIQUE 제약 1개뿐). (b) 이 프로젝트가 반복적으로 North Star Metric으로 언급해 온 "다이어리 중심 재방문율"에 직접 기여하는 정도가 꿈해몽 세분화(주로 신규 유입/SEO 기여)보다 크다(§12 재방문효과 5 vs 3). (c) 꿈해몽 세분화는 신규 테이블 + 상황당 콘텐츠 원고 작성(꿈 하나당 최대 8개 상황 × 관리자 수동 작성)이라는 반복 운영 부담이 더 크다.
2. **Premium/후원을 커뮤니티보다 먼저** 검토한다. 이유: (a) Premium의 가장 자연스러운 시작점(오늘의 행운 상세판)이 바로 위 §6 기능의 직접 연장이라 추가 설계 비용이 낮다. (b) 커뮤니티는 신고/스팸 대응이라는 **지속적** 운영 부담을 새로 만드는 반면(1인 운영자에게 가장 무거운 유형), Premium은 이 프로젝트의 지속가능성(수익)에 더 직접적으로 기여한다(§12 수익화가능성 5 vs 1, 유지보수부담 1 vs 2로 Premium이 오히려 근소하게 나음에도 수익 기여가 압도적으로 크다).

**최종 순서**:
```
1. 번호 생성 UX 개선                    ← 완료(이번 Task)
2. 오늘의 행운 MVP (rule-based)         ← fortune_results.result_date 추가 제안
3. 꿈해몽 세분화 (dream_situations)     ← 신규 테이블 제안
4. 추가 로그인(email OTP)               ← 카카오 E2E 완료 후 착수
5. Premium/후원 결제 연동
6. 커뮤니티 MVP
```

---

## TASK REPORT — Product Expansion

- **Number Generation UX**: 구현 완료(셔플→공개 2단계 연출, 첫 생성 ~1.9초/재생성 ~1.4초, reduced-motion 대응, 중복 클릭 방지)
- **Generation API Contract Changed**: NO (`app/api/numbers/route.ts`/`lib/api/numbers.ts` 무수정, 실제 로그인 세션으로 저장 흐름 재검증 완료)
- **Dream Expansion Recommendation**: B — 신규 `dream_situations` 하위 테이블(마이그레이션 미생성, 제안만)
- **Dream Number Count**: 0~6개 가변 지원(신규 `is_valid_partial_lotto_numbers()` 함수 제안, 기존 `is_valid_lotto_numbers()` 무변경)
- **Daily Fortune**: `fortune_results.result_date` + `UNIQUE(user_id, result_date)` 추가로 스키마 대부분 재사용 가능(제안만)
- **AI Required for MVP**: NO (rule/template 기반 권고, `FEATURE_SPEC.md` §3.2 기존 결정과 일치)
- **Additional Login Recommendation**: Email OTP(카카오 E2E 완료 후 착수 권고, 이번 Task에서 Auth 코드 미변경)
- **Community MVP**: posts+comments+reports 최소 구성, 당첨 인증 자동 검증 배지는 절대 금지
- **Monetization Recommendation**: 오늘의 행운 상세판 기반 Premium, 후원은 명확한 고지 필수, 결제는 After Validation 이후
- **Before Launch**: 번호 생성 UX(완료)
- **Shortly After Launch**: 오늘의 행운 → 꿈해몽 세분화(가설과 순서 반대로 재검증)
- **After Validation**: 추가 로그인 → Premium/후원 → 커뮤니티(가설과 순서 반대로 재검증)
- **Tests**: PASS (282/282, +5건 신규 — 연출 타이밍 검증)
- **Build**: PASS (38 routes, 무변화)
- **기존 기능 Regression**: PASS (`/`, `/dream`, `/faq`, `/about`, `/my/journal` 무영향, `/api/numbers` 401 게이트·저장 계약 실측 재확인, Dream→Generate 연동 정상)
- **다음 작업**: 오늘의 행운 MVP 설계를 실제 migration+API+UI 구현으로 진행하기 위한 세부 Task 기획 1개
