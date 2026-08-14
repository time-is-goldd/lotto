import { createHash } from "crypto";

import { AVOID_ACTION_BY_TIER } from "@/lib/data/fortune/avoidAction";
import { LUCKY_COLORS } from "@/lib/data/fortune/luckyColor";
import { LUCKY_TIMES } from "@/lib/data/fortune/luckyTime";
import { MONEY_LUCK_BY_TIER } from "@/lib/data/fortune/moneyLuck";
import { OVERALL_FORTUNE_BY_TIER } from "@/lib/data/fortune/overallFortune";
import { RECOMMENDED_ACTION_BY_TIER } from "@/lib/data/fortune/recommendedAction";
import { MAX_LUCK_SCORE, MIN_LUCK_SCORE, tierFromLuckScore } from "@/lib/data/fortune/tiers";

// 오늘의 행운(Phase10-4A) 전용 결정론적 엔진. OpenAI/Claude 등 외부 AI API를 전혀 쓰지 않고
// (지시문 §36 명시 금지) (userId, birthDate, resultDate) 조합만으로 매번 같은 결과를 계산한다.
// lib/logic/generateNumbers.ts(Math.random() 기반, 기존 "번호 생성" 기능)는 이 파일에서
// import도, 수정도 하지 않는다 — 완전히 별도의 코드 경로다(지시문 §12).
export const LOTTO_MIN = 1;
export const LOTTO_MAX = 45;
export const LOTTO_COUNT = 6;
export const MIN_LUCKY_NUMBER_COUNT = 1;
export const MAX_LUCKY_NUMBER_COUNT = 3;

// Daily Fortune UX Polish Task §10~§12: 금전운을 숫자 지수로도 보여준다. 새 DB 컬럼/migration을
// 추가하지 않는다 — recommendedNumbers/luckyNumbers와 동일하게 (userId, birthDate, resultDate)
// 시드에서 항상 다시 계산 가능한 순수 파생값이라, lib/api/fortune.ts가 저장된 행에서 다시
// 계산해 제공한다(§5 참조).
export const MIN_MONEY_SCORE = 40;
export const MAX_MONEY_SCORE = 95;
// overall luckScore를 그대로 복사하지 않기 위해 최소 1~최대 15 사이의 편차를 준다(0 제외) —
// "지나친 불일치"를 막기 위해 편차 자체를 좁게 제한한다(§11 "심하게 모순되지 않도록").
const MONEY_SCORE_MAX_DEVIATION = 15;

export interface DailyFortune {
  zodiacSign: string;
  overallFortune: string;
  luckScore: number;
  moneyLuck: string;
  moneyLuckScore: number;
  actionGuide: string;
  thingsToAvoid: string;
  luckyColor: string;
  luckyTime: string;
  luckyNumbers: number[];
  recommendedNumbers: number[];
}

// sha256 다이제스트 앞 4바이트를 부호 없는 32비트 정수로 읽어 시드로 쓴다. crypto는 Node
// 표준 모듈이라 새 의존성을 추가하지 않는다.
function hashToSeed(input: string): number {
  return createHash("sha256").update(input).digest().readUInt32BE(0);
}

export function computeFortuneSeed(userId: string, birthDate: string, resultDate: string): number {
  return hashToSeed(`${userId}|${birthDate}|${resultDate}`);
}

// 같은 base seed에서 용도별(콘텐츠 선택/번호 생성 등)로 서로 다른 하위 시드를 뽑아낸다.
// 하위 시드끼리 같은 random stream을 공유하지 않게 해, 한쪽 로직의 draw 횟수 변화가
// 다른 쪽 결과에 영향을 주지 않도록 분리한다.
function deriveSeed(baseSeed: number, salt: string): number {
  return hashToSeed(`${baseSeed}:${salt}`);
}

// mulberry32 — 작고 잘 알려진 seeded PRNG 구현. Math.random()과 무관하게 항상 같은 시드에서
// 같은 난수열을 만든다.
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickIndex(random: () => number, length: number): number {
  return Math.floor(random() * length);
}

function pickFrom<T>(random: () => number, pool: readonly T[]): T {
  return pool[pickIndex(random, pool.length)];
}

// lib/logic/generateNumbers.ts의 rejection-sampling 아이디어를 seeded random에 그대로
// 적용한, 완전히 독립된 함수다. 지시문 §12가 요구하는 정확한 이름/시그니처
// (seed 하나를 받아 번호 배열을 돌려주는 순수 함수)를 그대로 따른다.
export function generateSeededNumbers(seed: number, count: number = LOTTO_COUNT): number[] {
  const random = createSeededRandom(seed);
  const numbers = new Set<number>();
  while (numbers.size < count) {
    numbers.add(LOTTO_MIN + pickIndex(random, LOTTO_MAX - LOTTO_MIN + 1));
  }
  return Array.from(numbers).sort((a, b) => a - b);
}

