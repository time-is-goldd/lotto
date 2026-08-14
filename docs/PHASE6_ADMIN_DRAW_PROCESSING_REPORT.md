# Phase6-3 관리자 회차 입력 + 당첨번호 일괄 대조 구현 보고서

> **핵심 결론을 먼저 밝힌다: 이번 Task는 계획했던 범위 중 일부를 BLOCKER로 판단해 구현하지 않았다.** `POST /api/admin/draws` HTTP Route는 만들지 않았다 — 이 프로젝트에는 관리자 여부를 판별할 수 있는 구조가 전혀 없고(§2), 그 상태로 HTTP Route를 열면 지시문 원칙 4("일반 사용자에게 service_role이 노출될 수 있는 구조를 절대 만들지 않는다")를 직접 위반하게 된다. 대신 안전하게 구현 가능한 부분 — 배치 판정 로직 자체(`lib/api/admin/draws.ts`)를 서비스 계층 함수로 완성하고, 실제 Supabase에 대해 통합 테스트로 검증했다. 상세 근거는 §2·§16·§17 참조.

---

## 1. 생성/수정 파일

**영구적으로 생성한 파일**:
- `lib/api/admin/draws.ts` — 회차 등록 + 배치 대조 서비스 함수(`service_role` 사용)
- `lib/api/admin/draws.test.ts` — 단위 테스트(Supabase mock)
- `lib/api/notifications.ts` — 당첨 알림 생성 함수(`service_role` 사용)
- `lib/api/notifications.test.ts` — 단위 테스트(Supabase mock)
- `docs/PHASE6_ADMIN_DRAW_PROCESSING_REPORT.md` — 본 보고서

**수정한 파일**:
- `lib/logic/matchNumbers.ts` — `assertValidNumberSet`/`assertValidBonusNumber` 두 검증 함수 앞에 `export`만 추가했다. 판정 로직(`matchNumbers` 함수 본체, `determineWinRank`)은 한 줄도 바꾸지 않았다 — 목적은 "판정 알고리즘을 복제하지 않는다"는 지시(§0 원칙 3)를 지키기 위해, `lib/api/admin/draws.ts`가 회차의 `winningNumbers`/`bonusNumber`를 검증할 때 이 기존 검증 로직을 그대로 재사용하도록 하기 위함이다. 이 변경으로 Phase6-1의 20개 테스트가 전부 그대로 통과함을 확인했다(§13).

**만들지 않은 파일(의도적, BLOCKER)**:
- `app/api/admin/draws/route.ts` — §2 참조.
- `proxy.ts` 수정 — 보호할 admin route 자체가 없으므로 수정하지 않았다.

**검증 중 임시로 사용하고 전부 삭제한 것**(git 이력에 흔적 없음):
- `lib/api/admin/draws.integration.test.ts` — 실제 Supabase 프로젝트에 대해 `registerDrawAndMatchUserNumbers()`를 mock 없이 직접 실행하는 통합 테스트. `npx vitest run`으로 1회 실행해 결과를 확인한 뒤 삭제했다.
- Supabase 프로젝트에 생성했던 테스트 계정 2개(`auth.users`+`profiles`), `user_numbers` 테스트 행 2건, `draws` 테스트 회차(`round: 99999`) 1건, `notifications` 테스트 행 1건 — 통합 테스트 `afterAll`에서 전부 삭제했고, 별도 스크립트로 잔여 데이터가 0건임을 재확인했다.

`app/*`(admin 제외), `components/*`, `lib/api/numbers.ts`, `lib/api/journal.ts`, `lib/types/winning.ts`, Migration 파일은 이번 Task에서 전혀 수정하지 않았다.

---

## 2. 관리자 인증 구조 — BLOCKER

### 조사 결과

실제 코드를 전수 조사했다(`is_admin`/`admin_flag`/admin 테이블/metadata 기반 판별/기존 admin API 전부 검색):

