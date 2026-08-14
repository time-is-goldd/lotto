import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchOfficialDraw,
  OfficialLottoRoundNotFoundError,
  OfficialLottoSourceError,
  parseOfficialDrawResponse,
} from "./dhlottery";

// 실제 dhlottery.co.kr이 이 형식으로 지금도 응답하는지는 이 세션(IP 차단으로 실측 불가)에서
// 검증하지 못했다 — docs/OFFICIAL_LOTTO_AUTO_SYNC_REPORT.md §1/§2에 정직하게 기록했다. 여기서는
// "이 필드 구조가 주어졌을 때 파서가 정확히 동작하는가"만 검증한다.
const VALID_RESPONSE = {
  returnValue: "success",
  drwNo: 1237,
  drwNoDate: "2026-08-15", // 실제 토요일(검증용으로 맞춘 날짜)
  drwtNo1: 3,
  drwtNo2: 11,
  drwtNo3: 17,
  drwtNo4: 24,
  drwtNo5: 33,
  drwtNo6: 41,
  bnusNo: 9,
  firstWinamnt: 2_100_000_000,
  firstPrzwnerCo: 12,
};

describe("parseOfficialDrawResponse", () => {
  it("유효한 공식 응답을 OfficialLottoDraw로 변환한다(오름차순 정렬)", () => {
    const result = parseOfficialDrawResponse(VALID_RESPONSE, 1237);
    expect(result).toEqual({
      round: 1237,
      drawDate: "2026-08-15",
      numbers: [3, 11, 17, 24, 33, 41],
      bonusNumber: 9,
      firstPrizeAmount: 2_100_000_000,
      firstPrizeCount: 12,
    });
  });

  it("returnValue가 fail이면 OfficialLottoRoundNotFoundError(아직 미발표)", () => {
    expect(() => parseOfficialDrawResponse({ returnValue: "fail" }, 9999)).toThrow(
      OfficialLottoRoundNotFoundError
    );
  });

  it.each([
    ["null 응답", null],
    ["객체가 아닌 응답", "not-an-object"],
    ["returnValue가 알 수 없는 값", { ...VALID_RESPONSE, returnValue: "unknown" }],
    ["drwNo가 요청한 회차와 다름", { ...VALID_RESPONSE, drwNo: 9999 }],
    ["drwtNo가 5개만 존재(6번 누락)", { ...VALID_RESPONSE, drwtNo6: undefined }],
    ["당첨번호에 문자열 포함", { ...VALID_RESPONSE, drwtNo1: "3" }],
    ["당첨번호 범위 밖(0)", { ...VALID_RESPONSE, drwtNo1: 0 }],
    ["당첨번호 범위 밖(46)", { ...VALID_RESPONSE, drwtNo1: 46 }],
    ["당첨번호 중복", { ...VALID_RESPONSE, drwtNo1: 11, drwtNo2: 11 }],
    ["보너스 번호 누락", { ...VALID_RESPONSE, bnusNo: undefined }],
    ["보너스 번호가 당첨번호와 중복", { ...VALID_RESPONSE, bnusNo: 3 }],
    ["1등 당첨금 누락", { ...VALID_RESPONSE, firstWinamnt: undefined }],
    ["1등 당첨금이 음수", { ...VALID_RESPONSE, firstWinamnt: -1 }],
    ["1등 당첨자 수 누락", { ...VALID_RESPONSE, firstPrzwnerCo: undefined }],
    ["추첨일 형식이 아님", { ...VALID_RESPONSE, drwNoDate: "2026/08/15" }],
    ["추첨일이 로또 시작일 이전", { ...VALID_RESPONSE, drwNoDate: "1999-01-01" }],
    ["추첨일이 토요일이 아님(일요일)", { ...VALID_RESPONSE, drwNoDate: "2026-08-16" }],
  ])("rejects: %s", (_label, response) => {
    expect(() => parseOfficialDrawResponse(response, 1237)).toThrow(OfficialLottoSourceError);
  });
});

describe("fetchOfficialDraw", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("정상 JSON 응답을 파싱해 반환한다", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(VALID_RESPONSE), {
        status: 200,
        headers: { "content-type": "application/json;charset=UTF-8" },
      })
    );

    const result = await fetchOfficialDraw(1237);
    expect(result.round).toBe(1237);
    expect(result.numbers).toEqual([3, 11, 17, 24, 33, 41]);
  });

  it("HTTP 에러 상태(404/500)는 OfficialLottoSourceError", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 500 }));

    await expect(fetchOfficialDraw(1237)).rejects.toThrow(OfficialLottoSourceError);
  });

  // 실제로 이 세션에서 dhlottery.co.kr에 요청했을 때 받은 것과 동일한 종류의 응답(차단
  // 페이지 — JSON이 아니라 HTML, Content-Type: text/html)이다. 실측으로 확보한 진짜
  // 실패 시나리오를 fixture로 쓴다(§24 "필요한 최소 fixture만 사용" — 전체 105KB가 아니라
  // 판별에 필요한 부분만).
  it("차단/점검 페이지처럼 HTML이 반환되면 OfficialLottoSourceError(JSON 아님)", async () => {
    const blockedPageHtml =
      "<head><title>동행복권</title></head><body><h3>서비스 접속이 차단 되었습니다.</h3>" +
      "<div>현재 접속하신 아이피에서는 접속이 불가능합니다.</div></body>";
    vi.mocked(fetch).mockResolvedValue(
      new Response(blockedPageHtml, {
        status: 200,
        headers: { "content-type": "text/html;charset=UTF-8" },
      })
    );

    await expect(fetchOfficialDraw(1237)).rejects.toThrow(OfficialLottoSourceError);
  });

  it("네트워크 오류(타임아웃/DNS 등)는 OfficialLottoSourceError로 통일한다", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("fetch failed"));

    await expect(fetchOfficialDraw(1237)).rejects.toThrow(OfficialLottoSourceError);
  });

  it("빈 응답 본문은 OfficialLottoSourceError", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("", { status: 200, headers: { "content-type": "application/json" } })
    );

    await expect(fetchOfficialDraw(1237)).rejects.toThrow(OfficialLottoSourceError);
  });

  it("malformed JSON은 OfficialLottoSourceError", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("{not valid json", {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    await expect(fetchOfficialDraw(1237)).rejects.toThrow(OfficialLottoSourceError);
  });

  it("아직 발표되지 않은 회차(returnValue: fail)는 OfficialLottoRoundNotFoundError", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ returnValue: "fail" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    await expect(fetchOfficialDraw(9999)).rejects.toThrow(OfficialLottoRoundNotFoundError);
  });

  it("round가 1 미만/정수가 아니면 요청 없이 즉시 거부한다", async () => {
    await expect(fetchOfficialDraw(0)).rejects.toThrow(OfficialLottoSourceError);
    expect(fetch).not.toHaveBeenCalled();
  });
});
