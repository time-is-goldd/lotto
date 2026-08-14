# Phase6-1 당첨 판정 순수 함수 + 당첨 데이터 계약 구현 보고서

## 1. 구현 범위

이번 Task에서 생성/수정한 파일은 다음 4개뿐이다.

| 파일 | 종류 | 설명 |
|---|---|---|
| `lib/types/winning.ts` | 신규 | 당첨 데이터 내부 계약 (판정용 vs 표시용 분리) |
| `lib/logic/matchNumbers.ts` | 신규 | 당첨 판정 순수 함수 + 검증 로직 |
| `lib/logic/matchNumbers.test.ts` | 신규 | 단위 테스트 20건 |
| `docs/PHASE6_WINNING_LOGIC_REPORT.md` | 신규 | 본 보고서 |

`app/*`, `components/*`, `lib/api/numbers.ts`, `lib/api/journal.ts`, `proxy.ts`, Migration 파일, `lib/logic/generateNumbers.ts`는 전혀 건드리지 않았다 (§10 검증 결과 참조). DB에 대한 UPDATE/INSERT는 코드상 존재하지 않으며(Supabase import 자체가 없음), 관리자 UI/외부 API 연동도 구현하지 않았다.

## 2. 당첨 데이터 계약

`docs/PHASE6_PRE_IMPLEMENTATION_AUDIT.md`가 이미 정리한 "판정에 필요한 데이터"와 "표시를 위한 부가 데이터"의 분리를 그대로 타입으로 옮겼다.

- `WinningDraw` — 판정에 필요한 최소 데이터: `round`, `winningNumbers`(6개), `bonusNumber`. `supabase/migrations/0002_draws_user_numbers.sql`의 `draws.round`/`numbers`/`bonus_number` 컬럼과 1:1 대응한다.
- `WinningDrawPrizeInfo` — 표시 전용 부가 데이터: `firstPrizeAmount`, `firstPrizeCount`. `draws.first_prize_amount`/`first_prize_count`(1등 전용 컬럼)와 대응한다. 2~5등 당첨금 컬럼과 `draw_date` 컬럼은 현재 스키마에 없으므로 이 타입에 넣지 않았다 — 추측으로 필드를 만들지 않았다.

두 타입을 분리한 이유: 관리자가 회차를 입력할 때 "판정에 쓰이는 값"과 "화면에만 보여줄 값"이 섞이면 나중에 판정 로직이 표시용 필드에 암묵적으로 의존하게 될 위험이 있다. 타입 레벨에서부터 분리해두면 `matchNumbers()`가 `WinningDrawPrizeInfo`를 아예 참조할 수 없게 강제된다.

## 3. 타입 설계

```ts
export interface WinningDraw {
  round: number;
  winningNumbers: number[];
  bonusNumber: number;
}

export interface WinningDrawPrizeInfo {
  firstPrizeAmount: number;
  firstPrizeCount: number;
}

export type WinRank = 1 | 2 | 3 | 4 | 5; // "6등"은 존재하지 않는다

export interface MatchResult {
  matchCount: number;
  bonusMatched: boolean;
  winRank: WinRank | null; // null = 낙첨
}
```

`WinRank`를 `1 | 2 | 3 | 4 | 5` 리터럴 유니온으로 제한해, 타입 시스템 차원에서 "6등"이라는 값이 아예 존재할 수 없도록 했다.

## 4. matchNumbers 함수 계약

```ts
function matchNumbers(
  userNumbers: number[],
  winningNumbers: number[],
  bonusNumber: number
): MatchResult
```

- 입력: 사용자 번호 6개, 당첨 번호 6개, 보너스 번호 1개 — 전부 원시 배열/숫자이며 `WinningDraw` 객체를 직접 받지 않는다. 호출부가 `matchNumbers(userNumbers, draw.winningNumbers, draw.bonusNumber)` 형태로 분해해서 넘기는 것을 전제로, 함수 자체는 최대한 단순한 시그니처를 유지했다.
- 출력: `MatchResult` (`matchCount`, `bonusMatched`, `winRank`).
- 부작용 없음: Supabase, `getCurrentUser()`, API 호출, `Date.now()`, `Math.random()`, 환경변수, 전역 mutable state를 전혀 사용하지 않는다. 파일 전체에서 import는 `generateNumbers.ts`의 상수와 `winning.ts`의 타입뿐이다.
- 동일 입력 → 항상 동일 출력. 어떤 Server Component/API Route/관리자 배치에서 호출해도 결과가 같다.

