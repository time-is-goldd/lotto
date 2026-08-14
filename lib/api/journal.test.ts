import { describe, expect, it, vi } from "vitest";

import { getDreamById } from "@/lib/api/dreams";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

import {
  DEFAULT_LIST_LIMIT,
  JournalValidationError,
  createDreamJournalEntry,
  getDiarySummary,
  getDrawsByRounds,
  getRecentDreamJournalEntries,
  getRecentFortuneResults,
  getRecentUserNumbers,
  parseDreamJournalInput,
} from "./journal";

vi.mock("@/lib/auth/session");
vi.mock("@/lib/supabase/server");
vi.mock("@/lib/api/dreams");

// 실제 Supabase 쿼리 빌더는 어느 체이닝 지점에서 await해도 동작하는 thenable이다
// (select/eq/not/order/range 전부 같은 빌더를 반환). 그 특성을 그대로 흉내 낸 최소 mock —
// RLS 자체를 검증하는 것이 아니라, journal.ts가 쿼리를 어떻게 조립하고 결과를 어떻게
// 다루는지(빈 배열 처리, 에러 전파, 옵션 검증)만 확인하는 것이 이 테스트의 목적이다.
// "User A가 User B 데이터를 볼 수 없는지"는 mock으로 의미 있게 검증할 수 없어(RLS는 DB
// 레벨 동작이므로) 실제 Supabase 프로젝트 대상 실측으로 별도 확인한다(보고서 §10 참조).
interface MockResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

function createMockQuery(result: MockResult) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.not = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.range = vi.fn(() => builder);
  builder.then = (
    resolve: (value: MockResult) => void,
    reject?: (reason: unknown) => void
  ) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

function mockSupabaseFrom(result: MockResult) {
  const query = createMockQuery(result);
  const from = vi.fn(() => query);
  vi.mocked(createClient).mockResolvedValue({ from } as never);
  return { from, query };
}

const LOGGED_IN_USER = { id: "user-a-uuid" } as never;

describe("getRecentUserNumbers", () => {
  it("returns rows for the current logged-in user", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(LOGGED_IN_USER);
    const rows = [{ id: 1, user_id: "user-a-uuid" }];
    const { from } = mockSupabaseFrom({ data: rows, error: null });

    const result = await getRecentUserNumbers();

    expect(result).toEqual(rows);
    expect(from).toHaveBeenCalledWith("user_numbers");
  });

  it("returns an empty array when there is no data (not an error)", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(LOGGED_IN_USER);
    mockSupabaseFrom({ data: [], error: null });

    await expect(getRecentUserNumbers()).resolves.toEqual([]);
  });

  it("returns an empty array without querying Supabase when not logged in", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { from } = mockSupabaseFrom({ data: [{ id: 1 }], error: null });

    await expect(getRecentUserNumbers()).resolves.toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it("throws the underlying error on DB failure instead of swallowing it", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(LOGGED_IN_USER);
    const dbError = new Error("connection refused");
    mockSupabaseFrom({ data: null, error: dbError });

    await expect(getRecentUserNumbers()).rejects.toThrow("connection refused");
  });

  it("applies the checked_at filter only when onlyChecked is requested", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(LOGGED_IN_USER);
    const { query } = mockSupabaseFrom({ data: [], error: null });

    await getRecentUserNumbers({ onlyChecked: true });

    expect(query.not).toHaveBeenCalledWith("checked_at", "is", null);
  });

  it("does not call not() when onlyChecked is not requested", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(LOGGED_IN_USER);
    const { query } = mockSupabaseFrom({ data: [], error: null });

    await getRecentUserNumbers();

    expect(query.not).not.toHaveBeenCalled();
  });

  it("uses the default limit when none is given", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(LOGGED_IN_USER);
    const { query } = mockSupabaseFrom({ data: [], error: null });

    await getRecentUserNumbers();

    expect(query.range).toHaveBeenCalledWith(0, DEFAULT_LIST_LIMIT - 1);
  });

  it.each([0, -1, 1.5, 101])("rejects an invalid limit (%s)", async (limit) => {
    vi.mocked(getCurrentUser).mockResolvedValue(LOGGED_IN_USER);
    mockSupabaseFrom({ data: [], error: null });

    await expect(getRecentUserNumbers({ limit })).rejects.toBeInstanceOf(JournalValidationError);
  });

  it.each([-1, 1.5])("rejects an invalid offset (%s)", async (offset) => {
    vi.mocked(getCurrentUser).mockResolvedValue(LOGGED_IN_USER);
    mockSupabaseFrom({ data: [], error: null });

    await expect(getRecentUserNumbers({ offset })).rejects.toBeInstanceOf(JournalValidationError);
  });
});

