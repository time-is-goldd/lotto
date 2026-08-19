import { createClient } from "@/lib/supabase/server";

// Phase10-9 §30/§31: Parent가 45개, Situation이 300개 안팎으로 늘어난 뒤에도 사용자가
// "뱀 물림"처럼 부분 단어만 입력해도 가까운 결과를 찾을 수 있게 하는 최소 검색 기능이다.
// 복잡한 semantic/AI 검색을 만들지 않는다는 지시(§30 "이번 Task에서 복잡한 semantic/AI
// search 금지")에 따라 Postgres ilike 두 번(Parent/Situation)이 전부다 — 새 인덱스/RPC/전문
// 검색(full text search) 확장도 추가하지 않는다(현재 규모에서 ilike면 충분하다는 지시문
// 판단을 그대로 따름).
//
// dreams/dream_situations 둘 다 전체 공개 콘텐츠라(0008/0018 RLS) service_role이 필요 없다 —
// lib/api/dreams.ts / lib/api/dreamSituations.ts와 동일하게 anon 세션 클라이언트만 쓴다.

export interface DreamSearchResult {
  type: "parent" | "situation";
  title: string;
  summary: string | null;
  href: string;
}

const DEFAULT_LIMIT = 8;

// ilike 패턴에서 %, _, \는 와일드카드/이스케이프 문자로 해석된다 — 사용자가 입력한 검색어를
// 그대로 패턴에 꽂으면 의도치 않은 매칭이 생길 수 있어(예: "50%" 같은 입력), Postgres LIKE의
// 기본 이스케이프 문자(\)로 세 문자 모두 이스케이프한다.
function escapeIlikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function searchDreamContent(
  rawQuery: string,
  limit: number = DEFAULT_LIMIT
): Promise<DreamSearchResult[]> {
  const query = rawQuery.trim();
  if (query.length === 0) {
    return [];
  }

  const pattern = `%${escapeIlikePattern(query)}%`;
  const supabase = await createClient();

  const [{ data: parents, error: parentsError }, { data: situations, error: situationsError }] =
    await Promise.all([
      supabase.from("dreams").select("keyword").ilike("keyword", pattern).limit(limit),
      supabase
        .from("dream_situations")
        .select("keyword, title, key_meaning, dream_id, dreams!inner(keyword)")
        .or(`title.ilike.${pattern},keyword.ilike.${pattern}`)
        .limit(limit),
    ]);

  if (parentsError) {
    throw parentsError;
  }
  if (situationsError) {
    throw situationsError;
  }

  const parentResults: DreamSearchResult[] = (parents ?? []).map((dream) => ({
    type: "parent",
    title: dream.keyword,
    summary: null,
    href: `/dream/${encodeURIComponent(dream.keyword)}`,
  }));

  // situations!inner(keyword)로 부모의 keyword까지 한 번의 쿼리로 가져온다 — situation
  // 하나당 부모를 다시 조회하는 N+1을 만들지 않는다(§46 "모든 Situation을 모든 page에서
  // 한번에 fetch하는 비효율이 없는지 확인" 원칙을 검색에도 동일하게 적용).
  const situationResults: DreamSearchResult[] = (situations ?? []).map((situation) => {
    const parentKeyword = (situation as unknown as { dreams: { keyword: string } }).dreams.keyword;
    return {
      type: "situation",
      title: situation.title,
      summary: situation.key_meaning,
      href: `/dream/${encodeURIComponent(parentKeyword)}/${encodeURIComponent(situation.keyword)}`,
    };
  });

  return [...parentResults, ...situationResults].slice(0, limit);
}
