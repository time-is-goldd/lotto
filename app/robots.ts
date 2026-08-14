import type { MetadataRoute } from "next";

import { getEnv } from "@/lib/utils/env";

// docs/SITEMAP.md §4 P3(noindex) 분류 + proxy.ts의 PROTECTED_PATHS를 그대로 반영한다 —
// 새 보호 경로 목록을 여기서 재설계하지 않는다. robots.txt는 크롤 예산을 아끼는 안내일 뿐
// 보안 경계가 아니다 — 실제 데이터 접근 차단은 여전히 proxy.ts/RLS가 담당한다(무수정).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/my/", "/login", "/onboarding", "/api/", "/ui-preview"],
    },
    sitemap: `${getEnv("NEXT_PUBLIC_SITE_URL")}/sitemap.xml`,
  };
}
