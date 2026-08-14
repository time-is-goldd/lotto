import { MAX_NUMBER, MIN_NUMBER, NUMBERS_PER_GAME } from "@/lib/logic/generateNumbers";
import type { MatchResult, WinRank } from "@/lib/types/winning";

// Phase6-1 계약(docs/PHASE6_WINNING_LOGIC_REPORT.md, docs/PHASE6_PRE_IMPLEMENTATION_AUDIT.md §5).
// MIN_NUMBER/MAX_NUMBER/NUMBERS_PER_GAME은 lib/logic/generateNumbers.ts(Phase5-1)가 이미
// export한 상수를 그대로 재사용한다 — 여기서 다시 정의하지 않는다.

export class WinningValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WinningValidationError";
  }
}

// userNumbers/winningNumbers 둘 다 이 검증을 통과해야 한다 — 정확히 6개, 전부 정수,
// 1~45 범위, 중복 없음. label은 어느 배열이 잘못됐는지 에러 메시지에 남기기 위함이다.
// export하는 이유: docs/PHASE6_ADMIN_DRAW_PROCESSING_REPORT.md §4 — 관리자 회차 입력
// 검증(lib/api/admin/draws.ts)도 winningNumbers에 동일한 규칙을 적용해야 하는데,
// "판정 알고리즘을 복제하지 않는다"는 지시에 따라 이 검증 로직을 그대로 재사용한다.
export function assertValidNumberSet(numbers: unknown, label: string): asserts numbers is number[] {
  if (!Array.isArray(numbers)) {
    throw new WinningValidationError(`${label}는 배열이어야 합니다.`);
  }
  if (numbers.length !== NUMBERS_PER_GAME) {
    throw new WinningValidationError(`${label}는 정확히 ${NUMBERS_PER_GAME}개여야 합니다.`);
  }
  if (!numbers.every((n): n is number => typeof n === "number" && Number.isInteger(n))) {
    throw new WinningValidationError(`${label}는 전부 정수여야 합니다.`);
  }
  if (!numbers.every((n) => n >= MIN_NUMBER && n <= MAX_NUMBER)) {
    throw new WinningValidationError(`${label}는 ${MIN_NUMBER}~${MAX_NUMBER} 범위여야 합니다.`);
  }
  if (new Set(numbers).size !== NUMBERS_PER_GAME) {
    throw new WinningValidationError(`${label}에 중복된 값이 있습니다.`);
  }
}

// dream_situations.numbers(supabase/migrations/0018_dream_situations.sql)용 검증이다 — 정확히
// 6개를 강제하는 assertValidNumberSet과 의도적으로 분리했다(같은 이유로 DB도
// is_valid_lotto_numbers()와 is_valid_partial_lotto_numbers()를 별개 함수로 뒀다,
// docs/DREAM_SITUATIONS_MVP_REPORT.md §4 참조 — 이 분리를 흐리면 draws/user_numbers처럼
// "정확히 6개"가 진짜 불변식인 곳까지 실수로 느슨해질 위험이 있다). 0개(빈 배열)도 유효하다 —
// 호출부가 빈 문자열 입력을 빈 배열로 파싱해 넘긴다는 전제다.
export function assertValidPartialNumberSet(
  numbers: unknown,
  label: string
): asserts numbers is number[] {
  if (!Array.isArray(numbers)) {
    throw new WinningValidationError(`${label}는 배열이어야 합니다.`);
  }
  if (numbers.length > NUMBERS_PER_GAME) {
    throw new WinningValidationError(
      `${label}는 최대 ${NUMBERS_PER_GAME}개까지 입력할 수 있습니다.`
    );
  }
  if (!numbers.every((n): n is number => typeof n === "number" && Number.isInteger(n))) {
    throw new WinningValidationError(`${label}는 전부 정수여야 합니다.`);
  }
  if (!numbers.every((n) => n >= MIN_NUMBER && n <= MAX_NUMBER)) {
    throw new WinningValidationError(`${label}는 ${MIN_NUMBER}~${MAX_NUMBER} 범위여야 합니다.`);
  }
  if (new Set(numbers).size !== numbers.length) {
    throw new WinningValidationError(`${label}에 중복된 값이 있습니다.`);
  }
}

