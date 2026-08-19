import { MAX_NUMBER, MIN_NUMBER, NUMBERS_PER_GAME, generateNumbers } from "./generateNumbers";

// claude-code-luck-platform-launch-prompt.md §12: "꿈 숫자"(dream_situations.numbers 또는
// dream_number_mappings.numbers)와 무작위 채움 숫자를 합쳐 항상 6개를 만드는 순수 함수.
// generateNumbers()와 동일하게 side effect가 없다 — 호출부(app/generate/page.tsx,
// components/generate/NumberGenerator.tsx)가 이 결과를 그대로 표시/저장한다.
export interface DreamAwareNumbers {
  // 최종적으로 표시/저장할 6개, 오름차순 정렬.
  numbers: number[];
  // numbers의 부분집합 — 꿈에서 가져온 숫자만. 빈 배열이면 "꿈과 연결된 번호"가 아니라 순수
  // 무작위 생성이라는 뜻이다(호출부가 이 길이로 "꿈 연결" 라벨 노출 여부를 결정한다).
  dreamNumbers: number[];
}

function isValidLottoNumber(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_NUMBER && value <= MAX_NUMBER;
}

// dream_situations.numbers/dream_number_mappings.numbers는 DB에서 온 값이라 형식상으로는
// 이미 유효(1~45, 중복 없음)해야 하지만, 이 함수는 방어적으로 다시 한번 걸러내고 중복을
// 제거한다 — "숫자는 항상 1~45, 중복 없음"이라는 §24 검증 조건을 이 함수 하나가 구조적으로
// 보장하게 하기 위함이다(호출부마다 따로 검증하지 않아도 됨).
function sanitizeDreamNumbers(candidates: readonly number[] | null | undefined): number[] {
  if (!candidates || candidates.length === 0) {
    return [];
  }
  const unique = Array.from(new Set(candidates.filter(isValidLottoNumber)));
  return unique.slice(0, NUMBERS_PER_GAME);
}

// fixedCandidates가 비어 있으면(꿈에 연결된 숫자가 하나도 없으면) 완전한 무작위 생성으로
// 폴백한다 — 이때 dreamNumbers는 빈 배열이라, 호출부가 "꿈과 연결된 숫자"라는 문구를 절대
// 붙이지 않는다(§12 "꿈 숫자가 하나도 없으면... 꿈과 연결된 숫자라고 표현하지 않는다").
export function buildDreamAwareNumbers(
  fixedCandidates: readonly number[] | null | undefined
): DreamAwareNumbers {
  const dreamNumbers = sanitizeDreamNumbers(fixedCandidates);

  if (dreamNumbers.length === 0) {
    return { numbers: generateNumbers(), dreamNumbers: [] };
  }

  const filled = new Set(dreamNumbers);
  while (filled.size < NUMBERS_PER_GAME) {
    const candidate = Math.floor(Math.random() * MAX_NUMBER) + MIN_NUMBER;
    filled.add(candidate);
  }

  return { numbers: Array.from(filled).sort((a, b) => a - b), dreamNumbers };
}

// Situation 자신의 숫자가 없거나 유효하지 않을 때만 쓰는 Parent 상속 규칙 — "최대 3개"로
// 명시적으로 캡을 씌운다(§12 "Parent의 유효한 숫자 중 최대 3개를 상속한다"). Situation이
// 이미 자기 숫자를 가진 경우에는 이 함수를 호출하지 않는다(호출부 책임).
export function inheritParentNumbers(parentNumbers: readonly number[] | null | undefined): number[] {
  return sanitizeDreamNumbers(parentNumbers).slice(0, 3);
}
