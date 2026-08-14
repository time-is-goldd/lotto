# PHASE6 PRE-IMPLEMENTATION AUDIT — 당첨확인(Winning Check)

> Phase6 착수 전 사전 감사 + 설계 결정 문서다. 프로덕션 코드/Migration/RLS/Schema/API/UI/`proxy.ts`/컴포넌트를 전혀 수정하지 않았다 — 아래 내용은 전부 실제 마이그레이션 원문, 실제 코드, 웹 검색으로 확인한 실제 외부 데이터 소스 현황(출처 명시)에 근거한다. 확인되지 않은 API·URL·컬럼은 가정하지 않았다.

---

## 0. 가장 먼저 보고할 것 — 이번 지시문과 EXECUTION_PLAN의 근본적인 방향 차이

이번 지시문 §4는 "실제로 사용할 수 있는 로또 당첨번호 데이터 소스"를 조사해 Phase6이 이를 호출하는 것을 전제로 한 것처럼 읽힌다. 그런데 `docs/EXECUTION_PLAN.md` Phase6(원문, 아래 §1에서 인용)과 `docs/ROADMAP.md` §1은 **이미 명시적으로 다른 방향을 확정해뒀다**:

> `docs/ROADMAP.md` §1 Must 표: "당첨 자동 확인 (**관리자 수동 회차입력 기반**) | **완전 자동 API 연동은 Should로 미룸**, 입력은 수동이어도 대조는 자동"
> `docs/ROADMAP.md` §2 Phase 8: "당첨번호 자동 수집(공공데이터 API) + 관리자 승인 워크플로" — **자동 수집 자체가 Phase 8(장기 과제)로 명시되어 있다.**
> `docs/EXECUTION_PLAN.md` Phase6 "생성할 파일": `app/api/admin/draws/route.ts`(POST — **관리자가 회차 결과를 입력**하면 그 요청 안에서 대조까지 동기 처리) — 외부 API를 호출하는 코드는 어디에도 계획되어 있지 않다.

이번 Task의 지시 우선순위(①실제 EXECUTION_PLAN ②실제 코드 ③세부 Phase 문서)를 그대로 적용하면, **Phase6 MVP는 외부 API를 호출하지 않고 관리자가 공식 데이터를 직접 확인해 수동으로 입력하는 구조가 이미 확정되어 있다.** 이 감사는 그 결정을 뒤집지 않는다 — 대신 §4에서 "관리자가 입력할 때 참고할 공식 데이터 출처가 무엇인지"와 "향후 Phase 8이 자동화할 때 어떤 선택지가 있는지"를 실제로 조사해 기록한다. 이 방향 차이 자체를 §14-Critical급 확인 사항으로 다시 보고한다.

---

## 1. Phase6 범위 확정

### `docs/EXECUTION_PLAN.md` Phase6 원문 요약(추측 없음)

- **목표**: "관리자가 회차 결과를 입력하면 자동 대조되어 다이어리에 반영되고, 알림이 발송되는 기능을 완성한다."
- **생성 파일**: `app/api/admin/draws/route.ts`(POST, 회차 입력+대조 동기 처리), `lib/logic/matchNumbers.ts`+테스트, `lib/api/notifications.ts`, `components/journal/WinResultBanner.tsx`
- **수정 파일**: `proxy.ts`(관리자 API 임시 보호), 다이어리 결과 페이지(실데이터 연결), `lib/api/journal.ts`(결과 조회 완성)
- **구현 순서**: `matchNumbers()` → 관리자 회차 입력 API(화면은 **Phase9**) → 대조(`user_numbers` 전수 조회→`match_count`/`win_rank` UPDATE) → 당첨자 `notifications` INSERT → 다이어리 결과 화면 실데이터 → 헤더 알림 뱃지
- **완료 기준**: 1~5등 전체 케이스 정확 판정(자동화 테스트) / 관리자 입력→다이어리 결과 반영 / 당첨자 알림 생성 확인
- **주의사항**: "등수 판정 로직은 서비스 신뢰도와 직결 — 경계값마다 테스트 케이스 필수" / **비회원(`user_id` NULL) 번호는 대조 대상에서 제외** / MVP 규모에서는 관리자 요청 안에서 동기 처리, Edge Function은 나중에

### 범위 표

| 기능 | Phase6 포함 여부 | 근거 |
|---|---|---|
| 저장된 번호의 당첨 결과 확인(대조) | **포함** | 목표 그 자체 |
| 당첨 번호 조회(관리자가 입력한 `draws` 조회) | **포함** | 관리자 입력→대조 흐름의 전제 |
| 회차 조회 | **포함(단, §3에서 상세 — 현재 연결이 안 되어 있음)** | |
| 보너스 번호 | **포함** | `draws.bonus_number`(0002)가 이미 존재, 2등 판정에 필수 |
| 당첨 등수 계산(1~5등/낙첨) | **포함** | `matchNumbers()` |
| 당첨금 표시 | **부분 포함 — 1등만.** 2~5등 당첨금 컬럼이 스키마에 없음(§5-3) | |
| 번호 저장/조회 | **이미 완료(Phase5)** | 재사용만 |
| 당첨 결과 히스토리(다이어리 결과 화면) | **포함** | `docs/PHASE4_DIARY_READ_SERVICE_REPORT.md`의 `getRecentUserNumbers({ onlyChecked: true })`가 이미 이 용도로 설계돼 있음(§12) |
| 관리자 회차 입력 UI(화면) | **제외 — Phase9** | EXECUTION_PLAN 원문 "화면은 Phase9에서" |
| 알림(사이트 내 `notifications` INSERT + 헤더 뱃지) | **포함** | EXECUTION_PLAN 구현순서 4·6번 |
| 이메일/웹푸시 알림 | **제외 — Should, Phase2(회원기능강화)** | `notification_deliveries.channel`에 이미 값은 정의돼 있으나 실제 발송 로직은 범위 밖 |
| 통계(`user_period_stats`) | **제외** | Phase4/5 감사에서 이미 범위 밖 확정, Phase6도 동일 |
| 공유 | **제외** | Phase 배정 자체가 없음(기존 미결정 사항, §14) |
| 삭제/수정(`user_numbers`) | **제외** | Phase4/5와 동일하게 조회·대조 전용 |
| 외부 API 자동 수집 | **제외 — Phase8** | §0 |

