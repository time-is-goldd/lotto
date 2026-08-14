# Phase6-2 당첨 데이터 저장 구조 + 회차 연결(target_round) 전략 확정 보고서

> 이 Task는 설계 확정 Task다. 관리자 UI/외부 API/알림/통계/공유는 구현하지 않았고, 코드/DB도 전혀 수정하지 않았다(§9의 실측 검증 스크립트만 예외적으로 실제 Supabase에 대해 실행했으며, 사용한 임시 계정·행·파일은 전부 삭제해 원상복구했다 — §1 참조).

## 1. 생성/수정 파일

**영구적으로 남는 파일**: `docs/PHASE6_DATA_ARCHITECTURE_DECISION.md`(본 보고서) 1개뿐이다.

**검증 중 임시로 사용하고 전부 삭제한 것**(git 이력에 흔적 없음):
- 프로젝트 루트에 임시로 만든 `__verify_target_round.mjs`, `__phase6_rls_test.mjs` — Supabase JS 클라이언트로 실제 프로젝트에 접속해 §2/§9의 실측 검증을 수행한 1회성 스크립트. 검증 직후 삭제했고 `git status --porcelain`으로 흔적이 없음을 확인했다.
- Supabase 프로젝트에 생성했던 테스트 계정 2개(`profiles`+`auth.users`)와 `user_numbers` 테스트 행 1건 — 검증 종료 후 `service_role`로 전부 삭제하고, 스크립트 안에서 `cleanup_verified_empty: true`로 삭제 완료를 재확인했다.

`app/*`, `components/*`, `lib/api/numbers.ts`, `lib/api/journal.ts`, `proxy.ts`, Migration 파일, `lib/logic/matchNumbers.ts`, `lib/types/winning.ts`(Phase6-1 산출물)는 이번 Task에서 전혀 수정하지 않았다.

---

## 2. 현재 DB 구조 (실제 migration 원문 기준)

### `user_numbers` (`supabase/migrations/0002_draws_user_numbers.sql`)

| 컬럼 | 타입 | NULL | DEFAULT | 비고 |
|---|---|---|---|---|
| id | bigint | NOT NULL | identity | PK |
| user_id | uuid | NULL 허용 | 없음 | FK → `profiles(id)`, ON DELETE 기본값(NO ACTION) |
| session_id | varchar(64) | NULL 허용 | 없음 | 비회원 추적용 |
| numbers | int[] | NOT NULL | 없음 | CHECK `is_valid_lotto_numbers(numbers)` (6개, 1~45, 중복 없음 — **정렬 여부는 검사하지 않음**) |
| generation_method | enum('auto','custom','dream','fortune') | NOT NULL | 없음 | |
| related_dream_id / related_fortune_id | bigint | NULL 허용 | 없음 | FK 제약 없음(애플리케이션 레벨 참조) |
| recommendation_reason | text | NULL 허용 | 없음 | |
| is_purchased | boolean | NOT NULL | `false` | |
| purchase_amount | int | NOT NULL | `0` | |
| memo | text | NULL 허용 | 없음 | |
| **target_round** | int | NULL 허용 | 없음 | FK → `draws(round)`, ON DELETE 기본값(NO ACTION) |
| is_public | boolean | NOT NULL | `true` | |
| **match_count** | smallint | NULL 허용 | 없음 | |
| **win_rank** | smallint | NULL 허용 | 없음 | |
| **checked_at** | timestamptz | NULL 허용 | 없음 | |
| created_at | timestamptz | NOT NULL | `now()` | |

UNIQUE 제약 없음(id PK 제외). INDEX: `(user_id, target_round)`, `(target_round, is_public)`, `(created_at)`, `(related_dream_id)`, `(related_fortune_id)`.

**RLS** (`0008_rls_policies.sql`): `authenticated` 역할 대상으로 `auth.uid() = user_id`인 본인 행만 SELECT/INSERT/UPDATE/DELETE 전부 허용. `anon` 역할에는 어떤 정책도 없어 전체 차단. **컬럼 단위 제한은 없다** — 이 사실이 §9의 발견과 직결된다.

### `draws` (`supabase/migrations/0002_draws_user_numbers.sql`)

