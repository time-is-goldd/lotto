import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import { getEnv } from "@/lib/utils/env";

// 서버 전용 — service_role key는 RLS를 우회한다. Route Handler/Server Action 등 서버
// 실행 환경에서만 호출해야 하며, Client Component에 번들링되면 안 된다
// (docs/PHASE2_AUTH_DECISION.md Decision 4). 브라우저에서 호출되면 즉시 실패시켜
// 이 파일이 클라이언트 번들에 잘못 포함된 경우를 빌드 이후에도 조기에 드러낸다.
//
// <Database> 제네릭을 지정해 .from(table) 호출의 Row/Insert/Update 타입이 생성된 스키마
// 타입에서 그대로 파생되도록 한다(docs/AI_ENGINEERING_CONSTITUTION.md §3 "타입은 DB 스키마에서
// 파생한다").
export function createClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "lib/supabase/service.ts는 서버 전용입니다. Client Component에서 호출할 수 없습니다."
    );
  }

  return createSupabaseClient<Database>(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
