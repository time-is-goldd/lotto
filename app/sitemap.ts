import { createClient } from "@supabase/supabase-js";
import type { MetadataRoute } from "next";

import { getGuideEntries } from "@/lib/api/content";
import type { Database } from "@/lib/types/database";
import { getEnv } from "@/lib/utils/env";

// docs/PHASE7_DREAM_BROWSE_UI_REPORT.md §9(발견된 문제 2)가 이미 확인한 사실: lib/api/dreams.ts는
// lib/supabase/server.ts(next/headers의 cookies())를 쓰고, cookies()가 호출되는 렌더 경로는
// Next.js가 무조건 완전 동적으로 처리한다 — sitemap.xml에 그대로 재사용하면 매 요청마다 DB를
// 조회하게 된다(지시문 §6 "DB를 매 요청마다 과도하게 조회하는 구조를 만들지 않는다"와 충돌).
// lib/api/dreams.ts 자체는 Phase7/Phase8-0 범위 제한 대상이라 수정하지 않는다(§11) — 대신
// 이 파일 안에서만 cookies() 없는 별도 클라이언트로 직접 조회하고, 아래 revalidate로 캐싱한다.
// dreams/dream_number_mappings는 공개 콘텐츠라 anon key만으로 충분하다(0008_rls_policies.sql
// dreams_select_public) — service_role은 필요 없다.
function createPublicClient() {
  return createClient<Database>(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}

// 꿈 콘텐츠는 관리자 CRUD가 아직 없어(Phase9 범위) 자주 바뀌지 않는다 — 1시간 캐시로 충분하다.
// 이 값이 실제로 매 요청 DB 조회를 막아주는지는 실측으로 확인했다(보고서 §14).
export const revalidate = 3600;

const SITE_URL = getEnv("NEXT_PUBLIC_SITE_URL");

// docs/SITEMAP.md §4 P0 목록 중 실제로 구현된 페이지만 포함한다 — /winners/*·/store/*는 아직
// 코드가 없어(전수 확인) 존재하지 않는 URL을 sitemap에 올리지 않는다(지시문 §9 "의미 없는
// 페이지 대량 생성/doorway page 금지"와 같은 원칙). /generate는 app/generate/page.tsx의 canonical과
// 동일하게 쿼리 없는 경로만 싣는다. /fortune(Phase10-4A)도 같은 P0 그룹으로, 비로그인 상태에서도
// 의미 있는 설명 콘텐츠가 있어(app/fortune/page.tsx의 로그인 유도 화면) doorway page가 아니다 —
// 로그인 사용자별 결과(app/fortune/page.tsx가 서버에서 매 요청 조회)는 이 정적 sitemap에 실리지
// 않는다(개인화된 콘텐츠라 색인 대상이 아님, /generate와 동일한 원칙).
// Phase10-2: guide 목록은 lib/api/content.ts(Phase10-1)의 getGuideEntries()를 그대로
// 재사용한다 — 여기서 content_entries에 대한 별도 query를 새로 작성하지 않는다. 그 함수도
// 이 파일과 동일하게 service_role이 아닌 쿠키 없는 anon 클라이언트를 쓰므로(공개 SELECT
// RLS, 0015_content_entries_public_read.sql) 이 정적 sitemap 생성 경로와 궁합이 맞는다.
// FAQ는 dreams처럼 개별 URL이 여러 개가 아니라 /faq 단일 페이지라 별도 조회 없이
// staticEntries에 고정 URL 하나만 추가한다(docs/PHASE10_RELEASE_GATE.md §11).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createPublicClient();

  const [
    { data: dreams, error: dreamsError },
    { data: categoryRows, error: categoriesError },
    { data: situations, error: situationsError },
    guides,
  ] = await Promise.all([
    supabase.from("dreams").select("id, keyword, updated_at").order("id", { ascending: true }),
    supabase.from("dreams").select("category"),
    // Phase10-4D §26: dream_situations도 dreams와 동일하게 공개 SELECT RLS(0018_dream_situations.sql
    // dream_situations_select_public)라 여기서도 service_role이 아닌 위 anon 클라이언트만으로 충분하다.
    supabase
      .from("dream_situations")
      .select("dream_id, keyword, updated_at")
      .order("dream_id", { ascending: true })
      .order("display_order", { ascending: true }),
    getGuideEntries(),
  ]);

  if (dreamsError) {
    throw dreamsError;
  }
  if (categoriesError) {
    throw categoriesError;
  }
  if (situationsError) {
    throw situationsError;
  }

  const categories = Array.from(
    new Set((categoryRows ?? []).map((row) => row.category).filter((c): c is string => c !== null))
  ).sort();

  // Phase10-3: docs/SITEMAP.md §1이 /about·/terms·/privacy를 "/notice, /about, /terms, /privacy
  // 기존과 동일"으로 한 그룹으로 묶고, §4가 그중 /about을 P2(공개 색인)로 명시한다. /terms·
  // /privacy는 P0~P3 표에 개별 표기가 없지만 /admin/*·/my/*처럼 noindex 근거가 되는 어떤
  // 문서 표기도 없어(전수 확인), 기본 색인 정책(app/layout.tsx robots 기본값)을 그대로
  // 따르는 공개 페이지로 취급해 sitemap에 포함한다(/notice는 이번 Task 구현 대상이 아니라 제외).
  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/dream`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/generate`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/fortune`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/faq`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/about`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const categoryEntries: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${SITE_URL}/dream/category/${encodeURIComponent(category)}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  // keyword에 DB UNIQUE 제약이 없다(lib/api/dreams.ts 주석, docs/PHASE7_DREAM_READ_SERVICE_REPORT.md
  // §9에 이미 기록된 기존 Known Issue) — sitemap 생성 시점에 새로 검증하지 않는다. 중복 keyword가
  // 실제로 생기면 sitemap에 같은 URL이 중복 등장할 뿐 빌드/렌더링이 깨지지는 않는다.
  const dreamEntries: MetadataRoute.Sitemap = (dreams ?? []).map((dream) => ({
    url: `${SITE_URL}/dream/${encodeURIComponent(dream.keyword)}`,
    lastModified: dream.updated_at ?? undefined,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  // app/guide/[topic]/page.tsx의 canonical과 동일한 encodeURIComponent(guide.title) 규칙 —
  // sitemap URL과 실제 페이지 canonical이 항상 같은 형태를 갖는다. content_entries_guide_title_idx
  // (0015)가 type='guide' 행끼리 title 중복을 막아주므로 같은 URL이 두 번 나올 수 없다.
  const guideEntries: MetadataRoute.Sitemap = guides.map((guide) => ({
    url: `${SITE_URL}/guide/${encodeURIComponent(guide.title)}`,
    lastModified: guide.updated_at ?? undefined,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  // dream_situations는 keyword가 dream_id 범위로만 unique(0018_dream_situations.sql)라
  // 부모 dreams.keyword와 함께 조합해야만 URL이 고유해진다(§8) — dream_id → 부모 keyword
  // 매핑을 먼저 만든다. FK가 on delete cascade(0018)라 존재하는 situation 행은 항상 살아있는
  // 부모를 가리키므로 맵에서 못 찾는 경우는 이론상 없지만, sitemap 생성이 그 가정에 깨지지
  // 않도록 못 찾으면 조용히 건너뛴다(존재하지 않는 URL을 sitemap에 올리지 않는다는 기존
  // dreamEntries 원칙과 동일).
  const dreamKeywordById = new Map((dreams ?? []).map((dream) => [dream.id, dream.keyword]));

  const situationEntries: MetadataRoute.Sitemap = (situations ?? []).flatMap((situation) => {
    const dreamKeyword = dreamKeywordById.get(situation.dream_id);
    if (!dreamKeyword) {
      return [];
    }
    return [
      {
        url: `${SITE_URL}/dream/${encodeURIComponent(dreamKeyword)}/${encodeURIComponent(situation.keyword)}`,
        lastModified: situation.updated_at ?? undefined,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      },
    ];
  });

  return [
    ...staticEntries,
    ...categoryEntries,
    ...dreamEntries,
    ...situationEntries,
    ...guideEntries,
  ];
}
