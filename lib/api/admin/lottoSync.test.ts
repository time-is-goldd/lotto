import { beforeEach, describe, expect, it, vi } from "vitest";

import { DuplicateRoundError, registerDrawAndMatchUserNumbers } from "@/lib/api/admin/draws";
import { getTrustedDrawResult, type TrustedDrawResult } from "@/lib/lotto/sources";
import { createClient as createServiceClient } from "@/lib/supabase/service";

import { syncOfficialLottoDraws } from "./lottoSync";

vi.mock("@/lib/supabase/service");
vi.mock("@/lib/lotto/sources", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/lotto/sources")>();
  return { ...actual, getTrustedDrawResult: vi.fn() };
});
vi.mock("@/lib/api/admin/draws", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin/draws")>();
  return { ...actual, registerDrawAndMatchUserNumbers: vi.fn() };
});

interface StoredDraw {
  round: number;
  numbers: number[];
  bonus_number: number;
}

// draws 테이블을 흉내 낸 최소 in-memory 모델 — Phase10-6과 동일한 이유로 latest round
// 조회(order+limit)와 "특정 round 존재 여부" 조회(eq+limit)를 분리한다.
function mockSupabase(options: {
  latestRound: number | null;
  existingByRound?: Record<number, StoredDraw>;
}) {
  const { latestRound, existingByRound = {} } = options;
  const from = vi.fn((table: string) => {
    if (table !== "draws") {
      throw new Error(`unexpected table: ${table}`);
    }
    return {
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() =>
            Promise.resolve({
              data: latestRound === null ? [] : [{ round: latestRound }],
              error: null,
            })
          ),
        })),
        eq: vi.fn((_col: "round", value: number) => ({
          limit: vi.fn(() =>
            Promise.resolve({
              data: value in existingByRound ? [existingByRound[value]] : [],
              error: null,
            })
          ),
        })),
      })),
    };
  });
  vi.mocked(createServiceClient).mockReturnValue({ from } as unknown as ReturnType<
    typeof createServiceClient
  >);
}

function officialResult(round: number, numbers: number[], bonusNumber: number): TrustedDrawResult {
  return {
    status: "official",
    round,
    draw: { round, drawDate: "2026-08-15", numbers, bonusNumber, source: "dhlottery.co.kr" },
    firstPrizeAmount: 2_000_000_000,
    firstPrizeCount: 10,
    provenance: { mode: "official" },
    message: "공식 소스에서 정상 조회됐습니다.",
  };
}

function fallbackConsensusResult(
  round: number,
  numbers: number[],
  bonusNumber: number
): TrustedDrawResult {
  return {
    status: "fallback-consensus",
    round,
    draw: { round, drawDate: "2026-08-15", numbers, bonusNumber, source: "lottis.kr" },
    firstPrizeAmount: 2_000_000_000,
    firstPrizeCount: 10,
    provenance: { mode: "secondary-consensus", sources: ["lottis.kr", "datalotto.kr"] },
    message: "보조 출처 2곳이 일치해 fallback으로 등록합니다.",
  };
}

function notFoundResult(round: number): TrustedDrawResult {
  return {
    status: "official-round-not-found",
    round,
    draw: null,
    firstPrizeAmount: null,
    firstPrizeCount: null,
    provenance: null,
    message: `${round}회는 아직 공식 발표되지 않았습니다.`,
  };
}

