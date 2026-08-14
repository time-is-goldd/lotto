import {
  assertValidBonusNumber,
  assertValidNumberSet,
  WinningValidationError,
} from "@/lib/logic/matchNumbers";

// Phase10-6 계약(docs/OFFICIAL_LOTTO_AUTO_SYNC_REPORT.md §1~§9). 동행복권(dhlottery.co.kr)의
// 공개 JSON 엔드포인트를 source of truth로 쓴다 — 이 파일이 실제로 검증된 것은 아니다.
//
// **중요(정직하게 기록)**: 이 파일 작성 시점에 dhlottery.co.kr의 `common.do`/`gameResult.do`
// 두 경로 모두 이 검증 환경(클라우드/데이터센터 IP)에서 `/errorPage`로 리다이렉트되며 실제
// 차단 문구("서비스 접속이 차단 되었습니다 / 현재 접속하신 아이피에서는 접속이 불가능합니다",
// WELLCONN Corp. TRACER 봇 차단 솔루션)를 직접 확인했다 — robots.txt는 이 경로들을 막지 않아
// (정책 위반 아님) 순수 기술적(IP 기반) 차단으로 판단된다. 이 상태에서는 아래 파싱 로직이
// 실제 현재 응답 형식과 100% 일치하는지 이 세션에서 검증할 수 없었다 — `common.do?method=
// getLottoNumber&drwNo={round}`가 반환해온 것으로 오랫동안 알려진 필드 구조(returnValue/
// drwNo/drwNoDate/drwtNo1~6/bnusNo/firstWinamnt/firstPrzwnerCo)를 기준으로 최대한 엄격하게
// 작성했다. 우회(프록시/IP 스푸핑/세션 위조/CAPTCHA 우회)는 시도하지 않았다(지시문 §3 금지).
//
// 이 파일이 안전한 이유: 아래 파싱은 예상 필드가 하나라도 없거나 타입이 다르면 즉시 실패한다
// (지시문 §7/§25 "잘못된 데이터를 추측해서 복원하지 않는다", "parser가 FAIL해야 한다"). 실제
// 필드 구조가 바뀌었거나 애초에 접근이 막혀 있어도 이 함수는 예외를 던질 뿐 DB에 아무 영향을
// 주지 않는다 — 호출부(lib/api/admin/lottoSync.ts)가 이 예외를 잡아 "이번 실행은 아무 것도
// 하지 않음"으로 안전하게 종료한다.

const DHLOTTERY_COMMON_ENDPOINT = "https://www.dhlottery.co.kr/common.do";
const FETCH_TIMEOUT_MS = 8_000;

// 실제 로또 1회차 추첨일(2002-12-07) — 이보다 이른 날짜가 나오면 데이터가 명백히 잘못된
// 것이다(지시문 §6 "Lotto 일정과 모순되는 비정상 데이터도 거부"). 로또 추첨은 매주 토요일
// 진행되므로 추첨일의 요일도 함께 검증한다.
const LOTTO_FIRST_DRAW_DATE_UTC_MS = Date.UTC(2002, 11, 7);
const SATURDAY = 6;

export interface OfficialLottoDraw {
  round: number;
  drawDate: string; // YYYY-MM-DD
  numbers: number[]; // 6개, 오름차순 정렬됨
  bonusNumber: number;
  firstPrizeAmount: number;
  firstPrizeCount: number;
}

export class OfficialLottoSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfficialLottoSourceError";
  }
}

// returnValue: "fail" — 아직 발표되지 않은 미래 회차를 조회했을 때 공식 API가 반환하는
// 정상적인 "아직 없음" 신호다(다른 이상 응답과 구분해 별도 타입으로 둔다 — 이 경우는 사용자
// 입장에서 실패가 아니라 "아직 추첨 전"일 뿐이므로 §11 최신 회차 판단 로직이 이 타입만
// 조용히 처리하고 그 외 에러는 그대로 올린다).
export class OfficialLottoRoundNotFoundError extends OfficialLottoSourceError {
  constructor(round: number) {
    super(`${round}회는 아직 공식 발표되지 않았습니다.`);
    this.name = "OfficialLottoRoundNotFoundError";
  }
}

