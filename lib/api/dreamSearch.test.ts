import { describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";

import { searchDreamContent } from "./dreamSearch";

vi.mock("@/lib/supabase/server");

// lib/api/dreamSituations.test.ts와 동일한 mock 빌더 패턴 — 이 파일은 dreams/dream_situations
// 두 테이블을 동시에 조회하므로, from(table)마다 서로 다른 결과를 반환할 수 있게 확장했다.
function makeQueryBuilder(result: { data: unknown; error: unknown }, calls: Record<string, unknown>[]) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    ilike: vi.fn((column: string, pattern: string) => {
      calls.push({ op: "ilike", column, pattern });
      return builder;
    }),
    or: vi.fn((expr: string) => {
      calls.push({ op: "or", expr });
      return builder;
    }),
    limit: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

function mockSupabase(dreamsResult: { data: unknown; error: unknown }, situationsResult: { data: unknown; error: unknown }) {
  const dreamsCalls: Record<string, unknown>[] = [];
  const situationsCalls: Record<string, unknown>[] = [];
  const from = vi.fn((table: string) => {
    if (table === "dreams") return makeQueryBuilder(dreamsResult, dreamsCalls);
    if (table === "dream_situations") return makeQueryBuilder(situationsResult, situationsCalls);
    throw new Error(`unexpected table: ${table}`);
  });
  vi.mocked(createClient).mockResolvedValue({ from } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { from, dreamsCalls, situationsCalls };
}

describe("searchDreamContent", () => {
  it("빈 문자열/공백 검색어는 supabase를 호출하지 않고 빈 배열을 반환한다", async () => {
    const { from } = mockSupabase({ data: [], error: null }, { data: [], error: null });

    expect(await searchDreamContent("")).toEqual([]);
    expect(await searchDreamContent("   ")).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it("dreams와 dream_situations를 동시에 조회해 parent/situation 결과를 합친다", async () => {
    const { dreamsCalls, situationsCalls } = mockSupabase(
      { data: [{ keyword: "돼지꿈" }], error: null },
      {
        data: [
          {
            keyword: "돼지를-잡는-꿈",
            title: "돼지를 잡는 꿈",
            key_meaning: "핵심 해석",
            dream_id: 1,
            dreams: { keyword: "돼지꿈" },
          },
        ],
        error: null,
      }
    );

    const result = await searchDreamContent("돼지");

    expect(result).toEqual([
      { type: "parent", title: "돼지꿈", summary: null, href: "/dream/%EB%8F%BC%EC%A7%80%EA%BF%88" },
      {
        type: "situation",
        title: "돼지를 잡는 꿈",
        summary: "핵심 해석",
        href: "/dream/%EB%8F%BC%EC%A7%80%EA%BF%88/%EB%8F%BC%EC%A7%80%EB%A5%BC-%EC%9E%A1%EB%8A%94-%EA%BF%88",
      },
    ]);
    expect(dreamsCalls[0]).toEqual({ op: "ilike", column: "keyword", pattern: "%돼지%" });
    expect(situationsCalls[0]).toEqual({ op: "or", expr: "title.ilike.%돼지%,keyword.ilike.%돼지%" });
  });

  it("ilike 와일드카드 문자(%, _, \\)를 이스케이프해 패턴 인젝션을 막는다", async () => {
    const { dreamsCalls, situationsCalls } = mockSupabase({ data: [], error: null }, { data: [], error: null });

    await searchDreamContent("50%_할인\\");

    expect(dreamsCalls[0].pattern).toBe("%50\\%\\_할인\\\\%");
    expect(situationsCalls[0].expr).toBe("title.ilike.%50\\%\\_할인\\\\%,keyword.ilike.%50\\%\\_할인\\\\%");
  });

  it("합쳐진 결과가 limit을 넘으면 잘라낸다", async () => {
    const parents = Array.from({ length: 5 }, (_, i) => ({ keyword: `꿈${i}` }));
    mockSupabase({ data: parents, error: null }, { data: [], error: null });

    const result = await searchDreamContent("꿈", 3);

    expect(result).toHaveLength(3);
  });

  it("dreams/dream_situations 조회 중 하나라도 실패하면 에러를 던진다", async () => {
    const dbError = new Error("connection failed");
    mockSupabase({ data: null, error: dbError }, { data: [], error: null });

    await expect(searchDreamContent("돼지")).rejects.toBe(dbError);
  });
});