describe("syncOfficialLottoDraws", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("DB가 최신 상태면(broker가 아직 없다고 보고) up-to-date를 반환하고 아무것도 등록하지 않는다", async () => {
    mockSupabase({ latestRound: 1236 });
    vi.mocked(getTrustedDrawResult).mockResolvedValue(notFoundResult(1237));

    const result = await syncOfficialLottoDraws();

    expect(result).toEqual({
      status: "up-to-date",
      syncedRounds: [],
      conflictRound: null,
      message: "이미 최신 상태입니다.",
    });
    expect(registerDrawAndMatchUserNumbers).not.toHaveBeenCalled();
  });

  it("secondary-round-not-found도 official-round-not-found와 동일하게 정상 종료로 취급한다", async () => {
    mockSupabase({ latestRound: 1236 });
    vi.mocked(getTrustedDrawResult).mockResolvedValue({
      status: "secondary-round-not-found",
      round: 1237,
      draw: null,
      firstPrizeAmount: null,
      firstPrizeCount: null,
      provenance: null,
      message: "공식 소스에는 접근하지 못했지만, 보조 출처 확인 결과 아직 발표되지 않았습니다.",
    });

    const result = await syncOfficialLottoDraws();

    expect(result.status).toBe("up-to-date");
    expect(registerDrawAndMatchUserNumbers).not.toHaveBeenCalled();
  });

  it("official 결과가 있으면 source: dhlottery.co.kr로 등록한다", async () => {
    mockSupabase({ latestRound: 1236 });
    vi.mocked(getTrustedDrawResult)
      .mockResolvedValueOnce(officialResult(1237, [3, 11, 17, 24, 33, 41], 9))
      .mockResolvedValueOnce(notFoundResult(1238));
    vi.mocked(registerDrawAndMatchUserNumbers).mockResolvedValue({
      round: 1237,
      matchedCount: 0,
      winnersCount: 0,
      failedUpdateIds: [],
    });

    const result = await syncOfficialLottoDraws();

    expect(result.status).toBe("synced");
    expect(result.syncedRounds).toEqual([1237]);
    expect(registerDrawAndMatchUserNumbers).toHaveBeenCalledWith(
      {
        round: 1237,
        winningNumbers: [3, 11, 17, 24, 33, 41],
        bonusNumber: 9,
        firstPrizeAmount: 2_000_000_000,
        firstPrizeCount: 10,
      },
      { source: "dhlottery.co.kr" }
    );
  });

  it("fallback-consensus 결과는 source: lottis.kr+datalotto.kr로 등록한다(provenance 반영)", async () => {
    mockSupabase({ latestRound: 1236 });
    vi.mocked(getTrustedDrawResult)
      .mockResolvedValueOnce(fallbackConsensusResult(1237, [3, 11, 17, 24, 33, 41], 9))
      .mockResolvedValueOnce(notFoundResult(1238));
    vi.mocked(registerDrawAndMatchUserNumbers).mockResolvedValue({
      round: 1237,
      matchedCount: 0,
      winnersCount: 0,
      failedUpdateIds: [],
    });

    const result = await syncOfficialLottoDraws();

    expect(result.status).toBe("synced");
    expect(registerDrawAndMatchUserNumbers).toHaveBeenCalledWith(expect.anything(), {
      source: "lottis.kr+datalotto.kr",
    });
  });

  it("같은 회차를 2번 동기화해도(이미 동일 값으로 존재) idempotent하게 재등록하지 않는다", async () => {
    mockSupabase({
      latestRound: 1236,
      existingByRound: { 1237: { round: 1237, numbers: [3, 11, 17, 24, 33, 41], bonus_number: 9 } },
    });
    vi.mocked(getTrustedDrawResult)
      .mockResolvedValueOnce(officialResult(1237, [3, 11, 17, 24, 33, 41], 9))
      .mockResolvedValueOnce(notFoundResult(1238));

    const result = await syncOfficialLottoDraws();

    expect(result).toEqual({
      status: "up-to-date",
      syncedRounds: [],
      conflictRound: null,
      message: "이미 최신 상태입니다.",
    });
    expect(registerDrawAndMatchUserNumbers).not.toHaveBeenCalled();
  });

  it("DB에 이미 있는 회차와 결과가 다르면 DRAW_CONFLICT — 덮어쓰지 않고 중단한다", async () => {
    mockSupabase({
      latestRound: 1236,
      existingByRound: { 1237: { round: 1237, numbers: [1, 2, 3, 4, 5, 6], bonus_number: 7 } },
    });
    vi.mocked(getTrustedDrawResult).mockResolvedValueOnce(
      officialResult(1237, [1, 2, 3, 4, 5, 7], 8)
    );

    const result = await syncOfficialLottoDraws();

    expect(result.status).toBe("conflict");
    expect(result.conflictRound).toBe(1237);
    expect(registerDrawAndMatchUserNumbers).not.toHaveBeenCalled();
  });

  it("source-disagreement이면 DB를 건드리지 않고 그 상태를 그대로 보고한다", async () => {
    mockSupabase({ latestRound: 1236 });
    vi.mocked(getTrustedDrawResult).mockResolvedValueOnce({
      status: "source-disagreement",
      round: 1237,
      draw: null,
      firstPrizeAmount: null,
      firstPrizeCount: null,
      provenance: null,
      message: "보조 출처 간 결과가 일치하지 않습니다.",
    });

    const result = await syncOfficialLottoDraws();

    expect(result.status).toBe("source-disagreement");
    expect(registerDrawAndMatchUserNumbers).not.toHaveBeenCalled();
  });

  it("fallback-disabled이면 DB를 건드리지 않고 그 상태를 그대로 보고한다", async () => {
    mockSupabase({ latestRound: 1236 });
    vi.mocked(getTrustedDrawResult).mockResolvedValueOnce({
      status: "fallback-disabled",
      round: 1237,
      draw: null,
      firstPrizeAmount: null,
      firstPrizeCount: null,
      provenance: { mode: "secondary-consensus", sources: ["lottis.kr", "datalotto.kr"] },
      message: "보조 출처가 일치했지만 자동 등록이 꺼져 있습니다.",
    });

    const result = await syncOfficialLottoDraws();

    expect(result.status).toBe("fallback-disabled");
    expect(registerDrawAndMatchUserNumbers).not.toHaveBeenCalled();
  });

  it("official-parse-failure/all-sources-unavailable 등은 source-unavailable로 묶여 DB를 건드리지 않는다", async () => {
    mockSupabase({ latestRound: 1236 });
    vi.mocked(getTrustedDrawResult).mockResolvedValueOnce({
      status: "official-parse-failure",
      round: 1237,
      draw: null,
      firstPrizeAmount: null,
      firstPrizeCount: null,
      provenance: null,
      message: "공식 응답을 신뢰할 수 없습니다.",
    });

    const result = await syncOfficialLottoDraws();

    expect(result.status).toBe("source-unavailable");
    expect(registerDrawAndMatchUserNumbers).not.toHaveBeenCalled();
  });

  it("누락된 회차 여러 개를 순차적으로 복구한다", async () => {
    mockSupabase({ latestRound: 1236 });
    vi.mocked(getTrustedDrawResult)
      .mockResolvedValueOnce(officialResult(1237, [1, 2, 3, 4, 5, 7], 8))
      .mockResolvedValueOnce(officialResult(1238, [1, 2, 3, 4, 5, 8], 9))
      .mockResolvedValueOnce(officialResult(1239, [1, 2, 3, 4, 5, 9], 10))
      .mockResolvedValueOnce(notFoundResult(1240));
    vi.mocked(registerDrawAndMatchUserNumbers).mockResolvedValue({
      round: 0,
      matchedCount: 0,
      winnersCount: 0,
      failedUpdateIds: [],
    });

    const result = await syncOfficialLottoDraws();

    expect(result.status).toBe("synced");
    expect(result.syncedRounds).toEqual([1237, 1238, 1239]);
    expect(registerDrawAndMatchUserNumbers).toHaveBeenCalledTimes(3);
  });

  it("등록 중 DuplicateRoundError(동시 실행 경쟁)가 나면 idempotent skip으로 처리하고 계속 진행한다", async () => {
    mockSupabase({ latestRound: 1236 });
    vi.mocked(getTrustedDrawResult)
      .mockResolvedValueOnce(officialResult(1237, [1, 2, 3, 4, 5, 7], 8))
      .mockResolvedValueOnce(notFoundResult(1238));
    vi.mocked(registerDrawAndMatchUserNumbers).mockRejectedValueOnce(new DuplicateRoundError(1237));

    const result = await syncOfficialLottoDraws();

    expect(result.status).toBe("up-to-date");
    expect(result.syncedRounds).toEqual([]);
  });

  it("DB가 완전히 비어 있으면 round 1부터 시도한다", async () => {
    mockSupabase({ latestRound: null });
    vi.mocked(getTrustedDrawResult).mockResolvedValue(notFoundResult(1));

    await syncOfficialLottoDraws();

    expect(getTrustedDrawResult).toHaveBeenCalledWith(1);
  });
});