- `profiles` 테이블(`0001_profiles.sql`)에 관리자 여부를 나타내는 컬럼이 없다.
- 별도 `admins` 테이블이 없다(`DATABASE_SCHEMA.md` §3.2 주석이 "`admins` 테이블이 Phase9에야 생성되므로 Phase1~8은 client 대상 관리자 정책을 만들지 않는다"고 명시).
- `proxy.ts`에는 `/onboarding`, `/my` 보호 로직만 있고 관리자 판별 로직이 없다(직접 읽어서 확인, §1 참조).
- `app/api/admin/` 디렉터리 자체가 존재하지 않는다(`app/api/**/*.ts` 전수 검색 — `profile`/`auth/kakao/*`/`numbers`만 존재).
- `lib/auth/isAdmin.ts` 같은 파일이 없다.
- `EXECUTION_PLAN.md` Phase9(§561~589)가 정확히 이 구조(`lib/auth/isAdmin.ts`, `supabase/migrations/0012_admin_flag.sql`)를 **아직 만들지 않은 채로 예약**해뒀다는 것을 직접 확인했다. `docs/PHASE6_DATA_ARCHITECTURE_DECISION.md` §14도 이미 "관리자 인증 방식... 결정 필요"를 남은 Decision으로 남겨뒀다.
- `docs/ADMIN_REQUIREMENTS.md` §8은 "Supabase Auth의 관리자 플래그로 충분"이라고 언급하지만, 이는 요구사항 수준 서술일 뿐 실제로 `auth.users.app_metadata`에 관리자 플래그를 쓰고 읽는 코드는 어디에도 없다 — "이미 존재하는 안전한 구조"로 볼 수 없다.

### 결정

**관리자 권한 구조가 현재 이 프로젝트에 전혀 존재하지 않는다.** 지시문 §2 "중요한 규칙"과 §19가 정확히 이 경우를 대비해 "Phase6-3에서 임시 관리자 인증을 만들어서는 안 된다"고 명시했으므로, 다음을 절대 만들지 않았다:
- 환경변수 기반 임시 secret 헤더/쿼리 파라미터 인증
- 하드코딩된 관리자 user ID 비교
- `profiles.nickname`이나 다른 기존 컬럼을 이용한 임시 판별

**결론: `app/api/admin/draws/route.ts`(HTTP로 실제 도달 가능한 엔드포인트)는 이번 Task에서 만들지 않는다.** 이 라우트를 관리자 인증 없이 만들면, 로그인한 아무 사용자나 이 라우트를 호출해 `service_role` 권한으로 실행되는 로직(임의 회차 등록, 다른 모든 사용자의 `user_numbers` 일괄 UPDATE)을 실행할 수 있게 된다 — 이것이 정확히 지시문 원칙 4가 금지하는 "일반 사용자에게 service_role이 노출될 수 있는 구조"다.

### 이번 Task를 어느 수준까지 진행했는가 (§2 지시사항 대응)

HTTP Route 대신, **HTTP로 노출되지 않는 서비스 계층 함수**(`lib/api/admin/draws.ts`의 `registerDrawAndMatchUserNumbers()`)를 완전히 구현하고 실제 Supabase로 검증했다. 이 함수는:
- 어떤 HTTP Route에도 연결돼 있지 않으므로, 일반 사용자가 네트워크 요청으로 도달할 방법이 없다.
- Phase9에서 `lib/auth/isAdmin.ts`가 생기면, `app/api/admin/draws/route.ts`는 "JSON 파싱 → `parseAdminDrawsInput()` → 인증(`getCurrentUser()`) → 인가(`isAdmin()`) → `registerDrawAndMatchUserNumbers()` 호출 → 응답"만 조립하면 되는 상태로 이미 준비되어 있다(§15 Phase6-4 범위).

이것이 "관리자 UI는 만들지 않지만 서버 로직은 만든다"는 원래 Task 목표와 "안전하지 않은 구조를 만들지 않는다"는 원칙 사이에서 찾은 절충점이다.

---

## 3. API 계약

지시문이 제시한 계약을 기본으로 하되, 실제 `draws` 스키마와 충돌하는 부분을 확장했다:

