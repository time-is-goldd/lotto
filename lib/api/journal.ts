import { getDreamById } from "@/lib/api/dreams";
import { getCurrentUser } from "@/lib/auth/session";
import { DREAM_JOURNAL_TEXT_MAX_LENGTH } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type {
  DiarySummary,
  DrawEntry,
  DreamJournalEntry,
  FortuneResultEntry,
  ListOptions,
  UserNumberEntry,
  UserNumbersListOptions,
} from "@/lib/types/journal";

// Phase4 다이어리 조회 전용 서비스(docs/PHASE4_ARCHITECTURE_DECISION.md §9). 이 파일은
// 조회(Read)만 다룬다 — 작성/수정/삭제는 이번 Phase 범위가 아니다(Phase5~7에 분산).
//
// service_role을 쓰지 않는다: lib/supabase/server.ts(anon key + 쿠키 세션)로 현재 로그인
// 사용자 권한만 사용하고, user_numbers/dream_journal_entries의 실제 데이터 격리는
// supabase/migrations/0008_rls_policies.sql의 RLS(auth.uid() = user_id)에 맡긴다.
//
// 모든 함수가 user_id를 외부 입력으로 받지 않는다 — 항상 서버에서 getCurrentUser()로 현재
// 세션을 직접 확인한다(docs/PHASE4_ARCHITECTURE_DECISION.md §9, "user_id를 클라이언트
// 입력으로 받지 않는다"). 비로그인 상태로 호출되면 에러가 아니라 빈 결과를 반환한다 —
// "다이어리 페이지가 인증 확인을 빠뜨리고 이 함수를 호출하더라도 데이터가 새지 않는다"는
// 이중 안전장치이지, 이 함수들이 인증 게이트 역할을 대신한다는 뜻은 아니다(그 역할은 여전히
// proxy.ts/페이지 자신의 몫).

export class JournalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JournalValidationError";
  }
}

export const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;
// 다이어리 홈 요약 카드에 노출할 "최근 항목" 개수. 목록 화면(DEFAULT_LIST_LIMIT)과 다른
// 값이라 별도 상수로 분리했다 — 요약 카드는 전체 목록이 아니라 미리보기 몇 건만 필요하다.
const SUMMARY_RECENT_LIMIT = 5;

function resolveLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_LIST_LIMIT;
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIST_LIMIT) {
    throw new JournalValidationError(`limit은 1~${MAX_LIST_LIMIT} 사이의 정수여야 합니다.`);
  }
  return limit;
}

function resolveOffset(offset: number | undefined): number {
  if (offset === undefined) {
    return 0;
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new JournalValidationError("offset은 0 이상의 정수여야 합니다.");
  }
  return offset;
}

async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

// docs/PHASE4_ARCHITECTURE_DECISION.md §12(Phase4-4 위험요소)에서 이미 지적한 함정:
// user_numbers/dream_journal_entries/fortune_results 모두 RLS(0008, fortune_results는
// 0017로 교체)가 auth.uid() = user_id로 이미 걸러주지만, 이 함수는 세 테이블 전부에 동일하게
// .eq("user_id", userId)를 명시한다 — "이 함수가 안전한지"를 RLS 존재 여부를 매번 따로
// 확인하지 않고도 코드만 보고 판단할 수 있게 하기 위한 방어적 이중 필터다. (fortune_results는
// Phase10-4A 당시 RLS가 select를 anon/authenticated 모두에게 using(true)로 열어둬 이 필터가
// 유일한 방어선이었으나, Phase10-4B가 own-select 정책으로 교체해 지금은 RLS도 동일하게
// 막아준다 — docs/DAILY_FORTUNE_PRIVACY_FIX_REPORT.md 참조.)

