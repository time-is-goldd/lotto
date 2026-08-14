import {
  assertValidBonusNumber,
  assertValidNumberSet,
  WinningValidationError,
} from "@/lib/logic/matchNumbers";

import { DrawSourceError, DrawSourceRoundNotFoundError, type DrawSourceResult } from "./types";

// Phase10-6B secondary source #1 — 로티스(lottis.kr). 실제 페이지(https://lottis.kr/lotto/1227)를
// 직접 조회해 이 파일 작성 시점에 확인한 구조를 기준으로 만들었다: 페이지에 schema.org
// "Dataset" JSON-LD가 임베드돼 있고, `creator.name: "동행복권"` / `license: dhlottery.co.kr`로
// 원본 출처를 스스로 명시한다 — 즉 로티스는 **동행복권 데이터를 다시 게시하는 secondary
// corroborating source**이지, 독립적인 원천 데이터가 아니다(지시문 §5). fallback consensus의
// 목적은 "동행복권 원본이 정말 그 값인지"를 다른 경로로 재확인하는 것이지, 새로운 진실
// 공급원을 만드는 것이 아니다.
//
// robots.txt(`https://lottis.kr/robots.txt`)가 `/lotto/*` 경로를 막지 않음을 확인했다
// (Disallow는 `/api/`, `/_contact/`, `/_advertise/`뿐).

const LOTTIS_SOURCE_NAME = "lottis.kr";
const FETCH_TIMEOUT_MS = 5_000;

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LuckPlatformLottoSync/1.0)" },
    });
  } finally {
    clearTimeout(timeout);
  }
}

// Next.js RSC 스트리밍 페이로드(`self.__next_f.push([1,"..."])`) 안에 이스케이프된 문자열로
// JSON-LD가 들어있다 — 페이지 전체를 JSON.parse하지 않고, 필요한 필드만 정규식으로 뽑아낸다
// (지시문 §17 "각 adapter가 raw format을 normalized result로 변환"). 회차가 존재하지 않으면
// 이 Dataset 블록 자체가 응답에 없다(실측 확인 — 9999회처럼 없는 회차는 200 응답이지만
// PropertyValue/datePublished가 전혀 나타나지 않는다) — 그 부재 자체를 "아직 없음" 신호로
// 쓴다.
export function parseLottisResponse(html: string, expectedRound: number): DrawSourceResult {
  const nameMatch = html.match(/"name":"로또 6\/45 (\d+)회 당첨번호"/);
  const datePublishedMatch = html.match(/"datePublished":"(\d{4}-\d{2}-\d{2})T/);
  const winningNumbersMatch = html.match(/"name":"당첨번호","value":"([0-9, ]+)"/);
  const bonusMatch = html.match(/"name":"보너스번호","value":"(\d+)"/);

  if (!nameMatch || !datePublishedMatch || !winningNumbersMatch || !bonusMatch) {
    throw new DrawSourceRoundNotFoundError(LOTTIS_SOURCE_NAME, expectedRound);
  }

  const round = Number(nameMatch[1]);
  if (round !== expectedRound) {
    throw new DrawSourceError(
      `${LOTTIS_SOURCE_NAME}: 응답 회차가 요청한 회차와 다릅니다: ${expectedRound}회`
    );
  }

  const numbers = winningNumbersMatch[1].split(",").map((n) => Number(n.trim()));
  const bonusNumber = Number(bonusMatch[1]);

  try {
    assertValidNumberSet(numbers, `${LOTTIS_SOURCE_NAME} 당첨번호`);
    assertValidBonusNumber(bonusNumber, numbers);
  } catch (error) {
    if (error instanceof WinningValidationError) {
      throw new DrawSourceError(`${error.message} (${LOTTIS_SOURCE_NAME}, ${expectedRound}회)`);
    }
    throw error;
  }

  return {
    round,
    drawDate: datePublishedMatch[1],
    numbers: [...numbers].sort((a, b) => a - b),
    bonusNumber,
    source: LOTTIS_SOURCE_NAME,
  };
}

async function fetchLottisHtml(round: number): Promise<string> {
  if (!Number.isInteger(round) || round < 1) {
    throw new DrawSourceError(`round는 1 이상의 정수여야 합니다: ${round}`);
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(`https://lottis.kr/lotto/${round}`, FETCH_TIMEOUT_MS);
  } catch {
    throw new DrawSourceError(`${LOTTIS_SOURCE_NAME} 요청 실패(네트워크/타임아웃): ${round}회`);
  }

  if (!response.ok) {
    throw new DrawSourceError(
      `${LOTTIS_SOURCE_NAME} 요청 실패(HTTP ${response.status}): ${round}회`
    );
  }

  try {
    return await response.text();
  } catch {
    throw new DrawSourceError(`${LOTTIS_SOURCE_NAME} 응답을 읽을 수 없습니다: ${round}회`);
  }
}

export async function fetchLottisDraw(round: number): Promise<DrawSourceResult> {
  const html = await fetchLottisHtml(round);
  return parseLottisResponse(html, round);
}

// 1등 당첨금/당첨자 수는 DrawSourceResult(consensus 비교 대상)에는 포함하지 않지만
// (lib/lotto/sources/types.ts 주석 참조), fallback consensus가 실제로 통과해 draws 행을
// 등록해야 할 때는 이 값들도 필요하다(draws.first_prize_amount/first_prize_count는 NOT
// NULL). 로티스는 이 값을 구조화된 JSON-LD로 제공하는 유일하게 확인된 secondary라 별도
// 함수로 분리했다 — 값을 못 찾으면 추측하지 않고 null을 반환해, 호출부(source broker)가
// "1등 정보가 없으면 fallback 등록 자체를 보류한다"는 fail-closed 판단을 내릴 수 있게 한다.
export interface LottisPrizeInfo {
  firstPrizeAmount: number;
  firstPrizeCount: number;
}

export function parseLottisPrizeInfo(html: string): LottisPrizeInfo | null {
  const amountMatch = html.match(/"name":"1등 당첨금","value":"(\d+)"/);
  const countMatch = html.match(/"name":"1등 당첨자 수","value":"(\d+)"/);
  if (!amountMatch || !countMatch) {
    return null;
  }
  return { firstPrizeAmount: Number(amountMatch[1]), firstPrizeCount: Number(countMatch[1]) };
}

// consensus 통과 후에만 호출된다(가장 흔한 경로인 "official 성공"/"consensus 실패"에서는
// 이 요청 자체가 발생하지 않는다 — 불필요한 추가 fetch를 피한다).
export async function fetchLottisPrizeInfo(round: number): Promise<LottisPrizeInfo | null> {
  const html = await fetchLottisHtml(round);
  return parseLottisPrizeInfo(html);
}