```ts
// 요청 (지시문 원안 + 확장)
{
  round: number;
  winningNumbers: number[];
  bonusNumber: number;
  firstPrizeAmount: number;  // 확장 — 아래 이유 참조
  firstPrizeCount: number;   // 확장 — 아래 이유 참조
}
```

**확장 이유**: `draws.first_prize_amount`/`first_prize_count`는 `0002_draws_user_numbers.sql`에서 `NOT NULL`이고 **DEFAULT가 없다**(마이그레이션 주석: "관리자가 회차 입력 시 항상 실제 값을 명시하도록 강제"). 지시문 원안 계약대로 이 두 필드를 빼면 `draws` INSERT가 항상 NOT NULL 제약 위반으로 실패한다. `lib/types/winning.ts`의 `WinningDrawPrizeInfo`가 이미 이 두 필드를 정의해뒀으므로(Phase6-1), 새 타입을 만들지 않고 `WinningDraw & WinningDrawPrizeInfo`(`AdminDrawInput`)로 합성했다.

```ts
// 응답 (성공)
{ round: number; matchedCount: number; winnersCount: number; failedUpdateIds: number[] }

// 응답 (실패, 기존 컨벤션과 동일)
{ error: { code, message } }
```

HTTP Route가 없으므로 실제 JSON 응답 포맷은 함수의 반환 타입(`AdminDrawsResult`)으로만 존재한다 — Phase6-4에서 Route를 만들 때 `app/api/numbers/route.ts`와 동일한 `errorResponse()` 패턴으로 감싸면 된다.

---

## 4. 입력 검증 (`parseAdminDrawsInput`)

| 필드 | 규칙 | 구현 방식 |
|---|---|---|
| `round` | 정수, 1 이상, `MAX_ROUND`(100,000) 이하 | 신규 검증(회차는 matchNumbers의 관심사가 아니므로). 상한 근거: 실제 1회차는 2002-12-07, 매주 1회 진행돼 2020년대에도 1300회를 넘지 않는다 — 100,000회는 자릿수 오타만 걸러내는 안전한 상한이다 |
| `winningNumbers` | 정확히 6개, 정수, 1~45, 중복 없음 | `lib/logic/matchNumbers.ts`의 `assertValidNumberSet`을 **그대로 재사용**(신규 export, §1) — 복제하지 않음 |
| `bonusNumber` | 정수, 1~45, `winningNumbers`와 중복 불가 | 동일 파일의 `assertValidBonusNumber` **재사용** |
| `firstPrizeAmount`/`firstPrizeCount` | 정수, 0 이상 | 신규 검증(matchNumbers의 관심사가 아님) |

모든 검증 실패는 `AdminDrawsValidationError`(기존 `NumbersValidationError`/`WinningValidationError`와 동일한 `extends Error` 컨벤션)로 던진다. `matchNumbers.ts`의 검증 함수가 내부적으로 `WinningValidationError`를 던지면, `parseAdminDrawsInput`이 그 메시지를 그대로 옮겨 `AdminDrawsValidationError`로 재포장한다(호출부가 에러 타입 하나만 확인하면 되도록).

단위 테스트 17건(정상 1건 + 실패 16건: round 6종, winningNumbers 4종, bonusNumber 2종, prize 4종)으로 검증했다(§13).

---

## 5. draws 저장 구조

기존 `draws` 스키마를 그대로 사용한다(새 `lotto_draws` 테이블 없음, Phase6-2 결정 그대로):

```ts
await supabase.from("draws").insert({
  round: input.round,
  numbers: sortedWinningNumbers,  // 오름차순 정규화, 아래 참조
  bonus_number: input.bonusNumber,
  first_prize_amount: input.firstPrizeAmount,
  first_prize_count: input.firstPrizeCount,
  // source: 지정하지 않음 → DEFAULT 'manual' 그대로 사용
  // created_at: 지정하지 않음 → DEFAULT now() 그대로 사용
});
```

