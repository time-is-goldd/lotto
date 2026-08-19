import { describe, expect, it, vi } from "vitest";

import { createClient as createServiceClient } from "@/lib/supabase/service";

import { AdminAccountProtectedError, deleteAccount } from "./deleteAccount";

vi.mock("@/lib/supabase/service");

type Call = { table: string; op: "select" | "delete"; column: string; value: unknown };

// isAdmin.test.ts(lib/auth/isAdmin.test.ts)의 mock 체이닝 패턴을 참고했다 — 이 파일은
// deleteAccount()가 admins 조회 1건 + 여러 테이블 delete + auth.admin.deleteUser 1건을
// "정확한 순서"로 호출하는지까지 검증해야 해서, 호출 순서를 기록하는 calls 배열을 추가했다.
function createMockClient(options: {
  adminsResult?: { data: unknown; error: unknown };
  deleteErrors?: Partial<Record<string, unknown>>;
  deleteUserError?: unknown;
}) {
  const calls: Call[] = [];

  function from(table: string) {
    return {
      select: () => ({
        eq: (column: string, value: unknown) => {
          calls.push({ table, op: "select", column, value });
          return {
            maybeSingle: () =>
              Promise.resolve(options.adminsResult ?? { data: null, error: null }),
          };
        },
      }),
      delete: () => ({
        eq: (column: string, value: unknown) => {
          calls.push({ table, op: "delete", column, value });
          return Promise.resolve({ error: options.deleteErrors?.[table] ?? null });
        },
      }),
    };
  }

  const deleteUser = vi.fn(() =>
    Promise.resolve({ error: options.deleteUserError ?? null })
  );

  return {
    calls,
    deleteUser,
    client: { from, auth: { admin: { deleteUser } } },
  };
}

describe("deleteAccount", () => {
  it("admins에 본인 행이 있으면 AdminAccountProtectedError를 던지고 어떤 테이블도 건드리지 않는다", async () => {
    const { client, calls, deleteUser } = createMockClient({
      adminsResult: { data: { id: 1 }, error: null },
    });
    vi.mocked(createServiceClient).mockReturnValue(client as never);

    await expect(deleteAccount("admin-user")).rejects.toBeInstanceOf(AdminAccountProtectedError);

    expect(calls).toEqual([{ table: "admins", op: "select", column: "user_id", value: "admin-user" }]);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("admins 조회 자체가 실패하면(DB 오류) 그 오류를 그대로 던지고 삭제를 진행하지 않는다", async () => {
    const dbError = new Error("connection failed");
    const { client, deleteUser } = createMockClient({
      adminsResult: { data: null, error: dbError },
    });
    vi.mocked(createServiceClient).mockReturnValue(client as never);

    await expect(deleteAccount("user-a")).rejects.toBe(dbError);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("일반 사용자는 자식 테이블 → profiles → auth.users 순서로 정확히 삭제한다", async () => {
    const { client, calls, deleteUser } = createMockClient({});
    vi.mocked(createServiceClient).mockReturnValue(client as never);

    await deleteAccount("user-a");

    expect(calls).toEqual([
      { table: "admins", op: "select", column: "user_id", value: "user-a" },
      { table: "notifications", op: "delete", column: "user_id", value: "user-a" },
      { table: "user_numbers", op: "delete", column: "user_id", value: "user-a" },
      { table: "dream_journal_entries", op: "delete", column: "user_id", value: "user-a" },
      { table: "fortune_results", op: "delete", column: "user_id", value: "user-a" },
      { table: "user_period_stats", op: "delete", column: "user_id", value: "user-a" },
      { table: "share_cards", op: "delete", column: "user_id", value: "user-a" },
      { table: "profiles", op: "delete", column: "id", value: "user-a" },
    ]);
    expect(deleteUser).toHaveBeenCalledWith("user-a");
  });

  it("자식 테이블 삭제 중 하나가 실패하면 그 자리에서 멈추고 이후 단계(profiles/auth.users)를 실행하지 않는다", async () => {
    const dbError = new Error("fortune_results delete failed");
    const { client, calls, deleteUser } = createMockClient({
      deleteErrors: { fortune_results: dbError },
    });
    vi.mocked(createServiceClient).mockReturnValue(client as never);

    await expect(deleteAccount("user-a")).rejects.toBe(dbError);

    const tablesTouched = calls.map((c) => c.table);
    expect(tablesTouched).toEqual([
      "admins",
      "notifications",
      "user_numbers",
      "dream_journal_entries",
      "fortune_results",
    ]);
    expect(tablesTouched).not.toContain("profiles");
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("auth.users 삭제(admin.deleteUser)가 실패하면 오류를 던진다(이미 DB 데이터는 정리된 뒤다)", async () => {
    const authError = new Error("auth delete failed");
    const { client, calls } = createMockClient({ deleteUserError: authError });
    vi.mocked(createServiceClient).mockReturnValue(client as never);

    await expect(deleteAccount("user-a")).rejects.toBe(authError);
    expect(calls.map((c) => c.table)).toContain("profiles");
  });

  it("이미 자식/프로필 데이터가 없는 상태(재시도)에서도 에러 없이 완료된다 — idempotent", async () => {
    const { client, deleteUser } = createMockClient({});
    vi.mocked(createServiceClient).mockReturnValue(client as never);

    await expect(deleteAccount("user-a")).resolves.toBeUndefined();
    expect(deleteUser).toHaveBeenCalledWith("user-a");
  });
});
