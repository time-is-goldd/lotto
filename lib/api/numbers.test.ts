import { describe, expect, it, vi } from "vitest";

import { getDreamById } from "@/lib/api/dreams";
import { createClient } from "@/lib/supabase/server";

import {
  DreamNotFoundError,
  NumbersValidationError,
  parseDreamContext,
  parseNumbersInput,
  saveUserNumbers,
} from "./numbers";

vi.mock("@/lib/supabase/server");
vi.mock("@/lib/api/dreams");

const VALID = [1, 2, 3, 4, 5, 6];

describe("parseNumbersInput", () => {
  it("returns the numbers array when the payload is a valid game", () => {
    expect(parseNumbersInput({ numbers: VALID })).toEqual(VALID);
  });

  it("ignores extra fields such as a forged user_id", () => {
    const result = parseNumbersInput({ numbers: VALID, user_id: "someone-elses-uuid" });
    expect(result).toEqual(VALID);
  });

  it.each([
    ["null body", null],
    ["non-object body", "not-an-object"],
    ["missing numbers", {}],
    ["numbers is not an array", { numbers: "1,2,3,4,5,6" }],
    ["numbers is an object", { numbers: { 0: 1 } }],
    ["empty array", { numbers: [] }],
    ["5 numbers", { numbers: [1, 2, 3, 4, 5] }],
    ["7 numbers", { numbers: [1, 2, 3, 4, 5, 6, 7] }],
    ["contains a string", { numbers: [1, 2, 3, 4, 5, "6"] }],
    ["contains a decimal", { numbers: [1, 2, 3, 4, 5, 5.5] }],
    ["contains 0", { numbers: [0, 1, 2, 3, 4, 5] }],
    ["contains 46", { numbers: [1, 2, 3, 4, 5, 46] }],
    ["contains a negative number", { numbers: [-1, 1, 2, 3, 4, 5] }],
    ["has a duplicate", { numbers: [1, 1, 2, 3, 4, 5] }],
    ["is not sorted ascending", { numbers: [6, 5, 4, 3, 2, 1] }],
  ])("rejects: %s", (_label, body) => {
    expect(() => parseNumbersInput(body)).toThrow(NumbersValidationError);
  });
});

describe("parseDreamContext", () => {
  it("returns the auto default when the body has no generationMethod", () => {
    expect(parseDreamContext({ numbers: VALID })).toEqual({
      generationMethod: "auto",
      relatedDreamId: null,
    });
  });

  it("returns the auto default for a non-object body", () => {
    expect(parseDreamContext(null)).toEqual({ generationMethod: "auto", relatedDreamId: null });
  });

  it("accepts generationMethod: 'dream' with a numeric relatedDreamId", () => {
    expect(parseDreamContext({ numbers: VALID, generationMethod: "dream", relatedDreamId: 5 })).toEqual({
      generationMethod: "dream",
      relatedDreamId: 5,
    });
  });

  it("accepts a numeric string relatedDreamId (query-param origin)", () => {
    expect(parseDreamContext({ generationMethod: "dream", relatedDreamId: "5" })).toEqual({
      generationMethod: "dream",
      relatedDreamId: 5,
    });
  });

  it.each([
    ["unknown generationMethod value", { generationMethod: "fortune", relatedDreamId: 1 }],
    ["generationMethod dream without relatedDreamId", { generationMethod: "dream" }],
    ["relatedDreamId is zero", { generationMethod: "dream", relatedDreamId: 0 }],
    ["relatedDreamId is negative", { generationMethod: "dream", relatedDreamId: -1 }],
    ["relatedDreamId is a decimal", { generationMethod: "dream", relatedDreamId: 1.5 }],
    ["relatedDreamId is a non-numeric string", { generationMethod: "dream", relatedDreamId: "abc" }],
  ])("rejects: %s", (_label, body) => {
    expect(() => parseDreamContext(body)).toThrow(NumbersValidationError);
  });
});

function mockInsertResult(result: { data?: unknown; error?: unknown }) {
  const single = vi.fn(() => Promise.resolve(result));
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert }));
  vi.mocked(createClient).mockResolvedValue({ from } as never);
  return { from, insert, select, single };
}

describe("saveUserNumbers", () => {
  it("inserts with the given userId, the exact numbers, and generation_method fixed to 'auto'", async () => {
    const savedRow = { id: 1, user_id: "user-a", numbers: VALID, generation_method: "auto" };
    const { from, insert } = mockInsertResult({ data: savedRow, error: null });

    const result = await saveUserNumbers("user-a", VALID);

    expect(from).toHaveBeenCalledWith("user_numbers");
    expect(insert).toHaveBeenCalledWith({
      user_id: "user-a",
      numbers: VALID,
      generation_method: "auto",
    });
    expect(result).toEqual(savedRow);
  });

  it("throws the underlying error on DB failure instead of swallowing it", async () => {
    mockInsertResult({ data: null, error: new Error("insert failed") });

    await expect(saveUserNumbers("user-a", VALID)).rejects.toThrow("insert failed");
  });

  it("inserts generation_method='dream' and related_dream_id when a valid dream context is given", async () => {
    vi.mocked(getDreamById).mockResolvedValue({ id: 5 } as never);
    const savedRow = { id: 2, user_id: "user-a", numbers: VALID, generation_method: "dream", related_dream_id: 5 };
    const { insert } = mockInsertResult({ data: savedRow, error: null });

    const result = await saveUserNumbers("user-a", VALID, { generationMethod: "dream", relatedDreamId: 5 });

    expect(getDreamById).toHaveBeenCalledWith(5);
    expect(insert).toHaveBeenCalledWith({
      user_id: "user-a",
      numbers: VALID,
      generation_method: "dream",
      related_dream_id: 5,
    });
    expect(result).toEqual(savedRow);
  });

  it("rejects with DreamNotFoundError when relatedDreamId does not exist, without inserting", async () => {
    vi.mocked(getDreamById).mockResolvedValue(null);
    const { insert } = mockInsertResult({ data: null, error: null });

    await expect(
      saveUserNumbers("user-a", VALID, { generationMethod: "dream", relatedDreamId: 999 })
    ).rejects.toThrow(DreamNotFoundError);
    expect(insert).not.toHaveBeenCalled();
  });
});