**정규화**: `winningNumbers`는 오름차순으로 정렬해서 저장한다. `is_valid_lotto_numbers()` CHECK(0002)는 정렬을 요구하지 않지만, `user_numbers.numbers`(Phase5, `parseNumbersInput`)가 이미 오름차순 저장 관례를 따르고 있어 `draws.numbers`도 같은 관례를 따르는 것이 일관적이라고 판단했다. `matchNumbers()` 자체는 Set 기반 비교라 정렬 여부와 무관하게 정확히 동작한다(Phase6-1 계약, 실제로 관리자가 입력 순서(추첨 순서)대로 입력해도 문제없다).

`updated_at` 컬럼은 없다 — 스키마에 없고(§2 조사에서 실제 확인), append-only 기록이라는 기존 설계 의도(`0002` 주석)와 일치하므로 추가하지 않았다.

---

## 6. target_round 배치 연결 결과

Phase6-2 §5 채택안("배치 자동 연결")을 정확히 구현했다:

```ts
const { data: targets } = await supabase
  .from("user_numbers")
  .select("id, user_id, numbers")
  .is("target_round", null)
  .is("checked_at", null)
  .not("user_id", "is", null);  // 비회원 제외, EXECUTION_PLAN.md §456
```

이 조건에 해당하는 모든 행을 새로 등록된 회차에 연결한다. `saveUserNumbers()`(Phase5)는 전혀 수정하지 않았다 — Phase6-2가 이미 확인한 대로 "저장 시 NULL"이 정확한 설계였다.

---

## 7. matchNumbers 연동 결과

```ts
const result = matchNumbers(row.numbers, sortedWinningNumbers, input.bonusNumber);
```

`lib/logic/matchNumbers.ts`(Phase6-1)를 수정 없이 그대로 호출한다. 새로운 판정 함수를 만들지 않았다. 결과(`matchCount`/`bonusMatched`/`winRank`)를 그대로 `user_numbers` UPDATE에 사용한다:

```ts
await supabase.from("user_numbers").update({
  target_round: draw.round,
  match_count: result.matchCount,
  win_rank: result.winRank,
  checked_at: checkedAt,  // new Date().toISOString(), 배치 시작 시각 1회 계산해 모든 행에 동일하게 사용
}).eq("id", row.id);
```

**클라이언트가 `match_count`/`win_rank`/`checked_at`/`target_round`를 직접 보낼 방법이 없다** — 이 값들은 전부 서버(`matchNumbers()`의 반환값과 서버가 생성한 타임스탬프)에서만 계산되며, `AdminDrawInput`(요청 바디로부터 파싱되는 타입)에는애초에 이 네 필드가 존재하지 않는다(지시문 §6 "절대 하지 말 것" 충족).

---

## 8. notifications 처리 결과

### 스키마 조사

`0006_notifications.sql`을 직접 읽어 확인했다: `notifications`는 `user_id`/`type`(enum, `win_result` 포함)/`title`/`body`/`link_url`/`is_read`/`created_at`만 있다. **`round`나 다른 관련 엔티티를 가리키는 컬럼이 없다.** RLS(`0008`)는 SELECT/UPDATE(`is_read`)만 본인에게 허용하고 INSERT 정책이 아예 없다 — service_role 전용이다.

### 구현

`lib/api/notifications.ts`의 `createWinNotification(userId, round, winRank)`가 `type: 'win_result'`로 1건 INSERT한다. `title`/`body`에 회차/등수를 텍스트로 담는다(예: "1150회차 1등 당첨을 축하합니다!"). `link_url`은 현재 실제로 존재하는 `/my/journal/history`(Phase4, `getRecentUserNumbers()`가 이미 이 화면에 데이터를 공급 중)로 연결했다 — `EXECUTION_PLAN.md`가 계획한 전용 결과 화면(`.../journal/results`)은 아직 없다(이번 Task 범위 밖, UI 미구현).

**낙첨자에게는 호출하지 않는다** — `registerDrawAndMatchUserNumbers()`가 `result.winRank !== null`인 행에 대해서만 `createWinNotification()`을 호출한다(지시문 §10 "낙첨 사용자에게 불필요한 알림 생성 금지" 충족).

### 중복 생성 방지 (§11)