// Phase10-6B 계약(docs/LOTTO_MULTI_SOURCE_FALLBACK_REPORT.md §39) — "공식 소스에 아예 접근하지
// 못함(네트워크/차단/HTML 응답)"과 "공식 소스가 응답은 했는데 그 안의 데이터가 이상함(JSON은
// 맞는데 파싱/검증 실패)"을 구분하기 위한 서브타입이다. 전자는 secondary consensus fallback을
// 고려할 근거가 되지만(사이트 자체에 접근이 막혔을 뿐 official adapter 자체는 멀쩡할 수
// 있음), 후자는 official adapter 자체가 깨졌거나(사이트 구조 변경) 응답이 오염됐을 가능성을
// 먼저 의심해야 하므로 자동 fallback 승인 근거로 삼지 않는다(지시문 §39 정책을 그대로
// 구현) — source broker(lib/lotto/sources/index.ts)가 이 구분으로 정책을 분기한다.
export class OfficialLottoParseFailureError extends OfficialLottoSourceError {
  constructor(message: string) {
    super(message);
    this.name = "OfficialLottoParseFailureError";
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      // 실제 브라우저를 흉내 낸 정상적인 식별 헤더다 — CAPTCHA/anti-bot을 우회하기 위한
      // 조작이 아니다(TLS 지문 위조, 세션 쿠키 위조, 프록시 로테이션 등은 전혀 하지 않는다).
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LuckPlatformLottoSync/1.0)" },
    });
  } finally {
    clearTimeout(timeout);
  }
}

interface RawDhlotteryResponse {
  returnValue?: unknown;
  drwNo?: unknown;
  drwNoDate?: unknown;
  drwtNo1?: unknown;
  drwtNo2?: unknown;
  drwtNo3?: unknown;
  drwtNo4?: unknown;
  drwtNo5?: unknown;
  drwtNo6?: unknown;
  bnusNo?: unknown;
  firstWinamnt?: unknown;
  firstPrzwnerCo?: unknown;
}

// exported 이유: 테스트에서 실제 네트워크 호출 없이 파싱 자체를 검증하기 위해서다
// (§32~§33 요구 테스트 케이스 — 파일 하나 안에서 fetch와 parse를 분리해 각각 독립적으로
// 테스트 가능하게 한다).
// 지시문 §39: 이 함수 안의 모든 실패는 "공식 소스가 응답은 했지만 파싱/검증에서 걸러진"
// 경우다 — OfficialLottoParseFailureError로 던진다(returnValue:"fail"만 예외, 그건 정상적인
// "아직 미발표"라 OfficialLottoRoundNotFoundError). fetchOfficialDraw()의 네트워크/HTTP/
// Content-Type 실패(요청 자체가 온전한 JSON 응답에 도달하지 못한 경우)와 구분해, source
// broker가 후자만 fallback 후보로 고려하게 한다.
export function parseOfficialDrawResponse(raw: unknown, expectedRound: number): OfficialLottoDraw {
  if (typeof raw !== "object" || raw === null) {
    throw new OfficialLottoParseFailureError(
      `공식 데이터 응답이 올바른 객체가 아닙니다: ${expectedRound}회`
    );
  }
  const r = raw as RawDhlotteryResponse;

  if (r.returnValue === "fail") {
    throw new OfficialLottoRoundNotFoundError(expectedRound);
  }
  if (r.returnValue !== "success") {
    throw new OfficialLottoParseFailureError(
      `공식 데이터 응답 상태(returnValue)가 예상과 다릅니다: ${expectedRound}회`
    );
  }

  if (typeof r.drwNo !== "number" || !Number.isInteger(r.drwNo) || r.drwNo !== expectedRound) {
    throw new OfficialLottoParseFailureError(
      `공식 데이터의 회차가 요청한 회차와 일치하지 않습니다: ${expectedRound}회`
    );
  }
  const round = r.drwNo;

  const rawNumbers = [r.drwtNo1, r.drwtNo2, r.drwtNo3, r.drwtNo4, r.drwtNo5, r.drwtNo6];
  if (!rawNumbers.every((n): n is number => typeof n === "number" && Number.isInteger(n))) {
    throw new OfficialLottoParseFailureError(
      `공식 데이터의 당첨번호를 확인할 수 없습니다: ${expectedRound}회`
    );
  }
  const numbers = rawNumbers as number[];

  if (typeof r.bnusNo !== "number" || !Number.isInteger(r.bnusNo)) {
    throw new OfficialLottoParseFailureError(
      `공식 데이터의 보너스 번호를 확인할 수 없습니다: ${expectedRound}회`
    );
  }
  const bonusNumber = r.bnusNo;

  if (
    typeof r.firstWinamnt !== "number" ||
    !Number.isInteger(r.firstWinamnt) ||
    r.firstWinamnt < 0
  ) {
    throw new OfficialLottoParseFailureError(
      `공식 데이터의 1등 당첨금을 확인할 수 없습니다: ${expectedRound}회`
    );
  }
  const firstPrizeAmount = r.firstWinamnt;

  if (
    typeof r.firstPrzwnerCo !== "number" ||
    !Number.isInteger(r.firstPrzwnerCo) ||
    r.firstPrzwnerCo < 0
  ) {
    throw new OfficialLottoParseFailureError(
      `공식 데이터의 1등 당첨자 수를 확인할 수 없습니다: ${expectedRound}회`
    );
  }
  const firstPrizeCount = r.firstPrzwnerCo;

  if (typeof r.drwNoDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.drwNoDate)) {
    throw new OfficialLottoParseFailureError(
      `공식 데이터의 추첨일을 확인할 수 없습니다: ${expectedRound}회`
    );
  }
  const drawDate = r.drwNoDate;
  const parsedDateMs = Date.parse(`${drawDate}T00:00:00Z`);
  if (Number.isNaN(parsedDateMs)) {
    throw new OfficialLottoParseFailureError(
      `공식 데이터의 추첨일이 유효한 날짜가 아닙니다: ${expectedRound}회`
    );
  }
  if (parsedDateMs < LOTTO_FIRST_DRAW_DATE_UTC_MS) {
    throw new OfficialLottoParseFailureError(
      `공식 데이터의 추첨일이 로또 1회차 추첨일보다 이릅니다: ${expectedRound}회`
    );
  }
  if (new Date(parsedDateMs).getUTCDay() !== SATURDAY) {
    throw new OfficialLottoParseFailureError(
      `공식 데이터의 추첨일이 토요일이 아닙니다: ${expectedRound}회`
    );
  }

  // 6개/1~45 범위/중복 없음 + 보너스 중복 불가 — lib/logic/matchNumbers.ts의 기존 검증을
  // 그대로 재사용한다(새 당첨 판정/검증 로직을 만들지 않는다, 지시문 전체 원칙).
  try {
    assertValidNumberSet(numbers, "공식 당첨번호");
    assertValidBonusNumber(bonusNumber, numbers);
  } catch (error) {
    if (error instanceof WinningValidationError) {
      throw new OfficialLottoParseFailureError(`${error.message} (${expectedRound}회)`);
    }
    throw error;
  }

  return {
    round,
    drawDate,
    numbers: [...numbers].sort((a, b) => a - b),
    bonusNumber,
    firstPrizeAmount,
    firstPrizeCount,
  };
}

