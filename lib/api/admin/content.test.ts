import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient as createServiceClient } from "@/lib/supabase/service";

import {
  AdminContentNotFoundError,
  AdminContentValidationError,
  createContentEntry,
  deleteContentEntry,
  DuplicateGuideTitleError,
  getAdminContentEntries,
  parseAdminContentCreateInput,
  updateContentEntry,
} from "./content";

vi.mock("@/lib/supabase/service");

const VALID_BODY = {
  type: "faq",
  title: "환불은 어떻게 하나요?",
  body: "마이페이지에서 신청할 수 있습니다.",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("parseAdminContentCreateInput", () => {
  it("returns the parsed content entry for a valid payload (display_order omitted -> 0)", () => {
    expect(parseAdminContentCreateInput(VALID_BODY)).toEqual({
      type: "faq",
      title: "환불은 어떻게 하나요?",
      body: "마이페이지에서 신청할 수 있습니다.",
      display_order: 0,
    });
  });

  it("trims title/body", () => {
    expect(
      parseAdminContentCreateInput({ ...VALID_BODY, title: "  제목  ", body: "  내용  " })
    ).toMatchObject({ title: "제목", body: "내용" });
  });

  it("accepts an explicit display_order", () => {
    expect(parseAdminContentCreateInput({ ...VALID_BODY, display_order: 5 })).toMatchObject({
      display_order: 5,
    });
  });

  it("accepts type=guide", () => {
    expect(parseAdminContentCreateInput({ ...VALID_BODY, type: "guide" })).toMatchObject({
      type: "guide",
    });
  });

  it.each([
    ["null body", null],
    ["non-object body", "not-an-object"],
    ["missing type", { title: "제목", body: "내용" }],
    ["type is notice", { ...VALID_BODY, type: "notice" }],
    ["type is empty string", { ...VALID_BODY, type: "" }],
    ["type is arbitrary string", { ...VALID_BODY, type: "random" }],
    ["missing title", { type: "faq", body: "내용" }],
    ["empty title", { ...VALID_BODY, title: "" }],
    ["whitespace-only title", { ...VALID_BODY, title: "   " }],
    ["title exceeds max length", { ...VALID_BODY, title: "가".repeat(201) }],
    ["missing body", { type: "faq", title: "제목" }],
    ["empty body", { ...VALID_BODY, body: "" }],
    ["whitespace-only body", { ...VALID_BODY, body: "   " }],
    ["display_order is not an integer", { ...VALID_BODY, display_order: 1.5 }],
    ["display_order is negative", { ...VALID_BODY, display_order: -1 }],
    ["display_order is a string", { ...VALID_BODY, display_order: "1" }],
  ])("rejects: %s", (_label, body) => {
    expect(() => parseAdminContentCreateInput(body)).toThrow(AdminContentValidationError);
  });

  it("accepts title at exactly the max length (200 chars)", () => {
    const title = "가".repeat(200);
    expect(parseAdminContentCreateInput({ ...VALID_BODY, title })).toMatchObject({ title });
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

describe("createContentEntry", () => {
  it("inserts a content_entries row and returns it", async () => {
    const insertedRow = { id: 1, type: "faq", title: "제목", body: "내용", display_order: 0 };
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: insertedRow, error: null })) })),
    }));
    mockServiceSupabase({ content_entries: { insert } });

    const result = await createContentEntry({ type: "faq", title: "제목", body: "내용", display_order: 0 });

    expect(result).toEqual(insertedRow);
    expect(insert).toHaveBeenCalledWith({ type: "faq", title: "제목", body: "내용", display_order: 0 });
  });

  it("propagates the underlying error on insert failure", async () => {
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: new Error("insert failed") })),
      })),
    }));
    mockServiceSupabase({ content_entries: { insert } });

    await expect(
      createContentEntry({ type: "faq", title: "제목", body: "내용", display_order: 0 })
    ).rejects.toThrow("insert failed");
  });

  it("maps a Postgres unique violation (23505) to DuplicateGuideTitleError for type=guide", async () => {
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() =>
          Promise.resolve({
            data: null,
            error: { code: "23505", message: 'duplicate key value violates unique constraint "content_entries_guide_title_idx"' },
          })
        ),
      })),
    }));
    mockServiceSupabase({ content_entries: { insert } });

    await expect(
      createContentEntry({ type: "guide", title: "중복 가이드", body: "내용", display_order: 0 })
    ).rejects.toThrow(DuplicateGuideTitleError);
  });

  it("does not map a 23505 error to DuplicateGuideTitleError for type=faq (FAQ has no title UNIQUE)", async () => {
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() =>
          Promise.resolve({ data: null, error: { code: "23505", message: "some other unique violation" } })
        ),
      })),
    }));
    mockServiceSupabase({ content_entries: { insert } });

    await expect(
      createContentEntry({ type: "faq", title: "중복 아님", body: "내용", display_order: 0 })
    ).rejects.not.toThrow(DuplicateGuideTitleError);
  });
});

