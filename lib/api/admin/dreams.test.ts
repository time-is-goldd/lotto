import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDreamCategories } from "@/lib/api/dreams";
import { createClient as createPublicClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@/lib/supabase/service";

import {
  AdminDreamNotFoundError,
  AdminDreamValidationError,
  createAdminDream,
  deleteAdminDream,
  getDreamIdsWithNumbers,
  parseAdminDreamCreateInput,
  updateAdminDream,
} from "./dreams";

vi.mock("@/lib/api/dreams");
vi.mock("@/lib/supabase/server");
vi.mock("@/lib/supabase/service");

const KNOWN_CATEGORIES = ["동물", "신체", "인물", "상황", "자연", "행동", "사물"];

const VALID_BODY = {
  keyword: "돼지꿈",
  category: "동물",
  interpretation: "재물운 상승을 의미한다.",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDreamCategories).mockResolvedValue(KNOWN_CATEGORIES);
});

describe("parseAdminDreamCreateInput", () => {
  it("returns the parsed dream for a valid payload (no numbers)", async () => {
    await expect(parseAdminDreamCreateInput(VALID_BODY)).resolves.toEqual({
      keyword: "돼지꿈",
      category: "동물",
      interpretation: "재물운 상승을 의미한다.",
      numbers: null,
    });
  });

  it("trims keyword/interpretation", async () => {
    await expect(
      parseAdminDreamCreateInput({ ...VALID_BODY, keyword: "  돼지꿈  ", interpretation: "  내용  " })
    ).resolves.toMatchObject({ keyword: "돼지꿈", interpretation: "내용" });
  });

  it("accepts category omitted/null/empty as null (nullable column)", async () => {
    await expect(parseAdminDreamCreateInput({ ...VALID_BODY, category: undefined })).resolves.toMatchObject(
      { category: null }
    );
    await expect(parseAdminDreamCreateInput({ ...VALID_BODY, category: null })).resolves.toMatchObject({
      category: null,
    });
    await expect(parseAdminDreamCreateInput({ ...VALID_BODY, category: "" })).resolves.toMatchObject({
      category: null,
    });
  });

  it("rejects a category not in the current known set", async () => {
    await expect(parseAdminDreamCreateInput({ ...VALID_BODY, category: "판타지" })).rejects.toThrow(
      AdminDreamValidationError
    );
  });

  it("accepts a valid optional numbers array", async () => {
    await expect(
      parseAdminDreamCreateInput({ ...VALID_BODY, numbers: [3, 7, 12, 21, 34, 45] })
    ).resolves.toMatchObject({ numbers: [3, 7, 12, 21, 34, 45] });
  });

  it.each([
    ["null body", null],
    ["non-object body", "not-an-object"],
    ["missing keyword", { category: "동물", interpretation: "내용" }],
    ["empty keyword", { ...VALID_BODY, keyword: "" }],
    ["whitespace-only keyword", { ...VALID_BODY, keyword: "   " }],
    ["keyword exceeds max length", { ...VALID_BODY, keyword: "가".repeat(51) }],
    ["missing interpretation", { keyword: "돼지꿈", category: "동물" }],
    ["empty interpretation", { ...VALID_BODY, interpretation: "" }],
    ["interpretation exceeds max length", { ...VALID_BODY, interpretation: "가".repeat(5001) }],
    ["numbers has fewer than 6", { ...VALID_BODY, numbers: [1, 2, 3, 4, 5] }],
    ["numbers has duplicates", { ...VALID_BODY, numbers: [1, 1, 2, 3, 4, 5] }],
    ["numbers has an out-of-range value", { ...VALID_BODY, numbers: [0, 1, 2, 3, 4, 5] }],
  ])("rejects: %s", async (_label, body) => {
    await expect(parseAdminDreamCreateInput(body)).rejects.toThrow(AdminDreamValidationError);
  });
});

type ServiceFromMock = ReturnType<typeof createServiceClient>["from"];

function mockServiceSupabase(handlers: Record<string, unknown>) {
  const from = vi.fn((table: string) => {
    if (table in handlers) {
      return handlers[table];
    }
    throw new Error(`unexpected table: ${table}`);
  });
  vi.mocked(createServiceClient).mockReturnValue({ from } as unknown as ReturnType<
    typeof createServiceClient
  >);
  return from as unknown as ServiceFromMock;
}

