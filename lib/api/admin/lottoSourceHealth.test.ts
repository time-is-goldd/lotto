import { beforeEach, describe, expect, it, vi } from "vitest";

import { getTrustedDrawResult, type TrustedDrawResult } from "@/lib/lotto/sources";
import { createClient as createServiceClient } from "@/lib/supabase/service";

import { checkLottoSourceHealth } from "./lottoSourceHealth";

vi.mock("@/lib/supabase/service");
vi.mock("@/lib/lotto/sources", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/lotto/sources")>();
  return { ...actual, getTrustedDrawResult: vi.fn() };
});

function mockSupabase(latestRound: number | null) {
  const selectSpy = vi.fn(() => ({
    order: vi.fn(() => ({
      limit: vi.fn(() =>
        Promise.resolve({ data: latestRound === null ? [] : [{ round: latestRound }], error: null })
      ),
    })),
  }));
  const from = vi.fn((table: string) => {
    if (table !== "draws") {
      throw new Error(`unexpected table: ${table}`);
    }
    return { select: selectSpy };
  });
  vi.mocked(createServiceClient).mockReturnValue({ from } as unknown as ReturnType<
    typeof createServiceClient
  >);
  return { from, selectSpy };
}

const SAMPLE_RESULT: TrustedDrawResult = {
  status: "official-round-not-found",
  round: 1237,
  draw: null,
  firstPrizeAmount: null,
  firstPrizeCount: null,
  provenance: null,
  message: "1237회는 아직 공식 발표되지 않았습니다.",
};

describe("checkLottoSourceHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("DB latest round + 1을 broker에 물어보고 그 결과를 그대로 반환한다", async () => {
    mockSupabase(1236);
    vi.mocked(getTrustedDrawResult).mockResolvedValue(SAMPLE_RESULT);

    const report = await checkLottoSourceHealth();

    expect(report.round).toBe(1237);
    expect(getTrustedDrawResult).toHaveBeenCalledWith(1237);
    expect(report.result).toEqual(SAMPLE_RESULT);
  });

  it("DB가 비어 있으면 round 1을 확인한다", async () => {
    mockSupabase(null);
    vi.mocked(getTrustedDrawResult).mockResolvedValue(SAMPLE_RESULT);

    const report = await checkLottoSourceHealth();

    expect(report.round).toBe(1);
    expect(getTrustedDrawResult).toHaveBeenCalledWith(1);
  });

  it("draws 테이블에 select 외의 어떤 쓰기 메서드도 호출하지 않는다(구조적 mutation-zero 증거)", async () => {
    const { from } = mockSupabase(1236);
    vi.mocked(getTrustedDrawResult).mockResolvedValue(SAMPLE_RESULT);

    await checkLottoSourceHealth();

    // mock 빌더 자체가 select만 제공한다 — insert/update/delete를 호출하려 하면 TypeError가
    // 나야 정상이다. 실제로 select만 호출됐는지 명시적으로 확인한다.
    expect(from).toHaveBeenCalledWith("draws");
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("이 파일은 lib/api/admin/draws(registerDrawAndMatchUserNumbers가 있는 모듈)를 import하지 않는다(정적 검증)", async () => {
    // 설명 주석에는 그 함수 이름이 등장할 수 있으므로(왜 안 쓰는지 설명하기 위해), 실제
    // import 대상 모듈 경로로 검사한다 — "실수로 호출 경로가 생기는 것"을 코드 구조로
    // 막는다는 설계 의도(지시문 §23)를 import 문 자체의 부재로 고정한다.
    const fs = await import("fs");
    const source = fs.readFileSync(new URL("./lottoSourceHealth.ts", import.meta.url), "utf-8");
    expect(source).not.toContain('from "@/lib/api/admin/draws"');
  });
});