describe("updateContentEntry", () => {
  it("updates the content_entries row and returns it", async () => {
    const updatedRow = { id: 1, type: "faq", title: "제목2", body: "수정됨", display_order: 3 };
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: updatedRow, error: null })) })),
      })),
    }));
    mockServiceSupabase({ content_entries: { update } });

    const result = await updateContentEntry(1, {
      type: "faq",
      title: "제목2",
      body: "수정됨",
      display_order: 3,
    });

    expect(result).toEqual(updatedRow);
  });

  it("throws AdminContentNotFoundError when the id does not exist", async () => {
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })) })),
      })),
    }));
    mockServiceSupabase({ content_entries: { update } });

    await expect(
      updateContentEntry(999, { type: "faq", title: "x", body: "y", display_order: 0 })
    ).rejects.toThrow(AdminContentNotFoundError);
  });

  it("maps a Postgres unique violation (23505) to DuplicateGuideTitleError for type=guide", async () => {
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: vi.fn(() =>
            Promise.resolve({
              data: null,
              error: { code: "23505", message: 'duplicate key value violates unique constraint "content_entries_guide_title_idx"' },
            })
          ),
        })),
      })),
    }));
    mockServiceSupabase({ content_entries: { update } });

    await expect(
      updateContentEntry(1, { type: "guide", title: "중복 가이드", body: "내용", display_order: 0 })
    ).rejects.toThrow(DuplicateGuideTitleError);
  });
});

describe("deleteContentEntry", () => {
  it("deletes the content_entries row", async () => {
    const del = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: { id: 1 }, error: null })) })),
      })),
    }));
    mockServiceSupabase({ content_entries: { delete: del } });

    await expect(deleteContentEntry(1)).resolves.toBeUndefined();
  });

  it("throws AdminContentNotFoundError when nothing was deleted", async () => {
    const del = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })) })),
      })),
    }));
    mockServiceSupabase({ content_entries: { delete: del } });

    await expect(deleteContentEntry(999)).rejects.toThrow(AdminContentNotFoundError);
  });
});

describe("getAdminContentEntries", () => {
  it("orders by display_order then id, without a type filter", async () => {
    const order2 = vi.fn(() => Promise.resolve({ data: [{ id: 1 }, { id: 2 }], error: null }));
    const order1 = vi.fn(() => ({ order: order2 }));
    const select = vi.fn(() => ({ order: order1 }));
    mockServiceSupabase({ content_entries: { select } });

    const result = await getAdminContentEntries();

    expect(order1).toHaveBeenCalledWith("display_order", { ascending: true });
    expect(order2).toHaveBeenCalledWith("id", { ascending: true });
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("filters by type when given", async () => {
    const eq = vi.fn(() => Promise.resolve({ data: [{ id: 1, type: "guide" }], error: null }));
    const order2 = vi.fn(() => ({ eq }));
    const order1 = vi.fn(() => ({ order: order2 }));
    const select = vi.fn(() => ({ order: order1 }));
    mockServiceSupabase({ content_entries: { select } });

    const result = await getAdminContentEntries("guide");

    expect(eq).toHaveBeenCalledWith("type", "guide");
    expect(result).toEqual([{ id: 1, type: "guide" }]);
  });

  it("throws the underlying error on failure", async () => {
    const order2 = vi.fn(() => Promise.resolve({ data: null, error: new Error("select failed") }));
    const order1 = vi.fn(() => ({ order: order2 }));
    const select = vi.fn(() => ({ order: order1 }));
    mockServiceSupabase({ content_entries: { select } });

    await expect(getAdminContentEntries()).rejects.toThrow("select failed");
  });
});
