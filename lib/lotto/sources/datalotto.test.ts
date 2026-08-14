import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchDatalottoDraw, parseDatalottoResponse } from "./datalotto";
import { DrawSourceError, DrawSourceRoundNotFoundError } from "./types";

// 실제 datalotto.kr(https://datalotto.kr/results) 페이지를 이 파일 작성 시점에 직접 조회해
// 확인한 구조를 최소화한 fixture다(§37) — Next.js RSC 스트리밍 페이로드
// `self.__next_f.push([1,"..."])` 안에 이스케이프된 JSON 문자열로 `draws` 배열이 들어있다.
// 실제 페이지는 1회차부터 최신까지 전부 담겨 있지만, 테스트에는 필요한 회차 몇 개만 넣는다.
function buildDatalottoHtml(
  draws: { round: number; date: string; numbers: number[]; bonus: number }[]
): string {
  const drawsJson = JSON.stringify(
    draws.map((d) => ({ round: d.round, date: d.date, numbers: d.numbers, bonus: d.bonus }))
  );
  // RSC 페이로드 안에서는 큰따옴표가 백슬래시로 이스케이프된 채로 내려온다 — 실측 구조를
  // 그대로 재현한다(이스케이프를 빠뜨리면 실제 파서 버그를 테스트가 못 잡는다, Phase10-6B에서
  // 실제로 겪은 문제).
  const escaped = `{"draws":${drawsJson}}`.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `<html><body><script>self.__next_f.push([1,"5:[\\"$L10\\",[\\"$\\",\\"$L11\\",null,${escaped}]]"])</script></body></html>`;
}

const EMPTY_HTML = buildDatalottoHtml([]);

describe("parseDatalottoResponse", () => {
  it("유효한 응답에서 요청한 회차를 찾아 정규화된 DrawSourceResult로 변환한다", () => {
    const html = buildDatalottoHtml([
      { round: 1236, date: "2026-08-08", numbers: [12, 18, 21, 29, 34, 38], bonus: 10 },
      { round: 1227, date: "2026-06-06", numbers: [1, 14, 16, 34, 41, 44], bonus: 13 },
    ]);

    const result = parseDatalottoResponse(html, 1227);

    expect(result).toEqual({
      round: 1227,
      drawDate: "2026-06-06",
      numbers: [1, 14, 16, 34, 41, 44],
      bonusNumber: 13,
      source: "datalotto.kr",
    });
  });

  it("배열에 없는 회차는 DrawSourceRoundNotFoundError", () => {
    expect(() => parseDatalottoResponse(EMPTY_HTML, 9999)).toThrow(DrawSourceRoundNotFoundError);
  });

  it.each([
    ["당첨번호 7개(초과)", [1, 14, 16, 34, 41, 44, 45]],
    ["당첨번호 범위 밖(46)", [1, 14, 16, 34, 41, 46]],
    ["당첨번호 중복", [1, 1, 16, 34, 41, 44]],
  ])("rejects: %s", (_label, numbers) => {
    const html = buildDatalottoHtml([{ round: 1227, date: "2026-06-06", numbers, bonus: 13 }]);
    expect(() => parseDatalottoResponse(html, 1227)).toThrow(DrawSourceError);
  });

  it("보너스 번호가 당첨번호와 중복되면 거부한다", () => {
    const html = buildDatalottoHtml([
      { round: 1227, date: "2026-06-06", numbers: [1, 14, 16, 34, 41, 44], bonus: 1 },
    ]);
    expect(() => parseDatalottoResponse(html, 1227)).toThrow(DrawSourceError);
  });
});

describe("fetchDatalottoDraw (네트워크)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("정상 응답을 파싱해 반환한다", async () => {
    const html = buildDatalottoHtml([
      { round: 1227, date: "2026-06-06", numbers: [1, 14, 16, 34, 41, 44], bonus: 13 },
    ]);
    vi.mocked(fetch).mockResolvedValue(new Response(html, { status: 200 }));

    const result = await fetchDatalottoDraw(1227);
    expect(result.numbers).toEqual([1, 14, 16, 34, 41, 44]);
  });

  it("HTTP 에러는 DrawSourceError", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 500 }));
    await expect(fetchDatalottoDraw(1227)).rejects.toThrow(DrawSourceError);
  });

  it("네트워크 실패는 DrawSourceError로 통일한다", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("fetch failed"));
    await expect(fetchDatalottoDraw(1227)).rejects.toThrow(DrawSourceError);
  });

  it("round가 1 미만이면 요청 없이 즉시 거부한다", async () => {
    await expect(fetchDatalottoDraw(0)).rejects.toThrow(DrawSourceError);
    expect(fetch).not.toHaveBeenCalled();
  });
});
