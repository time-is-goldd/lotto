import { describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/service";

import { createWinNotification } from "./notifications";

vi.mock("@/lib/supabase/service");

function mockInsertResult(result: { error: unknown }) {
  const insert = vi.fn(() => Promise.resolve(result));
  const from = vi.fn(() => ({ insert }));
  vi.mocked(createClient).mockReturnValue({ from } as unknown as ReturnType<typeof createClient>);
  return { from, insert };
}

describe("createWinNotification", () => {
  it("type='win_result'로 notifications에 INSERT하고 회차/등수를 본문에 포함한다", async () => {
    const { from, insert } = mockInsertResult({ error: null });

    await createWinNotification("user-a", 1150, 1);

    expect(from).toHaveBeenCalledWith("notifications");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-a",
        type: "win_result",
        title: expect.stringContaining("1150"),
        body: expect.stringContaining("1등"),
        link_url: expect.any(String),
      })
    );
  });

  it("INSERT 실패 시 에러를 그대로 던진다", async () => {
    mockInsertResult({ error: new Error("insert failed") });

    await expect(createWinNotification("user-a", 1150, 1)).rejects.toThrow("insert failed");
  });
});
