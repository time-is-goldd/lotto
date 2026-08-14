import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { Constants } from "@/lib/types/database";
import type { Enums } from "@/lib/types/database";

// service_role을 사용하지 않는다 — lib/supabase/server.ts(anon key + 쿠키 세션) 기반으로
// 현재 요청의 로그인 사용자만 확인한다(docs/PHASE2_AUTH_DECISION.md Decision 4 사용 범위 원칙,
// DB를 수정하지 않는다).
//
// getSession()이 아니라 getUser()를 쓰는 이유: getSession()은 쿠키에 담긴 JWT를 재검증 없이
// 그대로 신뢰하지만, getUser()는 매 요청마다 Supabase Auth 서버에 재검증을 요청한다
// (docs/AI_ENGINEERING_CONSTITUTION.md §11 "인증이 필요한 API는 요청마다 세션을 재확인").
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user;
}

// provider는 클라이언트 요청 바디로 받지 않는다 — Supabase Auth 세션의 app_metadata에서
// 서버가 직접 판단한다(docs/PHASE2_AUTH_DECISION.md Decision 3의 "클라이언트 값을 신뢰하지
// 않는다" 원칙을 profile 생성 시점까지 확장 적용). 인식할 수 없는 값이면 'email'로 취급한다.
//
// app_metadata.provider(GoTrue 예약 필드, auth.identities 기준으로 자동 재계산되어 항상
// "email")가 아니라 app_metadata.auth_provider(커스텀 키, lib/auth/kakao.ts가 설정)를 읽는다
// — 실제 Supabase 프로젝트 대상 실측으로 예약 필드가 덮어써지지 않음을 확인했다
// (docs/PHASE2_KAKAO_E2E_REPORT.md 참조).
export function resolveProfileProvider(user: User): Enums<"profile_provider"> {
  const provider = user.app_metadata?.auth_provider;

  if (
    typeof provider === "string" &&
    (Constants.public.Enums.profile_provider as readonly string[]).includes(provider)
  ) {
    return provider as Enums<"profile_provider">;
  }

  return "email";
}