**문서 간 충돌**: `docs/ROADMAP.md`의 "Phase 4~8" 상위 로드맵 번호 체계는 이 프로젝트가 실제로 따르는 `EXECUTION_PLAN.md`의 세분화 Phase 번호와 다른 대상을 가리킨다는 것이 Phase4 감사에서 이미 확인된 사실이며, 이번에도 동일하게 적용했다(`EXECUTION_PLAN.md` 기준 채택, 재확인일 뿐 신규 발견 아님).

---

## 2. 현재 DB/Schema 감사 (실제 Migration 원문 재확인)

| 테이블 | 파일 | Phase6 관련 컬럼 | 확인 사항 |
|---|---|---|---|
| `draws` | `0002_draws_user_numbers.sql` | `round`(PK 아님, **UNIQUE NOT NULL**), `numbers int[6]`(CHECK `is_valid_lotto_numbers`), `bonus_number`(CHECK 1~45), `first_prize_amount bigint NOT NULL`, `first_prize_count int NOT NULL`, `source varchar(50) DEFAULT 'manual'`, `created_at` | **2~5등 당첨금/인원 컬럼이 없다**(§5-3). `draw_date`(추첨일) 컬럼도 없다 — `docs/BACKLOG.md` 항목 A가 이미 "미해결"로 기록해둔 것을 재확인, Phase6 UI가 "추첨일"을 표시하려면 이 공백과 직접 부딪힌다 |
| `user_numbers` | `0002_draws_user_numbers.sql` | `target_round int REFERENCES draws(round)`(**NULL 허용**), `match_count smallint NULL`, `win_rank smallint NULL`, `checked_at timestamptz NULL` | **대조 결과를 저장할 컬럼이 이미 존재한다** — 신규 컬럼/테이블 불필요(§6) |
| `user_period_stats` | `0005_...sql` | — | Phase6과 직접 관련 없음(재확인, Phase4/5 감사와 동일 결론) |
| `winning_cases`/`stores`/`store_win_records` | `0007_winning_cases_stores.sql` | — | **"당첨사례"(공개 콘텐츠, `/winners`)이지 "당첨확인"(개인, `/my/journal/results`)이 아니다** — Phase3에서 이미 확정된 구분을 재확인. Phase6이 이 테이블을 재사용할 이유가 없다 |
| `notifications`/`notification_deliveries` | `0006_notifications.sql` | `type='win_result'`(이미 enum에 존재), `link_url varchar(255) NOT NULL` | Phase6이 그대로 사용 가능. `notifications.link_url`이 NOT NULL이라 당첨 알림 생성 시 항상 유효한 링크(예: `/my/journal/results`)를 반드시 채워야 함(제약 확인, 문제 아님) |

### CHECK 제약의 숨은 사실 — `draws.numbers`도 `user_numbers.numbers`도 정렬을 강제하지 않는다

`is_valid_lotto_numbers()`(0002)는 `array_length=6`, `1~45 범위`, `count(distinct)=6`만 검증하고 **오름차순 여부는 검증하지 않는다.** 즉 관리자가 회차 데이터를 비정렬 순서로 입력해도 DB는 거부하지 않는다. **`matchNumbers()`는 입력 배열의 정렬 여부에 의존하지 않고 집합(Set) 비교로 구현해야 한다**(§5).

### RLS 재확인(`0008_rls_policies.sql`, 이번 Task에서 수정하지 않음)

| 테이블 | SELECT | INSERT/UPDATE |
|---|---|---|
| `draws` | 전체 공개(`anon, authenticated`, `using(true)`) | **정책 없음 = service_role 전용** |
| `user_numbers` | 본인만(`auth.uid()=user_id`) | 본인만(INSERT/UPDATE 각각 본인 행) |
| `notifications` | 본인만 | **정책 없음 = service_role 전용**(INSERT) |

**중요한 함의**: 관리자가 회차를 입력(`draws` INSERT)하는 것과, 대조 배치가 **다른 사용자들의** `user_numbers.match_count`/`win_rank`를 UPDATE하는 것 **둘 다 RLS상 client 세션으로는 불가능하다** — `draws`는 애초에 client INSERT 정책이 없고, `user_numbers_update_own` 정책은 "본인 행만" 허용해 관리자 세션이 타인의 행을 고칠 수 없다. **이 두 작업은 구조적으로 `service_role`이 필요하다** — 이는 Phase4/5가 지켜온 "service_role 사용 금지"의 예외가 아니라, `docs/DATABASE_SCHEMA.md` §6 "관리자 정책 공통 원칙"(관리자 쓰기는 항상 서버 API + service_role)이 Phase1부터 이미 정해둔 설계를 그대로 따르는 것이다(§8에서 상세).

**향후 Migration이 정말 필요한가**: 대조 결과 저장(§6)에는 **필요 없다**(컬럼이 이미 있음). 2~5등 당첨금 표시(§5-3)와 추첨일 표시에는 **필요할 수 있다** — 지금 만들지 않고 Decision으로 남긴다(§14).

---

## 3. 가장 중요한 문제 — 번호와 회차 연결

### 현재 상태(추측 아님, 코드 직접 확인)

