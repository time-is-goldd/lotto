import { DreamNotFoundError, type DreamContext } from "@/lib/api/numbers";
import { getDreamById } from "@/lib/api/dreams";
import { MAX_DAILY_GENERATIONS } from "@/lib/logic/dailyNumberPolicy";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/database";
import { getKstDateString } from "@/lib/utils/kstDate";

// claude-code-luck-platform-home-brand-daily-numbers-prompt.md §9.5: 회원의 "오늘의 세 조합"은
// server/database 레벨에서 강제한다. lib/api/numbers.ts(기존 "저장 번호" — user_numbers)와
// DreamContext/DreamNotFoundError를 그대로 재사용한다 — 꿈 연동 검증 로직을 두 번 만들지
// 않는다.

export type DailyNumberGenerationRow = Tables<"daily_number_generations">;

export class DailyLimitReachedError extends Error {
  constructor() {
    super("오늘 만들 수 있는 세 조합을 모두 사용했습니다.");
    this.name = "DailyLimitReachedError";
  }
}

// supabase/migrations/0023_daily_number_generations.sql의 generate_daily_number()가 한도
// 초과 시 SQLSTATE 'P0001'로 던진다.
const DAILY_LIMIT_SQLSTATE = "P0001";

export async function getTodayDailyGenerations(userId: string): Promise<DailyNumberGenerationRow[]> {
  const supabase = await createClient();
  const today = getKstDateString();

  const { data, error } = await supabase
    .from("daily_number_generations")
    .select()
    .eq("user_id", userId)
    .eq("generation_date", today)
    .order("slot_index", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

// user_id는 파라미터로 명시적으로 받는다(lib/api/numbers.ts saveUserNumbers()와 동일한 원칙) —
// 호출부(Route Handler)가 이미 getCurrentUser()로 인증을 확인했다는 전제다.
// dreamNumbers는 lib/logic/dreamNumbers.ts buildDreamAwareNumbers()가 생성 시점에 이미 계산한
// "numbers 중 실제 꿈에서 유래한 부분집합"이다 — 클라이언트가 화면에 보여준 값을 그대로
// 저장해, 나중에 dreams 테이블을 다시 조회하지 않고도 골드 강조를 재현할 수 있게 한다
// (supabase/migrations/0023_daily_number_generations.sql dream_numbers 컬럼 주석 참조).
export async function generateDailyNumber(
  userId: string,
  numbers: number[],
  dreamContext: DreamContext,
  dreamNumbers: number[] = []
): Promise<DailyNumberGenerationRow> {
  if (dreamContext.generationMethod === "dream") {
    const dream = await getDreamById(dreamContext.relatedDreamId);
    if (!dream) {
      throw new DreamNotFoundError(dreamContext.relatedDreamId);
    }
  }

  const supabase = await createClient();
  const today = getKstDateString();

  // dream_numbers는 numbers의 부분집합이어야 한다는 DB CHECK(dream_numbers <@ numbers)를
  // 만족시키기 위해 여기서도 한 번 더 교집합으로 걸러낸다 — 클라이언트 값을 그대로 신뢰하지
  // 않는다(이 프로젝트 전반의 "서버가 다시 검증" 원칙, lib/api/numbers.ts와 동일).
  const numbersSet = new Set(numbers);
  const sanitizedDreamNumbers =
    dreamContext.generationMethod === "dream"
      ? Array.from(new Set(dreamNumbers.filter((n) => numbersSet.has(n))))
      : [];

  const { data, error } = await supabase.rpc("generate_daily_number", {
    p_numbers: numbers,
    p_generation_method: dreamContext.generationMethod,
    p_related_dream_id: dreamContext.generationMethod === "dream" ? dreamContext.relatedDreamId : null,
    p_generation_date: today,
    p_dream_numbers: sanitizedDreamNumbers.length > 0 ? sanitizedDreamNumbers : null,
  });

  if (error) {
    if (error.code === DAILY_LIMIT_SQLSTATE) {
      throw new DailyLimitReachedError();
    }
    throw error;
  }

  // .rpc()가 SETOF가 아닌 단일 행을 반환하는 함수를 호출하면 그 행 객체를 그대로 data에
  // 담는다(PostgREST 계약) — user_id 파라미터는 함수 내부에서 auth.uid()로만 결정되므로
  // 여기서 데이터를 다시 조립할 필요가 없다.
  return data as DailyNumberGenerationRow;
}

// §9.7 비회원 → 로그인 전환 시 guest localStorage 조합을 회원 기록으로 병합한다. 이 함수
// 하나가 실제 "병합 정책"을 구현한다 — 이미 있는 회원 슬롯은 그대로 두고, 남은 슬롯 범위
// 안에서만 guest 조합을 순서대로 채운다(§9.7 "회원의 기존 일일 생성 기록을 우선 보존한다").
export interface GuestComboInput {
  numbers: number[];
  source: "general" | "dream";
  relatedDreamId: number | null;
  dreamNumbers: number[];
}

export interface ReconcileResult {
  merged: DailyNumberGenerationRow[];
  skipped: number;
}

function numbersKey(numbers: number[]): string {
  return numbers.join(",");
}

export async function reconcileGuestDailyCombos(
  userId: string,
  guestCombos: GuestComboInput[]
): Promise<ReconcileResult> {
  const existing = await getTodayDailyGenerations(userId);
  const existingKeys = new Set(existing.map((row) => numbersKey(row.numbers)));

  const merged: DailyNumberGenerationRow[] = [];
  let skipped = 0;

  for (const combo of guestCombos) {
    const key = numbersKey(combo.numbers);
    // §9.7 "guest 조합은 중복을 제거한 뒤" — 이미 회원 기록에 있거나(재시도 시나리오),
    // 이번 루프에서 이미 병합한 값과 같으면 건너뛴다.
    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }

    const dreamContext: DreamContext =
      combo.source === "dream" && combo.relatedDreamId
        ? { generationMethod: "dream", relatedDreamId: combo.relatedDreamId }
        : { generationMethod: "auto", relatedDreamId: null };

    try {
      const row = await generateDailyNumber(userId, combo.numbers, dreamContext, combo.dreamNumbers);
      merged.push(row);
      existingKeys.add(key);
    } catch (error) {
      if (error instanceof DailyLimitReachedError) {
        // §9.7 "최대 3개를 넘기지 않는다" — 한도에 닿으면 남은 guest 조합은 전부 건너뛴다.
        skipped += guestCombos.length - guestCombos.indexOf(combo);
        break;
      }
      if (error instanceof DreamNotFoundError) {
        // 병합 시점 사이에 꿈이 삭제된 드문 경우 — 이 조합 하나만 건너뛰고 나머지는 계속
        // 시도한다(전체 병합을 실패시키지 않는다, §9.7 "guest 조합을 브라우저에서 계속
        // 보여주며" 원칙과 같은 방향 — 실패를 조용히 무시하되 데이터를 잃지 않는다).
        skipped += 1;
        continue;
      }
      throw error;
    }

    if (existing.length + merged.length >= MAX_DAILY_GENERATIONS) {
      break;
    }
  }

  return { merged, skipped };
}
