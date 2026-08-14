import {
  DREAM_SITUATION_BODY_MAX_LENGTH,
  DREAM_SITUATION_KEY_MEANING_MAX_LENGTH,
  DREAM_SITUATION_KEYWORD_MAX_LENGTH,
  DREAM_SITUATION_TITLE_MAX_LENGTH,
} from "@/lib/constants";
import { assertValidPartialNumberSet, WinningValidationError } from "@/lib/logic/matchNumbers";

// components/admin/dreamFormValidation.ts와 동일한 이유로 분리한 순수 함수 파일 — React와
// 무관한 검증 로직만 여기 모은다. lib/api/admin/dreamSituations.ts는 service_role
// (lib/supabase/service.ts)을 top-level에서 import하므로 Client Component 번들에 넣지
// 않는다 — 길이 상한은 lib/constants에서, 번호 형식 검증은 lib/logic/matchNumbers.ts의
// assertValidPartialNumberSet을 그대로 재사용해 두 곳에서 같은 로직을 다시 쓰지 않는다.
export interface DreamSituationFormValues {
  keyword: string;
  title: string;
  body: string;
  keyMeaning: string; // 빈 문자열 = 핵심 해석 없음
  numbersText: string; // "3, 17" 형태의 원문 입력(지시문 §7 예시)
  displayOrder: string;
}

export interface DreamSituationSubmitPayload {
  keyword: string;
  title: string;
  body: string;
  keyMeaning: string | null;
  numbers: number[];
  displayOrder: number;
}

// 콤마 또는 공백(연속 포함)으로 구분된 숫자 목록을 파싱한다 — "3, 17" / "3,17" / "3  17" 전부
// 허용한다. 빈 문자열/공백만 있는 입력은 "0개"로 취급한다(지시문 §7 "empty → []").
export function parseNumbersText(raw: string): number[] {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return [];
  }
  return trimmed
    .split(/[,\s]+/)
    .filter((part) => part.length > 0)
    .map((part) => {
      const n = Number(part);
      if (!Number.isFinite(n)) {
        throw new WinningValidationError(`"${part}"은(는) 올바른 숫자가 아닙니다.`);
      }
      return n;
    });
}

// 클라이언트 검증은 UX 편의일 뿐 보안 경계가 아니다 — 최종 검증은 여전히 POST/PUT
// /api/admin/dreams/[dreamId]/situations(lib/api/admin/dreamSituations.ts)가 담당한다.
export function validateDreamSituationForm(
  values: DreamSituationFormValues
): DreamSituationSubmitPayload {
  const keyword = values.keyword.trim();
  if (keyword.length === 0) {
    throw new WinningValidationError("keyword를 입력해주세요.");
  }
  if (keyword.length > DREAM_SITUATION_KEYWORD_MAX_LENGTH) {
    throw new WinningValidationError(
      `keyword는 ${DREAM_SITUATION_KEYWORD_MAX_LENGTH}자를 초과할 수 없습니다.`
    );
  }

  const title = values.title.trim();
  if (title.length === 0) {
    throw new WinningValidationError("title을 입력해주세요.");
  }
  if (title.length > DREAM_SITUATION_TITLE_MAX_LENGTH) {
    throw new WinningValidationError(
      `title은 ${DREAM_SITUATION_TITLE_MAX_LENGTH}자를 초과할 수 없습니다.`
    );
  }

  const body = values.body.trim();
  if (body.length === 0) {
    throw new WinningValidationError("body를 입력해주세요.");
  }
  if (body.length > DREAM_SITUATION_BODY_MAX_LENGTH) {
    throw new WinningValidationError(
      `body는 ${DREAM_SITUATION_BODY_MAX_LENGTH}자를 초과할 수 없습니다.`
    );
  }

  const trimmedKeyMeaning = values.keyMeaning.trim();
  const keyMeaning = trimmedKeyMeaning === "" ? null : trimmedKeyMeaning;
  if (keyMeaning && keyMeaning.length > DREAM_SITUATION_KEY_MEANING_MAX_LENGTH) {
    throw new WinningValidationError(
      `keyMeaning은 ${DREAM_SITUATION_KEY_MEANING_MAX_LENGTH}자를 초과할 수 없습니다.`
    );
  }

  const parsedNumbers = parseNumbersText(values.numbersText);
  assertValidPartialNumberSet(parsedNumbers, "행운 숫자");
  const numbers = [...parsedNumbers].sort((a, b) => a - b);

  const displayOrder = Number(values.displayOrder);
  if (!Number.isInteger(displayOrder) || displayOrder < 0) {
    throw new WinningValidationError("displayOrder는 0 이상의 정수여야 합니다.");
  }

  return { keyword, title, body, keyMeaning, numbers, displayOrder };
}
