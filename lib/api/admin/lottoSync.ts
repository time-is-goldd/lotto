import { DuplicateRoundError, registerDrawAndMatchUserNumbers } from "@/lib/api/admin/draws";
import { getTrustedDrawResult } from "@/lib/lotto/sources";
import { createClient as createServiceClient } from "@/lib/supabase/service";

// Phase10-6 계약(docs/OFFICIAL_LOTTO_AUTO_SYNC_REPORT.md), Phase10-6B에서 source broker
// 연동으로 확장(docs/LOTTO_MULTI_SOURCE_FALLBACK_REPORT.md). 이 파일은 "다음에 어떤 회차를
// 시도할지, DB와 결과가 다르면 어떻게 할지"만 판단하는 조율(orchestration) 계층이다 — 실제
// draws INSERT + user_numbers 대조 + 당첨 알림은 전부 lib/api/admin/draws.ts의
// registerDrawAndMatchUserNumbers()(Phase6-3, 무수정)에 위임한다. 공식/보조 출처 중 무엇을
// 쓸지, consensus가 성립하는지는 전부 lib/lotto/sources/index.ts(source broker)의 책임이다 —
// 이 파일은 그 결과(TrustedDrawResult)의 status만 보고 분기할 뿐, dhlottery/lottis/datalotto
// 중 어떤 adapter가 있는지조차 모른다(지시문 §16 "Phase6는 source 종류를 몰라야 한다"와
// 동일한 원칙을 이 파일에도 적용). Cron(app/api/cron/sync-lotto)과 관리자 수동 동기화
// (app/api/admin/draws/sync)가 반드시 이 함수 하나만 호출한다 — 둘이 서로 다른 로직을 갖지
// 않는다.

// 한 번 실행에서 무제한 backfill을 하지 않는다(지시문 §12 "max 10 또는 20 rounds") — Cron이
// 오래 실패해도(예: 10주 이상) 한 번에 전부 복구하려다 실행 시간이 과도하게 늘어나는 것을
// 막는다. 이 한도를 넘는 누락은 다음 실행에서 이어서 복구된다(매 실행이 DB latest round부터
// 다시 계산하므로 상태를 별도로 저장할 필요가 없다).
const MAX_BACKFILL_ROUNDS = 10;

export type LottoSyncStatus =
  | "synced"
  | "up-to-date"
  | "conflict"
  | "source-unavailable"
  | "source-disagreement"
  | "fallback-disabled";

export interface LottoSyncResult {
  status: LottoSyncStatus;
  syncedRounds: number[];
  conflictRound: number | null;
  message: string;
}

function sameNumbers(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((n, i) => n === b[i]);
}