| 컬럼 | 타입 | NULL | DEFAULT | 비고 |
|---|---|---|---|---|
| id | bigint | NOT NULL | identity | PK |
| round | int | NOT NULL | 없음 | **UNIQUE** — 중복 회차 입력을 DB 레벨에서 원천 차단 |
| numbers | int[] | NOT NULL | 없음 | CHECK 동일(6개, 1~45, 중복 없음, 정렬 무관) |
| bonus_number | int | NOT NULL | 없음 | CHECK 1~45 |
| first_prize_amount | bigint | NOT NULL | 없음(의도적) | 1등 당첨금만 존재. 2~5등 당첨금 컬럼 없음 |
| first_prize_count | int | NOT NULL | 없음(의도적) | |
| source | varchar(50) | NOT NULL | `'manual'` | Phase8 자동화 시 `'api'` 등으로 구분 예정 |
| created_at | timestamptz | NOT NULL | `now()` | `draw_date`(실제 추첨일) 컬럼 없음 — `docs/BACKLOG.md` 항목 A에 이미 "미해결, 재검토 필요 시점: 실제 공식 데이터 import 시점"으로 기록되어 있다 |

**RLS**: `anon`/`authenticated` 전체 공개 SELECT, INSERT/UPDATE 정책 없음(=service_role 전용).

### Migration 번호 확인 (추측 없이 CLI로 직접 확인)

```
npx supabase migration list
local: 0001 0002 0003 0004 0005 0006 0007 0008 0009 0010 0011 0013
remote: 0001 0002 0003 0004 0005 0006 0007 0008 0009 0010 0011 0013 (완전 일치)
```

- 로컬/원격 완전 동기화 상태 — 밀린 migration 없음.
- `0012`는 파일이 없다. `0013_profiles_status_default.sql` 자체 주석에 "Phase9의 `0012_admin_flag.sql`을 위해 예약된 번호"라고 명시돼 있다(`EXECUTION_PLAN.md` L574와 일치). 따라서 **이번 Task에서 신규 migration이 필요해지면 다음 사용 가능 번호는 `0014`**다(0012는 이미 용도가 예약돼 있어 쓸 수 없음) — 결론적으로 §9까지의 조사 결과 이번 Task에서는 어떤 신규 migration도 필요하지 않다고 판단했다(§8).

### 실제 Supabase에서 실측 확인 (`draws` 실데이터)

`anon` 키로 `draws`를 직접 SELECT한 결과 `round: 1150` 등 15건이 실제로 존재했다. 이는 `0010_seed_data.sql`이 넣은 **합성(synthetic) placeholder 데이터**이며(`docs/BACKLOG.md` 항목 B에 이미 기록), 실제 로또 공식 당첨 결과가 아니다. 이번 Task의 판단(스키마가 충분하다)에는 영향을 주지 않지만, 실제 서비스 오픈 전에는 반드시 교체돼야 한다는 기존 BACKLOG 결정을 재확인했을 뿐, 이번 Task에서 새로 처리하지는 않는다(범위 밖).

---

## 3. 현재 Phase5 저장 구조

`lib/api/numbers.ts`의 `saveUserNumbers()`:

```ts
await supabase
  .from("user_numbers")
  .insert({ user_id: userId, numbers, generation_method: "auto" })
  .select()
  .single();
```

`target_round`를 INSERT 객체에 전혀 포함하지 않는다 — 즉 항상 컬럼 DEFAULT(없음 → NULL)로 저장된다. `app/api/numbers/route.ts`도 `saveUserNumbers(user.id, numbers)`만 호출할 뿐 회차 관련 로직이 전혀 없다. `app/generate/page.tsx`도 회차 선택 UI/로직이 없다(서버 컴포넌트에서 `generateNumbers()` 호출 결과를 그대로 클라이언트에 넘길 뿐).

**실제 Supabase에서 INSERT 후 SELECT로 검증한 결과** (테스트 계정으로 실제 프로덕션 Supabase 프로젝트에 실행, 종료 후 삭제):

```json
{
  "userA_insert_own": { "data": { "id": 25, "target_round": null, "match_count": null, "win_rank": null, "checked_at": null, ... }, "error": null },
  "target_round_is_null": true
}
```

**확인됨: `target_round`는 실제로 NULL로 저장된다.** Phase6-0/6-1에서 코드 리딩만으로 내린 결론이 실측으로도 그대로 맞았다.

---

## 4. target_round 연결 전략 비교

### Option A — 번호 생성 시 target_round 자동 지정

