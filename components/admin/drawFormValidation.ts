import {
  assertValidBonusNumber,
  assertValidNumberSet,
  WinningValidationError,
} from "@/lib/logic/matchNumbers";

// components/generate/generatorSaveLogic.ts(Phase5)와 동일한 이유로 이 파일을 분리했다:
// 이 프로젝트의 vitest 설정에는 jsdom/RTL이 없어 컴포넌트를 렌더링해서 테스트할 수 없으므로,
// React와 무관한 순수 함수만 여기 모아 실제로 단위 테스트 가능하게 만든다.
//
// 당첨번호/보너스번호 검증 규칙(6개/1~45/중복없음/보너스-본번호 중복금지)은 새로 만들지
// 않는다 — lib/logic/matchNumbers.ts(Phase6-1)가 이미 export한 assertValidNumberSet/
// assertValidBonusNumber를 그대로 재사용한다. 이 파일은 Supabase/service_role을 전혀
// import하지 않아(lib/logic/generateNumbers.ts의 순수 상수, lib/types/winning.ts의 순수
// 타입만 의존) Client Component 번들에 포함돼도 안전하다.
export interface DrawFormValues {
  round: string;
  numbers: [string, string, string, string, string, string];
  bonusNumber: string;
  firstPrizeAmount: string;
  firstPrizeCount: string;
}

export interface DrawSubmitPayload {
  round: number;
  winningNumbers: number[];
  bonusNumber: number;
  firstPrizeAmount: number;
  firstPrizeCount: number;
}

// 클라이언트 검증은 UX 편의일 뿐 보안 경계가 아니다(지시문 §3) — 최종 검증은 여전히
// POST /api/admin/draws → lib/api/admin/draws.ts의 parseAdminDrawsInput()이 담당한다.
// round의 상한(lib/api/admin/draws.ts의 MAX_ROUND)은 export되지 않은 서버 전용 상수라
// 여기서 재정의하지 않는다 — "양의 정수" 정도의 실수 방지만 클라이언트에서 확인한다.
function parsePositiveInteger(value: string, label: string): number {
  const n = Number(value);
  if (value.trim() === "" || !Number.isInteger(n) || n <= 0) {
    throw new WinningValidationError(`${label}는 양의 정수여야 합니다.`);
  }
  return n;
}

function parseNonNegativeInteger(value: string, label: string): number {
  const n = Number(value);
  if (value.trim() === "" || !Number.isInteger(n) || n < 0) {
    throw new WinningValidationError(`${label}는 0 이상의 정수여야 합니다.`);
  }
  return n;
}

// 모든 필드가 빈 문자열이 아닌지만 확인한다(제출 버튼 활성화 조건용) — 실제 형식 검증은
// validateDrawForm()이 제출 시점에 한 번에 수행한다.
export function isDrawFormFilled(values: DrawFormValues): boolean {
  return (
    values.round.trim() !== "" &&
    values.numbers.every((n) => n.trim() !== "") &&
    values.bonusNumber.trim() !== "" &&
    values.firstPrizeAmount.trim() !== "" &&
    values.firstPrizeCount.trim() !== ""
  );
}

// 실패 시 WinningValidationError를 던진다(호출부가 message를 그대로 화면에 표시).
export function validateDrawForm(values: DrawFormValues): DrawSubmitPayload {
  const round = parsePositiveInteger(values.round, "회차");

  const winningNumbers = values.numbers.map((n) => Number(n));
  assertValidNumberSet(winningNumbers, "당첨번호");

  const bonusNumber = Number(values.bonusNumber);
  assertValidBonusNumber(bonusNumber, winningNumbers);

  const firstPrizeAmount = parseNonNegativeInteger(values.firstPrizeAmount, "1등 당첨금");
  const firstPrizeCount = parseNonNegativeInteger(values.firstPrizeCount, "1등 당첨자 수");

  return { round, winningNumbers, bonusNumber, firstPrizeAmount, firstPrizeCount };
}