describe("createAdminDream", () => {
  it("inserts a dream row and returns it (no numbers)", async () => {
    const insertedDream = { id: 1, keyword: "돼지꿈", category: "동물", interpretation: "내용" };
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: insertedDream, error: null })) })),
    }));
    mockServiceSupabase({ dreams: { insert } });

    const result = await createAdminDream({
      keyword: "돼지꿈",
      category: "동물",
      interpretation: "내용",
      numbers: null,
    });

    expect(result).toEqual(insertedDream);
    expect(insert).toHaveBeenCalledWith({ keyword: "돼지꿈", category: "동물", interpretation: "내용" });
  });

  it("propagates the underlying error on insert failure", async () => {
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: new Error("insert failed") })),
      })),
    }));
    mockServiceSupabase({ dreams: { insert } });

    await expect(
      createAdminDream({ keyword: "돼지꿈", category: null, interpretation: "내용", numbers: null })
    ).rejects.toThrow("insert failed");
  });

  it("inserts a dream_number_mappings row when numbers is given (no existing mapping)", async () => {
    const insertedDream = { id: 1, keyword: "돼지꿈", category: "동물", interpretation: "내용" };
    const dreamsInsert = vi.fn(() => ({
      select: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: insertedDream, error: null })) })),
    }));
    const mappingSelect = vi.fn(() => ({
      eq: vi.fn(() => ({ limit: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })) })) })),
    }));
    const mappingInsert = vi.fn(() => Promise.resolve({ error: null }));
    mockServiceSupabase({
      dreams: { insert: dreamsInsert },
      dream_number_mappings: { select: mappingSelect, insert: mappingInsert },
    });

    await createAdminDream({
      keyword: "돼지꿈",
      category: "동물",
      interpretation: "내용",
      numbers: [1, 2, 3, 4, 5, 6],
    });

    expect(mappingInsert).toHaveBeenCalledWith({ dream_id: 1, numbers: [1, 2, 3, 4, 5, 6] });
  });
});

describe("updateAdminDream", () => {
  it("updates the dream row and returns it", async () => {
    const updatedDream = { id: 1, keyword: "돼지꿈2", category: "동물", interpretation: "수정됨" };
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: updatedDream, error: null })) })),
      })),
    }));
    mockServiceSupabase({ dreams: { update } });

    const result = await updateAdminDream(1, {
      keyword: "돼지꿈2",
      category: "동물",
      interpretation: "수정됨",
      numbers: null,
    });

    expect(result).toEqual(updatedDream);
  });

  it("throws AdminDreamNotFoundError when the id does not exist", async () => {
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })) })),
      })),
    }));
    mockServiceSupabase({ dreams: { update } });

    await expect(
      updateAdminDream(999, { keyword: "x", category: null, interpretation: "y", numbers: null })
    ).rejects.toThrow(AdminDreamNotFoundError);
  });

  it("updates an existing dream_number_mappings row instead of inserting a new one", async () => {
    const updatedDream = { id: 1, keyword: "돼지꿈", category: "동물", interpretation: "내용" };
    const dreamsUpdate = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: updatedDream, error: null })) })),
      })),
    }));
    const mappingSelect = vi.fn(() => ({
      eq: vi.fn(() => ({
        limit: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: { id: 55 }, error: null })) })),
      })),
    }));
    const mappingUpdate = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }));
    mockServiceSupabase({
      dreams: { update: dreamsUpdate },
      dream_number_mappings: { select: mappingSelect, update: mappingUpdate },
    });

    await updateAdminDream(1, {
      keyword: "돼지꿈",
      category: "동물",
      interpretation: "내용",
      numbers: [1, 2, 3, 4, 5, 6],
    });

    expect(mappingUpdate).toHaveBeenCalledWith({ numbers: [1, 2, 3, 4, 5, 6] });
  });
});

describe("deleteAdminDream", () => {
  it("deletes the dream row", async () => {
    const del = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: { id: 1 }, error: null })) })),
      })),
    }));
    mockServiceSupabase({ dreams: { delete: del } });

    await expect(deleteAdminDream(1)).resolves.toBeUndefined();
  });

  it("throws AdminDreamNotFoundError when nothing was deleted", async () => {
    const del = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })) })),
      })),
    }));
    mockServiceSupabase({ dreams: { delete: del } });

    await expect(deleteAdminDream(999)).rejects.toThrow(AdminDreamNotFoundError);
  });
});

describe("getDreamIdsWithNumbers", () => {
  it("returns a Set of dream_id values", async () => {
    const query = { select: vi.fn(() => Promise.resolve({ data: [{ dream_id: 1 }, { dream_id: 3 }], error: null })) };
    const from = vi.fn(() => query);
    vi.mocked(createPublicClient).mockResolvedValue({ from } as unknown as Awaited<
      ReturnType<typeof createPublicClient>
    >);

    const result = await getDreamIdsWithNumbers();

    expect(result).toEqual(new Set([1, 3]));
  });

  it("throws the underlying error on failure", async () => {
    const query = { select: vi.fn(() => Promise.resolve({ data: null, error: new Error("select failed") })) };
    const from = vi.fn(() => query);
    vi.mocked(createPublicClient).mockResolvedValue({ from } as unknown as Awaited<
      ReturnType<typeof createPublicClient>
    >);

    await expect(getDreamIdsWithNumbers()).rejects.toThrow("select failed");
  });
});