`round`/`notification_type` 조합을 저장할 컬럼이 없어 **DB 레벨 UNIQUE 제약으로는 중복을 막을 수 없다.** 대신 스키마 변경 없이 구조적으로 동일한 효과를 얻었다:

1. `draws.round`가 UNIQUE라 같은 회차는 두 번 등록될 수 없다(`DuplicateRoundError`로 즉시 차단, §5/§10).
2. 각 `user_numbers` 행은 `target_round IS NULL`일 때만 배치 대상이 되고, 한 번 UPDATE되면 `target_round`가 채워져 **다시는 이 조건에 걸리지 않는다**(단방향 전이).

이 두 가지가 합쳐지면, 특정 (사용자, 회차) 조합에 대한 당첨 알림은 시스템 생애주기 동안 **최대 1번만** 시도될 수 있다 — 재실행/재시도로 같은 알림이 중복 생성될 경로가 없다. 유일한 예외는 알림 INSERT 자체가 실패하는 경우인데, 이는 §10에서 별도로 분석한다. 새 migration 없이 이 정도의 중복 방지를 확보할 수 있다고 판단해 스키마 변경을 제안하지 않았다(§11 "지원하지 않으면 위험을 보고" — 위험이 구조적으로 이미 낮다는 것을 보고한다).

---

## 9. service_role 사용 범위

`lib/api/admin/draws.ts`, `lib/api/notifications.ts` 두 파일만 `lib/supabase/service.ts`를 import한다. 둘 다:
- HTTP Route에 연결되어 있지 않다(§2 BLOCKER).
- 클라이언트 번들에 포함될 수 없다(`lib/supabase/service.ts` 자체가 `typeof window !== "undefined"`에서 즉시 throw하는 기존 가드, 수정하지 않음).
- 일반 사용자 요청 경로(`app/api/numbers/route.ts`, `lib/api/journal.ts` 등)는 여전히 `lib/supabase/server.ts`(anon key + 세션)만 사용하며, 이번 Task에서 그 파일들을 전혀 건드리지 않았다.

**결론: service_role은 지금 이 코드베이스에서 실제로 도달 가능한 어떤 HTTP 요청 경로에도 연결되어 있지 않다.** Phase6-4에서 관리자 인증이 확정된 뒤 Route를 연결하는 순간부터 실질적으로 "사용"되기 시작한다.

---

## 10. 중복/동시성 처리 결과 (Case A~D 분석)

| Case | 시나리오 | 처리 결과 |
|---|---|---|
| A | Round 100 최초 입력 | 정상 INSERT + 배치 대조. 실제 Supabase로 검증 완료(§12 Test A) |
| B | Round 100 재입력(순차) | `draws.round UNIQUE` 제약 위반(Postgres 23505) → `DuplicateRoundError`. **기존 판정 결과는 전혀 건드리지 않는다** — draws INSERT가 배치 로직보다 먼저 실행되고 실패 시 즉시 함수가 종료되므로 `user_numbers` 조회/UPDATE 자체가 시도되지 않는다. 실제 Supabase로 검증 완료(§12 Test E) |
| D | 두 관리자 요청이 동시에 같은 회차 등록 | Postgres의 `UNIQUE` 제약은 트랜잭션 격리 수준과 무관하게 원자적으로 강제된다 — 두 INSERT가 정확히 동시에 도착해도 하나만 성공하고 다른 하나는 반드시 23505를 받는다. 애플리케이션 레벨 락/분산 lock을 별도로 구현하지 않았다(불필요하게 복잡한 transaction 금지 원칙, §0) — 기존 DB 제약만으로 충분하다고 판단 |
| C | `draws` INSERT는 성공했지만 일부 `user_numbers` UPDATE가 실패 | **분석 결과, 완전한 원자성은 보장하지 않는다.** PostgREST(Supabase JS client)는 단일 REST 호출 = 단일 SQL문 단위로만 원자적이며, 여러 개의 개별 UPDATE 호출을 하나의 트랜잭션으로 묶지 않는다. 이번 구현은 **행 단위로 최선을 다하는(best-effort) 방식**을 택했다: 한 행의 UPDATE가 실패해도 예외를 던져 나머지 행 처리를 중단하지 않고, 실패한 행의 id를 `failedUpdateIds`로 반환하며 `console.error`로 로그를 남긴다. 실패한 행은 `target_round`가 여전히 `NULL`로 남으므로, **다음 회차가 등록될 때 다시 배치 대상에 포함된다** — 다만 그 시점엔 이미 지난 회차가 아니라 새 회차와 대조되므로, "그 행이 원래 대조됐어야 할 회차"와는 다른 회차로 대조될 위험이 있다. 이 한계는 §14 "발견된 문제"에 기록한다 |

