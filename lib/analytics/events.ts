// claude-code-luck-platform-launch-prompt.md §20이 정의한 11개 최소 이벤트와 각 이벤트의
// 최소 property를 타입으로 고정한다. 개인식별정보(닉네임, 생년월일, 꿈 일기 원문 등)는 어떤
// 이벤트에도 property로 두지 않는다 — 프롬프트가 명시적으로 금지했다.
export type ProductEventName =
  | "dream_search_submitted"
  | "dream_result_viewed"
  | "related_dream_clicked"
  | "dream_number_cta_clicked"
  | "numbers_generated"
  | "save_number_clicked"
  | "login_started"
  | "login_completed"
  | "number_saved"
  | "fortune_viewed"
  | "result_comparison_viewed";

export interface ProductEventPropertiesMap {
  dream_search_submitted: {
    query_length: number;
    result_count: number;
    location: "home" | "dream";
  };
  dream_result_viewed: {
    dream_id: number;
    dream_type: "parent" | "situation";
    referrer_type: "internal" | "search_engine" | "external_or_direct";
  };
  related_dream_clicked: {
    from_dream_id: number;
    to_dream_id: number;
  };
  dream_number_cta_clicked: {
    dream_id: number;
    dream_type: "parent" | "situation";
  };
  numbers_generated: {
    source: "general" | "dream";
    dream_number_count: number;
  };
  save_number_clicked: {
    authenticated: boolean;
    source: "general" | "dream";
  };
  login_started: {
    reason: string | null;
  };
  login_completed: {
    reason: string | null;
  };
  number_saved: {
    source: "general" | "dream";
    draw_id: string | null;
  };
  fortune_viewed: {
    is_return_visit: boolean;
  };
  result_comparison_viewed: {
    draw_id: string;
    saved_set_count: number;
  };
}
