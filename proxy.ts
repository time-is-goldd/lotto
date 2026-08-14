import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// docs/PHASE2_PROXY_REPORT.md 참조. 로그인 필수 경로("보호 경로")와 /login(예외 처리 대상)만
// matcher에 등록한다 — 공개 페이지(/, /dream, /fortune 등)는 이 목록에 없으므로 proxy를
// 아예 통과하지 않는다.
//
// "/my"는 docs/SITEMAP.md가 정의한 개인화 영역 전체(/my/profile, /my/journal/*,
// /my/notifications 등)의 접두사다. 이전에는 실재하지 않는 경로(/mypage, /dream-journal,
// /notifications)를 개별로 나열해뒀는데, 실제 SITEMAP 경로와 전혀 달라 그 경로들을 보호한
// 적이 없었다(docs/PHASE3_PROXY_ROUTE_FIX_REPORT.md 참조). 개별 하위 경로를 나열하지 않고
// "/my" 접두사 하나로 묶은 이유는, docs/PHASE3_UI_ARCHITECTURE_PLAN.md §2.1이 이미
// "/my/*" 전체를 하나의 (protected) 영역으로 묶기로 결정했기 때문 — 이후 Phase4~6에서
// /my/journal/history 같은 하위 경로가 새로 생겨도 이 파일을 다시 고칠 필요가 없다.
const PROTECTED_PATHS = ["/onboarding", "/my"];
// /api/admin/*는 페이지가 아니라 JSON API라 /my/*처럼 /login으로 리다이렉트하지 않는다
// (docs/PHASE6_ADMIN_DRAW_ROUTE_REPORT.md §3). 이 목록은 "비로그인 1차 차단"만 담당하는
// UX/부하 절감 계층이다 — 관리자 여부(isAdmin())는 여기서 판정하지 않는다. proxy는
// service_role을 쓰지 않으므로 애초에 admins 테이블을 신뢰성 있게 판정할 근거가 부족하고,
// 실제 관리자 검증은 app/api/admin/draws/route.ts의 isAdmin() 재확인이 최종 보안 경계다
// (docs/PHASE6_ADMIN_AUTH_DECISION.md §7 "Proxy만으로 관리자 권한을 보장하지 않는다").
const PROTECTED_API_PATHS = ["/api/admin"];
const LOGIN_PATH = "/login";

// docs/PHASE4_ARCHITECTURE_DECISION.md §3 Option B: 다이어리 허브(/my/journal 및 그 하위)는
// proxy 단계에서 비로그인 진입을 막지 않는다 — 페이지 자체가 비로그인 사용자에게 가치설명
// 화면을 보여줄 수 있도록(Phase4-2에서 구현 예정) 통로만 열어둔다. 이 예외는 "페이지 진입"만
// 허용할 뿐 "데이터 접근"을 허용하는 것이 아니다 — /my/journal/* 안에서 실제 개인 데이터를
// 조회하는 서버 코드(Phase4-1 이후)는 이 파일과 무관하게 매 요청 자체적으로 로그인을
// 확인해야 하고, 설령 그 확인을 빠뜨리더라도 user_numbers/dream_journal_entries 등의 RLS
// (supabase/migrations/0008_rls_policies.sql, auth.uid() = user_id)가 타인의 행을 어차피
// 반환하지 않는다 — proxy의 공개 허용과 RLS의 데이터 격리는 서로 다른 레이어다.
const PUBLIC_EXCEPTIONS = ["/my/journal"];

function matchesPath(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

// lib/auth/profile.ts의 profileExists()/getProfile()은 lib/supabase/service.ts(service_role)를
// 사용한다. 이번 Task는 "proxy에서는 사용자 세션 확인만 수행하고 service_role은 절대 사용하지
// 않는다"를 명시적으로 요구해 그 두 함수를 여기서 재사용할 수 없다 — docs/PHASE2_AUTH_DECISION.md
// Decision 3이 profiles_select_own RLS 정책(본인 행 SELECT는 anon 세션으로도 허용)을 그대로
// 유지하기로 한 결정을 그대로 활용해, 이미 쓰고 있는 anon 클라이언트(lib/supabase/server.ts)로
// 동일한 존재 여부만 확인한다. 새로운 인증 매커니즘이 아니라 같은 세션 클라이언트로 수행하는
// 단순 조회다(docs/PHASE2_PROXY_REPORT.md §5 "발견한 문제" 참조).
async function hasProfile(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  return data !== null;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PROTECTED_API_PATHS.some((path) => matchesPath(pathname, path))) {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  const isProtected =
    PROTECTED_PATHS.some((path) => matchesPath(pathname, path)) &&
    !PUBLIC_EXCEPTIONS.some((path) => matchesPath(pathname, path));
  const isLoginPage = matchesPath(pathname, LOGIN_PATH);

  if (!isProtected && !isLoginPage) {
    return NextResponse.next();
  }

  const user = await getCurrentUser();

  if (isLoginPage) {
    if (!user) {
      return NextResponse.next();
    }
    const exists = await hasProfile(user.id);
    return NextResponse.redirect(new URL(exists ? "/" : "/onboarding", request.url));
  }

  if (!user) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (matchesPath(pathname, "/onboarding")) {
    const exists = await hasProfile(user.id);
    if (exists) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/onboarding/:path*", "/my/:path*", "/login", "/api/admin/:path*"],
};