- 문제로 지적된 그대로다: "생성 시점의 최신 회차"를 그대로 연결하면 그 회차는 **이미 추첨이 끝난 회차**라 논리적으로 맞지 않는다(사용자가 방금 만든 번호가 이미 끝난 추첨에 낄 수 없다). 올바르게 하려면 "다음 회차(아직 추첨 전)" 번호를 계산해야 하는데, `draws` 테이블에는 추첨이 끝난 회차만 존재하므로(§2, `numbers`/`bonus_number`가 NOT NULL) 다음 회차 번호는 DB에서 조회할 수 없고 **날짜 기반 순수 계산**(1회차 기준일 2002-12-07부터 매주 1회차씩 증가)이 필요하다.
- 이 계산 자체는 외부 API 없이 순수 함수로 가능하지만, 오차 검증(과거 결번/연기 회차가 실제로 없었는지 전수 확인)이 필요해 **이번 Task 범위에서 검증 없이 확정할 수 없다**.

### Option B — 당첨 확인 시 사용자가 회차 선택

- 장점: 정확성은 사용자 책임으로 넘어가 데이터 자체는 항상 정확.
- 단점: 사용자가 "몇 회차였는지"를 기억해야 하는 마찰이 크다. 로또 회차 번호를 외우는 사용자는 거의 없다 — 실제 사용성 관점에서 나쁘다.

### Option C — 회차 선택을 번호 생성 시점에 받음

- "이번 회차/다음 회차/특정 회차" 선택 UI가 필요하다 — `/generate` UI 수정이 필요한데 이는 이번 Task의 금지 범위(§0)이자 Phase6-2가 아니라 Phase6-3 이후 UI Task의 영역이다.
- UX 마찰은 B보다 약간 낮지만(선택지가 제한적) 여전히 "회차"라는 개념을 사용자에게 노출해야 한다.

### Option D — 별도 ticket/entry 엔티티 도입

- `user_numbers`와 "실제 구매 회차"를 분리하면 한 세트의 번호를 여러 회차에 반복 구매하는 시나리오까지 표현할 수 있어 이론적으로는 가장 유연하다.
- 그러나 현재 `user_numbers` 자체가 "번호 생성=저장=구매 기록" 역할을 1:1로 겸하고 있고([[FEATURE_SPEC]]/`DATABASE_SCHEMA.md` §3.3 어디에도 "한 세트를 여러 회차에 반복 사용"하는 요구사항이 없다), MVP 규모(1인 개발, 사용자 수 적음)에서 별도 엔티티는 명백한 과도설계다.

### 채택안 — **Option B의 변형: "배치가 자동으로 회차를 연결"**

위 4가지 원안 중 어느 것도 그대로 채택하지 않고, `EXECUTION_PLAN.md` Phase6이 이미 서술한 배치 흐름(§440 "대조 로직: 회차 `user_numbers` 전수 조회 → 대조 → UPDATE")을 실제로 동작하게 만드는 방향으로 Option B를 변형했다:

> **`target_round`는 저장 시점(Phase5)에도, 사용자 선택 시점에도 채워지지 않는다. 대신 관리자가 새 회차 결과를 입력하는 바로 그 순간(Phase6-3의 배치), `target_round IS NULL AND checked_at IS NULL AND user_id IS NOT NULL`인 모든 `user_numbers` 행을 그 회차에 일괄 연결하면서 동시에 `matchNumbers()`로 대조하고 `match_count`/`win_rank`/`checked_at`까지 한 번의 UPDATE로 채운다.**

이것이 A/B/C/D 어디에도 정확히 속하지 않는 이유: 사용자가 회차를 선택하지 않는다는 점(B/C와 다름)과, "생성 시점"이 아니라 "확인 시점"에 연결이 일어난다는 점(A와 다름)이 결합된 하이브리드다. 아래 §5에서 이 안이 왜 최선인지 기준별로 평가한다.

---

## 5. MVP 관점 최종 선택 — 평가표