// 서양 별자리 — birthDate에만 의존하고 userId/resultDate와는 무관하다. 매일 바뀌지 않는
// 안정적인 개인 속성이라 별도 seed 없이 순수 계산으로 처리한다.
const ZODIAC_RANGES: Array<{ sign: string; endMonth: number; endDay: number }> = [
  { sign: "염소자리", endMonth: 1, endDay: 19 },
  { sign: "물병자리", endMonth: 2, endDay: 18 },
  { sign: "물고기자리", endMonth: 3, endDay: 20 },
  { sign: "양자리", endMonth: 4, endDay: 19 },
  { sign: "황소자리", endMonth: 5, endDay: 20 },
  { sign: "쌍둥이자리", endMonth: 6, endDay: 21 },
  { sign: "게자리", endMonth: 7, endDay: 22 },
  { sign: "사자자리", endMonth: 8, endDay: 22 },
  { sign: "처녀자리", endMonth: 9, endDay: 22 },
  { sign: "천칭자리", endMonth: 10, endDay: 23 },
  { sign: "전갈자리", endMonth: 11, endDay: 22 },
  { sign: "사수자리", endMonth: 12, endDay: 21 },
  { sign: "염소자리", endMonth: 12, endDay: 31 },
];

export function zodiacSignFromBirthDate(birthDate: string): string {
  const [, monthStr, dayStr] = birthDate.split("-");
  const month = Number(monthStr);
  const day = Number(dayStr);

  for (const range of ZODIAC_RANGES) {
    if (month < range.endMonth || (month === range.endMonth && day <= range.endDay)) {
      return range.sign;
    }
  }
  return "염소자리";
}

export function computeLuckScore(random: () => number): number {
  const span = MAX_LUCK_SCORE - MIN_LUCK_SCORE;
  return MIN_LUCK_SCORE + Math.floor(random() * (span + 1));
}

// overallScore ± 1~15(0 제외, 부호도 random으로 결정)를 [MIN_MONEY_SCORE, MAX_MONEY_SCORE]로
// 클램프한다. overall이 [MIN_LUCK_SCORE, MAX_LUCK_SCORE]=[55,92] 범위이고 편차가 ±15이므로,
// 클램프가 실제로 편차를 "늘리는" 방향으로 작용하는 경우는 없다 — 수학적으로
// |moneyScore - overallScore| <= 15가 항상 성립한다(단위 테스트로 검증).
export function computeMoneyLuckScore(overallScore: number, random: () => number): number {
  const magnitude = 1 + Math.floor(random() * MONEY_SCORE_MAX_DEVIATION); // 1..15
  const sign = random() < 0.5 ? -1 : 1;
  const raw = overallScore + magnitude * sign;
  return Math.min(MAX_MONEY_SCORE, Math.max(MIN_MONEY_SCORE, raw));
}

export function generateDailyFortune(
  userId: string,
  birthDate: string,
  resultDate: string
): DailyFortune {
  const seed = computeFortuneSeed(userId, birthDate, resultDate);

  const contentRandom = createSeededRandom(deriveSeed(seed, "content"));
  const luckScore = computeLuckScore(contentRandom);
  const tier = tierFromLuckScore(luckScore);

  const overallFortune = pickFrom(contentRandom, OVERALL_FORTUNE_BY_TIER[tier]);
  const moneyLuck = pickFrom(contentRandom, MONEY_LUCK_BY_TIER[tier]);
  const actionGuide = pickFrom(contentRandom, RECOMMENDED_ACTION_BY_TIER[tier]);
  const thingsToAvoid = pickFrom(contentRandom, AVOID_ACTION_BY_TIER[tier]);
  const luckyColor = pickFrom(contentRandom, LUCKY_COLORS);
  const luckyTime = pickFrom(contentRandom, LUCKY_TIMES);

  // 다른 콘텐츠 선택과 독립된 별도 하위 시드를 쓴다 — moneyLuck 문구 선택(위 pickFrom들)의
  // draw 횟수가 바뀌어도 moneyLuckScore 결과가 흔들리지 않도록 분리한다.
  const moneyScoreRandom = createSeededRandom(deriveSeed(seed, "money-score"));
  const moneyLuckScore = computeMoneyLuckScore(luckScore, moneyScoreRandom);

  const recommendedNumbers = generateSeededNumbers(deriveSeed(seed, "numbers"), LOTTO_COUNT);

  const luckyCountRandom = createSeededRandom(deriveSeed(seed, "lucky-count"));
  const luckyNumberSpan = MAX_LUCKY_NUMBER_COUNT - MIN_LUCKY_NUMBER_COUNT;
  const luckyNumberCount = MIN_LUCKY_NUMBER_COUNT + pickIndex(luckyCountRandom, luckyNumberSpan + 1);
  const luckyNumbers = generateSeededNumbers(deriveSeed(seed, "lucky-numbers"), luckyNumberCount);

  return {
    zodiacSign: zodiacSignFromBirthDate(birthDate),
    overallFortune,
    luckScore,
    moneyLuck,
    moneyLuckScore,
    actionGuide,
    thingsToAvoid,
    luckyColor,
    luckyTime,
    luckyNumbers,
    recommendedNumbers,
  };
}
