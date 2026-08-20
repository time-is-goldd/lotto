import { describe, expect, it, vi } from "vitest";

import { generateDailyFortune } from "@/lib/logic/dailyFortune";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@/lib/supabase/service";
import { getKstDateString } from "@/lib/utils/kstDate";

import { getDerivedFortuneFields, getOrCreateTodayFortune } from "./fortune";

vi.mock("@/lib/supabase/server");
vi.mock("@/lib/supabase/service");
vi.mock("@/lib/utils/kstDate");

const USER_ID = "user-a";
const BIRTH_DATE = "1995-03-14";
const RESULT_DATE = "2026-08-12";

function mockSelectChain(result: { data?: unknown; error?: unknown }) {
  const maybeSingle = vi.fn(() => Promise.resolve(result));
  const eq2 = vi.fn(() => ({ maybeSingle }));
  const eq1 = vi.fn(() => ({ eq: eq2 }));
  const select = vi.fn(() => ({ eq: eq1 }));
  const from = vi.fn(() => ({ select }));
  vi.mocked(createClient).mockResolvedValue({ from } as never);
  return { from, select, eq1, eq2, maybeSingle };
}

function mockInsertChain(result: { data?: unknown; error?: unknown }) {
  const single = vi.fn(() => Promise.resolve(result));
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert }));
  vi.mocked(createServiceClient).mockReturnValue({ from } as never);
  return { from, insert, select, single };
}

describe("getOrCreateTodayFortune", () => {
  it("returns the existing row with isNew:false when today's result already exists", async () => {
    vi.mocked(getKstDateString).mockReturnValue(RESULT_DATE);
    const existingRow = { id: 1, user_id: USER_ID, result_date: RESULT_DATE };
    const { eq1, eq2 } = mockSelectChain({ data: existingRow, error: null });
    const insertChain = mockInsertChain({ data: null, error: null });

    const result = await getOrCreateTodayFortune(USER_ID, BIRTH_DATE);

    expect(eq1).toHaveBeenCalledWith("user_id", USER_ID);
    expect(eq2).toHaveBeenCalledWith("result_date", RESULT_DATE);
    expect(result).toEqual({ entry: existingRow, isNew: false });
    expect(insertChain.from).not.toHaveBeenCalled();
  });

  it("creates a new row with isNew:true when no result exists for today, using service_role", async () => {
    vi.mocked(getKstDateString).mockReturnValue(RESULT_DATE);
    mockSelectChain({ data: null, error: null });
    const createdRow = { id: 2, user_id: USER_ID, result_date: RESULT_DATE };
    const { from: serviceFrom, insert } = mockInsertChain({ data: createdRow, error: null });

    const result = await getOrCreateTodayFortune(USER_ID, BIRTH_DATE);

    expect(serviceFrom).toHaveBeenCalledWith("fortune_results");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_ID,
        input_birth_date: BIRTH_DATE,
        result_date: RESULT_DATE,
      })
    );
    expect(result).toEqual({ entry: createdRow, isNew: true });
  });

  it("computes deterministic fields from generateDailyFortune when inserting", async () => {
    vi.mocked(getKstDateString).mockReturnValue(RESULT_DATE);
    mockSelectChain({ data: null, error: null });
    const { insert } = mockInsertChain({ data: { id: 3 }, error: null });

    await getOrCreateTodayFortune(USER_ID, BIRTH_DATE);

    const expected = generateDailyFortune({ birthDate: BIRTH_DATE, targetDate: RESULT_DATE });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        overall_fortune: expected.overallFortune,
        luck_score: expected.luckScore,
        recommended_numbers: expected.recommendedNumbers,
        money_luck: expected.moneyLuck,
        action_guide: expected.actionGuide,
        things_to_avoid: expected.thingsToAvoid,
        lucky_color: expected.luckyColor,
        lucky_time: expected.luckyTime,
        zodiac_sign: expected.zodiacSign,
      })
    );
  });

  it("on a UNIQUE(user_id, result_date) race (23505), re-fetches and returns the winner's row instead of throwing", async () => {
    vi.mocked(getKstDateString).mockReturnValue(RESULT_DATE);
    const winnerRow = { id: 4, user_id: USER_ID, result_date: RESULT_DATE };

    // 1st select (초기 조회): 아직 없음 → 2nd select (충돌 후 재조회): 다른 요청이 만든 행 발견
    const maybeSingle = vi.fn().mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: winnerRow, error: null });
    const eq2 = vi.fn(() => ({ maybeSingle }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    const from = vi.fn(() => ({ select }));
    vi.mocked(createClient).mockResolvedValue({ from } as never);

    mockInsertChain({ data: null, error: { code: "23505", message: "duplicate key" } });

    const result = await getOrCreateTodayFortune(USER_ID, BIRTH_DATE);

    expect(result).toEqual({ entry: winnerRow, isNew: false });
    expect(maybeSingle).toHaveBeenCalledTimes(2);
  });

  it("throws on a non-unique-violation insert error", async () => {
    vi.mocked(getKstDateString).mockReturnValue(RESULT_DATE);
    mockSelectChain({ data: null, error: null });
    mockInsertChain({ data: null, error: { code: "42501", message: "permission denied" } });

    await expect(getOrCreateTodayFortune(USER_ID, BIRTH_DATE)).rejects.toMatchObject({
      code: "42501",
    });
  });

  it("throws when the initial select itself errors", async () => {
    vi.mocked(getKstDateString).mockReturnValue(RESULT_DATE);
    mockSelectChain({ data: null, error: new Error("select failed") });

    await expect(getOrCreateTodayFortune(USER_ID, BIRTH_DATE)).rejects.toThrow("select failed");
  });
});

describe("getDerivedFortuneFields", () => {
  it("returns the same luckyNumbers/moneyLuckScore that generateDailyFortune computes for the same inputs", () => {
    const entry = { result_date: RESULT_DATE } as never;
    const expected = generateDailyFortune({ birthDate: BIRTH_DATE, targetDate: RESULT_DATE });

    expect(getDerivedFortuneFields(entry, BIRTH_DATE)).toEqual({
      luckyNumbers: expected.luckyNumbers,
      moneyLuckScore: expected.moneyLuckScore,
    });
  });

  it("is deterministic across repeated calls", () => {
    const entry = { result_date: RESULT_DATE } as never;

    expect(getDerivedFortuneFields(entry, BIRTH_DATE)).toEqual(
      getDerivedFortuneFields(entry, BIRTH_DATE)
    );
  });

  it("does not depend on entry.input_birth_date (parameter takes precedence)", () => {
    const entry = { result_date: RESULT_DATE, input_birth_date: "1900-01-01" } as never;
    const expected = generateDailyFortune({ birthDate: BIRTH_DATE, targetDate: RESULT_DATE });

    expect(getDerivedFortuneFields(entry, BIRTH_DATE)).toEqual({
      luckyNumbers: expected.luckyNumbers,
      moneyLuckScore: expected.moneyLuckScore,
    });
  });

  it("gender/birthTime shift the derived fields when provided", () => {
    const entry = { result_date: RESULT_DATE } as never;
    const withoutPersonalization = getDerivedFortuneFields(entry, BIRTH_DATE);
    const withPersonalization = getDerivedFortuneFields(entry, BIRTH_DATE, "F", "09:15");

    expect(withPersonalization).not.toEqual(withoutPersonalization);
  });
});
