// Daily Fortune UX Polish Task §6: 12개 별자리 → 유니코드 점성술 기호 매핑. 새 이미지 CDN/
// 아이콘 라이브러리를 추가하지 않는다 — 유니코드 문자는 새 자산이 아니라 텍스트다. 키는
// lib/logic/dailyFortune.ts의 zodiacSignFromBirthDate()가 실제로 반환하는 문자열과
// 정확히 같아야 한다(그 함수가 예외 없이 12개 중 하나만 반환하므로 이 맵은 사실상
// 전수 커버되지만, 방어적으로 FALLBACK_ZODIAC_SYMBOL도 함께 둔다).
export const ZODIAC_SYMBOLS: Record<string, string> = {
  양자리: "♈",
  황소자리: "♉",
  쌍둥이자리: "♊",
  게자리: "♋",
  사자자리: "♌",
  처녀자리: "♍",
  천칭자리: "♎",
  전갈자리: "♏",
  사수자리: "♐",
  염소자리: "♑",
  물병자리: "♒",
  물고기자리: "♓",
};

export const FALLBACK_ZODIAC_SYMBOL = "✨";

export function getZodiacSymbol(zodiacSign: string | null): string {
  if (!zodiacSign) {
    return FALLBACK_ZODIAC_SYMBOL;
  }
  return ZODIAC_SYMBOLS[zodiacSign] ?? FALLBACK_ZODIAC_SYMBOL;
}
