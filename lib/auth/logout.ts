import { createClient } from "@/lib/supabase/server";

// anon 세션 기반 — service_role을 쓰지 않는다(docs/PHASE2_AUTH_DECISION.md Decision 4 사용
// 범위 원칙). supabase.auth.signOut()은 현재 요청의 세션(리프레시 토큰)을 서버에서 무효화하고,
// lib/supabase/server.ts의 쿠키 어댑터(setAll)를 통해 세션 쿠키 삭제를 함께 수행한다 — 이 함수를
// 호출하는 Route Handler가 그 삭제된 쿠키를 응답에 실어 보낸다.
export async function logout(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
