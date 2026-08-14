import { CONTENT_TITLE_MAX_LENGTH } from "@/lib/constants";
import { WinningValidationError } from "@/lib/logic/matchNumbers";

// components/admin/dreamFormValidation.ts(Phase9-3)와 동일한 이유로 분리한 순수 함수 파일 —
// jsdom/RTL이 없어 컴포넌트 렌더링 테스트가 불가능하므로 React와 무관한 검증 로직만 여기 모은다.
// lib/api/admin/content.ts는 service_role(lib/supabase/service.ts)을 top-level에서 import하므로
// Client Component 번들에 넣지 않는다 — type 값은 "faq"/"guide" 리터럴로 이 파일에 독립적으로
// 정의한다(lib/api/admin/content.ts를 값으로 import하지 않음). 에러 클래스는
// dreamFormValidation.ts와 동일하게 lib/logic/matchNumbers.ts의 WinningValidationError를 그대로
// 재사용한다(새 클라이언트 검증 에러 클래스를 만들지 않음).
export type ContentEntryType = "faq" | "guide";

export interface ContentFormValues {
  title: string;
  body: string;
  displayOrder: string; // 빈 문자열 = 0으로 취급
}

export interface ContentSubmitPayload {
  type: ContentEntryType;
  title: string;
  body: string;
  display_order: number;
}

// 클라이언트 검증은 UX 편의일 뿐 보안 경계가 아니다 — 최종 검증은 여전히
// POST/PUT /api/admin/content(lib/api/admin/content.ts)가 담당한다.
export function validateContentForm(type: ContentEntryType, values: ContentFormValues): ContentSubmitPayload {
  const title = values.title.trim();
  if (title.length === 0) {
    throw new WinningValidationError("제목을 입력해주세요.");
  }
  if (title.length > CONTENT_TITLE_MAX_LENGTH) {
    throw new WinningValidationError(`제목은 ${CONTENT_TITLE_MAX_LENGTH}자를 초과할 수 없습니다.`);
  }

  const body = values.body.trim();
  if (body.length === 0) {
    throw new WinningValidationError("본문을 입력해주세요.");
  }

  const trimmedOrder = values.displayOrder.trim();
  const display_order = trimmedOrder === "" ? 0 : Number(trimmedOrder);
  if (!Number.isInteger(display_order) || display_order < 0) {
    throw new WinningValidationError("표시 순서는 0 이상의 정수여야 합니다.");
  }

  return { type, title, body, display_order };
}