| 기준 | Option A(생성 시 자동) | Option B(확인 시 사용자 선택) | Option C(생성 시 사용자 선택) | Option D(별도 엔티티) | **채택안(배치 자동 연결)** |
|---|---|---|---|---|---|
| 데이터 정확성 | 낮음(다음 회차 계산 오차 위험, 미검증) | 높음(사용자 책임) | 높음 | 높음 | 높음(관리자가 정기적으로 입력한다는 전제하에) |
| UX 복잡도 | 낮음(사용자 개입 없음) | 높음(회차 암기 필요) | 중간(선택 UI 필요) | 높음(개념 추가) | **최저(사용자 개입 전혀 없음)** |
| 구현 난이도 | 중간(날짜 공식 검증 필요) | 낮음 | 중간(UI+검증) | 높음(신규 테이블+마이그레이션) | **낮음(기존 계획된 배치 로직에 조건 하나 추가)** |
| 기존 코드 변경량 | Phase5 수정 필요 | Phase5 불필요, UI 필요 | Phase5+UI 수정 필요 | 신규 테이블+Phase5 수정 | **Phase5 변경 0, 신규 파일(Phase6-3)에만 로직 추가** |
| 유지보수 비용 | 중간(날짜 공식 계속 검증 필요) | 낮음 | 중간 | 높음(테이블 하나 더 관리) | **낮음** |
| 향후 자동화 확장성(Phase8) | 보통 | 보통 | 보통 | 좋음 | **좋음**(회차 입력 소스가 수동→API로 바뀌어도 배치 로직은 그대로 재사용) |
| 1인 개발 적합성 | 보통 | 보통 | 낮음(UI 작업 추가) | 낮음(설계·마이그레이션 부담) | **높음** |

**결론: 채택안(배치 자동 연결)이 현재 Luck Platform의 MVP에 가장 적합하다.** 근거를 한 문장으로 요약하면 — "사용자에게 회차 개념을 전혀 노출하지 않으면서도, Phase5 저장 코드를 단 한 줄도 건드리지 않고, `EXECUTION_PLAN.md`가 이미 계획해 둔 Phase6-3 배치 로직에 조건 하나(`target_round IS NULL`)만 추가하면 완성되는 방식"이기 때문이다.

**알려진 리스크(해결하지 않고 기록만 함)**: 이 방식은 "관리자가 매 회차 결과를 정기적으로(늦어도 다음 회차 추첨 전까지) 입력한다"는 운영 규율을 전제로 한다. 만약 관리자가 여러 회차를 건너뛰고 입력하면, 그 사이에 저장된 서로 다른 회차 의도의 번호들이 전부 가장 최근 입력된 회차 하나에 묶이는 오류가 발생할 수 있다. MVP 단계(1인 개발, 관리자=개발자 본인)에서는 이 리스크가 낮다고 판단해 지금 별도 방지 로직(예: `created_at` 기준 컷오프 판단)을 설계하지 않았다 — Phase9 관리자 화면이 생기고 실제 운영 빈도가 검증되면 재검토한다(§13).

---

## 6. 상태 모델 — checked_at/win_rank/target_round Truth Table

채택안(§5)의 중요한 부수 효과: **`target_round`와 `checked_at`이 항상 같은 UPDATE에서 함께 세팅되므로, "target_round가 없다"는 상태와 "미확인" 상태가 완전히 동일해진다.** 이 덕분에 아래처럼 기존 3개 컬럼만으로 요청된 5가지 상태를 전부 표현할 수 있다.

| target_round | checked_at | win_rank | match_count | 상태 | 실제 발생 가능성 |
|---|---|---|---|---|---|
| NULL | NULL | NULL | NULL | ① 아직 당첨 확인하지 않음(=target_round 자체가 없음, ⑤와 동일 케이스) | 정상 — Phase5 저장 직후 기본 상태 |
| NOT NULL | NOT NULL | NULL | 0~2 | ② 확인했지만 낙첨 | 정상 — 배치가 매칭했지만 3개 미만 일치 |
| NOT NULL | NOT NULL | 4 또는 5 | 3 또는 4 | ③ 4~5등 당첨 | 정상 |
| NOT NULL | NOT NULL | 1, 2, 3 | 5 또는 6 | ④ 1~3등 당첨 | 정상 |
| NULL | NOT NULL | (무관) | (무관) | 논리적으로 발생 불가 | 채택안에서는 `checked_at`을 세팅하는 유일한 경로(배치 UPDATE)가 항상 `target_round`도 같이 세팅하므로 이 조합은 만들어지지 않는다. 만약 실제로 관측되면 애플리케이션 버그다 |
| NOT NULL | NULL | (무관) | (무관) | 채택안에서는 발생하지 않음 | Option C처럼 "생성 시점에 회차만 먼저 정하고 확인은 나중에" 하는 기능이 미래에 추가되면 이 조합이 의미를 가질 수 있으나, 현재 범위에서는 만들어지는 경로가 없다 |

