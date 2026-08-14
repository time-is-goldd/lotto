import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/lib/types/database";
import { getEnv } from "@/lib/utils/env";

// <Database> 제네릭: lib/supabase/service.ts와 동일한 이유로 .from(table) 호출의 Row 타입이
// 생성된 스키마 타입에서 그대로 파생되도록 한다(docs/AI_ENGINEERING_CONSTITUTION.md §3).
// 순수 타입 파라미터 추가라 런타임 동작은 전혀 바뀌지 않는다 — 기존 호출부(proxy.ts,
// lib/auth/session.ts, lib/auth/logout.ts, lib/auth/kakao.ts)는 전부 그대로 동작한다.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(getEnv("NEXT_PUBLIC_SUPABASE_URL"), getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component에서 호출되면 쓰기가 불가능하다 — 세션 갱신은 middleware(Phase 2)가 담당하므로 무시해도 안전하다.
        }
      },
    },
  });
}
