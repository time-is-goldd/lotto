import { DREAM_INTERPRETATION_MAX_LENGTH, DREAM_KEYWORD_MAX_LENGTH } from "@/lib/constants";
import { assertValidNumberSet, WinningValidationError } from "@/lib/logic/matchNumbers";

// components/admin/drawFormValidation.ts(Phase9-2)와 동일한 이유로 분리한 순수 함수 파일 —
// jsdom/RTL이 없어 컴포넌트 렌더링 테스트가 불가능하므로 React와 무관한 검증 로직만 여기
// 모은다. lib/api/admin/dreams.ts는 service_role(lib/supabase/service.ts)을 top-level에서
// import하므로 Client Component 번들에 넣지 않는다 — 규칙(길이 상한)은 lib/constants에서
// 공유하고, 번호 형식 검증은 lib/logic/matchNumbers.ts(Supabase 의존 없는 순수 함수)를
// 그대로 재사용해 두 곳에서 같은 로직을 다시 작성하지 않는다.
export interface DreamFormValues {
  keyword: string;
  category: string; // 빈 문자열 = 미지정
  interpretation: string;
  numbers: [string, string, string, string, string, string] | null; // null = 번호 매핑 입력 안 함
}

export interface DreamSubmitPayload {
  keyword: string;
  category: string | null;
  interpretation: string;
  numbers: number[] | null;
}

// 클라이언트 검증은 UX 편의일 뿐 보안 경계가 아니다 — 최종 검증은 여전히
// POST/PUT /api/admin/dreams(lib/api/admin/dreams.ts)가 담당한다.
export function validateDreamForm(values: DreamFormValues): DreamSubmitPayload {
  const keyword = values.keyword.trim();
  if (keyword.length === 0) {
    throw new WinningValidationError("keyword를 입력해주세요.");
  }
  if (keyword.length > DREAM_KEYWORD_MAX_LENGTH) {
    throw new WinningValidationError(`keyword는 ${DREAM_KEYWORD_MAX_LENGTH}자를 초과할 수 없습니다.`);
  }

  const interpretation = values.interpretation.trim();
  if (interpretation.length === 0) {
    throw new WinningValidationError("interpretation을 입력해주세요.");
  }
  if (interpretation.length > DREAM_INTERPRETATION_MAX_LENGTH) {
    throw new WinningValidationError(
      `interpretation은 ${DREAM_INTERPRETATION_MAX_LENGTH}자를 초과할 수 없습니다.`
    );
  }

  const category = values.category.trim() === "" ? null : values.category.trim();

  let numbers: number[] | null = null;
  if (values.numbers !== null) {
    const parsed = values.numbers.map((n) => Number(n));
    assertValidNumberSet(parsed, "numbers");
    numbers = parsed;
  }

  return { keyword, category, interpretation, numbers };
}
