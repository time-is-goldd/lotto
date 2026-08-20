import type { GuestDailyCombo } from "@/lib/storage/guestDailyNumbersStore";

// components/generate/NumberGenerator.tsx가 쓰는 순수 로직만 분리한 파일이다. 이 프로젝트의
// vitest 설정(vitest.config.mts, environment: "node")은 jsdom/React Testing Library가
// 없어 컴포넌트를 렌더링해서 테스트할 수 없다 — 이번 Task에서 그 인프라를 새로 도입하지
// 않고, React와 무관한 이 순수 함수들만 분리해 실제로 테스트 가능하게 만들었다.
//
// claude-code-luck-platform-home-brand-daily-numbers-prompt.md §3.5: "슬롯 회전, 과도한
// bounce, confetti 금지" — 이전(GENERATE_HOME_UX_FIX) 버전이 갖고 있던 "decoy 숫자가
// 계속 바뀌는 셔플 단계"는 정확히 이 금지 항목(슬롯머신 릴)이라 이번에 완전히 제거했다.
// 이제 연출은 "번호가 하나씩 순서대로 나타나는" 단일 단계뿐이다(§3.5 "전체 700ms 안팎,
// opacity + 작은 translate/scale 정도").

export type GenerateAuthState = "anonymous" | "profile-pending" | "ready";

const NUMBERS_PER_GAME = 6;
// 6개 × 115ms ≈ 690ms — §3.5 "전체 700ms 안팎" 요구를 만족한다.
export const REVEAL_STEP_MS = 115;

export function getRevealDurationMs(): number {
  return REVEAL_STEP_MS * NUMBERS_PER_GAME;
}

// 6개 공을 서로 다른 시각에 하나씩 확정 공개하기 위한 지연 목록. NumberGenerator.tsx가 이
// 배열의 인덱스별 값으로 개별 setTimeout을 예약한다.
export function getRevealDelaysMs(count: number): number[] {
  return Array.from({ length: count }, (_, index) => REVEAL_STEP_MS * (index + 1));
}

// Phase7-3 계약(docs/PHASE7_DREAM_NUMBER_INTEGRATION_REPORT.md). app/dream/[keyword]/page.tsx의
// CTA가 /generate?dream=<id>로 전달하는 최소 식별 정보.
export interface DreamContext {
  id: number;
  keyword: string;
  dreamNumbers: number[];
}

// 오늘의 세 조합 중 이미 완성된 한 조합. 회원은 app/generate/page.tsx가 DB에서 조회해
// 내려주고, 비회원은 lib/storage/guestDailyNumbersStore.ts에서 클라이언트가 직접 읽는다 —
// 두 출처 모두 이 하나의 shape으로 수렴시켜 NumberGenerator/DailyComboRow가 출처를 몰라도
// 되게 한다.
export interface DailyComboView {
  slotIndex: number;
  numbers: number[];
  dreamNumbers: number[];
}

// POST /api/numbers(기존 "저장 번호") 요청 바디. dreamContext를 생략하면 기존과 완전히
// 동일하게 동작한다(generation_method: 'auto', related_dream_id 없음).
export function buildSaveRequestPayload(
  numbers: number[],
  dreamContext?: DreamContext | null
): { numbers: number[]; generationMethod?: "dream"; relatedDreamId?: number } {
  if (!dreamContext) {
    return { numbers };
  }

  return { numbers, generationMethod: "dream", relatedDreamId: dreamContext.id };
}

// POST /api/numbers/daily(오늘의 세 조합) 요청 바디. dreamNumbers는 numbers의 부분집합만
// 담아야 한다는 서버 계약(lib/api/dailyNumbers.ts)을 클라이언트에서 먼저 맞춰 보낸다 —
// 서버가 다시 검증하므로 여기서는 형식만 맞춘다.
export function buildDailyGeneratePayload(
  numbers: number[],
  dreamNumbers: number[],
  dreamContext?: DreamContext | null
): {
  numbers: number[];
  dreamNumbers: number[];
  generationMethod?: "dream";
  relatedDreamId?: number;
} {
  if (!dreamContext) {
    return { numbers, dreamNumbers: [] };
  }

  return { numbers, dreamNumbers, generationMethod: "dream", relatedDreamId: dreamContext.id };
}

// 비회원 결과를 lib/storage/guestDailyNumbersStore.ts에 그대로 쓸 수 있는 모양으로 만든다 —
// "무엇을 저장할지"(이 함수)와 "어떻게 저장할지"(그 파일의 safeSetItem 등)를 분리한다.
export function toGuestDailyCombo(
  numbers: number[],
  dreamNumbers: number[],
  dreamContext: DreamContext | null | undefined,
  generatedAt: string
): GuestDailyCombo {
  return {
    numbers,
    source: dreamContext ? "dream" : "general",
    dreamNumbers: dreamContext ? dreamNumbers : [],
    relatedDreamId: dreamContext ? dreamContext.id : null,
    generatedAt,
  };
}

// claude-code-luck-platform-home-brand-daily-numbers-prompt.md §9.5: "생성됐다는 이유만으로
// 사용자의 저장 목록을 오염시키지 않는다" — authState가 "ready"(로그인 + profile 있음)일
// 때만 각 결과 행에 "다이어리에 저장" 버튼을 노출한다. 이전 버전은 이 조건을 자동 저장
// useEffect의 게이트로 썼지만, 지금은 명시적 클릭 버튼의 노출 여부를 결정하는 게이트다 —
// "profile-pending을 anonymous와 동일하게 취급"하는 이유(FK violation)는 그대로 유지된다
// (docs/PHASE5_PRE_IMPLEMENTATION_AUDIT.md §5).
export function canSaveNumbers(authState: GenerateAuthState): boolean {
  return authState === "ready";
}

// 동일한 번호 배열에 대해 저장을 중복 시도하지 않기 위한 키.
export function toSaveKey(numbers: number[]): string {
  return numbers.join(",");
}