**결론: 별도 `status` 컬럼은 필요하지 않다.** 지시문이 우려한 "① 미확인 / ② 확인 후 낙첨 / ③ 4~5등 / ④ 1~3등 / ⑤ target_round 없음"의 5가지는 사실 4가지 상태(⑤=①)이고, 이 4가지 전부 `(target_round, checked_at, win_rank, match_count)` 네 컬럼의 이미 정의된 NULL 조합만으로 애매함 없이 구분된다. 새 컬럼을 추가하는 것은 "불필요한 컬럼 추가 금지" 원칙에 반하는 과도한 설계다.

---

## 7. 당첨 데이터 저장 구조 재검토

1. **사용자가 당첨 여부를 확인하는 데 당첨금이 반드시 필요한가?** — 아니다. "몇 등인지"(`win_rank`)만으로 당첨 확인이라는 핵심 기능은 완결된다. 당첨금은 부가 표시 정보다(Phase6-1 `WinningDrawPrizeInfo` 분리와 일치).
2. **`WinRank`만 저장하고 당첨금은 별도 데이터에서 조회 가능한가?** — 가능하며, 이미 그렇게 설계돼 있다. `user_numbers.win_rank`(판정 결과)와 `draws.first_prize_amount`(그 회차의 실제 1등 금액)를 `target_round`로 조인하면 된다. 새로운 저장 구조가 필요 없다.
3. **회차별 당첨금 정보를 별도 `lotto_draws` 테이블에 저장해야 하는가?** — 아니다. 그 역할을 `draws` 테이블이 이미 하고 있다(§8).
4. **지금 `lotto_draws`를 새로 만드는 것이 과도한가?** — 과도하다. 기존 `draws`와 완전히 같은 목적의 테이블을 이름만 바꿔 하나 더 만드는 것에 불과하다.

**사용자 번호-당첨 회차 관계를 가장 단순하게 유지하는 구조**는 이미 존재한다: `user_numbers.target_round → draws.round`(FK) 하나로 충분하며, 이번 Task는 여기에 아무것도 추가하지 않기로 결정했다.

---

## 8. `lotto_draws` 테이블 필요성 판단

**불필요 — 이미 `draws` 테이블이 그 역할을 하고 있다.** 지시문이 예시로 든 컬럼과 실제 `draws` 컬럼을 대응시키면:

| 지시문 예시 (`lotto_draws`) | 실제 `draws` (0002) | 존재 여부 |
|---|---|---|
| round | round (UNIQUE NOT NULL) | 있음 |
| winning_numbers | numbers (CHECK) | 있음 |
| bonus_number | bonus_number (CHECK) | 있음 |
| draw_date | — | **없음**(BACKLOG 항목 A, 미해결로 이미 추적 중) |
| first_prize_amount | first_prize_amount | 있음 |
| first_prize_count | first_prize_count | 있음 |
| created_at | created_at | 있음 |
| updated_at | — | 없음(의도적 — append-only 기록이라 §2 주석에 명시) |

판단 기준별 확인:
- **관리자 수동 회차 입력에 필요한가?** — 이미 있는 `draws`로 충분, 신규 테이블 불필요.
- **중복 회차 입력을 방지할 수 있는가?** — `round UNIQUE NOT NULL`이 이미 강제한다(실측: migration 원문에서 직접 확인).
- **향후 외부 API 자동화(Phase8) 대응 가능한가?** — `source varchar(50) DEFAULT 'manual'` 컬럼이 이미 이 목적으로 존재한다(EXECUTION_PLAN.md도 명시).
- **RLS/service_role 구조가 자연스러운가?** — 이미 `0008`에서 "전체 공개 SELECT, service_role 전용 쓰기"로 적용 완료.
- **유지보수 비용이 낮은가?** — 테이블을 새로 만들지 않는 것이 당연히 더 낮다.

`draw_date`/2~5등 당첨금 컬럼 부재는 이미 `docs/BACKLOG.md` 항목 A로 추적 중인 별개의 미해결 사항이며, 이번 Task가 새로 발견한 문제가 아니다 — 그대로 유지하고 이번 Task에서 처리하지 않는다.