## 5. 당첨 등수 판정 규칙

```
6개 일치                    → 1등
5개 일치 + 보너스 일치      → 2등
5개 일치 (보너스 불일치)    → 3등
4개 일치                    → 4등
3개 일치                    → 5등
그 외 (0~2개 일치)          → 낙첨 (winRank: null)
```

"6등"이라는 등수는 실제 로또 6/45 규칙에 존재하지 않으므로 어디에도 사용하지 않았다 — 3개 미만 일치는 전부 `winRank: null`(낙첨)으로 표현한다.

## 6. 입력 검증

`WinningValidationError extends Error`를 정의해 기존 컨벤션(`ProfileValidationError`, `NumbersValidationError`, `JournalValidationError`)을 그대로 따랐다.

검증 항목:

- `userNumbers`/`winningNumbers` 공통(`assertValidNumberSet`): 배열 여부 → 정확히 6개(`NUMBERS_PER_GAME`) → 전부 정수 → `MIN_NUMBER`~`MAX_NUMBER`(1~45) 범위 → 중복 없음(Set 크기 비교).
- `bonusNumber`(`assertValidBonusNumber`): 정수 여부 → 1~45 범위 → `winningNumbers`와 중복 불가.
- `MIN_NUMBER`/`MAX_NUMBER`/`NUMBERS_PER_GAME`은 전부 `lib/logic/generateNumbers.ts`에서 import했다 — 재정의하지 않았다.
- 검증 실패 시 전부 `WinningValidationError`를 throw한다(Result 타입이 아닌 예외 방식 — `NumbersValidationError` 등 기존 컨벤션과 동일).

## 7. 당첨금 책임 분리

`matchNumbers()`는 `matchCount`/`bonusMatched`/`winRank`만 반환하며, 어떤 금액도 계산하거나 하드코딩하지 않는다. 실제 당첨금은 `WinningDrawPrizeInfo`(회차별 사실 데이터)에서 가져와 상위 서비스/UI가 `winRank`와 조합해 표시하는 구조로 분리했다. 이 함수 안에는 금액 관련 상수나 계산식이 전혀 없다 — 코드 검색으로 확인 가능(`amount`, `prize` 등의 토큰이 `matchNumbers.ts`에 등장하지 않음).

## 8. 미확인 vs 확인 후 낙첨 — 책임 분리 결정

`matchNumbers()`와 `MatchResult`는 "미확인" 상태를 표현하지 않는다. 이 함수는 **항상 실제 당첨 번호(`WinningDraw`)가 이미 존재할 때만 호출된다**는 것을 전제로 설계했다.

- "아직 대조하지 않음"(미확인)은 이 함수를 아예 호출하지 않는 것으로 표현된다 — 즉 호출 여부 자체가 상태를 나타낸다.
- DB 레벨에서는 이미 `user_numbers.checked_at`이 이 구분을 위해 존재한다: `checked_at IS NULL` = 미확인, `checked_at IS NOT NULL AND win_rank IS NULL` = 확인 후 낙첨, `checked_at IS NOT NULL AND win_rank IS NOT NULL` = 확인 후 당첨.
- 결론: "미확인" 상태 관리는 순수 함수의 책임이 아니라, 언제 `matchNumbers()`를 호출하고 그 결과로 `checked_at`/`win_rank`를 언제 세팅할지 결정하는 상위 서비스 레이어(Phase6-2 이후)의 책임이다. 순수 함수에 상태 관리 로직을 넣지 않음으로써 계약을 최소한으로 유지했다.

## 9. 테스트 케이스 (20건)

`lib/logic/matchNumbers.test.ts`:

1. 6개 일치 → 1등
2. 5개 일치 + 보너스 일치 → 2등
3. 5개 일치 + 보너스 불일치 → 3등
4. 4개 일치 → 4등
5. 3개 일치 → 5등
6. 2개 일치 → 낙첨
7. 0개 일치 → 낙첨
8. `winningNumbers`가 정렬되어 있지 않아도(`[45, 3, 21, 7, 12, 30]`) 정확히 판정
9. `bonusNumber`가 사용자 번호에 포함 → `bonusMatched: true`
10. `bonusNumber`가 사용자 번호에 없음 → `bonusMatched: false`
11. `userNumbers`가 5개(개수 오류) → `WinningValidationError`
12. `winningNumbers`가 7개(개수 오류) → `WinningValidationError`
13. `bonusNumber`가 `winningNumbers`와 중복 → `WinningValidationError`
14. `userNumbers`에 중복된 값 → `WinningValidationError`
15. `winningNumbers`에 중복된 값 → `WinningValidationError`
16. `userNumbers`에 범위 밖 값(0) → `WinningValidationError`
17. `userNumbers`에 범위 밖 값(46) → `WinningValidationError`
18. `bonusNumber`가 범위 밖 값(46) → `WinningValidationError`
19. `userNumbers`에 정수가 아닌 값(5.5) → `WinningValidationError`
20. `bonusNumber`가 정수가 아닌 값(7.5) → `WinningValidationError`

