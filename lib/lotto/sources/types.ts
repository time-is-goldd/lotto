// Phase10-6B 계약(docs/LOTTO_MULTI_SOURCE_FALLBACK_REPORT.md). 모든 source adapter(공식 +
// secondary)가 공통으로 다루는 최소 정규화 타입 — 지시문 §17이 예시로 준 형태를 그대로
// 따른다. 1등 당첨금/당첨자 수는 여기 포함하지 않는다 — `lib/types/winning.ts`의 기존 주석이
// 이미 명시하듯 그 값들은 "표시(UI)에만 필요하고 당첨 판정 로직은 전혀 사용하지 않는 부가
// 데이터"라, 당첨번호 자체의 정확성을 지키는 consensus 비교 대상에는 넣지 않는다(round/
// drawDate/numbers/bonusNumber만 비교 대상 — 지시문 §7 "모든 값 exact match"가 가리키는
// 값들과 정확히 일치).
export interface DrawSourceResult {
  round: number;
  drawDate: string; // YYYY-MM-DD
  numbers: number[]; // 6개, 오름차순 정렬
  bonusNumber: number;
  source: string; // 예: "dhlottery.co.kr", "lottis.kr", "datalotto.kr"
}

export class DrawSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DrawSourceError";
  }
}

// 아직 발표되지 않은 회차를 조회했을 때(공식 소스는 returnValue:"fail", secondary는 목록에
// 해당 round가 아직 없음)의 정상적인 "미발표" 신호 — 다른 이상 상황(네트워크/파싱 실패)과
// 구분한다(lib/lotto/sources/dhlottery.ts의 OfficialLottoRoundNotFoundError와 동일한 이유로
// 각 소스별로 재사용 가능한 공통 타입을 여기 둔다).
export class DrawSourceRoundNotFoundError extends DrawSourceError {
  constructor(source: string, round: number) {
    super(`${source}: ${round}회는 아직 발표되지 않았습니다.`);
    this.name = "DrawSourceRoundNotFoundError";
  }
}
