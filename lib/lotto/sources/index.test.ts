import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchDatalottoDraw } from "./datalotto";
import {
  fetchOfficialDraw,
  OfficialLottoParseFailureError,
  OfficialLottoRoundNotFoundError,
  OfficialLottoSourceError,
} from "./dhlottery";
import { getTrustedDrawResult, isSecondaryFallbackEnabled } from "./index";
import { fetchLottisDraw, fetchLottisPrizeInfo } from "./lottis";
import { DrawSourceRoundNotFoundError, type DrawSourceResult } from "./types";

vi.mock("./dhlottery", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./dhlottery")>();
  return { ...actual, fetchOfficialDraw: vi.fn() };
});
vi.mock("./lottis", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lottis")>();
  return { ...actual, fetchLottisDraw: vi.fn(), fetchLottisPrizeInfo: vi.fn() };
});
vi.mock("./datalotto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./datalotto")>();
  return { ...actual, fetchDatalottoDraw: vi.fn() };
});

const OFFICIAL_DRAW = {
  round: 1237,
  drawDate: "2026-08-15",
  numbers: [3, 11, 17, 24, 33, 41],
  bonusNumber: 9,
  firstPrizeAmount: 2_100_000_000,
  firstPrizeCount: 12,
};

const SECONDARY_A: DrawSourceResult = {
  round: 1237,
  drawDate: "2026-08-15",
  numbers: [3, 11, 17, 24, 33, 41],
  bonusNumber: 9,
  source: "lottis.kr",
};

const SECONDARY_B: DrawSourceResult = {
  round: 1237,
  drawDate: "2026-08-15",
  numbers: [3, 11, 17, 24, 33, 41],
  bonusNumber: 9,
  source: "datalotto.kr",
};

