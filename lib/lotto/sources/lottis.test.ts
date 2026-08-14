import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchLottisDraw,
  fetchLottisPrizeInfo,
  parseLottisPrizeInfo,
  parseLottisResponse,
} from "./lottis";
import { DrawSourceError, DrawSourceRoundNotFoundError } from "./types";

// 실제 lottis.kr(https://lottis.kr/lotto/1227) 페이지를 이 파일 작성 시점에 직접 조회해
// 확인한 구조를 최소화한 fixture다(§37, 전체 45KB 페이지 대신 파싱에 필요한 JSON-LD
// "Dataset" 블록만 남겼다). 실측 당시 이 블록은 <script type="application/ld+json"> 태그
// 안에 이스케이프 없이 그대로 있었다(RSC 하이드레이션용 이스케이프된 사본과는 별개).
function buildLottisHtml(round: number, numbers: number[], bonus: number, date: string): string {
  const dataset = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `로또 6/45 ${round}회 당첨번호`,
    description: `로또 ${round}회 당첨번호: ${numbers.join(", ")} + 보너스 ${bonus}.`,
    url: `https://lottis.kr/lotto/${round}`,
    datePublished: `${date}T00:00:00.000Z`,
    dateModified: `${date}T00:00:00.000Z`,
    creator: { "@type": "Organization", name: "동행복권" },
    publisher: { "@type": "Organization", name: "로티스" },
    license: "https://www.dhlottery.co.kr/common.do?method=main",
    variableMeasured: [
      { "@type": "PropertyValue", name: "당첨번호", value: numbers.join(", ") },
      { "@type": "PropertyValue", name: "보너스번호", value: String(bonus) },
      { "@type": "PropertyValue", name: "1등 당첨금", value: "2674808455" },
      { "@type": "PropertyValue", name: "1등 당첨자 수", value: "11" },
    ],
  };
  return `<html><head><script type="application/ld+json">${JSON.stringify(dataset)}</script></head><body></body></html>`;
}

const NOT_FOUND_HTML =
  "<html><body>404 페이지를 찾을 수 없습니다. 존재하지 않는 회차입니다.</body></html>";

describe("parseLottisResponse", () => {
  it("유효한 응답을 정규화된 DrawSourceResult로 변환한다", () => {
    const html = buildLottisHtml(1227, [1, 14, 16, 34, 41, 44], 13, "2026-06-06");
    const result = parseLottisResponse(html, 1227);

    expect(result).toEqual({
      round: 1227,
      drawDate: "2026-06-06",
      numbers: [1, 14, 16, 34, 41, 44],
      bonusNumber: 13,
      source: "lottis.kr",
    });
  });

  it("회차가 없는 응답(Dataset 블록 부재)은 DrawSourceRoundNotFoundError", () => {
    expect(() => parseLottisResponse(NOT_FOUND_HTML, 9999)).toThrow(DrawSourceRoundNotFoundError);
  });

  it("응답의 회차가 요청한 회차와 다르면 DrawSourceError", () => {
    const html = buildLottisHtml(1226, [1, 14, 16, 34, 41, 44], 13, "2026-05-30");
    expect(() => parseLottisResponse(html, 1227)).toThrow(DrawSourceError);
  });

  it.each([
    ["당첨번호 5개(누락)", [1, 14, 16, 34, 41]],
    ["당첨번호 범위 밖(0)", [0, 14, 16, 34, 41, 44]],
    ["당첨번호 중복", [1, 1, 16, 34, 41, 44]],
  ])("rejects: %s", (_label, numbers) => {
    const html = buildLottisHtml(1227, numbers, 13, "2026-06-06");
    expect(() => parseLottisResponse(html, 1227)).toThrow(DrawSourceError);
  });

  it("보너스 번호가 당첨번호와 중복되면 거부한다", () => {
    const html = buildLottisHtml(1227, [1, 14, 16, 34, 41, 44], 1, "2026-06-06");
    expect(() => parseLottisResponse(html, 1227)).toThrow(DrawSourceError);
  });
});

describe("parseLottisPrizeInfo", () => {
  it("1등 당첨금/당첨자 수를 추출한다", () => {
    const html = buildLottisHtml(1227, [1, 14, 16, 34, 41, 44], 13, "2026-06-06");
    expect(parseLottisPrizeInfo(html)).toEqual({
      firstPrizeAmount: 2674808455,
      firstPrizeCount: 11,
    });
  });

  it("정보가 없으면 null을 반환한다(추측하지 않음)", () => {
    expect(parseLottisPrizeInfo(NOT_FOUND_HTML)).toBeNull();
  });
});

describe("fetchLottisDraw / fetchLottisPrizeInfo (네트워크)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("정상 응답을 파싱해 반환한다", async () => {
    const html = buildLottisHtml(1227, [1, 14, 16, 34, 41, 44], 13, "2026-06-06");
    vi.mocked(fetch).mockResolvedValue(new Response(html, { status: 200 }));

    const result = await fetchLottisDraw(1227);
    expect(result.numbers).toEqual([1, 14, 16, 34, 41, 44]);
  });

  it("HTTP 에러는 DrawSourceError", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 500 }));
    await expect(fetchLottisDraw(1227)).rejects.toThrow(DrawSourceError);
  });

  it("네트워크 실패는 DrawSourceError로 통일한다", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("fetch failed"));
    await expect(fetchLottisDraw(1227)).rejects.toThrow(DrawSourceError);
  });

  it("round가 1 미만이면 요청 없이 즉시 거부한다", async () => {
    await expect(fetchLottisDraw(0)).rejects.toThrow(DrawSourceError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetchLottisPrizeInfo는 별도 fetch로 당첨금 정보를 가져온다", async () => {
    const html = buildLottisHtml(1227, [1, 14, 16, 34, 41, 44], 13, "2026-06-06");
    vi.mocked(fetch).mockResolvedValue(new Response(html, { status: 200 }));

    const prize = await fetchLottisPrizeInfo(1227);
    expect(prize).toEqual({ firstPrizeAmount: 2674808455, firstPrizeCount: 11 });
  });
});
