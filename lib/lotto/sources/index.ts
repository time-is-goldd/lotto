import {
  fetchOfficialDraw,
  OfficialLottoParseFailureError,
  OfficialLottoRoundNotFoundError,
  OfficialLottoSourceError,
} from "./dhlottery";
import { fetchDatalottoDraw } from "./datalotto";
import { fetchLottisDraw, fetchLottisPrizeInfo } from "./lottis";
import { DrawSourceRoundNotFoundError, type DrawSourceResult } from "./types";

// Phase10-6B source broker(지시문 §16 "Source Broker — 개별 source를 business logic에 직접
// 연결하지 않는다"). lib/api/admin/lottoSync.ts(sync 조율)는 이 파일의 getTrustedDrawResult()
// 하나만 알면 되고, 그 안에 official/lottis/datalotto가 있다는 사실 자체를 모른다.
//
// 정책 요약(지시문 §2/§6/§7/§10/§39):
//   1. 공식 source(dhlottery.co.kr)가 성공하면 그 결과를 그대로 쓴다 — secondary는 아예
//      조회하지 않는다("Secondary source 때문에 official result를 거부하지 않는다").
//   2. 공식 source가 "아직 미발표"(OfficialLottoRoundNotFoundError)면 그대로 보고한다 —
//      secondary로 넘어가지 않는다(아직 없는 회차를 secondary가 있다고 말할 리 없다는
//      전제가 아니라, 이 경우는애초에 "실패"가 아니라 "정상적으로 아직 없음"이기 때문).
//   3. 공식 source가 응답은 했는데 파싱/검증에 실패하면(OfficialLottoParseFailureError)
//      secondary로 넘어가지 않는다 — official adapter 자체가 깨졌을 가능성을 먼저 의심해야
//      하므로 자동 fallback 근거로 삼지 않는다(지시문 §39, 가장 보수적인 정책).
//   4. 공식 source가 네트워크/접근 자체에 실패하면(OfficialLottoSourceError, 위 두 서브타입
//      제외) 그때만 secondary 두 곳을 병렬로 조회한다. 둘 다 성공하고 값이 완전히
//      일치해야만 consensus로 인정한다(지시문 §7 "모든 값 exact match"). 하나만 성공하거나
//      값이 다르면 등록하지 않는다(지시문 §19/§20).
//   5. consensus가 성립해도 LOTTO_SECONDARY_FALLBACK_ENABLED 플래그가 꺼져 있으면 실제
//      등록에 쓰지 않는다("FALLBACK_AVAILABLE_BUT_DISABLED", 지시문 §29/§30) — 다만 "출처가
//      일치했다"는 사실 자체는 결과에 담아 관리자 화면에 보여줄 수 있게 한다.

export type TrustedDrawStatus =
  | "official"
  | "official-round-not-found"
  | "official-parse-failure"
  | "fallback-consensus"
  | "fallback-disabled"
  | "source-disagreement"
  | "single-secondary-success"
  | "all-sources-unavailable"
  | "secondary-round-not-found"
  | "prize-info-unavailable";

export type Provenance = { mode: "official" } | { mode: "secondary-consensus"; sources: string[] };

export interface TrustedDrawResult {
  status: TrustedDrawStatus;
  round: number;
  draw: DrawSourceResult | null;
  firstPrizeAmount: number | null;
  firstPrizeCount: number | null;
  provenance: Provenance | null;
  message: string;
}

// 값을 repo에 커밋하지 않는다(.env.example에는 이름만 존재, 지시문 §45) — 매 호출마다 다시
// 읽어서, 테스트가 process.env를 직접 조작해 on/off를 검증할 수 있게 한다(모듈 로드 시점에
// 한 번만 읽어 캐시하지 않음).
export function isSecondaryFallbackEnabled(): boolean {
  return process.env.LOTTO_SECONDARY_FALLBACK_ENABLED === "true";
}

function sameDrawResult(a: DrawSourceResult, b: DrawSourceResult): boolean {
  if (a.round !== b.round || a.drawDate !== b.drawDate || a.bonusNumber !== b.bonusNumber) {
    return false;
  }
  if (a.numbers.length !== b.numbers.length) {
    return false;
  }
  return a.numbers.every((n, i) => n === b.numbers[i]);
}

function emptyResult(
  status: TrustedDrawStatus,
  round: number,
  message: string,
  draw: DrawSourceResult | null = null,
  provenance: Provenance | null = null
): TrustedDrawResult {
  return {
    status,
    round,
    draw,
    firstPrizeAmount: null,
    firstPrizeCount: null,
    provenance,
    message,
  };
}

