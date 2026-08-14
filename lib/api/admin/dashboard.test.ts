import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient as createPublicClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@/lib/supabase/service";

import { getAdminDashboardStats } from "./dashboard";

vi.mock("@/lib/supabase/server");
vi.mock("@/lib/supabase/service");

// dreams/dream_number_mappings 조회(공개, anon 클라이언트)용 mock. select()가 count 조회와
// 목록 조회(order/limit) 둘 다에 쓰이므로 체이닝 가능한 thenable을 반환한다
// (lib/api/journal.test.ts의 createMockQuery와 동일한 패턴).
function mockPublicQuery(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => Promise.resolve(result));
  builder.then = (resolve: (v: typeof result) => void, reject?: (r: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

function mockPublicClient(dreamsResult: { count?: number | null; error?: unknown }, mappingResult: { count?: number | null; error?: unknown }, recentResult: { data?: unknown; error?: unknown }) {
  let dreamsCallCount = 0;
  const from = vi.fn((table: string) => {
    if (table === "dreams") {
      dreamsCallCount += 1;
      // 첫 호출은 count(head:true), 두 번째 호출은 최근 5건 목록(order+limit) — 실제
      // getDreamContentCounts()의 호출 순서와 무관하게 동작하도록 count/limit 둘 다 지원하는
      // builder를 반환한다.
      return dreamsCallCount === 1 ? mockPublicQuery(dreamsResult) : mockPublicQuery(recentResult);
    }
    if (table === "dream_number_mappings") {
      return mockPublicQuery(mappingResult);
    }
    throw new Error(`unexpected table: ${table}`);
  });
  vi.mocked(createPublicClient).mockResolvedValue({ from } as unknown as Awaited<
    ReturnType<typeof createPublicClient>
  >);
}

function mockServiceQuery(result: { count?: number | null; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.not = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.then = (resolve: (v: typeof result) => void, reject?: (r: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

function mockServiceClient(options: {
  userNumbersTotal?: { count?: number | null; error?: unknown };
  userNumbersChecked?: { count?: number | null; error?: unknown };
  userNumbersWinning?: { count?: number | null; error?: unknown };
  userNumbersDream?: { count?: number | null; error?: unknown };
  journalCount?: { count?: number | null; error?: unknown };
}) {
  const {
    userNumbersTotal = { count: 0 },
    userNumbersChecked = { count: 0 },
    userNumbersWinning = { count: 0 },
    userNumbersDream = { count: 0 },
    journalCount = { count: 0 },
  } = options;

  let userNumbersCallIndex = 0;
  const userNumbersResults = [userNumbersTotal, userNumbersChecked, userNumbersWinning, userNumbersDream];

  const from = vi.fn((table: string) => {
    if (table === "user_numbers") {
      const result = userNumbersResults[userNumbersCallIndex];
      userNumbersCallIndex += 1;
      return mockServiceQuery(result);
    }
    if (table === "dream_journal_entries") {
      return mockServiceQuery(journalCount);
    }
    throw new Error(`unexpected table: ${table}`);
  });

  vi.mocked(createServiceClient).mockReturnValue({ from } as unknown as ReturnType<
    typeof createServiceClient
  >);
  return from;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAdminDashboardStats", () => {
  it("aggregates all counts correctly for normal data", async () => {
    mockPublicClient(
      { count: 25 },
      { count: 25 },
      { data: [{ id: 1, keyword: "돼지꿈", created_at: "2026-08-01T00:00:00Z" }] }
    );
    mockServiceClient({
      userNumbersTotal: { count: 100 },
      userNumbersChecked: { count: 40 },
      userNumbersWinning: { count: 5 },
      userNumbersDream: { count: 10 },
      journalCount: { count: 8 },
    });

    const stats = await getAdminDashboardStats();

    expect(stats).toEqual({
      dreamCount: 25,
      dreamNumberMappingCount: 25,
      userNumbersCount: 100,
      checkedUserNumbersCount: 40,
      winningUserNumbersCount: 5,
      dreamGeneratedNumbersCount: 10,
      dreamJournalEntryCount: 8,
      recentDreams: [{ id: 1, keyword: "돼지꿈", createdAt: "2026-08-01T00:00:00Z" }],
    });
  });

  it("returns all zeros and an empty recent list when every table is empty", async () => {
    mockPublicClient({ count: 0 }, { count: 0 }, { data: [] });
    mockServiceClient({});

    const stats = await getAdminDashboardStats();

    expect(stats).toEqual({
      dreamCount: 0,
      dreamNumberMappingCount: 0,
      userNumbersCount: 0,
      checkedUserNumbersCount: 0,
      winningUserNumbersCount: 0,
      dreamGeneratedNumbersCount: 0,
      dreamJournalEntryCount: 0,
      recentDreams: [],
    });
  });

  it("treats a null count as 0 (PostgREST head:true can return null count)", async () => {
    mockPublicClient({ count: null }, { count: null }, { data: null });
    mockServiceClient({
      userNumbersTotal: { count: null },
      userNumbersChecked: { count: null },
      userNumbersWinning: { count: null },
      userNumbersDream: { count: null },
      journalCount: { count: null },
    });

    const stats = await getAdminDashboardStats();

    expect(stats.dreamCount).toBe(0);
    expect(stats.userNumbersCount).toBe(0);
    expect(stats.recentDreams).toEqual([]);
  });

  it("propagates an error from the dreams count query", async () => {
    mockPublicClient({ error: new Error("dreams count failed") }, { count: 0 }, { data: [] });
    mockServiceClient({});

    await expect(getAdminDashboardStats()).rejects.toThrow("dreams count failed");
  });

  it("propagates an error from a user_numbers count query", async () => {
    mockPublicClient({ count: 0 }, { count: 0 }, { data: [] });
    mockServiceClient({ userNumbersWinning: { error: new Error("winning count failed") } });

    await expect(getAdminDashboardStats()).rejects.toThrow("winning count failed");
  });

  it("propagates an error from the dream_journal_entries count query", async () => {
    mockPublicClient({ count: 0 }, { count: 0 }, { data: [] });
    mockServiceClient({ journalCount: { error: new Error("journal count failed") } });

    await expect(getAdminDashboardStats()).rejects.toThrow("journal count failed");
  });

  it("filters checked/winning/dream-based counts using the correct column conditions", async () => {
    mockPublicClient({ count: 0 }, { count: 0 }, { data: [] });
    const from = mockServiceClient({});

    await getAdminDashboardStats();

    const userNumbersCalls = from.mock.results.filter((_, i) => from.mock.calls[i][0] === "user_numbers");
    // 4번째(dream-based) 호출의 builder에서 eq가 generation_method/'dream'으로 불렸는지 확인.
    const dreamBasedBuilder = userNumbersCalls[3].value as { eq: ReturnType<typeof vi.fn> };
    expect(dreamBasedBuilder.eq).toHaveBeenCalledWith("generation_method", "dream");

    const checkedBuilder = userNumbersCalls[1].value as { not: ReturnType<typeof vi.fn> };
    expect(checkedBuilder.not).toHaveBeenCalledWith("checked_at", "is", null);

    const winningBuilder = userNumbersCalls[2].value as { not: ReturnType<typeof vi.fn> };
    expect(winningBuilder.not).toHaveBeenCalledWith("win_rank", "is", null);
  });
});
