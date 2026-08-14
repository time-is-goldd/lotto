// Daily Fortune UX Polish Task §14~§16: lucky color 이름(lib/data/fortune/luckyColor.ts의
// LUCKY_COLORS 18개) → 실제 CSS 색상값 매핑. 이 파일은 Fortune 결과 표시 전용이다 —
// design system(app/globals.css의 @theme 토큰)에 새 전역 색상 토큰을 추가하지 않는다(§15
// "design system 전체에 새 global token을 대량 추가하지 않는다. Fortune display 전용
// mapping으로 제한한다").
export const LUCKY_COLOR_SWATCHES: Record<string, string> = {
  네이비: "#1b2a4a",
  라벤더: "#b7a4d6",
  민트: "#8fd9c4",
  코랄: "#ff7f6b",
  베이지: "#e8dcc8",
  머스터드: "#d9a441",
  틸: "#2f8f8f",
  버건디: "#7b1e3a",
  라일락: "#c8a2d6",
  세이지그린: "#9caf88",
  피치: "#ffcba4",
  스카이블루: "#87ceeb",
  카키: "#8a7f5c",
  샌드베이지: "#e0cba8",
  딥그린: "#1f4d3a",
  아이보리: "#f5f0e6",
  차콜: "#3a3a3a",
  로즈핑크: "#e8a1b0",
};

// §16: 예상하지 못한 luckyColor 문자열이 들어와도 UI가 깨지지 않게 하는 중립 fallback.
export const FALLBACK_COLOR_SWATCH = "#9aa0a6";

export function getColorSwatch(colorName: string | null): string {
  if (!colorName) {
    return FALLBACK_COLOR_SWATCH;
  }
  return LUCKY_COLOR_SWATCHES[colorName] ?? FALLBACK_COLOR_SWATCH;
}