---

## 9. RLS/보안 검증 (실제 Supabase, 실측)

테스트 계정 2개(User A, User B)를 실제로 생성해(`auth.admin.createUser` + `profiles` INSERT, `email`+password 로그인 — Phase2-7(`docs/PHASE2_RLS_REAL_USER_TEST_REPORT.md`)와 동일한 검증 패턴 재사용) anon key + 각자의 JWT로 PostgREST를 직접 호출했다. 검증 종료 후 생성한 계정 2개와 `user_numbers` 행 1건을 `service_role`로 전부 삭제하고 삭제 완료를 재확인했다.

| 시나리오 | 결과 |
|---|---|
| User A 자신의 번호 INSERT | 성공(`target_round: null`로 저장됨 — §3과 동일 확인) |
| User A 자신의 번호 SELECT | 성공(자기 행만) |
| User B가 User A의 행 SELECT | `200 + []`(빈 배열, 노출 없음) |
| User B가 User A의 행 UPDATE(`memo` 변조 시도) | `200 + []`(0행 영향, 실제 변경 없음) |
| User B가 User A의 행 DELETE | `200 + []`(0행 영향, service_role로 재확인 결과 행이 그대로 존재) |
| 비로그인(anon)이 `user_numbers` SELECT | `200 + []`(전체 차단) |
| 비로그인(anon)이 `user_numbers` INSERT | `403`("new row violates row-level security policy") |
| 비로그인(anon)이 `draws` SELECT | 성공(전체 공개 데이터 정상 조회) |
| 비로그인(anon)이 `draws` INSERT | `403`("new row violates row-level security policy") |

**결과: User A/B/비로그인 모두 지시문이 요구한 격리 조건을 그대로 만족한다.** `0008_rls_policies.sql`은 Phase2-7 검증 이후 변경되지 않았고(migration 목록에 새 항목 없음, git 이력에도 수정 없음), 이번 실측이 그 결과를 재확인했다.

### 발견된 문제 — 당첨 데이터 위조 가능성

`user_numbers_update_own` 정책은 "본인 소유 행"만 검사할 뿐 **컬럼 단위 제한이 없다.** 실측 결과, User A가 자신의 행에 대해 앱을 거치지 않고 PostgREST를 직접 호출해 `match_count: 6, win_rank: 1, checked_at: now()`를 임의로 써넣는 UPDATE가 **그대로 성공했다**(`0008_rls_policies.sql`의 `user_numbers_update_own`이 행 소유권만 확인하고 어떤 컬럼이 바뀌는지는 확인하지 않기 때문 — `notifications_update_own`이 이미 동일한 구조적 한계를 갖고 있다고 `0008` 자체 주석·`docs/BACKLOG.md`에 기록된 것과 같은 종류의 문제다).

**지금 고치지 않기로 판단한 근거**:
1. 이 값은 서버가 신뢰의 근거로 쓰는 게 아니라 사용자 개인 다이어리 화면에 표시되는 자기참조 데이터일 뿐이다. 실제 상금은 오프라인 로또 판매점에서 수령하므로, 앱 내 위조가 실질적 금전적 이득으로 이어지지 않는다.
2. 위조해도 본인 화면에만 가짜 당첨 표시가 나타날 뿐, 관리자 배치(§4~§6, service_role로 동작)나 다른 사용자에게는 영향이 없다.
3. 그러나 향후 "당첨 인증 공유"(Phase 이후 커뮤니티/공유 기능)가 이 값을 그대로 노출하게 되면 "위조 가능한 당첨 인증"이라는 신뢰성 문제로 번질 수 있다 — **Phase7 이후 공유 기능을 설계할 때 재검토가 필요하다는 점을 명시적으로 남긴다**(§13). 해결 방향 후보(지금 구현하지 않음): 공유 시점에 서버가 `matchNumbers()`로 재검증한 뒤 카드에 새겨 넣고, 클라이언트가 보낸 `win_rank`/`match_count` 값을 신뢰하지 않는 방식.

### service_role 필요 시점