// 실제 네트워크 fetch + 파싱. HTTP 에러/타임아웃/네트워크 실패/JSON 아닌 응답(차단 페이지 등
// HTML 반환 포함) 전부 OfficialLottoSourceError로 통일해 던진다 — 호출부가 "공식 데이터를
// 가져오지 못했다"는 사실 하나만 알면 되고, 실패 사유별로 다르게 처리할 필요가 없다(지시문
// §7 Fail Closed 원칙과 일치).
export async function fetchOfficialDraw(round: number): Promise<OfficialLottoDraw> {
  if (!Number.isInteger(round) || round < 1) {
    throw new OfficialLottoSourceError(`round는 1 이상의 정수여야 합니다: ${round}`);
  }

  const url = `${DHLOTTERY_COMMON_ENDPOINT}?method=getLottoNumber&drwNo=${round}`;

  let response: Response;
  try {
    response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
  } catch {
    throw new OfficialLottoSourceError(`공식 데이터 요청 실패(네트워크/타임아웃): ${round}회`);
  }

  if (!response.ok) {
    throw new OfficialLottoSourceError(
      `공식 데이터 요청 실패(HTTP ${response.status}): ${round}회`
    );
  }

  // Content-Type으로 우선 걸러낸다 — 차단/점검/로그인 페이지는 전부 text/html로 응답하므로
  // (실측으로 확인) "JSON이 아니면 무조건 실패"가 특정 문자열을 찾는 것보다 훨씬 안정적인
  // fail-closed 신호다(지시문 §25 "잘못된 데이터를 추측해서 복원하지 않는다").
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new OfficialLottoSourceError(
      `공식 데이터 응답 형식이 예상과 다릅니다(JSON 아님, 접근 차단/점검 페이지일 수 있음): ${round}회`
    );
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    // Content-Type은 application/json이라고 응답했는데 실제 body가 JSON으로 파싱되지 않는
    // 경우다 — 접근 차단(HTML)이라면 위 Content-Type 체크에서 이미 걸러졌을 것이므로, 여기
    // 도달했다는 것 자체가 "정상 요청은 됐는데 응답 내용이 이상하다"는 신호에 더 가깝다.
    // parse-class로 분류해 source broker가 자동 fallback 근거로 삼지 않게 한다(지시문 §39).
    throw new OfficialLottoParseFailureError(`공식 데이터 응답을 파싱할 수 없습니다: ${round}회`);
  }

  return parseOfficialDrawResponse(raw, round);
}