// 히스토리 화면과 당첨확인 화면이 공유하는 조회 함수. 당첨확인은 checked_at이 채워진(Phase6
// 대조 완료) 행만 봐야 하므로 onlyChecked 옵션으로 구분한다 — 두 화면이 테이블/정렬 기준이
// 동일해 별도 함수로 쪼개지 않았다.
export async function getRecentUserNumbers(
  options: UserNumbersListOptions = {}
): Promise<UserNumberEntry[]> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return [];
  }

  const limit = resolveLimit(options.limit);
  const offset = resolveOffset(options.offset);

  const supabase = await createClient();
  let query = supabase.from("user_numbers").select("*").eq("user_id", userId);

  if (options.onlyChecked) {
    query = query.not("checked_at", "is", null);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  return data ?? [];
}

// Phase10-4C(당첨확인): draws는 공개 데이터라(0008_rls_policies.sql draws_select_public,
// anon+authenticated 모두 using(true)) user_id 필터가 필요 없다 — getCurrentUserId() 게이트를
// 두지 않는다. user_numbers.target_round(nullable)에 등장하는 실제 회차 값들만 조회한다 —
// "당첨확인" 화면이 표시할 실제 당첨번호/보너스번호를 여기서 가져온다(새로 인터넷에서
// fetch하지 않고 이미 검증된 draws 테이블만 source of truth로 쓴다).
export async function getDrawsByRounds(rounds: number[]): Promise<DrawEntry[]> {
  const uniqueRounds = Array.from(new Set(rounds));
  if (uniqueRounds.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("draws").select("*").in("round", uniqueRounds);

  if (error) {
    throw error;
  }

  return data ?? [];
}

// dream_journal_entries는 "언제 작성했는지"(created_at)와 "꿈을 꾼 날짜"(entry_date)가 다른
// 컬럼이다(supabase/migrations/0004_dream_journal_entries.sql). 다이어리 열람 목적상 의미
// 있는 최신순은 entry_date 기준이라 이를 정렬 기준으로 쓴다.
export async function getRecentDreamJournalEntries(
  options: ListOptions = {}
): Promise<DreamJournalEntry[]> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return [];
  }

  const limit = resolveLimit(options.limit);
  const offset = resolveOffset(options.offset);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dream_journal_entries")
    .select("*")
    .eq("user_id", userId)
    .order("entry_date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  return data ?? [];
}

// fortune_results의 SELECT RLS는 Phase10-4B(0017_fortune_results_privacy.sql)부터
// auth.uid() = user_id로 좁혀져 RLS 자체가 이미 "본인 데이터만"을 보장한다. 그래도
// .eq("user_id", userId)를 명시적으로 유지한다 — RLS와 이중으로 같은 조건을 강제하는
// 방어적 패턴이며, 이 필터를 빠뜨려도 RLS가 다른 사용자 결과를 걸러준다(단일 장애점 방지).
export async function getRecentFortuneResults(
  options: ListOptions = {}
): Promise<FortuneResultEntry[]> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return [];
  }

  const limit = resolveLimit(options.limit);
  const offset = resolveOffset(options.offset);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fortune_results")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  return data ?? [];
}

// 다이어리 홈 요약 카드용. "이번 달 N번 생성" 같은 기간별 집계는 만들지 않는다 — "이번 달"의
// 경계가 어느 타임존 기준인지 이 Task 범위에서 정해진 바가 없고(로컬 서버 타임존에 암묵적으로
// 의존하는 계산을 넣지 말라는 지시와 충돌), 그 정책이 실제로 필요한 시점(Phase4-2 UI 확정)에
// 명시적으로 결정한 뒤 추가하는 것이 안전하다. 지금은 총 개수 + 최근 목록만 제공한다.
export async function getDiarySummary(): Promise<DiarySummary> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { totalUserNumbersCount: 0, recentUserNumbers: [] };
  }

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("user_numbers")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  const recentUserNumbers = await getRecentUserNumbers({ limit: SUMMARY_RECENT_LIMIT });

  return {
    totalUserNumbersCount: count ?? 0,
    recentUserNumbers,
  };
}

