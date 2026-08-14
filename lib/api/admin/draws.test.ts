import { beforeEach, describe, expect, it, vi } from "vitest";

import { createWinNotification } from "@/lib/api/notifications";
import { createClient } from "@/lib/supabase/service";

import {
  AdminDrawsValidationError,
  DuplicateRoundError,
  parseAdminDrawsInput,
  registerDrawAndMatchUserNumbers,
} from "./draws";

vi.mock("@/lib/supabase/service");
vi.mock("@/lib/api/notifications");

const WINNING = [1, 2, 3, 4, 5, 6];
const BONUS = 7;
const VALID_BODY = {
  round: 1150,
  winningNumbers: WINNING,
  bonusNumber: BONUS,
  firstPrizeAmount: 2_000_000_000,
  firstPrizeCount: 10,
};

describe("parseAdminDrawsInput", () => {
  it("returns the parsed draw for a valid payload", () => {
    expect(parseAdminDrawsInput(VALID_BODY)).toEqual({
      round: 1150,
      winningNumbers: WINNING,
      bonusNumber: BONUS,
      firstPrizeAmount: 2_000_000_000,
      firstPrizeCount: 10,
    });
  });

  it.each([
    ["null body", null],
    ["non-object body", "not-an-object"],
    ["round이 0", { ...VALID_BODY, round: 0 }],
    ["round이 음수", { ...VALID_BODY, round: -1 }],
    ["round이 정수가 아님", { ...VALID_BODY, round: 1.5 }],
    ["round이 상한 초과", { ...VALID_BODY, round: 100_001 }],
    ["round이 문자열", { ...VALID_BODY, round: "1150" }],
    ["winningNumbers가 5개", { ...VALID_BODY, winningNumbers: [1, 2, 3, 4, 5] }],
    ["winningNumbers가 7개", { ...VALID_BODY, winningNumbers: [1, 2, 3, 4, 5, 6, 7] }],
    ["winningNumbers에 중복", { ...VALID_BODY, winningNumbers: [1, 1, 2, 3, 4, 5] }],
    ["winningNumbers에 범위 밖 값", { ...VALID_BODY, winningNumbers: [0, 1, 2, 3, 4, 5] }],
    ["bonusNumber가 winningNumbers와 중복", { ...VALID_BODY, bonusNumber: 1 }],
    ["bonusNumber가 범위 밖 값", { ...VALID_BODY, bonusNumber: 46 }],
    ["firstPrizeAmount가 음수", { ...VALID_BODY, firstPrizeAmount: -1 }],
    ["firstPrizeAmount가 정수가 아님", { ...VALID_BODY, firstPrizeAmount: 1.5 }],
    ["firstPrizeCount가 음수", { ...VALID_BODY, firstPrizeCount: -1 }],
    [
      "firstPrizeCount가 없음",
      { round: 1150, winningNumbers: WINNING, bonusNumber: BONUS, firstPrizeAmount: 1 },
    ],
  ])("rejects: %s", (_label, body) => {
    expect(() => parseAdminDrawsInput(body)).toThrow(AdminDrawsValidationError);
  });
});

type FromMock = ReturnType<typeof createClient>["from"];

function mockSupabase(options: {
  drawInsertResult: { data: unknown; error: unknown };
  targetsSelectResult?: { data: unknown; error: unknown };
  updateResultForId?: (id: number) => { data: unknown; error: unknown };
}) {
  const {
    drawInsertResult,
    targetsSelectResult = { data: [], error: null },
    updateResultForId,
  } = options;
  const updateCalls: { id: number; payload: unknown }[] = [];

  const from = vi.fn((table: string) => {
    if (table === "draws") {
      return {
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(drawInsertResult)),
          })),
        })),
      };
    }
    if (table === "user_numbers") {
      return {
        select: vi.fn(() => ({
          is: vi.fn(() => ({
            is: vi.fn(() => ({
              not: vi.fn(() => Promise.resolve(targetsSelectResult)),
            })),
          })),
        })),
        update: vi.fn((payload: unknown) => ({
          eq: vi.fn((_col: string, id: number) => ({
            is: vi.fn(() => ({
              select: vi.fn(() => {
                updateCalls.push({ id, payload });
                return Promise.resolve(
                  updateResultForId ? updateResultForId(id) : { data: [{ id }], error: null }
                );
              }),
            })),
          })),
        })),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });

  vi.mocked(createClient).mockReturnValue({ from } as unknown as ReturnType<typeof createClient>);
  return { from: from as unknown as FromMock, updateCalls };
}