describe("getRecentDreamJournalEntries", () => {
  it("filters by the current user and orders by entry_date", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(LOGGED_IN_USER);
    const { from, query } = mockSupabaseFrom({ data: [], error: null });

    await getRecentDreamJournalEntries();

    expect(from).toHaveBeenCalledWith("dream_journal_entries");
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-a-uuid");
    expect(query.order).toHaveBeenCalledWith("entry_date", { ascending: false });
  });

  it("returns an empty array when not logged in", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    await expect(getRecentDreamJournalEntries()).resolves.toEqual([]);
  });
});

describe("getRecentFortuneResults", () => {
  it("explicitly filters by user_id even though the table's SELECT RLS is public", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(LOGGED_IN_USER);
    const { from, query } = mockSupabaseFrom({ data: [], error: null });

    await getRecentFortuneResults();

    expect(from).toHaveBeenCalledWith("fortune_results");
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-a-uuid");
  });

  it("returns an empty array when not logged in", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    await expect(getRecentFortuneResults()).resolves.toEqual([]);
  });
});

describe("getDrawsByRounds", () => {
  it("queries draws with a deduplicated round list, without any user_id gate (public data)", async () => {
    const { from, query } = mockSupabaseFrom({ data: [], error: null });

    await getDrawsByRounds([1236, 1235, 1236]);

    expect(from).toHaveBeenCalledWith("draws");
    expect(query.in).toHaveBeenCalledWith("round", [1236, 1235]);
    expect(query.eq).not.toHaveBeenCalled();
  });

  it("returns an empty array without querying Supabase when given an empty round list", async () => {
    const { from } = mockSupabaseFrom({ data: [{ round: 1236 }], error: null });

    await expect(getDrawsByRounds([])).resolves.toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it("returns the rows found", async () => {
    const rows = [{ round: 1236, numbers: [1, 2, 3, 4, 5, 6], bonus_number: 7 }];
    mockSupabaseFrom({ data: rows, error: null });

    await expect(getDrawsByRounds([1236])).resolves.toEqual(rows);
  });

  it("throws the underlying error on DB failure instead of swallowing it", async () => {
    mockSupabaseFrom({ data: null, error: new Error("connection refused") });

    await expect(getDrawsByRounds([1236])).rejects.toThrow("connection refused");
  });

  it("does not depend on login state (works for the same reason draws' SELECT RLS is public)", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { from } = mockSupabaseFrom({ data: [{ round: 1236 }], error: null });

    await expect(getDrawsByRounds([1236])).resolves.toEqual([{ round: 1236 }]);
    expect(from).toHaveBeenCalledWith("draws");
  });
});

describe("getDiarySummary", () => {
  it("combines the total count and the recent list for a logged-in user", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(LOGGED_IN_USER);
    const { from } = mockSupabaseFrom({ data: [{ id: 1 }], error: null, count: 7 });

    const summary = await getDiarySummary();

    expect(summary.totalUserNumbersCount).toBe(7);
    expect(summary.recentUserNumbers).toEqual([{ id: 1 }]);
    expect(from).toHaveBeenCalledWith("user_numbers");
  });

  it("returns a zeroed-out empty summary without querying Supabase when not logged in", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { from } = mockSupabaseFrom({ data: [], error: null, count: 0 });

    await expect(getDiarySummary()).resolves.toEqual({
      totalUserNumbersCount: 0,
      recentUserNumbers: [],
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("throws on a count query failure", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(LOGGED_IN_USER);
    mockSupabaseFrom({ data: null, error: new Error("count failed"), count: null });

    await expect(getDiarySummary()).rejects.toThrow("count failed");
  });
});

describe("parseDreamJournalInput", () => {
  it("returns the trimmed dreamText with linkedDreamId: null when omitted", () => {
    expect(parseDreamJournalInput({ dreamText: "  하늘을 나는 꿈을 꿨다  " })).toEqual({
      dreamText: "하늘을 나는 꿈을 꿨다",
      linkedDreamId: null,
    });
  });

  it("accepts a numeric linkedDreamId", () => {
    expect(parseDreamJournalInput({ dreamText: "꿈 내용", linkedDreamId: 1 })).toEqual({
      dreamText: "꿈 내용",
      linkedDreamId: 1,
    });
  });

  it("accepts a numeric string linkedDreamId (query-param origin)", () => {
    expect(parseDreamJournalInput({ dreamText: "꿈 내용", linkedDreamId: "1" })).toEqual({
      dreamText: "꿈 내용",
      linkedDreamId: 1,
    });
  });

  it.each([
    ["null body", null],
    ["non-object body", "not-an-object"],
    ["missing dreamText", {}],
    ["dreamText is not a string", { dreamText: 123 }],
    ["empty string", { dreamText: "" }],
    ["whitespace-only string", { dreamText: "   \n\t  " }],
    ["dreamText exceeds max length", { dreamText: "가".repeat(2001) }],
    ["linkedDreamId is zero", { dreamText: "꿈", linkedDreamId: 0 }],
    ["linkedDreamId is negative", { dreamText: "꿈", linkedDreamId: -1 }],
    ["linkedDreamId is a decimal", { dreamText: "꿈", linkedDreamId: 1.5 }],
    ["linkedDreamId is a non-numeric string", { dreamText: "꿈", linkedDreamId: "abc" }],
  ])("rejects: %s", (_label, body) => {
    expect(() => parseDreamJournalInput(body)).toThrow(JournalValidationError);
  });
});

function mockInsertResult(result: { data?: unknown; error?: unknown }) {
  const single = vi.fn(() => Promise.resolve(result));
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn<(payload: Record<string, unknown>) => { select: typeof select }>(
    () => ({ select })
  );
  const from = vi.fn(() => ({ insert }));
  vi.mocked(createClient).mockResolvedValue({ from } as never);
  return { from, insert };
}

describe("createDreamJournalEntry", () => {
  it("inserts with the given userId, trimmed text, today's date, and no linked_dream_id", async () => {
    const savedRow = { id: 1, user_id: "user-a", dream_text: "꿈 내용" };
    const { from, insert } = mockInsertResult({ data: savedRow, error: null });

    const result = await createDreamJournalEntry("user-a", "꿈 내용");

    expect(from).toHaveBeenCalledWith("dream_journal_entries");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-a", dream_text: "꿈 내용" })
    );
    expect(insert.mock.calls[0][0]).not.toHaveProperty("linked_dream_id");
    expect(insert.mock.calls[0][0].entry_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result).toEqual(savedRow);
  });

  it("includes linked_dream_id when the linked dream exists", async () => {
    vi.mocked(getDreamById).mockResolvedValue({ id: 1 } as never);
    const savedRow = { id: 2, user_id: "user-a", dream_text: "꿈 내용", linked_dream_id: 1 };
    const { insert } = mockInsertResult({ data: savedRow, error: null });

    const result = await createDreamJournalEntry("user-a", "꿈 내용", 1);

    expect(getDreamById).toHaveBeenCalledWith(1);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-a", dream_text: "꿈 내용", linked_dream_id: 1 })
    );
    expect(result).toEqual(savedRow);
  });

  it("rejects with JournalValidationError when linkedDreamId does not exist, without inserting", async () => {
    vi.mocked(getDreamById).mockResolvedValue(null);
    const { insert } = mockInsertResult({ data: null, error: null });

    await expect(createDreamJournalEntry("user-a", "꿈 내용", 999)).rejects.toThrow(
      JournalValidationError
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it("throws the underlying error on DB failure instead of swallowing it", async () => {
    mockInsertResult({ data: null, error: new Error("insert failed") });

    await expect(createDreamJournalEntry("user-a", "꿈 내용")).rejects.toThrow("insert failed");
  });
});