`lib/api/numbers.ts`의 `saveUserNumbers()`(Phase5-2, 원문 확인)는 `.insert({ user_id, numbers, generation_method: "auto" })`만 수행한다 — **`target_round`를 전혀 설정하지 않는다.** 즉 **Phase5가 지금까지 저장한 모든 `user_numbers` 행은 `target_round = NULL`이다.** "회차 개념이 아예 없는 것"은 아니다(컬럼은 존재) — 하지만 "실제로 채워지는 경로가 하나도 없는" 상태다.

### 세 가지 방식 비교

| 방식 | 정확성 | UX 마찰 | 구현 난이도 | Phase5 재작업 필요 여부 |
|---|---|---|---|---|
| 생성/저장 시점의 최신 회차 자동 연결 | **낮음** — "번호를 생성했다"≠"그 회차에 구매했다"는 지시문 자체가 지적한 함정. 사용자가 실제로 사지 않은 회차에 "낙첨"이 뜨는 오인 유발 | 없음 | 낮음 | 있음(`saveUserNumbers` 수정 필요 — 이번 Task 범위 밖) |
| 생성일 기준 회차 자동 추정 | 상동 | 없음 | 중간(추첨 요일 계산 로직 필요) | 있음(상동) |
| 저장 시점에 사용자가 직접 회차 선택 | 높음 | **있음 — Phase5의 "생성 즉시 자동 저장"(이미 확정된 정책) 흐름을 깨뜨림** | 중간 | 있음(Phase5 UI/API 변경 필요 — "기존 구현을 임의로 리팩터링하지 말 것" 원칙과 충돌) |

### 권장안 — 하이브리드(저장은 그대로, 확인 시점에 사용자가 회차를 확정)

1. Phase5의 저장 흐름(`generateNumbers()`→즉시 자동 저장)은 **전혀 건드리지 않는다** — `target_round`는 계속 `NULL`로 저장된다.
2. Phase6이 새로 만드는 화면(다이어리 결과 페이지 또는 그 하위)에서, **`target_round`가 `NULL`인 본인 `user_numbers` 행에 한해 사용자가 "이 번호는 몇 회차 것인가요?"를 직접 선택**하게 하고, 선택 시 `target_round`를 `UPDATE`한다.
3. 이 `UPDATE`는 **본인 소유 행에 대한 본인 세션의 수정**이라 기존 `user_numbers_update_own` RLS 정책만으로 충분하다 — **service_role이 필요 없다**(Phase4/5의 "service_role 최소화" 원칙을 그대로 유지).
4. 관리자의 회차별 대조 배치는 `target_round`가 채워진 행만 대상으로 삼는다 — 회차를 확정하지 않은 사용자의 번호는 "아직 확인 안 함" 상태로 남고, 이는 실제로 올바른 동작이다(구매 여부를 모르는데 임의로 낙첨/당첨을 표시하지 않음).

**이 설계를 채택할지는 사용자 확인이 필요한 진짜 Decision이다**(§14) — 이 감사는 세 옵션을 비교해 하이브리드를 권장할 뿐, 임의로 확정하지 않는다.

---

## 4. 당첨번호 데이터 소스 감사 (실제 웹 검색, 출처 명시)

**검색 시점**: 이번 Task 수행 중(2026-08 기준) 실시.

| 우선순위 | 소스 | 실제 확인 결과 |
|---|---|---|
| 1. 공식 데이터(동행복권) | `dhlottery.co.kr` 공식 웹사이트의 "회차별 당첨번호" 페이지(`https://www.dhlottery.co.kr/gameResult.do?method=byWin`) | **이것이 유일하게 명확히 "공식"인 소스다** — 사람이 직접 읽는 웹페이지이며, 프로그램이 호출하도록 문서화된 공식 API가 아니다 |
| 2. 공식 데이터 기반 신뢰 가능한 공개 데이터 | 공공데이터포털(`data.go.kr`) | **로또 당첨번호 자체를 제공하는 오픈API를 찾지 못했다.** 검색으로 확인한 것은 "온라인복권 1등 당첨 판매점 현황"(기획재정부, `data.go.kr/data/15059963`)·"온라인복권 판매점 주소"(`data.go.kr/data/15086355`) 등 **판매점 위치 데이터뿐**이며, 당첨 번호 자체의 공식 오픈API는 검색 결과에 없었다 |
| 3. 안정적인 공개 API | `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo={회차}` | **실존하며 널리 쓰이지만 "비공식"이다.** 동행복권이 공식 문서화한 API가 아니라, 웹사이트 자체가 내부적으로 호출하는 엔드포인트를 개발자들이 역으로 찾아 쓰는 것이다. GitHub의 `roeniss/dhlottery-api` 저장소 자체가 이름에 "비공식(unofficial)"임을 명시하고 있다. 응답은 JSON이며 확인된 필드는 `returnValue`(성공여부), `drwNo`(회차), `drwNoDate`(추첨일), `drwtNo1~6`(당첨번호 6개), `bnusNo`(보너스번호), `firstWinamnt`(1등 1인당 당첨금), `totSellamnt`(총 판매액) 등이다. **이용약관이 이 엔드포인트의 제3자 프로그램적 사용을 명시적으로 허용하는지는 검색으로 확인하지 못했다** — 공식 ToS 문서를 찾지 못해 "허용됨"이라고 단정할 수 없다 |
| 4. 기타 | 개인/커뮤니티 사이트(예: `redinfo.co.kr`, `data.soledot.com` 등 당첨결과 재게시 사이트) | 전부 위 2번 소스를 다시 가공한 2차 데이터로 보이며, 공식성이 1~3번보다 낮다. 이번 감사는 이 계층을 권장하지 않는다 |