요구된 16개 케이스를 전부 포함하며, 검증 케이스를 8~10개로 세분화해 20개로 확장했다.

## 10. 검증 결과

| 명령 | 결과 |
|---|---|
| `npm run lint` | 통과 (에러/경고 없음) |
| `npm run type-check` | 통과 |
| `npm test` | 통과 — **8 test files, 87 tests passed** (신규 20 tests, 기존 67 tests) |
| `npm run build` | 통과 (Next.js 프로덕션 빌드 성공) |

`git status`로 확인한 결과, 이번 Task에서 새로 생성/수정된 파일은 `lib/types/winning.ts`, `lib/logic/matchNumbers.ts`, `lib/logic/matchNumbers.test.ts`, `docs/PHASE6_WINNING_LOGIC_REPORT.md` 4개뿐이다. `lib/logic/generateNumbers.ts`/`generateNumbers.test.ts`는 파일 수정 시각(mtime)이 이번 작업 이전 그대로였고, `app/*`, `components/*`, `lib/api/numbers.ts`, `lib/api/journal.ts`, `proxy.ts`, Migration 파일은 이번 Task에서 전혀 쓰기 작업을 하지 않았다(모두 이전 Phase에서부터 이미 untracked/modified 상태였던 파일).

## 11. 기존 Phase5와의 연결

Phase5의 `saveUserNumbers()`(`lib/api/numbers.ts`)는 `user_numbers` row를 저장하되 `target_round`를 세팅하지 않는다 — 이 Task에서는 이 문제를 고치지 않았다(범위 외, Phase6-2 대상).

`MatchResult`가 향후 `user_numbers` 컬럼과 매핑될 방식(실제 UPDATE는 이번 Task에서 수행하지 않음):

| `MatchResult` 필드 | `user_numbers` 컬럼 |
|---|---|
| `matchCount` | `match_count` |
| `winRank` | `win_rank` |
| (호출 시점) | `checked_at` |

`bonusMatched`는 현재 `user_numbers`에 대응 컬럼이 없다 — 필요하다면 Phase6-2에서 컬럼 추가 여부를 결정해야 한다(이번 보고서는 문제 제기만 하고 결정하지 않는다).

## 12. Phase6-2 필요 작업 제안

1. **당첨 데이터 저장 구조**: `WinningDraw`를 실제로 어디에 저장할지 확정 — 기존 `draws` 테이블을 그대로 쓸지, 관리자 입력 흐름을 어떻게 설계할지.
2. **회차 연결(target_round) 전략**: Phase5에서 세팅되지 않는 `user_numbers.target_round`를 언제/어떻게 채울지 확정 — 저장 시점에 채울지, 판정 시점에 채울지, 사용자가 직접 회차를 선택하게 할지.
3. 위 두 가지가 확정되면 `app/api/admin/draws/route.ts`(EXECUTION_PLAN.md가 이미 지정한 경로)에서 `matchNumbers()`를 호출해 `user_numbers.match_count`/`win_rank`/`checked_at`을 실제로 UPDATE하는 로직을 구현할 수 있다.
4. `bonusMatched`를 DB에 별도로 저장할지 여부 결정.

## 13. 발견된 문제

- Phase5의 `saveUserNumbers()`가 `target_round`를 세팅하지 않는 문제는 여전히 미해결 상태다(Phase6-0에서 이미 발견, 이번 Task 범위 외로 재확인만 함).
- `bonusMatched` 값을 저장할 DB 컬럼이 현재 스키마에 없다 — Phase6-2에서 결정 필요.
- 2~5등 당첨금 컬럼과 `draw_date` 컬럼이 `draws` 테이블에 없어 `WinningDrawPrizeInfo`가 1등 정보만 담고 있다 — 실제 서비스에서 2~5등 당첨금도 표시해야 한다면 Migration이 필요하다(이번 Task에서는 수행하지 않음).