// Phase7-4: 개인 꿈 기록 작성. 이 파일의 나머지 함수는 전부 조회 전용이지만(Phase4
// Architecture Decision §9), createDreamJournalEntry()는 lib/api/numbers.ts(Phase5)의
// saveUserNumbers()와 동일한 "쓰기 서비스" 패턴을 따른다 — userId를 명시적 파라미터로 받고
// 내부에서 getCurrentUser()를 다시 부르지 않는다(호출자인 Route Handler가 이미 인증을
// 확인했다는 전제). 위 조회 함수들의 getCurrentUserId() 패턴(비로그인 → 빈 배열)은 여기 쓰지
// 않는다 — 쓰기 작업에서 "비로그인"은 조용히 무시할 상태가 아니라 명백한 401 오류이기 때문이다.

export function parseDreamJournalInput(body: unknown): { dreamText: string; linkedDreamId: number | null } {
  if (typeof body !== "object" || body === null) {
    throw new JournalValidationError("요청 본문이 올바른 JSON 객체가 아닙니다.");
  }

  const { dreamText, linkedDreamId } = body as Record<string, unknown>;

  if (typeof dreamText !== "string") {
    throw new JournalValidationError("dreamText는 문자열이어야 합니다.");
  }

  const trimmed = dreamText.trim();
  if (trimmed.length === 0) {
    throw new JournalValidationError("꿈 내용을 입력해주세요.");
  }
  if (trimmed.length > DREAM_JOURNAL_TEXT_MAX_LENGTH) {
    throw new JournalValidationError(`꿈 내용은 ${DREAM_JOURNAL_TEXT_MAX_LENGTH}자를 초과할 수 없습니다.`);
  }

  if (linkedDreamId === undefined || linkedDreamId === null) {
    return { dreamText: trimmed, linkedDreamId: null };
  }

  // linkedDreamId는 /dream/[keyword] CTA가 쿼리파라미터로 넘긴 값이 문자열로 도착할 수 있어
  // (Phase7-3의 relatedDreamId와 동일한 이유) 문자열/숫자 둘 다 받는다. 형식만 여기서
  // 검증하고, 실제 존재 여부는 DB 조회가 필요해 createDreamJournalEntry()에서 확인한다.
  const normalizedId = typeof linkedDreamId === "string" ? Number(linkedDreamId) : linkedDreamId;
  if (typeof normalizedId !== "number" || !Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw new JournalValidationError("linkedDreamId는 양의 정수여야 합니다.");
  }

  return { dreamText: trimmed, linkedDreamId: normalizedId };
}

// entry_date는 NOT NULL이고 DEFAULT가 없다(0004_dream_journal_entries.sql) — 사용자에게
// 날짜 입력 필드를 새로 만들지 않고(지시문 §7 "실제 DB에 없는 필드를 새로 만들지 않는다"의
// 반대 방향: 존재하는 NOT NULL 컬럼은 UI 없이도 서버가 채워야 한다), "기록을 저장하는 시점"을
// 오늘 날짜로 서버가 직접 채운다. lib/auth/profile.ts의 calculateAgeVerified와 동일한 이유로
// UTC 기준으로 "오늘"을 계산한다(Date→로컬 getter를 거치면 서버 실행 타임존에 따라 하루
// 밀릴 수 있음).
function todayDateString(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// linkedDreamId가 주어지면 INSERT 전에 실제 존재하는 꿈인지 확인한다 — lib/api/dreams.ts의
// getDreamById()를 재사용하고(Phase7-3이 이미 같은 목적으로 도입한 함수) 새 조회 로직을
// 복제하지 않는다. 존재하지 않으면 JournalValidationError를 던져 위조되거나 삭제된 dreamId로
// 조용히 연결이 성립하는 것을 막는다.
export async function createDreamJournalEntry(
  userId: string,
  dreamText: string,
  linkedDreamId: number | null = null
): Promise<DreamJournalEntry> {
  if (linkedDreamId !== null) {
    const dream = await getDreamById(linkedDreamId);
    if (!dream) {
      throw new JournalValidationError(`존재하지 않는 꿈입니다. (id: ${linkedDreamId})`);
    }
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("dream_journal_entries")
    .insert({
      user_id: userId,
      entry_date: todayDateString(),
      dream_text: dreamText,
      ...(linkedDreamId !== null ? { linked_dream_id: linkedDreamId } : {}),
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}
