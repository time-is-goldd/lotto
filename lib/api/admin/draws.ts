import { createWinNotification } from "@/lib/api/notifications";
import {
  assertValidBonusNumber,
  assertValidNumberSet,
  matchNumbers,
} from "@/lib/logic/matchNumbers";
import { createClient } from "@/lib/supabase/service";
import type { WinningDraw, WinningDrawPrizeInfo } from "@/lib/types/winning";

// Phase6-3 계약(docs/PHASE6_ADMIN_DRAW_PROCESSING_REPORT.md). Phase6-2가 확정한 "배치 자동
// 연결" 전략(docs/PHASE6_DATA_ARCHITECTURE_DECISION.md §5)을 실제로 구현하는 서비스 계층이다.
//
// 이 파일은 service_role(lib/supabase/service.ts)을 사용한다 — draws INSERT와 다른 사용자들의
// user_numbers 일괄 UPDATE는 RLS(0008_rls_policies.sql)를 우회해야만 가능한 관리자 전용
// 작업이기 때문이다(DATABASE_SCHEMA.md §6 "관리자 정책 공통 원칙"). 이 파일을 호출하는 상위
// 계층(HTTP Route 등)이 반드시 관리자 인증을 통과시킨 뒤에만 이 함수를 불러야 한다 — 이 함수
// 자체는 호출자가 관리자인지 검증하지 않는다(관리자 인증 자체가 아직 이 프로젝트에 없다는
// 사실이 이번 Task의 BLOCKER다. 보고서 §2 참조).

export class AdminDrawsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminDrawsValidationError";
  }
}

export class DuplicateRoundError extends Error {
  constructor(round: number) {
    super(`회차 ${round}는 이미 등록되어 있습니다.`);
    this.name = "DuplicateRoundError";
  }
}

// 실제 로또 1회차는 2002-12-07, 매주 1회 진행된다 — 지금(2020년대)까지도 1300회를 넘지 않는다.
// 100000회차는 매주 진행돼도 약 1900년 뒤에나 도달하는 값이라, 정상적인 회차 입력에서는
// 절대 도달할 수 없는 상한이다. 자릿수 오타(예: 1150 대신 11500000)만 걸러내는 목적이며,
// 실제 회차 계산 로직(날짜 기반 자동 산출)은 이번 Task 범위가 아니다(Phase6-2 §4 Option A 참조).
const MAX_ROUND = 100_000;

export type AdminDrawInput = WinningDraw & WinningDrawPrizeInfo;

export interface AdminDrawsResult {
  round: number;
  matchedCount: number;
  winnersCount: number;
  failedUpdateIds: number[];
}

// round/firstPrizeAmount/firstPrizeCount는 matchNumbers()의 검증 대상이 아니므로 여기서
// 직접 검증한다. winningNumbers/bonusNumber는 matchNumbers.ts가 이미 검증하는 것과 완전히
// 같은 규칙(6개, 1~45, 중복 없음, bonus는 winningNumbers와 중복 불가)이라 그 검증 함수를
// 그대로 재사용한다("판정 알고리즘을 복제하지 않는다" 원칙 — draws.ts가 아니라 matchNumbers.ts
// 쪽 로직이 유일한 진실 소스다).
export function parseAdminDrawsInput(body: unknown): AdminDrawInput {
  if (typeof body !== "object" || body === null) {
    throw new AdminDrawsValidationError("요청 본문이 올바른 JSON 객체가 아닙니다.");
  }

  const { round, winningNumbers, bonusNumber, firstPrizeAmount, firstPrizeCount } = body as Record<
    string,
    unknown
  >;

  if (typeof round !== "number" || !Number.isInteger(round) || round < 1 || round > MAX_ROUND) {
    throw new AdminDrawsValidationError(`round는 1~${MAX_ROUND} 사이의 정수여야 합니다.`);
  }

  try {
    assertValidNumberSet(winningNumbers, "winningNumbers");
    assertValidBonusNumber(bonusNumber, winningNumbers);
  } catch (error) {
    if (error instanceof Error) {
      throw new AdminDrawsValidationError(error.message);
    }
    throw error;
  }

  if (
    typeof firstPrizeAmount !== "number" ||
    !Number.isInteger(firstPrizeAmount) ||
    firstPrizeAmount < 0
  ) {
    throw new AdminDrawsValidationError("firstPrizeAmount는 0 이상의 정수여야 합니다.");
  }

  if (
    typeof firstPrizeCount !== "number" ||
    !Number.isInteger(firstPrizeCount) ||
    firstPrizeCount < 0
  ) {
    throw new AdminDrawsValidationError("firstPrizeCount는 0 이상의 정수여야 합니다.");
  }

  return { round, winningNumbers, bonusNumber, firstPrizeAmount, firstPrizeCount };
}

