import type { DailyFortune } from "@/lib/logic/dailyFortune";
import type { DreamJournalEntry, DrawEntry, UserNumberEntry } from "@/lib/types/journal";

// claude-code-luck-platform-daily-fortune-number-demo-prompt.md §18: "모든 데이터는 코드에
// 정의된 명백한 synthetic fixture다. 실명, 실제 생년월일, 이메일, 실제 번호 기록 등
// 개인정보를 넣지 않는다." 이 파일이 /demo/* 전체가 쓰는 유일한 데이터 원천이다 — Supabase를
// 전혀 import하지 않는다(app/demo/**는 lib/api/**, lib/auth/session을 import하지 않는다는
// 것을 lib/demo/noRealDataAccess.test.ts가 정적으로 확인한다).

export const DEMO_RESULT_DATE = "2026-08-19";

export const DEMO_FORTUNE_RESULT: DailyFortune & { resultDate: string } = {
  resultDate: DEMO_RESULT_DATE,
  zodiacSign: "물병자리",
  overallFortune: "차분히 준비해온 일이 하나씩 자리를 잡아가는 흐름이에요.",
  luckScore: 78,
  moneyLuck: "작은 지출을 아끼면 뜻밖의 여유가 생겨요.",
  moneyLuckScore: 71,
  actionGuide: "미뤄둔 연락을 오늘 한번 해보세요.",
  thingsToAvoid: "성급한 결정은 잠시 미뤄두는 게 좋아요.",
  luckyColor: "네이비",
  luckyTime: "오후 2시~4시",
  luckyNumbers: [7, 18, 29],
  recommendedNumbers: [3, 12, 19, 24, 31, 42],
};

// user_numbers.user_id는 실제로는 auth.users(id) FK다 — 데모에서는 어떤 실제 계정도
// 가리키지 않는 명백히 가짜인 UUID를 쓴다(전부 0으로 채운 nil UUID + 접미사).
const DEMO_USER_ID = "00000000-0000-0000-0000-000000000000";

export const DEMO_DRAW: DrawEntry = {
  id: 1,
  round: 1177,
  numbers: [3, 12, 19, 24, 31, 45],
  bonus_number: 8,
  first_prize_amount: 2_000_000_000,
  first_prize_count: 12,
  source: "demo-fixture",
  created_at: "2026-08-15T09:00:00Z",
};

// §20 /demo/results: "일치 없음과 일부 숫자 일치 상태" — DEMO_DRAW.numbers=[3,12,19,24,31,45]
// 기준으로 partial은 3개(12,19,24) 일치, noMatch는 하나도 겹치지 않게 구성했다.
export const DEMO_USER_NUMBERS_WAITING: UserNumberEntry = {
  id: 1,
  user_id: DEMO_USER_ID,
  numbers: [2, 15, 22, 28, 33, 40],
  generation_method: "auto",
  related_dream_id: null,
  related_fortune_id: null,
  session_id: null,
  target_round: 1178,
  is_purchased: false,
  purchase_amount: 0,
  memo: null,
  is_public: false,
  recommendation_reason: null,
  match_count: null,
  win_rank: null,
  checked_at: null,
  created_at: "2026-08-18T10:00:00Z",
};

export const DEMO_USER_NUMBERS_NO_MATCH: UserNumberEntry = {
  ...DEMO_USER_NUMBERS_WAITING,
  id: 2,
  target_round: DEMO_DRAW.round,
  numbers: [1, 5, 9, 14, 20, 44],
  match_count: 0,
  win_rank: null,
  checked_at: "2026-08-15T21:10:00Z",
};

export const DEMO_USER_NUMBERS_PARTIAL_MATCH: UserNumberEntry = {
  ...DEMO_USER_NUMBERS_WAITING,
  id: 3,
  target_round: DEMO_DRAW.round,
  numbers: [12, 19, 24, 27, 36, 41],
  match_count: 3,
  win_rank: null,
  checked_at: "2026-08-15T21:10:00Z",
};

// /demo/journal populated 상태 — 저장된 번호 여러 건 + 꿈 기록 + 오늘의 행운을 한 화면에서
// 보여준다(§20 "생성 번호, 꿈 기록, 오늘의 운세가 있는 populated 상태").
export const DEMO_JOURNAL_USER_NUMBERS: UserNumberEntry[] = [
  {
    ...DEMO_USER_NUMBERS_WAITING,
    id: 10,
    generation_method: "dream",
    related_dream_id: 1,
    target_round: null,
    created_at: "2026-08-19T08:30:00Z",
  },
  DEMO_USER_NUMBERS_PARTIAL_MATCH,
  DEMO_USER_NUMBERS_NO_MATCH,
];

export const DEMO_DREAM_JOURNAL_ENTRIES: DreamJournalEntry[] = [
  {
    id: 1,
    user_id: DEMO_USER_ID,
    entry_date: "2026-08-19",
    dream_text: "높은 산을 오르다가 정상에서 커다란 무지개를 본 꿈을 꿨다.",
    linked_dream_id: null,
    created_at: "2026-08-19T08:00:00Z",
  },
  {
    id: 2,
    user_id: DEMO_USER_ID,
    entry_date: "2026-08-17",
    dream_text: "돼지 여러 마리가 마당에 들어오는 꿈을 꿨다.",
    linked_dream_id: null,
    created_at: "2026-08-17T07:40:00Z",
  },
];