async function getLatestDbRound(supabase: ReturnType<typeof createServiceClient>): Promise<number> {
  const { data, error } = await supabase
    .from("draws")
    .select("round")
    .order("round", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return data?.[0]?.round ?? 0;
}

interface ExistingDraw {
  numbers: number[];
  bonus_number: number;
}

async function getExistingDraw(
  supabase: ReturnType<typeof createServiceClient>,
  round: number
): Promise<ExistingDraw | null> {
  const { data, error } = await supabase
    .from("draws")
    .select("numbers, bonus_number")
    .eq("round", round)
    .limit(1);

  if (error) {
    throw error;
  }

  return data?.[0] ?? null;
}

// provenance를 draws.source(varchar(50))에 기록할 문자열로 변환한다 — "official"이면 기존
// 그대로 "dhlottery.co.kr", "secondary-consensus"면 실제로 합의한 두 출처를 그대로 남겨
// 나중에 이 회차가 어떻게 등록됐는지 로그/DB만으로 추적 가능하게 한다(지시문 §9 provenance
// 요구를 draws.source 컬럼 재사용으로 충족 — 새 컬럼을 추가하지 않는다).
function provenanceToSourceLabel(
  provenance: { mode: "official" } | { mode: "secondary-consensus"; sources: string[] }
): string {
  if (provenance.mode === "official") {
    return "dhlottery.co.kr";
  }
  return provenance.sources.join("+");
}

// 지시문 §5 순서(Official Source → Parse → Strict Validation → Existing DB Comparison →
// Phase6 Registration)를 그대로 구현한다. DB latest round + 1부터 순차적으로 시도하며,
// 각 회차의 신뢰 가능한 결과는 getTrustedDrawResult()(source broker)가 결정한다. 다음 중
// 하나라도 발생하면 그 즉시 루프를 멈춘다(더 진행하지 않음 — 지시문 §36 "중간 회차 하나가
// invalid하면 이후 데이터까지 무리하게 진행하지 않는다"):
//   1. 공식/보조 출처 어디에도 그 회차가 아직 없음 → 정상 종료.
//   2. 신뢰할 수 있는 결과를 얻지 못함(공식 실패 + 보조 미달/불일치/비활성 등) → fail-closed,
//      DB 변경 없이 종료.
//   3. 같은 회차가 이미 DB에 있는데 값이 다름(DRAW_CONFLICT) → 절대 덮어쓰지 않고 종료.
export async function syncOfficialLottoDraws(): Promise<LottoSyncResult> {
  const supabase = createServiceClient();
  const dbLatestRound = await getLatestDbRound(supabase);

  const syncedRounds: number[] = [];

  for (let offset = 1; offset <= MAX_BACKFILL_ROUNDS; offset++) {
    const round = dbLatestRound + offset;

    const existing = await getExistingDraw(supabase, round);
    const trusted = await getTrustedDrawResult(round);

    if (
      trusted.status === "official-round-not-found" ||
      trusted.status === "secondary-round-not-found"
    ) {
      return {
        status: syncedRounds.length > 0 ? "synced" : "up-to-date",
        syncedRounds,
        conflictRound: null,
        message:
          syncedRounds.length > 0
            ? `${syncedRounds.join(", ")}회 동기화 완료. ${trusted.message}`
            : "이미 최신 상태입니다.",
      };
    }

    if (trusted.status === "source-disagreement") {
      return {
        status: "source-disagreement",
        syncedRounds,
        conflictRound: null,
        message: trusted.message,
      };
    }

    if (trusted.status === "fallback-disabled") {
      return {
        status: "fallback-disabled",
        syncedRounds,
        conflictRound: null,
        message: trusted.message,
      };
    }

    if (trusted.status !== "official" && trusted.status !== "fallback-consensus") {
      // official-parse-failure / all-sources-unavailable / single-secondary-success /
      // prize-info-unavailable — 전부 "이번 회차를 신뢰할 수 있게 확정하지 못함"으로 묶어
      // fail-closed 종료한다.
      return {
        status: syncedRounds.length > 0 ? "synced" : "source-unavailable",
        syncedRounds,
        conflictRound: null,
        message:
          syncedRounds.length > 0
            ? `${syncedRounds.join(", ")}회까지 동기화 후 ${round}회에서 중단: ${trusted.message}`
            : trusted.message,
      };
    }

    // 여기 도달하면 trusted.status는 "official" 또는 "fallback-consensus"이고,
    // draw/firstPrizeAmount/firstPrizeCount가 전부 채워져 있음이 보장된다(source broker 계약).
    const draw = trusted.draw!;
    const firstPrizeAmount = trusted.firstPrizeAmount!;
    const firstPrizeCount = trusted.firstPrizeCount!;

    if (existing) {
      // 지시문 §10/§40: 이미 DB에 있는 회차와 결과가 정확히 일치하면 아무 것도 하지 않는다
      // (idempotent no-op). 값이 다르면 절대 덮어쓰지 않고 즉시 중단한다 — 출처가 official/
      // fallback 무엇이든 정책은 동일하다.
      if (
        sameNumbers(existing.numbers, draw.numbers) &&
        existing.bonus_number === draw.bonusNumber
      ) {
        continue;
      }
      return {
        status: "conflict",
        syncedRounds,
        conflictRound: round,
        message: `${round}회는 이미 DB에 다른 값으로 존재합니다 — 자동 덮어쓰기를 하지 않았습니다. 운영자 확인이 필요합니다.`,
      };
    }

    try {
      await registerDrawAndMatchUserNumbers(
        {
          round: draw.round,
          winningNumbers: draw.numbers,
          bonusNumber: draw.bonusNumber,
          firstPrizeAmount,
          firstPrizeCount,
        },
        { source: provenanceToSourceLabel(trusted.provenance!) }
      );
      syncedRounds.push(round);
    } catch (error) {
      // DuplicateRoundError: 이 함수가 시작한 뒤 다른 실행(동시 Cron/관리자 수동 동기화)이
      // 먼저 같은 회차를 등록한 극히 드문 경쟁 상황이다 — idempotent skip으로 처리하고 다음
      // 회차로 계속 진행한다(지시문 §9).
      if (error instanceof DuplicateRoundError) {
        continue;
      }
      throw error;
    }
  }

  return {
    status: syncedRounds.length > 0 ? "synced" : "up-to-date",
    syncedRounds,
    conflictRound: null,
    message:
      syncedRounds.length > 0
        ? `${syncedRounds.join(", ")}회 동기화 완료.`
        : "이미 최신 상태입니다.",
  };
}
