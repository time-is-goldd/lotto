import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// Phase6-4-1 계약(docs/PHASE6_ADMIN_AUTH_IMPLEMENTATION_REPORT.md). service_role을 쓰지
// 않는다 — lib/supabase/server.ts(anon key + 쿠키 세션)로 현재 로그인 사용자만 확인한다.
// supabase/migrations/0012_admin_access.sql의 admins_select_own RLS(auth.uid() = user_id)가
// 본인 행 조회를 이미 허용하므로 service_role 없이도 정확히 판정할 수 있다 — proxy.ts의
// hasProfile()과 정확히 같은 패턴이다.
//
// userId를 파라미터로 받지 않는다 — 클라이언트나 호출부가 "누구의 관리자 여부"를 지정할 수
// 없고, 오직 getCurrentUser()가 확인한 현재 세션 본인의 관리자 여부만 판정한다.
//
// fail-closed 원칙: DB 조회 자체가 실패해도(네트워크 오류 등) true를 반환하지 않는다 —
// 비로그인/일반 사용자/DB 오류 전부 false이고, admins에 본인 행이 실제로 존재할 때만 true다.
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();

  if (!user) {
    return false;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admins")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[isAdmin] admins 조회 실패 — fail-closed로 false 반환", {
      userId: user.id,
      error,
    });
    return false;
  }

  return data !== null;
}
