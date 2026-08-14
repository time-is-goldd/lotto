import { describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";

import { getDreamById, getDreamByKeyword, getDreamCategories, getDreamNumbers, getDreams } from "./dreams";

vi.mock("@/lib/supabase/server");

// select/eq/order는 서로를 반환해 체이닝을 흉내내고, 어느 지점에서 await하더라도(then)
// 최종 결과로 resolve된다 — maybeSingle/limit은 실제 supabase-js처럼 그 자체가 Promise다.
function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    then: (resolve: (value: typeof result) => void) => void;
  } = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    limit: vi.fn(() => Promise.resolve(result)),
    then: (resolve) => resolve(result),
  };
  return builder;
}

function mockSupabase(resultsByTable: Record<string, { data: unknown; error: unknown }>) {
  const from = vi.fn((table: string) => {
    const result = resultsByTable[table];
    if (!result) {
      throw new Error(`unexpected table: ${table}`);
    }
    return makeQueryBuilder(result);
  });
  vi.mocked(createClient).mockResolvedValue({ from } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { from };
}

const SAMPLE_DREAMS = [
  { id: 1, keyword: "돼지꿈", category: "동물", interpretation: "재물운", image_url: null, created_at: "t", updated_at: "t" },
  { id: 2, keyword: "뱀꿈", category: "동물", interpretation: "권력운", image_url: null, created_at: "t", updated_at: "t" },
  { id: 3, keyword: "똥꿈", category: "신체", interpretation: "재물운", image_url: null, created_at: "t", updated_at: "t" },
];

describe("getDreamCategories", () => {
  it("중복 없이 정렬된 카테고리 목록을 반환한다", async () => {
    mockSupabase({ dreams: { data: [{ category: "동물" }, { category: "신체" }, { category: "동물" }], error: null } });

    expect(await getDreamCategories()).toEqual(["동물", "신체"]);
  });

  it("category가 NULL인 행은 걸러낸다", async () => {
    mockSupabase({ dreams: { data: [{ category: "동물" }, { category: null }], error: null } });

    expect(await getDreamCategories()).toEqual(["동물"]);
  });

  it("빈 결과는 빈 배열을 반환한다", async () => {
    mockSupabase({ dreams: { data: [], error: null } });

    expect(await getDreamCategories()).toEqual([]);
  });

  it("Supabase 오류를 그대로 전파한다", async () => {
    mockSupabase({ dreams: { data: null, error: new Error("db down") } });

    await expect(getDreamCategories()).rejects.toThrow("db down");
  });
});

describe("getDreams", () => {
  it("옵션 없이 호출하면 전체 목록을 반환한다", async () => {
    mockSupabase({ dreams: { data: SAMPLE_DREAMS, error: null } });

    expect(await getDreams()).toEqual(SAMPLE_DREAMS);
  });

  it("category로 필터링할 수 있다", async () => {
    const { from } = mockSupabase({ dreams: { data: [SAMPLE_DREAMS[0], SAMPLE_DREAMS[1]], error: null } });

    const result = await getDreams({ category: "동물" });

    const builder = from.mock.results[0].value;
    expect(builder.eq).toHaveBeenCalledWith("category", "동물");
    expect(result).toEqual([SAMPLE_DREAMS[0], SAMPLE_DREAMS[1]]);
  });

  it("데이터가 없으면 빈 배열을 반환한다", async () => {
    mockSupabase({ dreams: { data: null, error: null } });

    expect(await getDreams()).toEqual([]);
  });

  it("Supabase 오류를 그대로 전파한다", async () => {
    mockSupabase({ dreams: { data: null, error: new Error("db down") } });

    await expect(getDreams()).rejects.toThrow("db down");
  });
});

describe("getDreamByKeyword", () => {
  it("정상 keyword로 조회하면 해당 dream을 반환한다", async () => {
    const { from } = mockSupabase({ dreams: { data: SAMPLE_DREAMS[0], error: null } });

    const result = await getDreamByKeyword("돼지꿈");

    const builder = from.mock.results[0].value;
    expect(builder.eq).toHaveBeenCalledWith("keyword", "돼지꿈");
    expect(result).toEqual(SAMPLE_DREAMS[0]);
  });

  it("존재하지 않는 keyword는 null을 반환한다(에러 아님)", async () => {
    mockSupabase({ dreams: { data: null, error: null } });

    expect(await getDreamByKeyword("존재하지않는꿈")).toBeNull();
  });

  it("Supabase 오류를 그대로 전파한다", async () => {
    mockSupabase({ dreams: { data: null, error: new Error("db down") } });

    await expect(getDreamByKeyword("돼지꿈")).rejects.toThrow("db down");
  });
});

describe("getDreamById", () => {
  it("정상 id로 조회하면 해당 dream을 반환한다", async () => {
    const { from } = mockSupabase({ dreams: { data: SAMPLE_DREAMS[0], error: null } });

    const result = await getDreamById(1);

    const builder = from.mock.results[0].value;
    expect(builder.eq).toHaveBeenCalledWith("id", 1);
    expect(result).toEqual(SAMPLE_DREAMS[0]);
  });

  it("존재하지 않는 id는 null을 반환한다(에러 아님)", async () => {
    mockSupabase({ dreams: { data: null, error: null } });

    expect(await getDreamById(999)).toBeNull();
  });

  it("Supabase 오류를 그대로 전파한다", async () => {
    mockSupabase({ dreams: { data: null, error: new Error("db down") } });

    await expect(getDreamById(1)).rejects.toThrow("db down");
  });
});

describe("getDreamNumbers", () => {
  it("매핑이 있으면 numbers 배열을 반환한다", async () => {
    const { from } = mockSupabase({
      dream_number_mappings: { data: [{ numbers: [1, 2, 3, 4, 5, 6] }], error: null },
    });

    const result = await getDreamNumbers(1);

    const builder = from.mock.results[0].value;
    expect(builder.eq).toHaveBeenCalledWith("dream_id", 1);
    expect(result).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("매핑이 없으면 null을 반환한다", async () => {
    mockSupabase({ dream_number_mappings: { data: [], error: null } });

    expect(await getDreamNumbers(999)).toBeNull();
  });

  it("Supabase 오류를 그대로 전파한다", async () => {
    mockSupabase({ dream_number_mappings: { data: null, error: new Error("db down") } });

    await expect(getDreamNumbers(1)).rejects.toThrow("db down");
  });
});
