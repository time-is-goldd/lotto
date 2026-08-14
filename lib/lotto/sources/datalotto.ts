import {
  assertValidBonusNumber,
  assertValidNumberSet,
  WinningValidationError,
} from "@/lib/logic/matchNumbers";

import { DrawSourceError, DrawSourceRoundNotFoundError, type DrawSourceResult } from "./types";

// Phase10-6B secondary source #2 — 데이터로또(datalotto.kr). 실제 페이지
// (https://datalotto.kr/results)를 직접 조회해 이 파일 작성 시점에 확인한 구조를 기준으로
// 만들었다: 페이지 하나에 1회차부터 최신 회차까지 전체 데이터가 Next.js RSC 페이로드 안에
// `"draws":[{"round":N,"date":"...","numbers":[...],"bonus":N}, ...]` 형태로 임베드돼 있다 —
// 로티스처럼 회차별 URL이 아니라 통째로 한 번에 받는 구조라, 회차별 경로를 추측하지 않고
// 이 방식을 그대로 반영했다. 로티스와 마찬가지로 원본 출처가 동행복권이라고 봐야 하며(별도
// 독립 데이터 생성 근거를 페이지 어디에서도 찾지 못했다), secondary corroborating source로만
// 취급한다.
//
// robots.txt(`https://datalotto.kr/robots.txt`)가 `/results` 경로를 막지 않음을 확인했다
// (Disallow는 `/app`, `/api`, `/signup`뿐). 1등 당첨금/당첨자 수는 이 페이지 데이터에
// 없다(확인됨) — 그래서 이 adapter는 DrawSourceResult(round/date/numbers/bonus)만 제공하고,
// 상금 정보는 다루지 않는다(로티스 쪽에서만 보강, lib/lotto/sources/lottis.ts 참조).

const DATALOTTO_SOURCE_NAME = "datalotto.kr";
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

// datalotto.kr은 이 데이터를 Next.js RSC 스트리밍 페이로드(`self.__next_f.push([1,"..."])`)
// 안에 이스케이프된 JSON 문자열로 내려보낸다(실측 확인 — lottis.kr의 standalone JSON-LD
// `<script>` 태그와 달리, 여기는 raw HTML 안에 `\"round\":1236` 형태로 백슬래시 이스케이프가
// 그대로 남아있다). 그래서 매칭 전에 반드시 청크를 모아 이스케이프를 한 번 풀어야 한다 —
// 이 언이스케이프 없이 원본 HTML에 바로 정규식을 걸면 전부 매칭 실패한다.
function extractUnescapedPayload(html: string): string {
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)].map(
    (m) => m[1]
  );
  return chunks.join("").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

// 언이스케이프된 페이로드에서 `{"round":N,"date":"...","numbers":[...],"bonus":N}` 객체들을
// 직접 정규식으로 추출한다(전체를 JSON.parse하지 않는 이유는 lib/lotto/sources/lottis.ts와
// 동일 — 스트리밍 청크 경계 때문에 문자열 전체가 항상 유효한 단일 JSON이 아니다). 요청한
// round가 배열에 없으면 아직 발표되지 않은 것으로 취급한다.
export function parseDatalottoResponse(html: string, expectedRound: number): DrawSourceResult {
  const payload = extractUnescapedPayload(html);
  const objRe =
    /\{"round":(\d+),"date":"(\d{4}-\d{2}-\d{2})","numbers":\[([^\]]+)\],"bonus":(\d+)\}/g;
  let match: RegExpExecArray | null;
  let found: { round: number; date: string; numbers: number[]; bonus: number } | null = null;

  while ((match = objRe.exec(payload))) {
    const round = Number(match[1]);
    if (round === expectedRound) {
      found = {
        round,
        date: match[2],
        numbers: match[3].split(",").map((n) => Number(n.trim())),
        bonus: Number(match[4]),
      };
      break;
    }
  }

  if (!found) {
    throw new DrawSourceRoundNotFoundError(DATALOTTO_SOURCE_NAME, expectedRound);
  }

  try {
    assertValidNumberSet(found.numbers, `${DATALOTTO_SOURCE_NAME} 당첨번호`);
    assertValidBonusNumber(found.bonus, found.numbers);
  } catch (error) {
    if (error instanceof WinningValidationError) {
      throw new DrawSourceError(`${error.message} (${DATALOTTO_SOURCE_NAME}, ${expectedRound}회)`);
    }
    throw error;
  }

  return {
    round: found.round,
    drawDate: found.date,
    numbers: [...found.numbers].sort((a, b) => a - b),
    bonusNumber: found.bonus,
    source: DATALOTTO_SOURCE_NAME,
  };
}

export async function fetchDatalottoDraw(round: number): Promise<DrawSourceResult> {
  if (!Number.isInteger(round) || round < 1) {
    throw new DrawSourceError(`round는 1 이상의 정수여야 합니다: ${round}`);
  }

  let response: Response;
  try {
    response = await fetchWithTimeout("https://datalotto.kr/results", FETCH_TIMEOUT_MS);
  } catch {
    throw new DrawSourceError(`${DATALOTTO_SOURCE_NAME} 요청 실패(네트워크/타임아웃): ${round}회`);
  }

  if (!response.ok) {
    throw new DrawSourceError(
      `${DATALOTTO_SOURCE_NAME} 요청 실패(HTTP ${response.status}): ${round}회`
    );
  }

  let html: string;
  try {
    html = await response.text();
  } catch {
    throw new DrawSourceError(`${DATALOTTO_SOURCE_NAME} 응답을 읽을 수 없습니다: ${round}회`);
  }

  return parseDatalottoResponse(html, round);
}
