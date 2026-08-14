import { describe, expect, it } from "vitest";
import { vi } from "vitest";

import { createClient } from "@/lib/supabase/server";

import { getDreamSituationByKeyword, getDreamSituations } from "./dreamSituations";

vi.mock("@/lib/supabase/server");

// lib/api/dreams.test.ts와 동일한 mock 빌더 패턴 — select/eq/order는 체이닝을 흉내내고
// maybeSingle은 그 자체가 Promise다.
function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: (resolve: (value: typeof result) => void) => void;
  } = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve) => resolve(result),
  };
  return builder;
}

function mockSupabase(result: { data: unknown; error: unknown }) {
  const from = vi.fn(() => makeQueryBuilder(result));
  vi.mocked(createClient).mockResolvedValue({ from } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { from };
}

const SAMPLE_SITUATIONS = [
  {
    id: 1,
    dream_id: 1,
    keyword: "돼지를-보는-꿈",
    title: "돼지를 보는 꿈",
    body: "본문",
    key_meaning: "핵심 해석",
    numbers: [3, 17],
    display_order: 1,
    created_at: "t",
    updated_at: "t",
  },
  {
    id: 2,
    dream_id: 1,
    keyword: "돼지를-잡는-꿈",
    title: "돼지를 잡는 꿈",
    body: "본문2",
    key_meaning: null,
    numbers: null,
    display_order: 2,
    created_at: "t",
    updated_at: "t",
  },
];

describe("getDreamSituations", () => {
  it("부모 꿈 id로 상황 목록을 display_order 순으로 조회한다", async () => {
    const { from } = mockSupabase({ data: SAMPLE_SITUATIONS, error: null });

    const result = await getDreamSituations(1);

    const builder = from.mock.results[0].value;
    expect(from).toHaveBeenCalledWith("dream_situations");
    expect(builder.eq).toHaveBeenCalledWith("dream_id", 1);
    expect(builder.order).toHaveBeenCalledWith("display_order", { ascending: true });
    expect(result).toEqual(SAMPLE_SITUATIONS);
  });

  it("상황이 없으면 빈 배열을 반환한다", async () => {
    mockSupabase({ data: null, error: null });

    expect(await getDreamSituations(999)).toEqual([]);
  });

  it("Supabase 오류를 그대로 전파한다", async () => {
    mockSupabase({ data: null, error: new Error("db down") });

    await expect(getDreamSituations(1)).rejects.toThrow("db down");
  });
});

describe("getDreamSituationByKeyword", () => {
  it("dream_id와 situation keyword로 상황 하나를 조회한다", async () => {
    const { from } = mockSupabase({ data: SAMPLE_SITUATIONS[1], error: null });

    const result = await getDreamSituationByKeyword(1, "돼지를-잡는-꿈");

    const builder = from.mock.results[0].value;
    expect(builder.eq).toHaveBeenNthCalledWith(1, "dream_id", 1);
    expect(builder.eq).toHaveBeenNthCalledWith(2, "keyword", "돼지를-잡는-꿈");
    expect(result).toEqual(SAMPLE_SITUATIONS[1]);
  });

  it("0개 numbers(null)인 상황도 그대로 반환한다 — 6개로 채우지 않는다", async () => {
    mockSupabase({ data: SAMPLE_SITUATIONS[1], error: null });

    const result = await getDreamSituationByKeyword(1, "돼지를-잡는-꿈");

    expect(result?.numbers).toBeNull();
  });

  it("존재하지 않는 조합은 null을 반환한다(에러 아님, 404 처리는 호출부 책임)", async () => {
    mockSupabase({ data: null, error: null });

    expect(await getDreamSituationByKeyword(1, "존재하지않는상황")).toBeNull();
  });

  it("Supabase 오류를 그대로 전파한다", async () => {
    mockSupabase({ data: null, error: new Error("db down") });

    await expect(getDreamSituationByKeyword(1, "돼지를-보는-꿈")).rejects.toThrow("db down");
  });
});