// Postgres unique violation code. draws.round UNIQUE 제약(0002_draws_user_numbers.sql)이
// 동시 요청(Case D)까지 포함해 중복 회차를 원천적으로 막아준다 — 애플리케이션 레벨 락이나
// 트랜잭션을 새로 만들지 않는다(이번 Task 원칙: 불필요하게 복잡한 transaction 도입 금지).
const POSTGRES_UNIQUE_VIOLATION = "23505";

// Phase6-2 §5 채택안("배치 자동 연결")을 그대로 구현한다: 회차를 저장한 뒤, 그 시점까지
// 아직 어떤 회차에도 연결되지 않고(target_round IS NULL) 확인되지도 않은(checked_at IS NULL)
// 회원 소유(user_id IS NOT NULL — 비회원은 EXECUTION_PLAN.md §456에 따라 대조 제외) 행 전부를
// 이 회차에 연결하고 matchNumbers()로 판정한다.
//
// 부분 실패(Case C) 처리 방침: 한 행의 UPDATE가 실패해도 나머지 행 처리를 중단하지 않는다
// (실패한 id는 failedUpdateIds로 반환). 실패한 행은 target_round가 여전히 NULL로 남으므로
// 다음 번 다른 회차가 등록될 때 다시 조회 대상에 포함된다 — 즉 "이번 회차로는 확인되지
// 않았지만 다음 회차 처리 때 재시도된다"는 뜻이다(정확히 이번 회차와 대조되지 못했다는
// 한계는 있음, docs/PHASE6_ADMIN_DRAW_PROCESSING_REPORT.md §10 참조).
//
// Phase6-4-0이 제안한 .upsert() 기반 일괄 처리는 채택하지 않았다 — 실제 Supabase에 대해
// 직접 검증한 결과, user_numbers.id/draws.id가 "generated always as identity"라 upsert가
// id 컬럼에 값을 실어 보내는 순간 Postgres가 "cannot insert a non-DEFAULT value into
// column \"id\"" (428C9)로 거부한다(OVERRIDING SYSTEM VALUE가 필요하나 PostgREST가 이를
// 자동으로 붙여주지 않는다). 이를 우회하려면 identity 컬럼 정의를 바꾸는 migration이
// 필요한데 이번 Task는 신규 migration을 금지하므로, 대신 아래 UPDATE에 .is("target_round",
// null) 조건과 .select("id")를 추가하는 "최소 안전장치"로 대체했다(docs/PHASE6_ADMIN_DRAW_
// ROUTE_REPORT.md §7).
// options.source: Phase10-6 계약(docs/OFFICIAL_LOTTO_AUTO_SYNC_REPORT.md §7) — draws.source
// (varchar(50) not null default 'manual', 0002_draws_user_numbers.sql에 이미 존재하던 컬럼,
// "Phase8 자동수집 도입 시 그 경로에서 다른 값을 명시한다"는 원래 주석 그대로 실현했다)에
// 어떤 값을 넣을지는 항상 호출부가 정한다 — 이 함수가 스스로 판단하지 않는다. 기존
// app/api/admin/draws/route.ts(관리자 수동 등록)는 이 옵션을 넘기지 않아 DB 기본값
// 'manual'을 그대로 쓰고, 새 lib/api/admin/lottoSync.ts(자동 동기화)만 explicit하게
// source: 'dhlottery.co.kr'를 넘긴다. 매개변수를 선택적으로 추가했을 뿐 기존 호출부/테스트는
// 전혀 바뀌지 않는다(새 matching 파이프라인을 만들지 않는다는 원칙 — 이 함수 자체와 그
// 아래의 대조/알림 로직은 한 글자도 바꾸지 않았다).
export async function registerDrawAndMatchUserNumbers(
  input: AdminDrawInput,
  options?: { source?: string }
): Promise<AdminDrawsResult> {
  const supabase = createClient();
  const sortedWinningNumbers = [...input.winningNumbers].sort((a, b) => a - b);

  const { data: draw, error: insertError } = await supabase
    .from("draws")
    .insert({
      round: input.round,
      numbers: sortedWinningNumbers,
      bonus_number: input.bonusNumber,
      first_prize_amount: input.firstPrizeAmount,
      first_prize_count: input.firstPrizeCount,
      ...(options?.source ? { source: options.source } : {}),
    })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === POSTGRES_UNIQUE_VIOLATION) {
      throw new DuplicateRoundError(input.round);
    }
    throw insertError;
  }

  const { data: targets, error: selectError } = await supabase
    .from("user_numbers")
    .select("id, user_id, numbers")
    .is("target_round", null)
    .is("checked_at", null)
    .not("user_id", "is", null);

  if (selectError) {
    throw selectError;
  }

  const checkedAt = new Date().toISOString();
  let winnersCount = 0;
  const failedUpdateIds: number[] = [];

  for (const row of targets ?? []) {
    const result = matchNumbers(row.numbers, sortedWinningNumbers, input.bonusNumber);

    // Case C 최소 보완(docs/PHASE6_ADMIN_DRAW_ROUTE_REPORT.md §7): .eq("id", row.id) 외에
    // .is("target_round", null)을 추가로 조건에 걸었다 — SELECT와 이 UPDATE 사이에 그 행이
    // 이미 다른 처리로 target_round를 갖게 됐다면(예: 극히 드문 동시 실행), 이 UPDATE는
    // 조건 불일치로 0행에 적용되고 조용히 값을 덮어쓰지 않는다. .select("id")로 실제
    // 영향받은 행 수를 직접 확인해 "에러는 없지만 0행 업데이트"인 경우까지 실패로 취급한다
    // (기존에는 이 경우를 감지할 방법이 없었다 — Postgres는 조건 불일치를 에러로 보지 않는다).
    const { data: updatedRows, error: updateError } = await supabase
      .from("user_numbers")
      .update({
        target_round: draw.round,
        match_count: result.matchCount,
        win_rank: result.winRank,
        checked_at: checkedAt,
      })
      .eq("id", row.id)
      .is("target_round", null)
      .select("id");

    if (updateError || !updatedRows || updatedRows.length === 0) {
      console.error("[registerDrawAndMatchUserNumbers] user_numbers UPDATE 실패(또는 0행 적용)", {
        id: row.id,
        error: updateError ?? null,
        updatedCount: updatedRows?.length ?? 0,
      });
      failedUpdateIds.push(row.id);
      continue;
    }

    if (result.winRank !== null && row.user_id !== null) {
      winnersCount += 1;
      try {
        await createWinNotification(row.user_id, draw.round, result.winRank);
      } catch (error) {
        // 알림 실패는 판정 결과(이미 UPDATE 성공)를 되돌리지 않는다 — 당첨 확인 자체가
        // 알림보다 핵심 기능이다. 이 행은 target_round가 이미 세팅돼 다음 조회 대상에서
        // 빠지므로 알림 재시도 경로가 없다는 한계를 그대로 기록한다(보고서 §10).
        console.error("[registerDrawAndMatchUserNumbers] 당첨 알림 생성 실패", {
          userId: row.user_id,
          round: draw.round,
          error,
        });
      }
    }
  }

  return {
    round: draw.round,
    matchedCount: (targets ?? []).length,
    winnersCount,
    failedUpdateIds,
  };
}
