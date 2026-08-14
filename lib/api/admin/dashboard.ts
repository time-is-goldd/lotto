import { createClient as createPublicClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@/lib/supabase/service";

// Phase9-4 계약(docs/PHASE9_ADMIN_DASHBOARD_REPORT.md). 관리자 전용 집계 책임을 이 파일에
// 분리한다 — lib/api/dreams.ts(Phase7, 공개 조회)와 lib/api/admin/dreams.ts(Phase9-3, 꿈
// mutation)를 이 목적으로 수정하지 않는다(지시문 §5). 이 파일을 호출하는 상위 계층
// (app/admin/page.tsx)이 반드시 관리자 인증을 통과시킨 뒤에만 이 함수를 불러야 한다 —
// lib/api/admin/draws.ts/dreams.ts와 동일하게 이 함수 자체는 호출자가 관리자인지
// 검증하지 않는다.
export interface AdminDashboardStats {
  dreamCount: number;
  dreamNumberMappingCount: number;
  userNumbersCount: number;
  checkedUserNumbersCount: number;
  winningUserNumbersCount: number;
  dreamGeneratedNumbersCount: number;
  dreamJournalEntryCount: number;
  recentDreams: { id: number; keyword: string; createdAt: string }[];
}

// dreams/dream_number_mappings는 공개 데이터라(dreams_select_public 등, 0008_rls_policies.sql)
// service_role이 필요 없다 — anon 세션 클라이언트로 충분하다(lib/api/admin/dreams.ts의
// getDreamIdsWithNumbers()와 동일한 판단).
async function getDreamContentCounts(): Promise<{
  dreamCount: number;
  dreamNumberMappingCount: number;
  recentDreams: AdminDashboardStats["recentDreams"];
}> {
  const supabase = await createPublicClient();

  const [{ count: dreamCount, error: dreamCountError }, { count: mappingCount, error: mappingError }, { data: recent, error: recentError }] =
    await Promise.all([
      supabase.from("dreams").select("*", { count: "exact", head: true }),
      supabase.from("dream_number_mappings").select("*", { count: "exact", head: true }),
      supabase.from("dreams").select("id, keyword, created_at").order("created_at", { ascending: false }).limit(5),
    ]);

  if (dreamCountError) {
    throw dreamCountError;
  }
  if (mappingError) {
    throw mappingError;
  }
  if (recentError) {
    throw recentError;
  }

  return {
    dreamCount: dreamCount ?? 0,
    dreamNumberMappingCount: mappingCount ?? 0,
    recentDreams: (recent ?? []).map((row) => ({ id: row.id, keyword: row.keyword, createdAt: row.created_at })),
  };
}

// user_numbers/dream_journal_entries의 RLS는 "본인만 SELECT"다(auth.uid() = user_id,
// 0008_rls_policies.sql) — 전체 사용자를 대상으로 한 집계(대시보드가 필요로 하는 것)는
// anon 세션 클라이언트로는 근본적으로 불가능하다(관리자 세션이어도 RLS는 "본인 행"만
// 통과시킨다). 이것이 이 파일에서 service_role이 실제로 필요한 유일한 지점이다 — 지시문
// §10 "정말 필요한 서버 전용 집계 작업"에 해당한다.
//
// count(head: true)만 쓴다 — 행 데이터를 전부 가져와 JS에서 세지 않는다(지시문 §7).
// 조건별로 별도 count 쿼리 4개를 쓴 이유: PostgREST가 하나의 요청 안에서 서로 다른 조건의
// count를 동시에 반환하는 기능을 제공하지 않고, 이를 위해 RPC(새 DB 함수)를 새로 만드는
// 것은 지시문이 금지한 범위 확장이다(§15 경우 C) — 현재 규모(수십~수백 행)에서 단순 count
// 쿼리 4개면 충분하다고 판단했다.
async function getUserNumbersCounts(): Promise<{
  userNumbersCount: number;
  checkedUserNumbersCount: number;
  winningUserNumbersCount: number;
  dreamGeneratedNumbersCount: number;
}> {
  const supabase = createServiceClient();

  const [
    { count: total, error: totalError },
    { count: checked, error: checkedError },
    { count: winning, error: winningError },
    { count: dreamBased, error: dreamBasedError },
  ] = await Promise.all([
    supabase.from("user_numbers").select("*", { count: "exact", head: true }),
    supabase.from("user_numbers").select("*", { count: "exact", head: true }).not("checked_at", "is", null),
    supabase.from("user_numbers").select("*", { count: "exact", head: true }).not("win_rank", "is", null),
    supabase.from("user_numbers").select("*", { count: "exact", head: true }).eq("generation_method", "dream"),
  ]);

  if (totalError) {
    throw totalError;
  }
  if (checkedError) {
    throw checkedError;
  }
  if (winningError) {
    throw winningError;
  }
  if (dreamBasedError) {
    throw dreamBasedError;
  }

  return {
    userNumbersCount: total ?? 0,
    checkedUserNumbersCount: checked ?? 0,
    winningUserNumbersCount: winning ?? 0,
    dreamGeneratedNumbersCount: dreamBased ?? 0,
  };
}

async function getDreamJournalEntryCount(): Promise<number> {
  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from("dream_journal_entries")
    .select("*", { count: "exact", head: true });

  if (error) {
    throw error;
  }
  return count ?? 0;
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const [dreamContent, userNumbers, dreamJournalEntryCount] = await Promise.all([
    getDreamContentCounts(),
    getUserNumbersCounts(),
    getDreamJournalEntryCount(),
  ]);

  return { ...dreamContent, ...userNumbers, dreamJournalEntryCount };
}