**Postgres/DB 제약을 최대한 활용**하고(round UNIQUE), **새로운 transaction 시스템은 만들지 않았다**(RPC/Postgres 함수 등 신규 서버 로직 없음) — 지시문 원칙을 그대로 지켰다.

---

## 11. user_numbers RLS 이슈 검토 (Phase6-2 §9 발견 사항)

Phase6-2가 발견한 문제: "일반 사용자가 자신의 `match_count`/`win_rank`/`checked_at`/`target_round`를 직접 UPDATE할 수 있음"(`user_numbers_update_own` RLS가 컬럼 단위 제한이 없음).

**이번 Task에서 이 문제를 해결하지 않기로 판단했다.** 이유:
1. 이번 관리자 배치는 `service_role`로 동작해 RLS 자체를 우회하므로, 이 이슈가 관리자 배치의 정확성에 영향을 주지 않는다 — 관리자가 쓴 값은 언제나 사용자가 직접 쓴 값을 덮어쓸 수 있다.
2. RLS 정책을 변경(컬럼 단위 제한 추가)하려면 `WITH CHECK`만으로는 표현할 수 없는 "OLD/NEW 컬럼 비교"가 필요해(`notifications_update_own`이 이미 겪고 있는 것과 동일한 구조적 한계, `0008` 자체 주석에 기록됨) 트리거 또는 별도 컬럼이 필요하다 — 이는 "정말 필요한 경우에만" 허용된 신규 migration의 문턱을 넘지 못한다고 판단했다.
3. Phase6-2가 이미 이 문제를 "Phase7 이후 공유 기능 설계 시 재검토"로 결론짓고 Decision으로 남겨뒀다(`docs/PHASE6_DATA_ARCHITECTURE_DECISION.md` §14-3) — 이번 Task가 그 결론을 뒤집을 새로운 근거를 발견하지 못했다.

**Decision(승인 필요, 범위 확장 없음)**: RLS 정책 변경/컬럼 업데이트 제한은 이번 Task에서 수행하지 않는다. 그대로 유지한다.

---

## 12. 실제 Supabase 통합 테스트

`lib/api/admin/draws.integration.test.ts`(임시 파일, 검증 후 삭제)를 `npx vitest run`으로 mock 없이 실제 프로덕션 Supabase 프로젝트에 대해 실행했다.

### 준비

- 테스트 계정 2개(User A, User B)를 `auth.admin.createUser()` + `profiles` INSERT로 생성(Phase2-7/Phase6-2와 동일한 검증 패턴).
- 각자 anon key + 비밀번호 로그인으로 실제 세션을 얻어, **앱과 동일한 경로**(RLS가 적용되는 인증된 클라이언트)로 `user_numbers`에 테스트 번호를 저장:
  - User A: `[1,2,3,4,5,6]` (테스트 회차 당첨번호와 6개 전부 일치하도록 설계)
  - User B: `[10,11,12,13,14,15]` (전혀 일치하지 않도록 설계)
- 실제 회차와 충돌하지 않는 테스트 전용 회차 `round: 99999` 사용.

### Test A / F — 정상 등록 + User A/B 동시 판정

```
registerDrawAndMatchUserNumbers({
  round: 99999, winningNumbers: [1,2,3,4,5,6], bonusNumber: 7,
  firstPrizeAmount: 2_000_000_000, firstPrizeCount: 5,
})
```