export async function getTrustedDrawResult(round: number): Promise<TrustedDrawResult> {
  try {
    const official = await fetchOfficialDraw(round);
    return {
      status: "official",
      round,
      draw: {
        round: official.round,
        drawDate: official.drawDate,
        numbers: official.numbers,
        bonusNumber: official.bonusNumber,
        source: "dhlottery.co.kr",
      },
      firstPrizeAmount: official.firstPrizeAmount,
      firstPrizeCount: official.firstPrizeCount,
      provenance: { mode: "official" },
      message: "공식 소스(dhlottery.co.kr)에서 정상 조회됐습니다.",
    };
  } catch (error) {
    if (error instanceof OfficialLottoRoundNotFoundError) {
      return emptyResult("official-round-not-found", round, error.message);
    }
    if (error instanceof OfficialLottoParseFailureError) {
      return emptyResult(
        "official-parse-failure",
        round,
        `공식 소스 응답을 신뢰할 수 없어 자동 fallback을 진행하지 않습니다: ${error.message}`
      );
    }
    if (!(error instanceof OfficialLottoSourceError)) {
      throw error;
    }
    // 네트워크/접근 실패(base OfficialLottoSourceError)만 여기로 떨어진다 — secondary로 진행.
  }

  const [lottisResult, datalottoResult] = await Promise.allSettled([
    fetchLottisDraw(round),
    fetchDatalottoDraw(round),
  ]);

  const lottis = lottisResult.status === "fulfilled" ? lottisResult.value : null;
  const datalotto = datalottoResult.status === "fulfilled" ? datalottoResult.value : null;

  // 실측으로 발견한 흔한 정상 케이스(Phase10-6B 실증 검증, 실제 운영자 브라우저 테스트로
  // 재확인): 아직 추첨 전/직후라 보조 출처 두 곳 모두 그 회차를 아직 발표하지 않은
  // 경우다. 여기 도달했다는 것 자체가 "공식 소스는 network-class 실패로 접근하지 못했다"는
  // 뜻이므로(위 catch 블록에서 그 경우에만 이 지점까지 내려온다), 이 상태를
  // "official-round-not-found"로 합쳐버리면 "공식 소스가 정상"이라는 잘못된 인상을 준다
  // (실제로 처음 이렇게 구현했다가 운영자 실측 테스트에서 바로 드러난 문제). 그래서 별도
  // status로 분리해 "공식 소스 자체는 확인 못 했고, 보조 출처로 간접 확인했다"는 사실을
  // 숨기지 않는다. 두 곳 다 "아직 없음" 신호(DrawSourceRoundNotFoundError)를 준 경우만
  // 이렇게 구분한다 — 한쪽만 그렇거나 다른 종류의 실패가 섞이면 아래의 일반 실패 처리로
  // 넘어간다(진짜 이상 상황과 섞지 않는다).
  const lottisNotFound =
    lottisResult.status === "rejected" &&
    lottisResult.reason instanceof DrawSourceRoundNotFoundError;
  const datalottoNotFound =
    datalottoResult.status === "rejected" &&
    datalottoResult.reason instanceof DrawSourceRoundNotFoundError;
  if (lottisNotFound && datalottoNotFound) {
    return emptyResult(
      "secondary-round-not-found",
      round,
      `공식 소스(dhlottery.co.kr)에는 접근하지 못했지만, 보조 출처 2곳(lottis.kr, datalotto.kr) 확인 결과 ${round}회는 아직 발표되지 않았습니다.`
    );
  }

  if (!lottis && !datalotto) {
    return emptyResult(
      "all-sources-unavailable",
      round,
      "공식 소스와 보조 출처(lottis.kr, datalotto.kr) 모두 접근할 수 없습니다."
    );
  }

  if (!lottis || !datalotto) {
    const succeededName = lottis ? "lottis.kr" : "datalotto.kr";
    return emptyResult(
      "single-secondary-success",
      round,
      `보조 출처 중 ${succeededName}만 성공했습니다 — 단일 출처만으로는 등록하지 않습니다.`
    );
  }

  if (!sameDrawResult(lottis, datalotto)) {
    return emptyResult(
      "source-disagreement",
      round,
      `보조 출처 간 결과가 일치하지 않습니다(lottis.kr vs datalotto.kr) — 자동 등록하지 않습니다.`
    );
  }

  const provenance: Provenance = {
    mode: "secondary-consensus",
    sources: [lottis.source, datalotto.source],
  };

  if (!isSecondaryFallbackEnabled()) {
    return {
      status: "fallback-disabled",
      round,
      draw: lottis,
      firstPrizeAmount: null,
      firstPrizeCount: null,
      provenance,
      message:
        "보조 출처 2곳(lottis.kr, datalotto.kr)이 일치했지만, fallback 자동 등록 기능이 꺼져 있어 DB에 반영하지 않았습니다.",
    };
  }

  let prize: Awaited<ReturnType<typeof fetchLottisPrizeInfo>>;
  try {
    prize = await fetchLottisPrizeInfo(round);
  } catch {
    prize = null;
  }

  if (!prize) {
    return {
      status: "prize-info-unavailable",
      round,
      draw: lottis,
      firstPrizeAmount: null,
      firstPrizeCount: null,
      provenance,
      message:
        "당첨번호는 보조 출처 2곳이 일치했지만, 1등 당첨금/당첨자 수를 확인할 수 없어 등록을 보류합니다.",
    };
  }

  return {
    status: "fallback-consensus",
    round,
    draw: lottis,
    firstPrizeAmount: prize.firstPrizeAmount,
    firstPrizeCount: prize.firstPrizeCount,
    provenance,
    message: `보조 출처 2곳(lottis.kr, datalotto.kr)이 일치해 fallback으로 등록합니다.`,
  };
}