**결론**: "확인된 공식 프로그램적 API"는 존재하지 않는다. **§0에서 확인한 대로 Phase6 MVP는 애초에 이 API 호출을 필요로 하지 않으므로(관리자 수동 입력), 이 결론이 Phase6을 막지 않는다.** 이 조사 결과는 (a) 관리자가 수동 입력 시 참고할 1차 출처(동행복권 공식 웹페이지)를 확정하고, (b) 향후 Phase8이 자동화를 검토할 때 "공식 API가 없으므로 비공식 엔드포인트 사용 여부를 별도로 승인받아야 한다"는 점을 미리 기록해두는 데 쓰인다.

**Sources**:
- [동행복권에서 지원해주는 로또 번호 가져와 보기](https://ety.kr/board/TIP/126)
- [GitHub - roeniss/dhlottery-api: 비공식 동행복권 API](https://github.com/roeniss/dhlottery-api)
- [동행복권 로또6/45 회차별 결과정보 JSON 획득하기](https://lunikism.com/entry/%EB%8F%99%ED%96%89%EB%B3%B5%EA%B6%8C-%EB%A1%9C%EB%98%90645-%ED%9A%8C%EC%B0%A8%EB%B3%84-%EA%B2%B0%EA%B3%BC%EC%A0%95%EB%B3%B4-JSON-%ED%9A%8D%EB%93%9D%ED%95%98%EA%B8%B0)
- [회차별 당첨번호 (동행복권 공식)](https://www.dhlottery.co.kr/gameResult.do?method=byWin)
- [재정경제부_온라인복권 1등 당첨 판매점 현황 정보 (공공데이터포털)](https://www.data.go.kr/data/15059963/fileData.do)
- [기획재정부_온라인복권 판매점 주소 (공공데이터포털)](https://www.data.go.kr/data/15086355/fileData.do)

---

## 5. 당첨 계산 알고리즘 계약 (Phase6-1에서 구현할 것, 이번 Task는 설계만)

### 용어 정정 — "6등"은 실제로 없다

이번 지시문이 "6등/낙첨 처리 방식"이라고 표현했으나, 로또 6/45의 공식 등수 체계는 **1~5등과 낙첨뿐이며 "6등"이라는 등수는 존재하지 않는다.** `docs/EXECUTION_PLAN.md`가 인용한 판정 기준("5개+보너스=2등, 5개=3등")과 일치시켜 아래처럼 정정해 설계했다 — 추측이 아니라 이미 EXECUTION_PLAN에 준용된 표준 규칙이다.

### 제안 시그니처

```ts
export interface MatchResult {
  matchCount: number;           // 0~6, 사용자 번호 중 당첨번호와 일치하는 개수
  bonusMatched: boolean;        // 보너스 번호 일치 여부
  winRank: 1 | 2 | 3 | 4 | 5 | null; // null = 낙첨
}

export function matchNumbers(
  userNumbers: number[],
  winningNumbers: number[],
  bonusNumber: number
): MatchResult
```

- **등수 판정 규칙**(EXECUTION_PLAN이 인용한 것과 동일): 6개 일치=1등, 5개 일치+보너스 일치=2등, 5개 일치(보너스 불일치)=3등, 4개 일치=4등, 3개 일치=5등, 그 외=낙첨(`winRank: null`).
- **비교 방식**: §2에서 확인했듯 입력 배열의 정렬이 DB 레벨에서 보장되지 않으므로, **`Set` 기반 교집합 계산**으로 구현해 정렬 여부·중복(애초에 CHECK로 불가능하지만 방어적으로) 여부에 관계없이 정확해야 한다.
- **잘못된 입력 처리**: 이 함수의 입력은 항상 DB CHECK를 통과한 데이터(`user_numbers.numbers`, `draws.numbers`/`bonus_number`)에서 오므로, Phase5-1의 `generateNumbers()`(무입력 순수 함수)와 달리 "신뢰되지만 형식은 재확인 가능한 내부 데이터"를 다룬다 — 길이 6 확인 등 최소한의 방어적 체크는 두되(`assert`류), Phase5-2의 `parseNumbersInput()`처럼 클라이언트 대상의 상세한 에러 메시지 체계까지는 필요 없다(호출자가 사용자가 아니라 관리자 배치 로직이므로).
- **순수 함수 여부**: 그렇다 — DB/네트워크 의존성 없음, 동일 입력에 항상 동일 출력.
- **재현성**: 필요하다(Phase5-1의 `generateNumbers()`와 반대) — 같은 세 인자에 항상 같은 결과가 나와야 신뢰도가 유지된다.

### 당첨금은 알고리즘이 계산하지 않는다

이번 지시문의 지적이 정확하다 — **당첨 "등수"는 순수 계산(위 함수)이지만, 당첨 "금액"은 회차마다 실제 배당 결과에 따라 달라지는 사실 데이터**다. `matchNumbers()`는 금액을 반환하지 않는다. 금액 표시는 UI가 해당 회차의 `draws` 행을 조회해 가져와야 한다 — 그런데:

**발견된 공백**: 현재 `draws` 스키마는 `first_prize_amount`(1등)만 갖고 있고 **2~5등 당첨금 컬럼이 없다.** 로또 6/45 공식 규정상 4등(고정 5만원)·5등(고정 5천원)은 매 회차 동일하지만, 2등·3등은 1등과 마찬가지로 당첨자 수에 따라 회차마다 배분되어 달라진다 — 이 값들을 어디서 가져올지(스키마 확장이 필요한지, 아니면 4·5등만 상수로 처리하고 2·3등은 표시하지 않을지)는 **이번 감사에서 확정하지 않고 Decision으로 남긴다**(§14) — 공식 규정 수치를 코드에 하드코딩하기 전에 실제 공식 출처(§4)에서 재확인이 필요하다.

---

## 6. 저장 구조 결정

### 이미 스키마가 결정해둔 것 — Option C

`user_numbers.match_count`/`win_rank`/`checked_at`(전부 Phase1부터 존재, NULL 허용)는 **정확히 이 용도로 이미 설계되어 있다.** `docs/EXECUTION_PLAN.md` 구현순서 3번("대조 로직: 회차 `user_numbers` 전수 조회 → 대조 → `match_count`/`win_rank` UPDATE")도 이 구조를 그대로 전제한다. 따라서 A(매번 실시간 계산)/B(별도 캐시 테이블)/D(하이브리드)를 새로 검토할 필요 없이 **C(결과를 `user_numbers`에 직접 저장)가 이미 확정된 설계**다 — 이번 감사는 이를 비교 기준으로 재확인만 한다.

| 기준 | 평가 |
|---|---|
| 정확성 | 한 번 계산해 저장하므로 매번 재계산할 필요가 없고, 결과가 회차 데이터가 바뀌지 않는 한 변하지 않는다(당첨 결과는 사실 확정 후 불변) |
| 유지보수 비용 | 낮음 — 새 테이블 없음, 기존 컬럼 재사용 |
| Supabase Free Tier | 영향 없음 — 이미 존재하는 컬럼에 값만 채우는 UPDATE |
| 외부 API 호출량 | **0회** — §0/§4 결론대로 외부 API를 아예 호출하지 않으므로 이 항목 자체가 해당 없음 |
| 데이터 최신성 | 관리자가 회차를 입력하는 시점에 그 회차 전체가 한 번에 대조되므로 최신성 문제 없음 |
| 1인 개발 유지보수 난이도 | 낮음 — EXECUTION_PLAN이 이미 이 흐름을 동기 처리 하나로 설계해둠(Edge Function 불필요, §9) |
| 장애 대응 | 관리자 입력 API가 실패하면 그 회차만 재시도하면 됨 — 부분 실패 시 재실행 가능하도록 UPDATE가 멱등적인지(같은 회차를 두 번 입력해도 결과가 같은지)는 Phase6-1 구현 시 확인 필요(Decision 아님, 구현 세부사항) |
| 통계 확장성 | `user_period_stats`가 이미 `best_win_rank` 컬럼을 갖고 있어(Phase4 감사에서 확인), 향후 이 값을 채우는 배치가 `user_numbers.win_rank`를 그대로 소스로 쓸 수 있다 — 확장에 유리 |

---

## 7. 회차 선택 UX

§3의 권장안(하이브리드)을 UX 관점에서 구체화한다.

- **자동으로 최신 회차 선택**·**생성일 기준 자동 추정**: 둘 다 기각(§3) — "생성=구매" 가정이 시스템이 임의로 사용자를 오인시킬 위험이 있다는 지시문의 우려가 실제로 타당하다고 판단했다.
- **권장**: 다이어리 결과 화면에서 `target_round`가 없는 항목에 "회차 선택" UI(예: 드롭다운 또는 최근 회차 몇 개 중 선택)를 제공하고, 선택 즉시 그 항목만 확정한다. 선택하지 않은 항목은 계속 "회차 미지정" 상태로 조회 목록에 남아 있어도 무방하다(강제하지 않음).
- **번호 저장 시 회차 선택**: 기각(§3) — Phase5의 "생성 즉시 자동 저장" 플로우를 변경해야 해서 이번 Task의 "기존 구현을 임의로 리팩터링하지 말 것" 원칙과 충돌한다.

---

## 8. 보안 감사

| 항목 | 확인 결과 |
|---|---|
| `user_id`를 클라이언트 입력으로 받지 않는 구조 | Phase4/5와 동일 원칙 유지 가능 — 사용자가 직접 수행하는 유일한 쓰기(§3의 회차 확정 `UPDATE`)는 `getCurrentUser()`로 얻은 `user.id`만 사용하면 된다 |
| `service_role` 사용 필요 여부 | **관리자 전용 작업(회차 `draws` INSERT, 전체 사용자 `user_numbers` 배치 UPDATE, `notifications` INSERT) 3곳은 구조적으로 필요하다**(§2 RLS 재확인) — 이는 새로운 예외가 아니라 `docs/DATABASE_SCHEMA.md` §6이 Phase1부터 정해둔 "관리자 쓰기는 서버 API+service_role" 원칙을 그대로 따르는 것이다. 사용자 본인의 조회/회차확정은 계속 `service_role` 없이 처리 가능 |
| RLS | 재확인만 함(§2) — 이번 Task에서 수정하지 않음 |
| 다른 사용자의 `user_numbers` 접근 가능성 | 없음 — `user_numbers_select_own`(본인만)이 그대로 유지되고, 관리자 배치는 service_role로 RLS를 우회하지만 그 결과는 각 사용자 본인만 자신의 행에서 조회 가능(RLS가 그대로 적용됨, 우회는 "쓰기" 시점뿐) |
| 공개 데이터(당첨번호)와 개인 데이터(사용자 결과) 분리 | 이미 분리되어 있다 — `draws`는 전체 공개 SELECT(`0008`), `user_numbers`는 본인만. Phase6이 새로 만들 코드는 이 경계를 유지하기만 하면 된다 |
| API 응답의 불필요한 정보 노출 | Phase6-1에서 관리자 API/조회 API를 실제로 만들 때, Phase5-2가 확립한 패턴(응답에 최소 정보만 포함, `{ data: ... }`/`{ error: {...} }`)을 재사용할 것을 권장(설계 지침, 이번 Task에서 코드 작성 안 함) |

---

## 9. 성능/캐싱

**외부 API를 호출하지 않으므로(§0/§4) 이 섹션의 대부분 우려가 원천적으로 해소된다.**

| 질문 | 답 |
|---|---|
| 매 페이지마다 외부 API 호출? | **아니오 — 애초에 외부 API를 호출하지 않는다.** `draws` 조회는 우리 DB의 평범한 SELECT다 |
| 회차별 당첨번호 캐시 필요? | 불필요 — 자체 DB 테이블 조회는 이미 빠르다. 별도 캐시 레이어(Redis 등)는 과설계 |
| Next.js 캐싱 활용 가능? | 필요 시 활용 가능하지만 MVP 트래픽 규모에서 필수는 아니다(Decision 아님, 나중에 필요해지면 추가) |
| Edge Function/cron/background job 필요? | **불필요** — EXECUTION_PLAN 자신이 "MVP 규모에서는 관리자 요청 안에서 동기 처리해도 응답 지연이 문제되지 않는다"고 이미 명시했고, `docs/IMPLEMENTATION_PLAN.md`의 기존 원칙과도 일치한다. 대조 대상이 크게 늘어나면 그때 재검토(EXECUTION_PLAN 원문 그대로) |
| 실패 시 fallback | 관리자 입력 자체가 수동이라 "외부 API 장애" 시나리오가 없다 — 관리자가 재시도하면 된다 |

---

## 10. UX/UI 요구사항

`docs/DESIGN_SYSTEM.md`와 Phase3~5가 이미 구축한 컴포넌트(`Card`/`Badge`/`EmptyState`/`Spinner`/`Container`) 재사용을 전제로 정리한다(이번 Task에서 UI를 만들지 않음, 요구사항만 정리).

| 항목 | 요구사항 |
|---|---|
| 당첨 번호 표시 | `draws.numbers`+`bonus_number` — 공개 데이터, 로그인 여부와 무관하게 조회 가능 |
| 사용자가 저장한 번호 표시 | 기존 히스토리 카드 패턴(`app/my/journal/history/page.tsx`) 재사용 |
| 일치 번호 강조 | **색상만으로 표현하지 않는다**(§11). `matchNumbers()`의 `matchCount` 자체를 텍스트로 병기 |
| 보너스 번호 표시 | 당첨번호와 시각적으로 구분하되(예: 별도 표기), 색상 하나로만 구분하지 않음 |
| 당첨 등수 | 텍스트로 명확히("3등", "낙첨") — §11 |
| 당첨금 | 1등만 확실히 표시 가능(§5), 2~5등은 Decision 필요 |
| 낙첨 상태 | `EmptyState`류가 아니라(데이터가 없는 게 아니라 "결과가 확인됨 + 낙첨"이므로) 명확한 결과 카드로 표시 — "아직 확인 안 됨"(대조 전, `checked_at IS NULL`)과 "확인했지만 낙첨"(`checked_at`은 있고 `win_rank IS NULL`)을 **구분해서 표시해야 한다**(신규 발견 — 이 두 상태를 섞으면 사용자가 "결과가 안 나온 것"과 "떨어진 것"을 혼동한다) |
| 회차 정보 | `draws.round` 표시 가능. **추첨일은 표시 불가**(컬럼 없음, §2) — Decision 필요 |
| Empty/Loading/Error State | Phase4가 확립한 패턴(`EmptyState`, `Spinner`, "불러오는 중 문제가 발생했어요") 재사용 권장 |
| BottomNavigation과의 관계 | 신규 탭 불필요 — 기존 "다이어리" 탭 하위 화면으로 흡수(SITEMAP `/my/journal/results`가 이미 이 경로를 정의해둠) |

### Phase3 잔여 디자인 이슈의 Phase6 적용

- **`color-danger`/`color-success`**: Phase6은 "당첨/낙첨"이라는 명확한 성공/실패 이분법을 다루는 **첫 Phase**라 이 문제를 실제로 마주칠 가능성이 매우 높다(Phase5 최종 감사가 이미 이렇게 예측했음, 재확인). 이번 Task는 토큰 값을 변경하지 않는다 — Phase6-1 설계 시 `docs/PHASE4_ARCHITECTURE_DECISION.md`/`docs/PHASE5_GENERATE_UI_REPORT.md`가 이미 채택한 정책(큰/굵은 텍스트에만 `danger` 허용, `success`는 텍스트 색상으로 미사용, 색상 대신 문구로 구분)을 그대로 이어가는 것을 권장.
- **번호 구간별 5색 토큰**: 여전히 미구현(Phase5 감사에서 확인). Phase6이 "일치 번호 강조"에 색으로 접근하고 싶다면 이 공백과 다시 부딪힌다 — 새 토큰을 만들지 않고, 예를 들어 "굵기+테두리+텍스트 병기"처럼 기존 토큰만으로 강조하는 방법을 Phase6-1에서 검토할 것을 권장(이번 Task에서 확정하지 않음).

---

## 11. 접근성

- **색상만으로 당첨 여부를 표현하지 않는다** — "3등", "낙첨", "보너스 일치" 같은 텍스트가 항상 함께 있어야 한다(위 §10에서 이미 요구사항으로 명시). 이는 WCAG 1.4.1(색에 의존한 정보 전달 금지)과 직결되며, `docs/UI_UX_GUIDELINE.md` §4가 이미 "당첨/미당첨을 색상+아이콘+텍스트 3중으로 표시"하라고 명시해둔 원칙과 일치한다(재확인, 신규 아님).
- **색상 대비**: `color-danger`/`success`를 실제로 어떻게 쓸지에 따라 Phase3 감사의 WCAG 미달 문제가 재현될 수 있다(§10) — Phase6-1에서 반드시 재검토.
- **heading hierarchy**: Phase4가 확립한 패턴(각 페이지 `<h1>` 정확히 1개, 필요 시 섹션별 `<h2>`)을 그대로 따를 것을 권장.
- **focus/keyboard**: 회차 선택 UI(§7)가 실제 인터랙티브 요소(select 또는 버튼 목록)가 될 것이므로, 기존 `focus-visible` 패턴(Button/Link 전반에 이미 일관 적용됨)을 재사용.
- **screen reader**: 대조 결과가 비동기로 갱신되는 화면이 아니라(관리자가 미리 대조를 끝내고, 사용자는 정적으로 완성된 결과를 조회) Phase5-3의 `role="status"` 같은 라이브 리전이 필수는 아니다 — 있다면 페이지 새로고침으로 충분.
- **aria-label**: 새 랜드마크가 필요하면 기존 사용 중인 라벨("주요 메뉴"/"하단 메뉴"/"다이어리 메뉴" 등)과 중복되지 않는 새 라벨을 사용해야 한다(Phase3/4가 반복적으로 확인해온 원칙).

---

## 12. 기존 Phase5와의 연결 — 전체 데이터 흐름

```
[Phase5, 이미 완료]
/generate → generateNumbers() → POST /api/numbers → user_numbers INSERT
  (user_id=본인, numbers=생성값, generation_method='auto', target_round=NULL)

[Phase6 신규 — §3 하이브리드 권장]
사용자가 다이어리 결과 화면에서 target_round 없는 항목에 회차 선택
  → user_numbers UPDATE(target_round=선택값)   ※ 본인 세션, service_role 불필요

[Phase6 신규 — 관리자, service_role]
관리자가 공식 데이터(§4)를 확인해 POST /api/admin/draws 호출
  → draws INSERT(round, numbers, bonus_number, first_prize_amount, first_prize_count)
  → 같은 요청 안에서 동기 처리:
      해당 round를 target_round로 가진 user_numbers 전수 조회(user_id NOT NULL만, 비회원 제외)
      → matchNumbers(각 행.numbers, draws.numbers, draws.bonus_number)
      → user_numbers.match_count/win_rank/checked_at UPDATE
      → 당첨자(win_rank NOT NULL)에 대해 notifications INSERT(type='win_result')

[Phase4, 이미 완료 — 코드 수정 없이 재사용]
사용자가 /my/journal/history 또는 결과 화면 방문
  → getRecentUserNumbers({ onlyChecked: true })가 checked_at NOT NULL인 행을 조회
  → 결과 표시(§10)
```

**Phase4 코드 수정 필요 여부**: `getRecentUserNumbers()`(`lib/api/journal.ts`)는 이미 `onlyChecked` 옵션을 갖고 있어(Phase4-1에서 이미 구현) **수정 없이 그대로 사용 가능하다** — EXECUTION_PLAN이 "수정할 파일"로 적어둔 `lib/api/journal.ts`는 실제로는 "이미 준비된 기능의 재확인"이지 코드 변경이 아니다(Phase5 때와 동일한 패턴 재확인).

---

## 13. 향후 Phase 영향

| 향후 기능 | Phase6 설계가 막는가 |
|---|---|
| 통계(`user_period_stats.best_win_rank`) | 막지 않음 — `user_numbers.win_rank`를 그대로 소스로 쓸 수 있음(§6) |
| 공유 | 막지 않음 — `share_cards.content_type`에 향후 `'win_result'`류 값을 추가하는 확장은 기존 ENUM 확장 패턴을 그대로 따르면 됨 |
| 커뮤니티 | 막지 않음 — 무관한 레이어 |
| 알림(이메일/웹푸시) | 막지 않음 — `notification_deliveries.channel`이 이미 그 값들을 정의해둠, Phase6은 `in_app`만 채우고 나머지는 나중에 |
| 꿈 연동 | 막지 않음 — `related_dream_id`는 Phase6이 건드리지 않음 |
| **여러 게임 생성**(Phase5 미결정) | **막지 않음** — `user_numbers`가 게임당 1행 구조라, 한 번의 생성이 여러 행을 만들게 되어도 Phase6의 대조 로직(행 단위)에는 영향이 없다 |
| AI 추천 | 막지 않음 — `generation_method` ENUM에 이미 여지가 있음(`'fortune'` 등) |
| 행운 다이어리(고도화) | 막지 않음 — 오히려 Phase6이 "당첨확인"이라는 다이어리의 핵심 조각을 완성함 |
| Fortune 기능 | 막지 않음 — 무관한 레이어 |
| **`session_id`**(Phase5 미결정) | **막지 않음** — EXECUTION_PLAN 자체가 "비회원 번호는 대조 대상에서 제외"라고 명시해, `session_id`(비회원 추적용)는 Phase6 대조 로직과 애초에 무관하다 |

---

## 14. 기존 미결정 사항 종합 — 최종 분류

| # | 항목 | 현재 상태 | 분류 |
|---|---|---|---|
| 1 | `/generate` vs `/generate/auto` | 미해결(Phase5-0부터) | Phase6과 무관, 후속 처리 |
| 2 | 여러 게임 생성 | 미해결 | Phase6과 무관(§13) |
| 3 | 번호 구간별 5색 | 미해결 | **Phase6에서 다시 마주칠 가능성 있음**(§10) — 결정은 Phase6 이후로 미뤄도 되나, Phase6-1 UI 설계 시 이 제약을 인지하고 있어야 함 |
| 4 | 저장 개수/생성 횟수 제한 | 미해결 | Phase6과 무관, 후속 처리 |
| 5 | `session_id` | 미해결 | Phase6과 무관(§13, EXECUTION_PLAN이 이미 "비회원 제외" 명시) |
| 6 | 카카오 공유 Phase 배정 | 미배정 | Phase6과 무관, 후속 처리 |
| 7 | Fortune Phase 배정 | 미배정 | Phase6과 무관, 후속 처리 |
| 8 | `proxy.ts` vs Architecture Decision 문서 불일치 | 미해결(Phase4) | Phase6과 무관 — `/my/journal/results`류 신규 경로도 이미 `/my` 접두사로 보호되므로 기존 구조 그대로 적용됨 |
| 9 | `color-danger`/`color-success` WCAG | 미해결 | **Phase6-1 UI 설계 시 반드시 재검토**(§10, §11) — 착수 자체를 막지는 않음 |
| 10 | GNB/BottomNavigation 메뉴 차이·"더보기" 미구현 | 미해결(Phase3) | Phase6과 무관 |
| **11(신규)** | **번호와 회차 연결 방식**(§3) | **미해결** | **Phase6-1 착수 전 결정 권장**(하이브리드 제안) — UI/데이터 흐름 전체에 영향을 주는 사안이라 나머지와 성격이 다름 |
| **12(신규)** | **2~5등 당첨금 컬럼 부재**(§5) | **미해결** | Migration 필요 여부 결정 — Phase6-1(순수 함수)에는 영향 없음, UI(당첨금 표시) 단계에서 결정 필요 |
| **13(신규)** | **`draws.draw_date`(추첨일) 컬럼 부재** | 미해결(기존 BACKLOG 항목 A 재확인) | UI(추첨일 표시) 단계에서 결정 필요, Phase6-1에는 영향 없음 |
| **14(신규)** | **"확인 전"과 "확인 후 낙첨"의 상태 구분**(§10) | 신규 발견 | Phase6-1 UI 설계 시 반드시 반영 — 별도 Migration/컬럼 불필요(`checked_at`/`win_rank` 조합으로 이미 표현 가능) |

**Phase6-1(순수 함수 구현) 착수를 막는 항목은 없다** — #11(회차 연결)·#12(당첨금 컬럼)·#13(추첨일 컬럼)은 전부 **UI/데이터 저장 단계**의 결정 사항이지, `matchNumbers()` 자체(등수 판정 순수 함수)는 이 결정들과 독립적으로 지금 바로 설계·구현 가능하다.

---

## 15. 최종 판정

### **CONDITIONAL READY**

Critical/Blocker급 기술적 문제는 없다 — 필요한 테이블/컬럼(대조 결과 저장)이 이미 존재하고, RLS도 이미 관리자 작업에 필요한 service_role 사용을 구조적으로 허용해두었으며, 순수 판정 함수는 지금 바로 설계 가능하다. `CONDITIONAL READY`인 이유는 §14의 4개 신규 항목(특히 #11 회차 연결 방식)이 UI/데이터 흐름의 실제 모양을 결정하기 때문이다.

1. **Phase6-1에서 바로 구현 가능한 것**: `matchNumbers()` 순수 함수 + 경계값 단위 테스트(1~5등 전체 케이스, 낙첨, 입력 정렬 무관성) — 이번 지시문이 제안한 순서와 정확히 일치.
2. **구현 전에 반드시 결정해야 하는 것**: (a) §3의 회차 연결 방식(하이브리드 권장) — 이것이 확정돼야 Phase6-2(관리자 API+대조 배치)와 Phase6-3(UI)의 데이터 흐름이 정해진다. (b) 2~5등 당첨금 표시 여부(§5, §14-12). (c) 추첨일 표시 여부(§14-13).
3. **DB Migration이 필요한가**: 대조 결과 저장에는 **불필요**(이미 있음). 2~5등 당첨금·추첨일 표시를 하기로 결정하면 **그때 필요**(지금 만들지 않음).
4. **외부 API 의존성이 있는가**: **없다**(§0, §4) — 관리자 수동 입력이 MVP 설계다.
5. **보안상 Blocker가 있는가**: **없다** — 관리자 작업의 `service_role` 사용은 기존 설계 원칙(`DATABASE_SCHEMA.md` §6)과 일치하는 예정된 사용이다.
6. **UX상 Blocker가 있는가**: **없다** — 다만 §3 미결정 시 "결과 화면이 무엇을 보여줄지" 자체가 확정되지 않아 Phase6-3(UI) 착수는 지연될 수 있다.
7. **Phase6-1의 정확한 다음 작업**: **"당첨 데이터 소스 계약(관리자 수동 입력 확정, §0/§4) + `matchNumbers()` 순수 함수 계약(§5) 구현"** — 이번 지시문이 제안한 순서를 그대로 채택한다. `saveUserNumbers()`/`user_numbers` 스키마는 건드리지 않는다.

---

## 16. 근거 문서/코드 경로 목록 (재확인 편의를 위해 정리)

- `docs/EXECUTION_PLAN.md`(Phase6 섹션), `docs/ROADMAP.md`(§1 Must 표, §2 Phase 8), `docs/SITEMAP.md`(`/my/journal/results`), `docs/DATABASE_SCHEMA.md`(§6 관리자 정책 공통 원칙)
- `supabase/migrations/0002_draws_user_numbers.sql`(`draws`/`user_numbers`/`is_valid_lotto_numbers`)
- `supabase/migrations/0006_notifications.sql`(`notifications`/`notification_deliveries`)
- `supabase/migrations/0007_winning_cases_stores.sql`(`winning_cases` — Phase6과 무관함을 확인하는 근거)
- `supabase/migrations/0008_rls_policies.sql`(전체 RLS 원문)
- `lib/api/numbers.ts`(Phase5-2, `target_round` 미설정 확인)
- `lib/api/journal.ts`(Phase4-1, `getRecentUserNumbers({ onlyChecked })` 존재 확인)
- `docs/BACKLOG.md`(항목 A, `draw_date` 미해결 재확인)
- `docs/PHASE4_ARCHITECTURE_DECISION.md`, `docs/PHASE5_GENERATE_UI_REPORT.md`(color-danger/success 사용 정책 선례)
