import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  KAKAO_OAUTH_STATE_COOKIE,
  establishKakaoSupabaseSession,
  exchangeKakaoCodeForToken,
  fetchKakaoUserProfile,
} from "@/lib/auth/kakao";
import { getProfile } from "@/lib/auth/profile";

// GET /api/auth/kakao/callback — 카카오 Authorization Code → Access Token → 사용자 정보
// → Supabase 세션 순으로 처리한다(docs/PHASE2_AUTH_DECISION.md Decision 2).
//
// profile 자동 생성은 하지 않는다: 카카오 기본 동의항목(닉네임)만으로는 profiles.birth_date
// (NOT NULL)를 채울 수 없고, docs/PHASE2_AUTH_DECISION.md Decision 1이 placeholder 값으로
// 미완성 행을 만드는 것을 이미 금지했다. "로그인은 됐지만 profile이 없는 상태"는 Decision 1이
// 정의한 정상적인 온보딩 대기 상태이며, 이 PoC는 그 상태를 정확히 감지하는 것까지만 검증한다
// — 실제 온보딩 화면(생년월일 입력)은 다음 Task 범위다.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const kakaoError = url.searchParams.get("error");

  const cookieStore = await cookies();
  const savedState = cookieStore.get(KAKAO_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(KAKAO_OAUTH_STATE_COOKIE);

  if (kakaoError) {
    return NextResponse.redirect(new URL("/?login=error&reason=kakao_denied", request.url));
  }

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(new URL("/?login=error&reason=invalid_state", request.url));
  }

  try {
    const tokenResponse = await exchangeKakaoCodeForToken(code);
    const kakaoUser = await fetchKakaoUserProfile(tokenResponse.access_token);
    const userId = await establishKakaoSupabaseSession(kakaoUser);

    const profile = await getProfile(userId);

    if (!profile) {
      return NextResponse.redirect(new URL("/?login=success&profile=pending", request.url));
    }

    return NextResponse.redirect(new URL("/?login=success&profile=ready", request.url));
  } catch (error) {
    // access_token/refresh_token/secret은 절대 로그에 남기지 않는다 — 에러 메시지만 남긴다.
    console.error("[GET /api/auth/kakao/callback] 카카오 로그인 실패", {
      message: error instanceof Error ? error.message : "unknown error",
    });
    return NextResponse.redirect(new URL("/?login=error&reason=server_error", request.url));
  }
}
