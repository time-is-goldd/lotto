import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/database";

// 별도 lib/types/dreams.ts를 만들지 않았다 — lib/api/numbers.ts와 동일한 이유로, 이 파일
// 하나에서만 쓰이는 타입이라 분리할 재사용 가치가 없다(과도한 abstraction 지양).
export type Dream = Tables<"dreams">;

// 꿈해몽(dreams/dream_number_mappings)은 전체 공개 콘텐츠다(supabase/migrations/0008_rls_policies.sql
// dreams_select_public/dream_number_mappings_select_public — anon/authenticated 모두 SELECT 허용).
// 그래서 이 파일의 모든 함수는 getCurrentUser()를 호출하지 않고, user_id도 전혀 받지 않는다 —
// 인증을 강제할 이유 자체가 없다(docs/PHASE7_PRE_IMPLEMENTATION_AUDIT.md §4/§5).
// service_role도 쓰지 않는다 — lib/supabase/server.ts(anon key + 쿠키 세션)만으로 공개 데이터
// 조회에 충분하다(RLS가 이미 전체 공개를 허용).

export async function getDreamCategories(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("dreams").select("category");

  if (error) {
    throw error;
  }

  // category는 NULL 허용 컬럼이다(docs/DATABASE_SCHEMA.md §3.4) — 실제 시드 데이터 25건에는
  // 전부 값이 있지만, 스키마상 NULL도 유효하므로 안전하게 걸러낸다.
  const categories = new Set(
    (data ?? [])
      .map((row) => row.category)
      .filter((category): category is string => category !== null)
  );

  return Array.from(categories).sort();
}

export interface GetDreamsOptions {
  category?: string;
}

// 페이지네이션을 넣지 않았다 — 실제 시드 데이터가 25건뿐이고(docs/PHASE7_PRE_IMPLEMENTATION_AUDIT.md
// §2 실측) MVP 완료 기준(EXECUTION_PLAN.md Phase7, "20~30건")도 이 규모를 전제하므로 지금
// 필요하지 않은 기능을 미리 만들지 않는다.
export async function getDreams(options: GetDreamsOptions = {}): Promise<Dream[]> {
  const supabase = await createClient();
  let query = supabase.from("dreams").select("*");

  if (options.category !== undefined) {
    query = query.eq("category", options.category);
  }

  const { data, error } = await query.order("id", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

// dreams.keyword에는 DB 레벨 UNIQUE 제약이 없다(0003_dreams.sql 원문 확인 — varchar(50) not
// null뿐). 실제 시드 데이터 25건은 전부 서로 다른 keyword다(읽기 전용 조회로 확인,
// docs/PHASE7_DREAM_READ_SERVICE_REPORT.md §9 "발견된 문제" 참조). 스키마가 중복을 막아주지
// 않으므로 .maybeSingle()을 그대로 쓰면 향후 중복 keyword가 생겼을 때 명시적 에러로 드러난다
// (조용히 잘못된 행을 반환하는 것보다 안전한 실패 방식이라 판단해 그대로 둔다).
//
// 이 함수 이름을 지시문 원안(getDreamBySlug)이 아니라 getDreamByKeyword로 정한 이유:
// dreams 테이블에는 별도 slug 컬럼이 없고, EXECUTION_PLAN.md의 라우트도 app/dream/[keyword]/
// page.tsx로 "keyword"를 그대로 URL 세그먼트로 쓴다 — 존재하지 않는 개념(slug)에 이름을
// 맞추지 않고 실제 스키마/라우트 컨벤션(keyword)에 맞췄다(docs/PHASE7_DREAM_READ_SERVICE_
// REPORT.md §3 Decision 참조).
export async function getDreamByKeyword(keyword: string): Promise<Dream | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("dreams").select("*").eq("keyword", keyword).maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

// dreams.id는 실제 PK(bigint generated always as identity)라 keyword와 달리 고유성이 DB
// 레벨에서 보장된다 — .maybeSingle()이 안전하다. Phase7-3(lib/api/numbers.ts의 dream 연동
// 검증)이 이 함수로 "클라이언트가 보낸 relatedDreamId가 실제 존재하는 꿈인지" 확인한다.
export async function getDreamById(id: number): Promise<Dream | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("dreams").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

// dream_number_mappings.dream_id는 UNIQUE가 아니다(0003_dreams.sql) — 스키마상 한 꿈에 여러
// 추천번호 세트가 존재할 수 있다(현재 실데이터는 25:25로 1:1이지만 강제되지는 않음). 이 함수는
// .maybeSingle() 대신 .limit(1)로 첫 번째 매핑만 반환해, 스키마가 실제로 허용하는 것보다
// 더 강한 제약(정확히 1개)을 가정하지 않는다 — 향후 여러 세트가 추가돼도 에러 없이 동작한다.
// 번호 생성/저장(Phase7-3 이후)과는 무관한 순수 조회 함수다.
export async function getDreamNumbers(dreamId: number): Promise<number[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dream_number_mappings")
    .select("numbers")
    .eq("dream_id", dreamId)
    .limit(1);

  if (error) {
    throw error;
  }

  return data?.[0]?.numbers ?? null;
}
