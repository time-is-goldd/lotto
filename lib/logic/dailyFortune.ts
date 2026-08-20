import { AVOID_ACTION_BY_TIER } from "@/lib/data/fortune/avoidAction";
import { LUCKY_COLORS } from "@/lib/data/fortune/luckyColor";
import { LUCKY_TIMES } from "@/lib/data/fortune/luckyTime";
import { MONEY_LUCK_BY_TIER } from "@/lib/data/fortune/moneyLuck";
import { OVERALL_FORTUNE_BY_TIER } from "@/lib/data/fortune/overallFortune";
import { RECOMMENDED_ACTION_BY_TIER } from "@/lib/data/fortune/recommendedAction";
import { MAX_LUCK_SCORE, MIN_LUCK_SCORE, tierFromLuckScore } from "@/lib/data/fortune/tiers";

// 오늘의 행운(Phase10-4A) 전용 결정론적 엔진. OpenAI/Claude 등 외부 AI API를 전혀 쓰지 않고
// (지시문 §36 명시 금지) DailyFortuneInput(birthDate/targetDate/gender?/birthTime?) 조합만으로
// 매번 같은 결과를 계산한다. userId를 시드에 포함하지 않는 이유는
// claude-code-luck-platform-fortune-domain-followup-prompt.md §7 참조 — 비회원(계정 없음)과
// 회원이 같은 입력을 넣으면 항상 같은 결과를 받아야 한다는 요구 때문이다.
// lib/logic/generateNumbers.ts(Math.random() 기반, 기존 "번호 생성" 기능)는 이 파일에서
// import도, 수정도 하지 않는다 — 완전히 별도의 코드 경로다(지시문 §12).
export const LOTTO_MIN = 1;
export const LOTTO_MAX = 45;
export const LOTTO_COUNT = 6;
export const MIN_LUCKY_NUMBER_COUNT = 1;
export const MAX_LUCKY_NUMBER_COUNT = 3;

// Daily Fortune UX Polish Task §10~§12: 금전운을 숫자 지수로도 보여준다. 새 DB 컬럼/migration을
// 추가하지 않는다 — recommendedNumbers/luckyNumbers와 동일하게 DailyFortuneInput 시드에서 항상
// 다시 계산 가능한 순수 파생값이라, lib/api/fortune.ts가 저장된 행에서 다시 계산해 제공한다
// (§5 참조).
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

// profiles.gender(0001_profiles.sql)의 DB enum 값을 그대로 재사용한다 — 이 파일이 별도로
// "male"/"female" 같은 값을 새로 발명하면 lib/api/fortune.ts가 매 호출마다 다시 매핑해야
// 한다. "N"(선택 안 함)은 gender가 없는 것과 동일하게 취급한다(§7 "선택하지 않은 값은 임의의
// 기본 성별로 위장하지 말고 명시적인 unknown 상태로 처리").
export type FortuneGender = "M" | "F" | "N";

// claude-code-luck-platform-fortune-domain-followup-prompt.md §7: "비회원과 회원이 같은
// 입력을 사용하면 기본 운세 결과도 일관되어야 한다"는 요구에 따라 userId를 시드에서 뺐다 —
// 이 입력 계약(birthDate/targetDate/gender?/birthTime?)만으로 결과가 완전히 결정된다. userId는
// fortune_results 행의 소유자를 표시하는 DB 컬럼일 뿐, 더 이상 결과 내용 자체에는 관여하지
// 않는다(lib/api/fortune.ts가 여전히 user_id로 저장은 하지만, 계산에는 전달하지 않는다).
export interface DailyFortuneInput {
  birthDate: string; // "YYYY-MM-DD"
  targetDate: string; // "YYYY-MM-DD" (KST 기준 결과 날짜)
  gender?: FortuneGender | null;
  birthTime?: string | null; // "HH:MM" 또는 "HH:MM:SS"(DB time 컬럼 형식 그대로 받아도 무방)
}

// claude-code-luck-platform-daily-fortune-number-demo-prompt.md §13: "가능하면 비회원 운세
// 계산은... 브라우저에서 실행해 raw 생년월일이 서버로 전송되지 않게 한다. 알고리즘에
// secret이 필요하지 않다면 server action을 억지로 거치지 않는다." 이 함수가 예전에 쓰던
// Node crypto.createHash("sha256")는 브라우저에 없다 — 이 파일을 Client Component
// (components/fortune/GuestFortuneForm.tsx)에서 그대로 import해 서버를 거치지 않고 계산할
// 수 있으려면 Node 전용 API에 의존하면 안 된다. FNV-1a는 암호학적 해시가 아니지만(이 값이
// 지키는 건 "예측 불가능성"이 아니라 "같은 입력→같은 출력"뿐이라 secret이 필요 없다), 32비트
// 정수 하나만 필요한 seeded PRNG 입력으로는 충분히 고르게 분산되고, Node/브라우저 양쪽에서
// 동기적으로(await 없이) 동일한 결과를 낸다.
function hashToSeed(input: string): number {
  let hash = 0x811c9dc5; // FNV-1a 32-bit offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return hash >>> 0;
}

// gender가 "M"/"F"가 아니면(null/undefined/"N") 개인화에 반영하지 않는다 — "N"과 미입력을
// 시드 레벨에서 구분하지 않는 것이 의도적이다(§7 "선택하지 않은 값은... 명시적인 unknown
// 상태로 처리" — 둘 다 "선택하지 않음"과 동일한 unknown 상태이지 서로 다른 기본값이 아니다).
function normalizeGenderForSeed(gender: FortuneGender | null | undefined): string {
  return gender === "M" || gender === "F" ? gender : "unknown";
}

// DB time 컬럼은 "HH:MM:SS"(초 포함)로 내려올 수 있고, 폼 입력은 "HH:MM"이다 — 앞 5자만
// 비교해 같은 시각을 입력한 게스트와 회원이 항상 같은 시드를 얻게 한다(§7 일관성 요구).
function normalizeBirthTimeForSeed(birthTime: string | null | undefined): string {
  return birthTime ? birthTime.slice(0, 5) : "unknown";
}

export function computeFortuneSeed(input: DailyFortuneInput): number {
  const genderPart = normalizeGenderForSeed(input.gender);
  const timePart = normalizeBirthTimeForSeed(input.birthTime);
  return hashToSeed(`${input.birthDate}|${genderPart}|${timePart}|${input.targetDate}`);
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

export function generateDailyFortune(input: DailyFortuneInput): DailyFortune {
  const seed = computeFortuneSeed(input);

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
    zodiacSign: zodiacSignFromBirthDate(input.birthDate),
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
