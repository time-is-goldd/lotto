// components/fortune/BirthDateSplitInput.tsx가 쓰는 순수 로직만 분리했다 — 이 프로젝트의
// vitest 설정(jsdom 없음)으로는 컴포넌트를 렌더링해서 테스트할 수 없어(components/generate/
// generatorSaveLogic.ts와 동일한 이유), React와 무관한 이 함수들만 따로 빼서 실제로 테스트
// 가능하게 만들었다.

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export interface SplitDateParts {
  year: string;
  month: string;
  day: string;
}

// claude-code-luck-platform-daily-fortune-number-demo-prompt.md §7: "19990110",
// "1999-01-10", "1999.01.10"을 붙여넣으면 세 필드에 올바르게 분배한다 — 구분자를 무시하고
// 숫자만 뽑아 8자리인지만 확인한다(하이픈/점 외의 다른 구분자가 섞여도 동일하게 동작).
// 8자리가 아니면(부분 날짜, 다른 텍스트 등) null을 반환해 호출부가 기본 붙여넣기 동작에
// 맡기게 한다.
export function distributeDigits(rawPasteText: string): SplitDateParts | null {
  const digits = onlyDigits(rawPasteText);
  if (digits.length !== 8) {
    return null;
  }
  return { year: digits.slice(0, 4), month: digits.slice(4, 6), day: digits.slice(6, 8) };
}

export function parsePartsFromValue(value: string): SplitDateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return { year: "", month: "", day: "" };
  }
  return { year: match[1], month: match[2], day: match[3] };
}

// §7 "월/일 한 자리도 입력할 수 있고 blur 또는 제출 시 정규화한다" — 한 자리 값만 0으로
// 패딩한다(이미 두 자리이거나 빈 값은 그대로 둔다).
export function normalizeTwoDigit(value: string): string {
  return value.length === 1 ? value.padStart(2, "0") : value;
}

// 세 필드가 조합 가능한 상태(연도 4자리 + 월/일 각각 1자리 이상)일 때만 "YYYY-MM-DD"를
// 만든다 — 아직 다 채워지지 않았으면 null을 반환해 호출부가 부모에 빈 값을 올리게 한다.
export function combineIfComplete(parts: SplitDateParts): string | null {
  if (parts.year.length !== 4 || parts.month.length < 1 || parts.day.length < 1) {
    return null;
  }
  return `${parts.year}-${normalizeTwoDigit(parts.month)}-${normalizeTwoDigit(parts.day)}`;
}