- **지금(Phase6-2)**: 필요 없다. 실제로 이번 Task는 코드에 `service_role`을 전혀 추가하지 않았다(§9의 검증 스크립트는 검증 전용 1회성 파일로 실행 후 삭제했다).
- **Phase6-3부터 필요**: (1) `draws` INSERT(회차 결과 입력 — `draws`는 client 쓰기 정책이 아예 없으므로 service_role 필수), (2) 여러 사용자의 `user_numbers`를 한 번에 UPDATE하는 배치 대조 로직(§4~§6 채택안 — 본인 소유가 아닌 다른 사용자들의 행까지 한 요청에서 갱신해야 하므로 RLS를 우회하는 service_role이 필요하다. `DATABASE_SCHEMA.md` §6 "관리자 정책 공통 원칙"이 이미 이 예외를 문서화해 두었다).

---

## 10. Phase6 데이터 흐름 설계 (§5 채택안 반영)

```text
[사용자] 번호 생성 (lib/logic/generateNumbers, 순수 함수, 클라이언트)
   ↓
[사용자] POST /api/numbers → saveUserNumbers()
   생성 데이터: user_numbers 행 1건
   저장 테이블: user_numbers (target_round=NULL, match_count=NULL, win_rank=NULL, checked_at=NULL)
   실행 주체: 인증된 사용자 세션(authenticated 클라이언트)
   RLS: user_numbers_insert_own (auth.uid() = user_id) 적용
   service_role: 불필요
   ※ 이번 Task와 무관 — Phase5 코드 그대로, 변경 없음
   ↓
   (시간 경과 — 사용자는 여러 회차분 번호를 계속 생성/저장할 수 있음)
   ↓
[관리자] 회차 결과 입력 (Phase6-3 신규: app/api/admin/draws/route.ts POST)
   생성 데이터: draws 행 1건 (round, numbers, bonus_number, first_prize_amount, first_prize_count)
   저장 테이블: draws
   실행 주체: 관리자(Phase9 이전에는 임시 보호 방식, §13 남은 Decision)
   RLS: draws는 client 쓰기 정책이 없음 → service_role 필수
   ↓
[배치] 같은 요청 안에서 동기 실행 (Phase6-3 신규 로직)
   조회 대상: user_numbers WHERE target_round IS NULL AND checked_at IS NULL AND user_id IS NOT NULL
   (비회원 user_id NULL 행은 EXECUTION_PLAN.md §456 원칙에 따라 대조 제외)
   ↓
[순수 함수] matchNumbers(row.numbers, draw.numbers, draw.bonus_number)  (Phase6-1, 이미 구현 완료)
   입력: 사용자 번호, 당첨 번호, 보너스 번호
   출력: { matchCount, bonusMatched, winRank }
   부작용 없음 — DB/네트워크 접근 없음
   ↓
[배치] UPDATE user_numbers
   SET target_round = <입력된 회차>, match_count = matchCount, win_rank = winRank, checked_at = now()
   WHERE id = <해당 행>
   실행 주체: service_role (여러 사용자의 행을 한 요청에서 갱신하므로 RLS 우회 필요)
   ↓
[사용자] 다이어리에서 결과 확인 (Phase6-3 이후: app/(journal)/my/journal/results/page.tsx)
   조회: user_numbers SELECT (본인 행, RLS 그대로 적용, service_role 불필요)
```

---

## 11. Migration 필요 여부

**불필요.** §2~§8의 조사 결과, 현재 스키마(`user_numbers.target_round`/`match_count`/`win_rank`/`checked_at`, `draws` 전체 컬럼)만으로 §5 채택안과 §6 상태 모델을 그대로 구현할 수 있다. `draw_date`/2~5등 당첨금 컬럼은 이미 `docs/BACKLOG.md` 항목 A로 추적 중인 별개 사안이며 이번 Task 범위에서 새로 결정하지 않는다.

---

## 12. Phase6-3에서 구현할 정확한 범위

`EXECUTION_PLAN.md` Phase6이 이미 계획한 파일 목록에서, 이번 Task의 결정사항(§5 채택안)을 반영해 정확한 작업 내용만 다시 정리한다(실제 구현은 이번 Task에서 하지 않음):

1. `app/api/admin/draws/route.ts` (신규, POST):
   - 요청 검증 후 `draws`에 회차 결과 INSERT (`service_role`, round UNIQUE로 중복 회차 자동 차단).
   - 같은 요청 안에서 `user_numbers WHERE target_round IS NULL AND checked_at IS NULL AND user_id IS NOT NULL` 전수 조회.
   - 각 행에 대해 `matchNumbers()`(Phase6-1, 이미 존재, 수정 불필요) 호출.
   - `target_round`/`match_count`/`win_rank`/`checked_at`을 한 번에 UPDATE(`service_role`).
