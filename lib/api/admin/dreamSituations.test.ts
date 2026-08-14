import { describe, expect, it, vi } from "vitest";

import { AdminDreamNotFoundError } from "@/lib/api/admin/dreams";
import { createClient as createPublicClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@/lib/supabase/service";

import {
  AdminDreamSituationNotFoundError,
  AdminDreamSituationValidationError,
  createAdminDreamSituation,
  deleteAdminDreamSituation,
  DuplicateSituationKeywordError,
  getDreamSituationCounts,
  parseAdminDreamSituationInput,
  updateAdminDreamSituation,
  type AdminDreamSituationInput,
} from "./dreamSituations";

vi.mock("@/lib/supabase/service");
vi.mock("@/lib/supabase/server");

const VALID_BODY = {
  keyword: "돼지를-잡는-꿈",
  title: "돼지를 잡는 꿈",
  body: "직접 돼지를 붙잡거나 손으로 제압하는 꿈이다.",
  keyMeaning: "스스로 움직여 얻어내는 성과를 상징한다.",
  numbers: [17, 3],
  displayOrder: 3,
};

const SAMPLE_INPUT: AdminDreamSituationInput = {
  keyword: "돼지를-잡는-꿈",
  title: "돼지를 잡는 꿈",
  body: "직접 돼지를 붙잡거나 손으로 제압하는 꿈이다.",
  keyMeaning: "스스로 움직여 얻어내는 성과를 상징한다.",
  numbers: [3, 17],
  displayOrder: 3,
};

describe("parseAdminDreamSituationInput", () => {
  it("returns the parsed payload for a valid body(numbers를 오름차순 정렬)", () => {
    expect(parseAdminDreamSituationInput(VALID_BODY)).toEqual(SAMPLE_INPUT);
  });

  it("numbers가 없으면 빈 배열(0개)로 취급한다", () => {
    expect(parseAdminDreamSituationInput({ ...VALID_BODY, numbers: undefined })).toMatchObject({
      numbers: [],
    });
  });

  it("keyMeaning이 없으면 null로 취급한다", () => {
    expect(parseAdminDreamSituationInput({ ...VALID_BODY, keyMeaning: undefined })).toMatchObject({
      keyMeaning: null,
    });
  });

  it("본문 내 dream_id/dreamId 필드는 무시한다(요청 본문의 소유권 필드를 신뢰하지 않음)", () => {
    const result = parseAdminDreamSituationInput({ ...VALID_BODY, dreamId: 999, dream_id: 999 });
    expect(result).not.toHaveProperty("dreamId");
    expect(result).not.toHaveProperty("dream_id");
  });

  it.each([
    ["null body", null],
    ["non-object body", "not-an-object"],
    ["빈 keyword", { ...VALID_BODY, keyword: "" }],
    ["keyword 길이 초과", { ...VALID_BODY, keyword: "가".repeat(51) }],
    ["빈 title", { ...VALID_BODY, title: "" }],
    ["title 길이 초과", { ...VALID_BODY, title: "가".repeat(101) }],
    ["빈 body", { ...VALID_BODY, body: "" }],
    ["keyMeaning 길이 초과", { ...VALID_BODY, keyMeaning: "가".repeat(201) }],
    ["numbers 7개", { ...VALID_BODY, numbers: [1, 2, 3, 4, 5, 6, 7] }],
    ["numbers 범위 밖 값", { ...VALID_BODY, numbers: [0, 1] }],
    ["numbers 중복", { ...VALID_BODY, numbers: [3, 3] }],
    ["displayOrder가 음수", { ...VALID_BODY, displayOrder: -1 }],
    ["displayOrder가 정수가 아님", { ...VALID_BODY, displayOrder: 1.5 }],
  ])("rejects: %s", (_label, body) => {
    expect(() => parseAdminDreamSituationInput(body)).toThrow(AdminDreamSituationValidationError);
  });
});

// draws.test.ts와 동일한 mock 빌더 패턴 — insert/update/delete 각각의 체이닝을 흉내낸다.
function mockServiceClient(result: { data: unknown; error: unknown }) {
  const eqCalls: unknown[] = [];
  const builder = {
    insert: vi.fn(() => ({
      select: vi.fn(() => ({ single: vi.fn(() => Promise.resolve(result)) })),
    })),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn((...args: unknown[]) => {
      eqCalls.push(args);
      return builder;
    }),
    select: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  const from = vi.fn(() => builder);
  vi.mocked(createServiceClient).mockReturnValue({ from } as unknown as ReturnType<
    typeof createServiceClient
  >);
  return { from, builder, eqCalls };
}

describe("createAdminDreamSituation", () => {
  it("성공하면 생성된 situation을 반환한다", async () => {
    const created = { id: 1, dream_id: 5, ...SAMPLE_INPUT };
    mockServiceClient({ data: created, error: null });

    const result = await createAdminDreamSituation(5, SAMPLE_INPUT);
    expect(result).toEqual(created);
  });

  it("23505(unique violation)는 DuplicateSituationKeywordError로 변환한다", async () => {
    mockServiceClient({ data: null, error: { code: "23505", message: "duplicate key" } });

    await expect(createAdminDreamSituation(5, SAMPLE_INPUT)).rejects.toThrow(
      DuplicateSituationKeywordError
    );
  });

  it("23503(FK violation)는 AdminDreamNotFoundError로 변환한다(존재하지 않는 부모 dreamId)", async () => {
    mockServiceClient({ data: null, error: { code: "23503", message: "fk violation" } });

    await expect(createAdminDreamSituation(999, SAMPLE_INPUT)).rejects.toThrow(
      AdminDreamNotFoundError
    );
  });

  it("그 외 에러는 그대로 전파한다", async () => {
    mockServiceClient({ data: null, error: new Error("db down") });

    await expect(createAdminDreamSituation(5, SAMPLE_INPUT)).rejects.toThrow("db down");
  });
});

describe("updateAdminDreamSituation", () => {
  it("성공하면 수정된 situation을 반환하고 id+dream_id 둘 다로 필터링한다(소유권 검증)", async () => {
    const updated = { id: 10, dream_id: 5, ...SAMPLE_INPUT };
    const { eqCalls } = mockServiceClient({ data: updated, error: null });

    const result = await updateAdminDreamSituation(5, 10, SAMPLE_INPUT);
    expect(result).toEqual(updated);
    expect(eqCalls).toContainEqual(["id", 10]);
    expect(eqCalls).toContainEqual(["dream_id", 5]);
  });

  it("소유권 불일치(다른 dream 소속) 또는 존재하지 않으면 AdminDreamSituationNotFoundError", async () => {
    mockServiceClient({ data: null, error: null });

    await expect(updateAdminDreamSituation(5, 10, SAMPLE_INPUT)).rejects.toThrow(
      AdminDreamSituationNotFoundError
    );
  });

  it("23505(unique violation)는 DuplicateSituationKeywordError로 변환한다", async () => {
    mockServiceClient({ data: null, error: { code: "23505", message: "duplicate key" } });

    await expect(updateAdminDreamSituation(5, 10, SAMPLE_INPUT)).rejects.toThrow(
      DuplicateSituationKeywordError
    );
  });
});

describe("deleteAdminDreamSituation", () => {
  it("성공하면 조용히 반환한다", async () => {
    mockServiceClient({ data: { id: 10 }, error: null });

    await expect(deleteAdminDreamSituation(5, 10)).resolves.toBeUndefined();
  });

  it("소유권 불일치 또는 존재하지 않으면 AdminDreamSituationNotFoundError", async () => {
    mockServiceClient({ data: null, error: null });

    await expect(deleteAdminDreamSituation(5, 10)).rejects.toThrow(
      AdminDreamSituationNotFoundError
    );
  });
});

describe("getDreamSituationCounts", () => {
  it("dream_id별 situation 개수를 집계한다", async () => {
    const from = vi.fn(() => ({
      select: vi.fn(() =>
        Promise.resolve({
          data: [{ dream_id: 1 }, { dream_id: 1 }, { dream_id: 2 }],
          error: null,
        })
      ),
    }));
    vi.mocked(createPublicClient).mockResolvedValue({ from } as unknown as Awaited<
      ReturnType<typeof createPublicClient>
    >);

    const counts = await getDreamSituationCounts();
    expect(counts.get(1)).toBe(2);
    expect(counts.get(2)).toBe(1);
    expect(counts.get(999)).toBeUndefined();
  });
});