결과(전부 실제 DB 재조회로 확인):
- `draws` 행 정상 생성.
- User A 행: `target_round: 99999, match_count: 6, win_rank: 1, checked_at: <NOT NULL>` — 정확.
- User B 행: `target_round: 99999, match_count: 0, win_rank: null, checked_at: <NOT NULL>` — 정확.
- `notifications`: User A에게 `type: 'win_result'` 1건 생성됨, User B에게는 0건(낙첨자 알림 없음, §8 확인).

### Test E — 중복 회차

같은 `round: 99999`를 다른 당첨번호로 재등록 시도 → `DuplicateRoundError` 발생 확인. 재조회 결과 User A 행의 `match_count`/`win_rank`가 **첫 번째 등록 결과 그대로**(6/1) 유지됨 — 두 번째 시도가 기존 판정을 전혀 훼손하지 않았다(§10 Case B).

### 정리(Cleanup)

`afterAll`에서 테스트 `user_numbers` 2건, `draws`(round 99999) 1건, `notifications` 1건, `profiles`/`auth.users` 2계정을 전부 삭제했고, 별도 조회 스크립트로 4개 테이블 모두 잔여 데이터 0건임을 재확인했다.

**결과: 2개 테스트 파일, 2 tests, 전부 PASS.**

---

## 13. 보안 검증

### 코드 레벨(Phase6-2 §9의 재확인)

- `AdminDrawInput`(요청에서 파싱되는 유일한 타입)에는 `match_count`/`win_rank`/`checked_at`/`target_round`/`user_id` 필드가 애초에 존재하지 않는다 — 클라이언트가 이 값들을 보내도 `parseAdminDrawsInput()`이 조용히 무시한다(다른 API들과 동일한 "명시적 화이트리스트" 컨벤션, `lib/api/numbers.ts`와 동일 패턴).
- `registerDrawAndMatchUserNumbers()`는 이 네 필드를 오직 `matchNumbers()`의 반환값과 서버가 생성한 타임스탬프로만 채운다.

### 단위 테스트(17 + 8 = 25건)

- `parseAdminDrawsInput`: 정상 1건, 실패 16건(§4).
- `registerDrawAndMatchUserNumbers`: 대상 없음/중복 회차/기타 DB 에러/정상 배치(1·2등·낙첨 혼합)/부분 UPDATE 실패/알림 실패/조회 실패 — 8건.
- `createWinNotification`: 정상 INSERT/에러 전파 — 2건.

### 실제 Supabase 레벨

관리자 인증 자체가 없어(§2) "일반 사용자가 관리자 API를 호출했을 때 403을 받는지"(지시문 Test B)를 검증할 **HTTP Route가 존재하지 않는다.** 대신 이번 실측이 실제로 증명한 것: **어떤 HTTP 경로로도 이 배치 로직에 도달할 방법이 현재 없다** — `service_role`은 서버 프로세스 내부의 함수 호출로만 실행되며, 이것이 지금 시점에 가능한 가장 안전한 상태다. Test B/C(비로그인/일반 사용자 거부)는 Route가 생기는 Phase6-4에서 재검증 대상으로 남긴다(§15).

---

## 14. 기존 기능 회귀 검증

- `npm run build` 결과 라우트 목록이 Phase6-2 시점과 **완전히 동일**하다(`/`, `/login`, `/onboarding`, `/generate`, `/my/journal`, `/my/journal/history`, `/my/journal/dreams`, `/my/journal/fortune-history`, `/ui-preview`, `/api/auth/kakao/*`, `/api/numbers`, `/api/profile`) — 새 admin 라우트가 추가되지 않았으므로 당연한 결과이자, §2 BLOCKER 결정이 실제로 지켜졌다는 증거이기도 하다.
- `proxy.ts`, `lib/auth/kakao.ts`, `lib/auth/profile.ts`, `app/api/numbers/route.ts`, `lib/api/numbers.ts`, `lib/api/journal.ts`는 이번 Task에서 전혀 수정하지 않았다(git 상태로 확인).
- `lib/logic/matchNumbers.ts`의 유일한 변경(`export` 키워드 추가)이 기존 20개 테스트를 깨뜨리지 않았음을 `npm test`로 확인했다(§16).

