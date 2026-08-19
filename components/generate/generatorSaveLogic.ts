// components/generate/NumberGenerator.tsx가 쓰는 순수 로직만 분리한 파일이다. 이 프로젝트의
// vitest 설정(vitest.config.mts, environment: "node")은 jsdom/React Testing Library가
// 없어 컴포넌트를 렌더링해서 테스트할 수 없다 — 이번 Task에서 그 인프라를 새로 도입하지
// 않고(지시문 §13 "억지로 새로운 테스트 프레임워크를 도입하지 않는다"), React와 무관한 이
// 순수 함수들만 분리해 실제로 테스트 가능하게 만들었다. 나머지(상태/이펙트 오케스트레이션)는
// docs/PHASE5_GENERATE_UI_REPORT.md §13에 코드 리뷰 근거로 기록했다.

export type GenerateAuthState = "anonymous" | "profile-pending" | "ready";

// Product Expansion PART A(docs/PRODUCT_EXPANSION_PLAN.md §1): 번호 생성 연출 타이밍 상수.
// generateNumbers() 자체는 건드리지 않는다 — 여기는 "언제/얼마나" 연출을 보여줄지에 대한
// 순수 시간 계산만 담당한다. 셔플 단계(decoy 숫자가 바뀌는 연출) 뒤에 공개 단계(실제 번호가
// 하나씩 나타나는 연출)가 이어지는 2단계 구성이다.
export const SHUFFLE_INTERVAL_MS = 90;
const FIRST_SHUFFLE_DURATION_MS = 1000;
const REGENERATE_SHUFFLE_DURATION_MS = 500;
export const REVEAL_STEP_MS = 150;
const NUMBERS_PER_GAME = 6; // lib/logic/generateNumbers.ts의 NUMBERS_PER_GAME과 동일한 상수값 —
// 이 파일은 React 없는 순수 로직 전용이라 그 파일을 다시 import하지 않고 동일한 값만 별도로
// 둔다(값 자체는 로또 규칙상 불변이라 중복이 아니라 이 파일의 독립성을 지키는 선택).

// 첫 생성은 약 2초, 다시 생성은 약 1~1.5초를 목표로 한다(지시문 §A-2) — 재생성이 지나치게
// 답답하지 않도록 셔플 구간만 짧게 줄이고, 공개 구간(REVEAL_STEP_MS × 6개)은 동일하게 유지해
// 번호가 하나씩 나타나는 리듬 자체는 두 경우가 같게 느껴지도록 한다.
export function getShuffleDurationMs(isFirst: boolean): number {
  return isFirst ? FIRST_SHUFFLE_DURATION_MS : REGENERATE_SHUFFLE_DURATION_MS;
}

export function getRevealDurationMs(): number {
  return REVEAL_STEP_MS * NUMBERS_PER_GAME;
}

export function getTotalAnimationDurationMs(isFirst: boolean): number {
  return getShuffleDurationMs(isFirst) + getRevealDurationMs();
}

// GENERATE_HOME_UX_FIX Task: 6개 공을 서로 다른 시각에 하나씩 확정 공개하기 위한 지연
// 목록이다(§D "왼쪽부터 하나씩 확정"). NumberGenerator.tsx가 이 배열의 인덱스별 값으로
// 개별 setTimeout을 예약한다 — 값 자체(간격이 REVEAL_STEP_MS로 일정하고 단조 증가하는지)를
// React/DOM 없이 순수하게 테스트할 수 있도록 컴포넌트 밖으로 뺐다.
export function getRevealDelaysMs(count: number): number[] {
  return Array.from({ length: count }, (_, index) => REVEAL_STEP_MS * (index + 1));
}

// Phase7-3 계약(docs/PHASE7_DREAM_NUMBER_INTEGRATION_REPORT.md). app/dream/[keyword]/page.tsx의
// CTA가 /generate?dream=<id>로 전달하는 최소 식별 정보 — dream 콘텐츠 전체가 아니라 화면
// 표시(§7 "꿈 기반 생성임을 표시")와 저장 요청 구성에 필요한 값만 담는다.
//
// dreamNumbers는 claude-code-luck-platform-launch-prompt.md §12가 추가한 필드다 —
// app/generate/page.tsx가 lib/logic/dreamNumbers.ts로 이미 검증·병합한 "꿈에서 가져온 숫자"
// 부분집합(0~6개, initialNumbers의 부분집합)이다. 빈 배열이면 이 dream에 연결된 유효한 숫자가
// 없었다는 뜻이라, NumberGenerator가 "꿈과 연결된 번호" 문구/강조색을 표시하지 않는다.
export interface DreamContext {
  id: number;
  keyword: string;
  dreamNumbers: number[];
}

// POST /api/numbers의 요청 바디는 기존에는 numbers 하나뿐이었다(docs/PHASE5_NUMBERS_API_REPORT.md).
// dreamContext를 생략하면(기존 모든 호출부가 그렇듯) 여전히 numbers 하나뿐인 객체를 반환해
// user_id 등 다른 필드를 절대 포함하지 않는다는 기존 계약을 그대로 지킨다. dreamContext가
// 있을 때만 generationMethod/relatedDreamId를 추가한다 — 서버(lib/api/numbers.ts의
// parseDreamContext)가 이 값을 다시 한번 독립적으로 검증하므로, 여기서는 형식을 맞추는
// 역할만 한다(클라이언트 값은 최종적으로 신뢰되지 않음).
export function buildSaveRequestPayload(
  numbers: number[],
  dreamContext?: DreamContext | null
): { numbers: number[]; generationMethod?: "dream"; relatedDreamId?: number } {
  if (!dreamContext) {
    return { numbers };
  }

  return { numbers, generationMethod: "dream", relatedDreamId: dreamContext.id };
}

// authState가 "ready"(로그인 + profile 있음)일 때만 자동 저장을 시도한다. "profile-pending"을
// "anonymous"와 동일하게 저장 시도 안 함으로 처리하는 이유: user_numbers.user_id가 profiles를
// FK로 참조해, profile이 없는 계정은 INSERT 자체가 23503(FK violation)으로 실패함을
// docs/PHASE5_PRE_IMPLEMENTATION_AUDIT.md §5에서 실측 확인했다 — 실패가 확정적인 요청을
// 애초에 보내지 않는다.
export function canAutoSave(authState: GenerateAuthState): boolean {
  return authState === "ready";
}

// 동일한 번호 배열에 대해 저장을 중복 시도하지 않기 위한 키. React Strict Mode가 effect를
// 두 번 실행해도(마운트→클린업→재마운트) 이 키가 같으면 두 번째 시도를 건너뛴다
// (docs/PHASE5_GENERATE_UI_REPORT.md §7).
export function toSaveKey(numbers: number[]): string {
  return numbers.join(",");
}