2. `proxy.ts` 수정: `/api/admin/*` 임시 보호(Phase9 이전 관리자 인증 방식 확정 필요, §13).
3. `lib/api/notifications.ts`(신규): 당첨자에게 `notifications` INSERT — 이번 결정과 직접 관련 없는 후속 단계.
4. `app/(journal)/my/journal/results/page.tsx` 실데이터 연결, `lib/api/journal.ts` 결과 조회 완성.
5. `components/journal/WinResultBanner.tsx`(신규): 당첨 축하 UI.

이번 Task(6-2)는 위 목록의 "무엇을, 언제, 어떤 조건으로" UPDATE할지(§5/§6/§10)만 확정했고, 실제 코드는 전혀 작성하지 않았다.

---

## 13. Phase5 수정 필요 여부

**불필요.** §5 채택안이 "Phase5 저장 코드를 전혀 건드리지 않는 것"을 핵심 장점으로 삼도록 설계했다. `saveUserNumbers()`가 `target_round`를 세팅하지 않는 현재 동작은 **버그가 아니라 채택안이 요구하는 정확한 동작**이었음이 이번 Task를 통해 확인됐다.

---

## 14. 남은 Decision (Phase6-3 착수 전 또는 착수 중 확정 필요)

1. **관리자 인증 방식**: `admins` 테이블이 Phase9에야 생성되므로, Phase6-3~8 동안 `/api/admin/draws`를 어떤 방식으로 임시 보호할지(예: 환경변수 기반 secret 헤더, IP 제한 등) 결정 필요. `EXECUTION_PLAN.md`도 "임시 보호"라고만 언급하고 구체 방식은 확정하지 않았다.
2. **배치 지연 시 리스크**(§5 "알려진 리스크"): 관리자가 여러 회차를 건너뛰고 입력할 경우의 정책. 지금은 운영 규율(정기 입력)로 대응하기로 하고 별도 로직을 만들지 않았다 — 실제 운영 빈도가 확인되면 재검토.
3. **당첨 데이터 위조 가능성**(§9): 개인 다이어리 용도로는 지금 당장 문제 없다고 판단했으나, Phase7 이후 공유/커뮤니티 기능 설계 시 서버 재검증 방식 도입 여부를 재검토해야 한다.
4. **`draw_date`/2~5등 당첨금 컬럼**: `docs/BACKLOG.md` 항목 A와 동일 사안, 실제 공식 데이터 import 시점(Phase10 전후)에 재검토.

---

## 15. 최종 READY 판정

**Ready — Phase6-3(관리자 회차 입력 API + 대조 배치) 착수 가능.**

근거: (1) 현재 스키마(`user_numbers`/`draws`)가 §5 채택안과 §6 상태 모델을 추가 Migration 없이 그대로 지원함을 실제 migration 원문과 실측 INSERT/SELECT로 확인했다. (2) `target_round` 연결 전략을 하나로 확정했고(§5), 그 전략이 Phase5 코드를 전혀 건드리지 않아도 됨을 확인했다(§13). (3) RLS가 User A/B/비로그인 격리 조건을 실제로 만족함을 실측했다(§9). (4) `matchNumbers()`(Phase6-1)를 그대로 재사용하는 것 외에 추가로 필요한 순수 로직이 없다. 남은 것은 §14의 4개 Decision(주로 관리자 인증 방식)뿐이며, 이는 Phase6-3 구현 중 또는 착수 직전에 확정해도 무방한 수준이다.

---

## 16. 검증 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 (코드 변경 없음 — Phase6-1 상태 그대로) |
| `npm run type-check` | 통과 |
| `npm test` | 통과 — 8 test files, 87 tests(변경 없음, 이번 Task는 코드를 추가/수정하지 않음) |
| `npm run build` | 통과 |
| `git status` | 이번 Task로 인해 새로 생긴 파일은 `docs/PHASE6_DATA_ARCHITECTURE_DECISION.md` 1개뿐. 검증용 임시 스크립트 2개는 실행 후 삭제해 흔적 없음. `app/*`, `components/*`, `lib/api/numbers.ts`, `lib/api/journal.ts`, `proxy.ts`, Migration 파일 모두 미변경 |