describe("getTrustedDrawResult", () => {
  const originalEnv = process.env.LOTTO_SECONDARY_FALLBACK_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LOTTO_SECONDARY_FALLBACK_ENABLED;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.LOTTO_SECONDARY_FALLBACK_ENABLED;
    } else {
      process.env.LOTTO_SECONDARY_FALLBACK_ENABLED = originalEnv;
    }
  });

  it("공식 소스가 성공하면 secondary를 전혀 조회하지 않고 official 결과를 반환한다", async () => {
    vi.mocked(fetchOfficialDraw).mockResolvedValue(OFFICIAL_DRAW);

    const result = await getTrustedDrawResult(1237);

    expect(result.status).toBe("official");
    expect(result.provenance).toEqual({ mode: "official" });
    expect(result.firstPrizeAmount).toBe(2_100_000_000);
    expect(fetchLottisDraw).not.toHaveBeenCalled();
    expect(fetchDatalottoDraw).not.toHaveBeenCalled();
  });

  it("공식 소스가 아직 미발표(RoundNotFound)면 secondary를 조회하지 않고 그대로 보고한다", async () => {
    vi.mocked(fetchOfficialDraw).mockRejectedValue(new OfficialLottoRoundNotFoundError(1237));

    const result = await getTrustedDrawResult(1237);

    expect(result.status).toBe("official-round-not-found");
    expect(fetchLottisDraw).not.toHaveBeenCalled();
    expect(fetchDatalottoDraw).not.toHaveBeenCalled();
  });

  it("공식 소스 응답이 파싱 실패(OFFICIAL_PARSE_FAILURE)면 secondary로 넘어가지 않는다(보수적 정책, 지시문 §39)", async () => {
    vi.mocked(fetchOfficialDraw).mockRejectedValue(new OfficialLottoParseFailureError("형식 이상"));

    const result = await getTrustedDrawResult(1237);

    expect(result.status).toBe("official-parse-failure");
    expect(fetchLottisDraw).not.toHaveBeenCalled();
    expect(fetchDatalottoDraw).not.toHaveBeenCalled();
  });

  it("공식 소스 네트워크 실패 + secondary A/B 완전 일치 + flag=true → fallback-consensus로 등록 후보가 된다", async () => {
    process.env.LOTTO_SECONDARY_FALLBACK_ENABLED = "true";
    vi.mocked(fetchOfficialDraw).mockRejectedValue(new OfficialLottoSourceError("네트워크 실패"));
    vi.mocked(fetchLottisDraw).mockResolvedValue(SECONDARY_A);
    vi.mocked(fetchDatalottoDraw).mockResolvedValue(SECONDARY_B);
    vi.mocked(fetchLottisPrizeInfo).mockResolvedValue({
      firstPrizeAmount: 2_100_000_000,
      firstPrizeCount: 12,
    });

    const result = await getTrustedDrawResult(1237);

    expect(result.status).toBe("fallback-consensus");
    expect(result.provenance).toEqual({
      mode: "secondary-consensus",
      sources: ["lottis.kr", "datalotto.kr"],
    });
    expect(result.firstPrizeAmount).toBe(2_100_000_000);
    expect(result.firstPrizeCount).toBe(12);
  });

  it("공식 소스 네트워크 실패 + secondary A/B 일치하지만 flag=false(기본값) → fallback-disabled, 등록 정보 없음", async () => {
    vi.mocked(fetchOfficialDraw).mockRejectedValue(new OfficialLottoSourceError("네트워크 실패"));
    vi.mocked(fetchLottisDraw).mockResolvedValue(SECONDARY_A);
    vi.mocked(fetchDatalottoDraw).mockResolvedValue(SECONDARY_B);

    expect(isSecondaryFallbackEnabled()).toBe(false);
    const result = await getTrustedDrawResult(1237);

    expect(result.status).toBe("fallback-disabled");
    expect(result.firstPrizeAmount).toBeNull();
    expect(fetchLottisPrizeInfo).not.toHaveBeenCalled();
  });

  it("공식 소스 실패 + secondary A/B 결과가 다르면 SOURCE_DISAGREEMENT — 등록 후보 아님", async () => {
    process.env.LOTTO_SECONDARY_FALLBACK_ENABLED = "true";
    vi.mocked(fetchOfficialDraw).mockRejectedValue(new OfficialLottoSourceError("네트워크 실패"));
    vi.mocked(fetchLottisDraw).mockResolvedValue(SECONDARY_A);
    vi.mocked(fetchDatalottoDraw).mockResolvedValue({ ...SECONDARY_B, bonusNumber: 15 });

    const result = await getTrustedDrawResult(1237);

    expect(result.status).toBe("source-disagreement");
    expect(result.draw).toBeNull();
  });

  it("공식 소스 실패 + secondary 한 곳만 성공하면 등록 후보가 되지 않는다", async () => {
    process.env.LOTTO_SECONDARY_FALLBACK_ENABLED = "true";
    vi.mocked(fetchOfficialDraw).mockRejectedValue(new OfficialLottoSourceError("네트워크 실패"));
    vi.mocked(fetchLottisDraw).mockResolvedValue(SECONDARY_A);
    vi.mocked(fetchDatalottoDraw).mockRejectedValue(new Error("datalotto down"));

    const result = await getTrustedDrawResult(1237);

    expect(result.status).toBe("single-secondary-success");
    expect(result.draw).toBeNull();
  });

  it("공식 소스 실패 + secondary 둘 다 실패하면 all-sources-unavailable", async () => {
    vi.mocked(fetchOfficialDraw).mockRejectedValue(new OfficialLottoSourceError("네트워크 실패"));
    vi.mocked(fetchLottisDraw).mockRejectedValue(new Error("lottis down"));
    vi.mocked(fetchDatalottoDraw).mockRejectedValue(new Error("datalotto down"));

    const result = await getTrustedDrawResult(1237);

    expect(result.status).toBe("all-sources-unavailable");
  });

  it("공식 소스 실패 + secondary 둘 다 '아직 미발표'면 secondary-round-not-found로 구분한다(공식 소스가 정상이라고 오해하게 만들지 않는다 — 실제 운영자 브라우저 테스트에서 발견한 문제)", async () => {
    vi.mocked(fetchOfficialDraw).mockRejectedValue(new OfficialLottoSourceError("네트워크 실패"));
    vi.mocked(fetchLottisDraw).mockRejectedValue(
      new DrawSourceRoundNotFoundError("lottis.kr", 1237)
    );
    vi.mocked(fetchDatalottoDraw).mockRejectedValue(
      new DrawSourceRoundNotFoundError("datalotto.kr", 1237)
    );

    const result = await getTrustedDrawResult(1237);

    expect(result.status).toBe("secondary-round-not-found");
    expect(result.status).not.toBe("official-round-not-found");
  });

  it("consensus 성립 + flag=true인데 당첨금 정보를 못 가져오면 prize-info-unavailable — 등록 보류", async () => {
    process.env.LOTTO_SECONDARY_FALLBACK_ENABLED = "true";
    vi.mocked(fetchOfficialDraw).mockRejectedValue(new OfficialLottoSourceError("네트워크 실패"));
    vi.mocked(fetchLottisDraw).mockResolvedValue(SECONDARY_A);
    vi.mocked(fetchDatalottoDraw).mockResolvedValue(SECONDARY_B);
    vi.mocked(fetchLottisPrizeInfo).mockResolvedValue(null);

    const result = await getTrustedDrawResult(1237);

    expect(result.status).toBe("prize-info-unavailable");
    expect(result.firstPrizeAmount).toBeNull();
  });

  it("isSecondaryFallbackEnabled는 정확히 문자열 'true'일 때만 true다", () => {
    process.env.LOTTO_SECONDARY_FALLBACK_ENABLED = "TRUE";
    expect(isSecondaryFallbackEnabled()).toBe(false);
    process.env.LOTTO_SECONDARY_FALLBACK_ENABLED = "1";
    expect(isSecondaryFallbackEnabled()).toBe(false);
    process.env.LOTTO_SECONDARY_FALLBACK_ENABLED = "true";
    expect(isSecondaryFallbackEnabled()).toBe(true);
  });
});
