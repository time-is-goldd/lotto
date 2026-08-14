import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database, Tables } from "@/lib/types/database";
import { getEnv } from "@/lib/utils/env";

// Phase10-1 계약(docs/PHASE10_RELEASE_GATE.md §16). content_entries는 이제 공개 SELECT RLS를
// 갖는다(0015_content_entries_public_read.sql, content_entries_select_public —
// dreams_select_public/0008_rls_policies.sql과 동일한 패턴). 이 파일은 그 공개 데이터만
// 다루는 조회 전용 서비스이고, lib/api/admin/content.ts(관리자 mutation, service_role)와
// 책임을 완전히 분리한다 — service_role도, 관리자 인증(getCurrentUser/isAdmin)도 이 파일
// 어디에서도 쓰지 않는다. type도 admin 모듈에서 import하지 않고 이 파일 안에 독립적으로
// 정의한다(components/admin/contentFormValidation.ts가 lib/api/admin/dreams.ts를 값으로
// import하지 않는 것과 동일한 이유 — 공개 서비스 번들에 관리자 전용 코드 경로가 조금이라도
// 섞이지 않게 한다).
//
// lib/supabase/server.ts(쿠키 기반 세션 클라이언트, next/headers의 cookies())를 쓰지 않는다 —
// cookies()를 호출하는 렌더 경로는 Next.js가 무조건 완전 동적으로 처리해, 로그인 여부와 무관하게
// 항상 같아야 할 공개 콘텐츠 조회가 매 요청 DB를 때리게 된다(app/sitemap.ts가 정확히 같은 이유로
// 쿠키 없는 별도 anon 클라이언트를 쓰는 것과 동일한 판단, docs/PHASE10_RELEASE_GATE.md §5).
// lib/api/dreams.ts는 이 문제를 겪고 있지만(SSG/ISR 미적용 Known Issue, 이 파일의 책임 밖이라
// 수정하지 않는다) 이 파일은 처음부터 sitemap.ts 패턴을 재사용해 같은 문제를 만들지 않는다.
function createPublicClient() {
  return createSupabaseClient<Database>(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}

type PublicContentEntryType = "faq" | "guide";

// DB generated type(Tables<"content_entries">)을 Pick으로 재사용한다 — 필드를 손으로 다시
// 선언하지 않는다(docs/AI_ENGINEERING_CONSTITUTION.md §3 "타입은 DB 스키마에서 파생한다").
// created_at은 Phase10 공개 UI(목록/상세)에 필요하지 않아 select 대상에서 제외했다 — 필요
// 없는 컬럼을 억지로 노출하지 않는다(docs/PHASE10_RELEASE_GATE.md §6).
export type PublicContentEntry = Pick<
  Tables<"content_entries">,
  "id" | "type" | "title" | "body" | "display_order" | "updated_at"
>;

const PUBLIC_CONTENT_COLUMNS = "id, type, title, body, display_order, updated_at" as const;

// FAQ/가이드 목록이 공유하는 조회 로직 — type만 다르다. select("*") 대신 필요한 컬럼만 명시한다.
async function getEntriesByType(type: PublicContentEntryType): Promise<PublicContentEntry[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("content_entries")
    .select(PUBLIC_CONTENT_COLUMNS)
    .eq("type", type)
    .order("display_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }
  return data ?? [];
}

// display_order 오름차순 → id 오름차순 2차 정렬 — lib/api/admin/content.ts의
// getAdminContentEntries()와 동일한 정렬 계약(관리자 화면 순서와 공개 화면 순서가 어긋나지 않게).
export function getFaqEntries(): Promise<PublicContentEntry[]> {
  return getEntriesByType("faq");
}

export function getGuideEntries(): Promise<PublicContentEntry[]> {
  return getEntriesByType("guide");
}

// topic은 이미 디코딩된 문자열을 받는다 — decode 책임은 호출부(Phase10-2의
// app/guide/[topic]/page.tsx)에 있다. lib/api/dreams.ts의 getDreamByKeyword()가 이미 확립한
// 계약(app/dream/[keyword]/page.tsx가 decodeURIComponent를 직접 호출한 뒤 이미 디코딩된 값을
// 서비스에 넘김, Phase7-2)과 동일하게 맞춘다 — 새 decode 계약을 이 파일에서 발명하지 않는다.
//
// content_entries_guide_title_idx(0015, type='guide' 대상 partial UNIQUE)가 동일 title의 guide
// 중복을 DB 레벨에서 막아주므로 .maybeSingle()이 안전하다(2행 이상이 될 수 없음, dreams.id처럼
// PK 조회는 아니지만 이 UNIQUE 인덱스가 동등한 보장을 제공한다).
export async function getGuideByTopic(topic: string): Promise<PublicContentEntry | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("content_entries")
    .select(PUBLIC_CONTENT_COLUMNS)
    .eq("type", "guide")
    .eq("title", topic)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}