describe("registerDrawAndMatchUserNumbers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const draw = {
    id: 1,
    round: 1150,
    numbers: WINNING,
    bonus_number: BONUS,
    first_prize_amount: 2_000_000_000,
    first_prize_count: 10,
    source: "manual",
    created_at: "2026-08-09T00:00:00.000Z",
  };

  it("연결 대상이 없으면 draws만 저장하고 배치 대상은 0건이다", async () => {
    mockSupabase({ drawInsertResult: { data: draw, error: null } });

    const result = await registerDrawAndMatchUserNumbers(VALID_BODY);

    expect(result).toEqual({ round: 1150, matchedCount: 0, winnersCount: 0, failedUpdateIds: [] });
  });

  it("options.source를 넘기지 않으면 INSERT payload에 source 필드를 전혀 넣지 않는다(DB 기본값 'manual' 유지, Phase10-6)", async () => {
    const { from } = mockSupabase({ drawInsertResult: { data: draw, error: null } });

    await registerDrawAndMatchUserNumbers(VALID_BODY);

    const insertCall = (
      vi.mocked(from).mock.results[0].value as { insert: ReturnType<typeof vi.fn> }
    ).insert;
    expect(insertCall).toHaveBeenCalledWith(
      expect.not.objectContaining({ source: expect.anything() })
    );
  });

  it("options.source를 넘기면 INSERT payload에 그대로 반영한다(Phase10-6 자동 동기화용)", async () => {
    const { from } = mockSupabase({ drawInsertResult: { data: draw, error: null } });

    await registerDrawAndMatchUserNumbers(VALID_BODY, { source: "dhlottery.co.kr" });

    const insertCall = (
      vi.mocked(from).mock.results[0].value as { insert: ReturnType<typeof vi.fn> }
    ).insert;
    expect(insertCall).toHaveBeenCalledWith(expect.objectContaining({ source: "dhlottery.co.kr" }));
  });

  it("회차 중복 등록은 DuplicateRoundError를 던지고 대조를 시도하지 않는다", async () => {
    const { from } = mockSupabase({
      drawInsertResult: { data: null, error: { code: "23505", message: "duplicate key" } },
    });

    await expect(registerDrawAndMatchUserNumbers(VALID_BODY)).rejects.toThrow(DuplicateRoundError);
    expect(from).not.toHaveBeenCalledWith("user_numbers");
  });

  it("draws INSERT의 다른 에러는 그대로 전파한다", async () => {
    mockSupabase({
      drawInsertResult: { data: null, error: { code: "23514", message: "check violation" } },
    });

    await expect(registerDrawAndMatchUserNumbers(VALID_BODY)).rejects.toMatchObject({
      code: "23514",
    });
  });

  it("대상 user_numbers를 matchNumbers()로 판정해 UPDATE하고, 당첨자에게만 알림을 생성한다", async () => {
    const targets = [
      { id: 10, user_id: "user-a", numbers: [1, 2, 3, 4, 5, 6] }, // 6개 일치 → 1등
      { id: 11, user_id: "user-b", numbers: [1, 2, 3, 4, 5, 7] }, // 5개+보너스 → 2등
      { id: 12, user_id: "user-c", numbers: [10, 11, 12, 13, 14, 15] }, // 0개 → 낙첨
    ];
    const { updateCalls } = mockSupabase({
      drawInsertResult: { data: draw, error: null },
      targetsSelectResult: { data: targets, error: null },
    });

    const result = await registerDrawAndMatchUserNumbers(VALID_BODY);

    expect(result.matchedCount).toBe(3);
    expect(result.winnersCount).toBe(2);
    expect(result.failedUpdateIds).toEqual([]);

    expect(updateCalls).toEqual([
      {
        id: 10,
        payload: expect.objectContaining({ target_round: 1150, match_count: 6, win_rank: 1 }),
      },
      {
        id: 11,
        payload: expect.objectContaining({ target_round: 1150, match_count: 5, win_rank: 2 }),
      },
      {
        id: 12,
        payload: expect.objectContaining({ target_round: 1150, match_count: 0, win_rank: null }),
      },
    ]);

    expect(createWinNotification).toHaveBeenCalledTimes(2);
    expect(createWinNotification).toHaveBeenCalledWith("user-a", 1150, 1);
    expect(createWinNotification).toHaveBeenCalledWith("user-b", 1150, 2);
    expect(createWinNotification).not.toHaveBeenCalledWith(
      "user-c",
      expect.anything(),
      expect.anything()
    );
  });

  it("일부 행의 UPDATE가 실패해도 나머지 행은 계속 처리하고 실패 id를 반환한다", async () => {
    const targets = [
      { id: 20, user_id: "user-a", numbers: [1, 2, 3, 4, 5, 6] },
      { id: 21, user_id: "user-b", numbers: [10, 11, 12, 13, 14, 15] },
    ];
    const { updateCalls } = mockSupabase({
      drawInsertResult: { data: draw, error: null },
      targetsSelectResult: { data: targets, error: null },
      updateResultForId: (id) =>
        id === 20
          ? { data: null, error: { message: "update failed" } }
          : { data: [{ id }], error: null },
    });

    const result = await registerDrawAndMatchUserNumbers(VALID_BODY);

    expect(result.failedUpdateIds).toEqual([20]);
    expect(updateCalls).toHaveLength(2);
    // id 20은 UPDATE 자체가 실패했으므로 당첨자였더라도 알림을 보내지 않는다.
    expect(createWinNotification).not.toHaveBeenCalledWith(
      "user-a",
      expect.anything(),
      expect.anything()
    );
  });

  it("UPDATE는 에러 없이 성공했지만 0행에 적용됐다면(target_round가 이미 채워짐) 실패로 취급한다", async () => {
    const targets = [{ id: 40, user_id: "user-a", numbers: [1, 2, 3, 4, 5, 6] }];
    const { updateCalls } = mockSupabase({
      drawInsertResult: { data: draw, error: null },
      targetsSelectResult: { data: targets, error: null },
      updateResultForId: () => ({ data: [], error: null }),
    });

    const result = await registerDrawAndMatchUserNumbers(VALID_BODY);

    expect(result.failedUpdateIds).toEqual([40]);
    expect(updateCalls).toHaveLength(1);
    expect(createWinNotification).not.toHaveBeenCalled();
  });

  it("알림 생성이 실패해도 판정 결과(UPDATE)는 되돌리지 않고 예외를 전파하지 않는다", async () => {
    vi.mocked(createWinNotification).mockRejectedValueOnce(new Error("notification insert failed"));
    const targets = [{ id: 30, user_id: "user-a", numbers: [1, 2, 3, 4, 5, 6] }];
    const { updateCalls } = mockSupabase({
      drawInsertResult: { data: draw, error: null },
      targetsSelectResult: { data: targets, error: null },
    });

    const result = await registerDrawAndMatchUserNumbers(VALID_BODY);

    expect(result.winnersCount).toBe(1);
    expect(result.failedUpdateIds).toEqual([]);
    expect(updateCalls).toHaveLength(1);
  });

  it("user_numbers 조회 실패는 그대로 전파한다", async () => {
    mockSupabase({
      drawInsertResult: { data: draw, error: null },
      targetsSelectResult: { data: null, error: { message: "select failed" } },
    });

    await expect(registerDrawAndMatchUserNumbers(VALID_BODY)).rejects.toMatchObject({
      message: "select failed",
    });
  });
});
