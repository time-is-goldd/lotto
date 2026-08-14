import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getFaqEntries, getGuideByTopic, getGuideEntries } from "./content";

vi.mock("@supabase/supabase-js");

// createPublicClient()가 createClient(...)의 인자로 getEnv()를 호출한다 — createClient 자체는
// 모킹돼도 그 인자는 실제로 평가되므로, lib/auth/kakao.test.ts와 동일한 패턴으로 필요한
// 환경변수를 직접 설정한다(실제 값이 아니어도 되며, mockSupabase가 결과를 대체한다).
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

// lib/api/dreams.test.ts와 동일한 체이닝 흉내 패턴 — select/eq/order는 서로를 반환하고,
// 어느 지점에서 await하더라도(then) 최종 결과로 resolve된다. maybeSingle은 그 자체가 Promise다.
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
  vi.mocked(createClient).mockReturnValue({ from } as unknown as ReturnType<typeof createClient>);
  return { from };
}

const SAMPLE_FAQS = [
  { id: 1, type: "faq", title: "환불은요?", body: "마이페이지에서 신청", display_order: 0, updated_at: "t" },
  { id: 2, type: "faq", title: "회원 탈퇴는요?", body: "설정에서 가능", display_order: 1, updated_at: "t" },
];

const SAMPLE_GUIDES = [
  { id: 3, type: "guide", title: "번호 생성 가이드", body: "생성 방법 설명", display_order: 0, updated_at: "t" },
];

describe("getFaqEntries", () => {
  it("faq 목록을 반환하고 display_order → id 순으로 정렬 조건을 건다", async () => {
    const { from } = mockSupabase({ data: SAMPLE_FAQS, error: null });

    const result = await getFaqEntries();

    const builder = from.mock.results[0].value;
    expect(builder.eq).toHaveBeenCalledWith("type", "faq");
    expect(builder.order).toHaveBeenNthCalledWith(1, "display_order", { ascending: true });
    expect(builder.order).toHaveBeenNthCalledWith(2, "id", { ascending: true });
    expect(result).toEqual(SAMPLE_FAQS);
  });

  it("데이터가 없으면 빈 배열을 반환한다", async () => {
    mockSupabase({ data: null, error: null });

    expect(await getFaqEntries()).toEqual([]);
  });

  it("Supabase 오류를 그대로 전파한다", async () => {
    mockSupabase({ data: null, error: new Error("db down") });

    await expect(getFaqEntries()).rejects.toThrow("db down");
  });
});

describe("getGuideEntries", () => {
  it("guide 목록만 반환한다(faq 제외 — type 필터로 보장)", async () => {
    const { from } = mockSupabase({ data: SAMPLE_GUIDES, error: null });

    const result = await getGuideEntries();

    const builder = from.mock.results[0].value;
    expect(builder.eq).toHaveBeenCalledWith("type", "guide");
    expect(result).toEqual(SAMPLE_GUIDES);
  });

  it("정렬 조건(display_order → id)을 건다", async () => {
    const { from } = mockSupabase({ data: SAMPLE_GUIDES, error: null });

    await getGuideEntries();

    const builder = from.mock.results[0].value;
    expect(builder.order).toHaveBeenNthCalledWith(1, "display_order", { ascending: true });
    expect(builder.order).toHaveBeenNthCalledWith(2, "id", { ascending: true });
  });

  it("Supabase 오류를 그대로 전파한다", async () => {
    mockSupabase({ data: null, error: new Error("db down") });

    await expect(getGuideEntries()).rejects.toThrow("db down");
  });
});

describe("getGuideByTopic", () => {
  it("정확히 일치하는 topic의 guide를 반환한다", async () => {
    const { from } = mockSupabase({ data: SAMPLE_GUIDES[0], error: null });

    const result = await getGuideByTopic("번호 생성 가이드");

    const builder = from.mock.results[0].value;
    expect(builder.eq).toHaveBeenNthCalledWith(1, "type", "guide");
    expect(builder.eq).toHaveBeenNthCalledWith(2, "title", "번호 생성 가이드");
    expect(result).toEqual(SAMPLE_GUIDES[0]);
  });

  it("type='guide' 조건이 항상 함께 걸려 동일 title의 FAQ와 혼동하지 않는다", async () => {
    const { from } = mockSupabase({ data: null, error: null });

    await getGuideByTopic("환불은요?");

    const builder = from.mock.results[0].value;
    // eq("type","guide")가 eq("title", ...)보다 먼저 걸려, FAQ 행(type='faq')은애초에
    // 쿼리 조건에서 제외된다 — 서비스 로직이 아니라 DB 쿼리 자체가 혼동을 차단한다.
    expect(builder.eq).toHaveBeenNthCalledWith(1, "type", "guide");
  });

  it("존재하지 않는 topic은 null을 반환한다(에러 아님)", async () => {
    mockSupabase({ data: null, error: null });

    expect(await getGuideByTopic("존재하지않는가이드")).toBeNull();
  });

  it("Supabase 오류를 그대로 전파한다", async () => {
    mockSupabase({ data: null, error: new Error("db down") });

    await expect(getGuideByTopic("번호 생성 가이드")).rejects.toThrow("db down");
  });
});
