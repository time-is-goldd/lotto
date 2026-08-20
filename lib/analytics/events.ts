// claude-code-luck-platform-launch-prompt.md §20이 정의한 11개 최소 이벤트와 각 이벤트의
// 최소 property를 타입으로 고정한다. 개인식별정보(닉네임, 생년월일, 꿈 일기 원문 등)는 어떤
// 이벤트에도 property로 두지 않는다 — 프롬프트가 명시적으로 금지했다.
// claude-code-luck-platform-fortune-domain-followup-prompt.md §21이 fortune_viewed를 더
// 세분화한 6개 이벤트(fortune_form_viewed~fortune_profile_saved)로 대체 제안했다 — 기존
// fortune_viewed는 한 번도 연결된 적이 없어(docs/analytics.md 이전 기록) 삭제하지 않고
// 그대로 두되, 새 6개를 별도로 추가한다.
//
// claude-code-luck-platform-daily-fortune-number-demo-prompt.md §6: "결과를 다시 보는 행위를
// 신규 생성으로 집계하지 않는다"는 요구가 fortune_reveal_started/fortune_revealed(단순
// "애니메이션이 재생됐는지")보다 더 구체적이라, 그 두 이벤트를 대체하는
// fortune_generation_started/fortune_generated/fortune_result_reopened/fortune_limit_hit
// 4개로 바꿨다 — 같은 사용자 행동(공개 버튼 클릭/폼 제출)을 두 세트가 동시에 추적하면
// "생성"과 "재확인"이 이벤트 이름 두 벌로 흩어져 오히려 집계를 헷갈리게 만든다. §16의
// generate_page_viewed(번호 생성 페이지 조회, 생성과 분리)도 함께 추가한다.
export type ProductEventName =
  | "dream_search_submitted"
  | "dream_result_viewed"
  | "related_dream_clicked"
  | "dream_number_cta_clicked"
  | "numbers_generated"
  | "numbers_generation_started"
  | "numbers_limit_reached"
  | "home_generate_link_clicked"
  | "save_number_clicked"
  | "login_started"
  | "login_completed"
  | "number_saved"
  | "fortune_viewed"
  | "result_comparison_viewed"
  | "fortune_form_viewed"
  | "fortune_form_submitted"
  | "fortune_login_cta_clicked"
  | "fortune_profile_saved"
  | "fortune_generation_started"
  | "fortune_generated"
  | "fortune_result_reopened"
  | "fortune_limit_hit"
  | "generate_page_viewed";

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
  // claude-code-luck-platform-home-brand-daily-numbers-prompt.md §13: "실제 생성 요청" —
  // 사용자가 생성 버튼을 눌러 그 요청이 서버에 실제로 도달한 시점(연출 애니메이션 시작 전)에
  // 한 번만 기록한다. numbers_generated(§16 reveal 완료)와 짝을 이뤄 "몇 명이 시작했는데 몇
  // 명이 실제로 결과를 봤는지"를 구분할 수 있게 한다.
  numbers_generation_started: {
    source: "general" | "dream";
    auth_state: "anonymous" | "profile-pending" | "ready";
    slot_index: number;
  };
  // §13 "일일 3개 상태 도달/4번째 시도 차단" — 3번째 조합이 막 완성돼 한도에 도달한 순간과,
  // 이미 3/3인 상태에서 새 생성을 다시 시도한 순간(직접 진입 CTA 없음, 꿈 CTA 자동 생성 시도
  // 등) 양쪽 모두 이 이벤트로 기록한다.
  numbers_limit_reached: {
    source: "general" | "dream";
    auth_state: "anonymous" | "profile-pending" | "ready";
  };
  // §5.3 Home Secondary link("꿈 없이 바로 번호 만들기 →") 클릭 — §13 "기존 CTA 이벤트 또는
  // home_generate_link_clicked". Home에는 이 링크를 위한 기존 전용 이벤트가 없어 새로 추가했다.
  home_generate_link_clicked: {
    source: "home_secondary";
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
  fortune_form_viewed: {
    auth_state: "anonymous" | "profile-pending";
  };
  fortune_form_submitted: {
    auth_state: "anonymous" | "profile-pending";
    has_gender: boolean;
    has_birth_time: boolean;
  };
  fortune_login_cta_clicked: {
    location: string;
  };
  fortune_profile_saved: {
    has_gender: boolean;
    has_birth_time: boolean;
  };
  fortune_generation_started: {
    auth_state: "anonymous" | "profile-pending" | "member";
  };
  fortune_generated: {
    auth_state: "anonymous" | "profile-pending" | "member";
  };
  fortune_result_reopened: {
    auth_state: "anonymous" | "profile-pending" | "member";
  };
  // 회원은 하드 unique constraint라 "제한에 걸린다"는 개념이 없다(항상 기존 행을 그대로
  // 반환) — 이 이벤트는 비회원이 localStorage에 이미 있는 프로필로 다시 제출해 새 계산을
  // 건너뛴 순간에만 의미가 있다.
  fortune_limit_hit: {
    auth_state: "anonymous" | "profile-pending";
  };
  generate_page_viewed: {
    source: "direct" | "dream";
  };
}
