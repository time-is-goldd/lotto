import { describe, expect, it, vi } from "vitest";

import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

import { isAdmin } from "./isAdmin";

vi.mock("@/lib/auth/session");
vi.mock("@/lib/supabase/server");

function mockAdminsSelectResult(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn(() => Promise.resolve(result));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  vi.mocked(createClient).mockResolvedValue({ from } as never);
  return { from, select, eq, maybeSingle };
}

describe("isAdmin", () => {
  it("비로그인이면 admins를 조회하지 않고 false를 반환한다", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { from } = mockAdminsSelectResult({ data: null, error: null });

    expect(await isAdmin()).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("일반 사용자(admins에 본인 행 없음)는 false를 반환한다", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-a" } as never);
    const { from, eq } = mockAdminsSelectResult({ data: null, error: null });

    expect(await isAdmin()).toBe(false);
    expect(from).toHaveBeenCalledWith("admins");
    expect(eq).toHaveBeenCalledWith("user_id", "user-a");
  });

  it("관리자(admins에 본인 행 존재)는 true를 반환한다", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "admin-a" } as never);
    mockAdminsSelectResult({ data: { id: 1 }, error: null });

    expect(await isAdmin()).toBe(true);
  });

  it("DB 오류가 발생하면 fail-closed로 false를 반환한다(true를 반환하지 않는다)", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-a" } as never);
    mockAdminsSelectResult({ data: null, error: new Error("connection failed") });

    expect(await isAdmin()).toBe(false);
  });
});