// bonusNumber는 winningNumbers와 별개로 검증한다 — 실제 로또 6/45 규칙상 보너스 번호는
// 본번호 6개와 항상 다른 값이다(docs/PHASE6_PRE_IMPLEMENTATION_AUDIT.md §2).
// export 이유는 assertValidNumberSet과 동일(위 주석 참조).
export function assertValidBonusNumber(
  bonusNumber: unknown,
  winningNumbers: number[]
): asserts bonusNumber is number {
  if (typeof bonusNumber !== "number" || !Number.isInteger(bonusNumber)) {
    throw new WinningValidationError("bonusNumber는 정수여야 합니다.");
  }
  if (bonusNumber < MIN_NUMBER || bonusNumber > MAX_NUMBER) {
    throw new WinningValidationError(`bonusNumber는 ${MIN_NUMBER}~${MAX_NUMBER} 범위여야 합니다.`);
  }
  if (winningNumbers.includes(bonusNumber)) {
    throw new WinningValidationError("bonusNumber는 winningNumbers와 중복될 수 없습니다.");
  }
}

// "6등"은 로또 6/45 공식 등수 체계에 없다(docs/PHASE6_PRE_IMPLEMENTATION_AUDIT.md §5) —
// 1~5등만 실제 등수이고 그 외(0~2개 일치)는 전부 낙첨(null)이다. 당첨금은 이 함수의
// 책임이 아니다(docs/PHASE6_PRE_IMPLEMENTATION_AUDIT.md §11) — 등수/일치개수만 반환하고,
// 실제 금액은 상위 레이어가 WinningDrawPrizeInfo(lib/types/winning.ts)를 조합해 표시한다.
function determineWinRank(matchCount: number, bonusMatched: boolean): WinRank | null {
  if (matchCount === 6) {
    return 1;
  }
  if (matchCount === 5 && bonusMatched) {
    return 2;
  }
  if (matchCount === 5) {
    return 3;
  }
  if (matchCount === 4) {
    return 4;
  }
  if (matchCount === 3) {
    return 5;
  }
  return null;
}

// 순수 함수 — Supabase/getCurrentUser()/API 호출/Date.now()/random/환경변수/전역
// mutable state를 전혀 쓰지 않는다. 같은 세 인자면 항상 같은 결과를 반환한다.
//
// winningNumbers의 정렬 여부에 의존하지 않는다 — draws.numbers는 DB CHECK
// (is_valid_lotto_numbers, 0002_draws_user_numbers.sql)가 정렬을 강제하지 않으므로
// [45, 3, 21, 7, 12, 30]처럼 순서가 섞여 들어와도 정확히 판정해야 한다. Set 기반
// 비교로 이 요구사항을 충족한다.
//
// "미확인" 상태는 이 함수의 책임이 아니다 — 이 함수는 항상 "실제 당첨번호가 이미 존재하는"
// 상황에서만 호출된다는 것을 전제한다. "아직 대조하지 않음"은 이 함수를 아예 호출하지
// 않는 것으로 표현되며, 그 판단은 상위 서비스(Phase6-2)의 책임이다
// (docs/PHASE6_WINNING_LOGIC_REPORT.md §8).
export function matchNumbers(
  userNumbers: number[],
  winningNumbers: number[],
  bonusNumber: number
): MatchResult {
  assertValidNumberSet(userNumbers, "userNumbers");
  assertValidNumberSet(winningNumbers, "winningNumbers");
  assertValidBonusNumber(bonusNumber, winningNumbers);

  const winningSet = new Set(winningNumbers);
  const matchCount = userNumbers.filter((n) => winningSet.has(n)).length;
  const bonusMatched = userNumbers.includes(bonusNumber);
  const winRank = determineWinRank(matchCount, bonusMatched);

  return { matchCount, bonusMatched, winRank };
}
