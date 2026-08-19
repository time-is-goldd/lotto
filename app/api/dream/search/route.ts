import { NextResponse } from "next/server";

import { searchDreamContent } from "@/lib/api/dreamSearch";

// GET /api/dream/search?q=... — 완전 공개 콘텐츠 검색이라 인증을 요구하지 않는다(dreams/
// dream_situations 둘 다 anon SELECT 허용, app/api/profile/route.ts와 달리 getCurrentUser()를
// 호출하지 않는다 — lib/api/dreams.ts/lib/api/dreamSituations.ts가 애초에 그렇게 설계된
// 이유와 동일).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  try {
    const results = await searchDreamContent(q);
    return NextResponse.json({ data: results });
  } catch (error) {
    console.error("[GET /api/dream/search] 검색 실패", { q, error });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "검색 중 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
