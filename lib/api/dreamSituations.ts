import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/database";

// lib/api/dreams.ts와 동일한 이유로 별도 lib/types/dreamSituations.ts를 만들지 않는다 — 이
// 파일 하나에서만 쓰이는 타입이라 분리할 재사용 가치가 없다.
export type DreamSituation = Tables<"dream_situations">;

// dream_situations도 dreams와 동일하게 전체 공개 콘텐츠다(supabase/migrations/0018_dream_situations.sql
// dream_situations_select_public — anon/authenticated 모두 SELECT 허용). 그래서 lib/api/dreams.ts와
// 똑같이 getCurrentUser()를 호출하지 않고 service_role도 쓰지 않는다 — lib/supabase/server.ts
// (anon key + 쿠키 세션)만으로 공개 데이터 조회에 충분하다.

// 부모 꿈 상세 페이지("이 꿈에는 이런 상황도 있어요" 섹션)와 상황 목록 어디에서도 쓰인다.
// display_order로 정렬해 seed migration이 의도한 노출 순서(대표 상황 먼저)를 그대로 따른다.
export async function getDreamSituations(dreamId: number): Promise<DreamSituation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dream_situations")
    .select("*")
    .eq("dream_id", dreamId)
    .order("display_order", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

// dream_situations.keyword는 dream_id 범위로만 UNIQUE하다(0018_dream_situations.sql —
// unique (dream_id, keyword)) — 전역으로는 고유하지 않으므로 반드시 dreamId와 함께 조회해야
// 한다. URL 구조가 /dream/[keyword]/[situation]이라 두 값 모두 라우트 세그먼트에서 항상 함께
// 확보된다(app/dream/[keyword]/[situation]/page.tsx가 먼저 getDreamByKeyword로 부모를 찾은
// 뒤 이 함수를 호출하는 흐름을 전제로 한다).
// lib/api/dreams.ts의 getDreamById()와 동일한 이유로 존재한다 — 관리자 수정 화면
// (app/admin/dreams/[id]/situations/[situationId]/edit/page.tsx)이 URL의 situationId(숫자
// PK)로 조회해야 하는데, 공개 페이지는 항상 keyword로만 접근하므로 이 by-id 조회는 현재
// 관리자 화면 전용이다. 그래도 순수 SELECT라 공개 조회 서비스 책임(anon 클라이언트)에서
// 벗어나지 않으므로 lib/api/admin/dreamSituations.ts가 아니라 이 파일에 둔다(dreams.id가
// 실제 PK라 .maybeSingle()이 안전한 것과 동일하게 dream_situations.id도 PK다).
export async function getDreamSituationById(id: number): Promise<DreamSituation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dream_situations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getDreamSituationByKeyword(
  dreamId: number,
  situationKeyword: string
): Promise<DreamSituation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dream_situations")
    .select("*")
    .eq("dream_id", dreamId)
    .eq("keyword", situationKeyword)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