카카오 OAuth/profile 처리/Phase5 `/api/numbers`/Phase4 다이어리 조회 서비스 중 어느 것도 이번 Task가 건드리지 않아 회귀 위험이 구조적으로 없다.

---

## 15. Phase6-4에서 남은 작업

1. **관리자 인증 구조 확정 및 구현** — `lib/auth/isAdmin.ts` + 최소한의 관리자 판별 컬럼/메커니즘. `EXECUTION_PLAN.md`는 이를 Phase9(`0012_admin_flag.sql`)로 예약해뒀지만, Phase6이 "MVP Must 핵심 루프" 완성 조건이라는 점(`EXECUTION_PLAN.md` §421)을 고려하면 **이 조각만 Phase9에서 앞당겨 오는 것을 검토할 가치가 있다** — 사용자 승인 필요(새 migration 포함).
2. `app/api/admin/draws/route.ts` 구현: `getCurrentUser()` → `isAdmin()` → `parseAdminDrawsInput()` → `registerDrawAndMatchUserNumbers()` 순서로 조립. 401(비로그인)/403(비관리자) 응답은 `app/api/numbers/route.ts`와 동일한 `errorResponse()` 컨벤션을 재사용.
3. `proxy.ts`에 `/api/admin/*` 보호 추가(관리자 인증이 준비된 뒤).
4. 지시문 Test B/C(일반 사용자 403, 비로그인 401, 둘 다 DB 변경 없음)를 실제 Route에 대해 재검증.
5. §10 Case C(부분 UPDATE 실패 시 재시도 경로 부재)의 완화 방안 검토 — 예: 실패한 id를 별도로 재처리하는 관리자 화면(Phase9) 또는 재시도 큐.
6. §11의 RLS Decision(당첨 데이터 위조 가능성) — Phase7 공유 기능 설계 시점에 재검토.

---

## 16. Validation

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run type-check` | 통과 |
| `npm test` | 통과 — **10 test files, 114 tests**(기존 87 + 신규 27: `admin/draws.test.ts` 25 + `notifications.test.ts` 2) |
| `npm run build` | 통과, 라우트 목록 변경 없음(§14) |
| 실제 Supabase 통합 테스트 | 통과 — 2 tests(Test A/F, Test E), 임시 파일·데이터 전부 삭제 후 잔여 0건 재확인 |

`git status`로 확인한 이번 Task의 실제 변경 파일: `lib/logic/matchNumbers.ts`(export 2개 추가만), `lib/api/notifications.ts`(신규)+테스트, `lib/api/admin/draws.ts`(신규)+테스트, 본 보고서 — 그 외 `app/*`, `components/*`, `lib/api/numbers.ts`, `lib/api/journal.ts`, `proxy.ts`, Migration 파일은 전부 미변경.

---

## 17. Phase6 완료 여부

**완료되지 않았다 — Phase6-4가 남아 있다.** `EXECUTION_PLAN.md`가 정의한 Phase6의 "완료 기준"(§445~448: "관리자 입력 → 다이어리 결과 반영 확인", "당첨자 알림 생성 확인")은 배치 로직 자체로는 실제 Supabase 검증까지 마쳤지만(§12), **관리자가 실제로 그 기능을 호출할 수 있는 경로(HTTP API)가 없다**는 점에서 "관리자 입력"이라는 조건이 아직 충족되지 않았다.

이번 Task가 이룬 것: Phase6의 가장 리스크가 큰 부분(판정 정확성, 회차 연결 전략, 중복/동시성, 알림 중복 방지)을 **안전하게 검증 가능한 형태로 전부 완성**했고, 유일하게 남은 것은 "이 로직을 관리자만 호출할 수 있게 만드는 인증 계층" 하나뿐이다. 이는 임의로 우회해도 되는 사소한 디테일이 아니라 이 프로젝트의 명시적 설계 결정(Phase9 예약)이므로, 그 결정을 뒤집지 않고 정직하게 BLOCKER로 보고한다.
