import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  KAKAO_OAUTH_NEXT_COOKIE,
  KAKAO_OAUTH_REASON_COOKIE,
  KAKAO_OAUTH_STATE_COOKIE,
  establishKakaoSupabaseSession,
  exchangeKakaoCodeForToken,
  fetchKakaoUserProfile,
} from "@/lib/auth/kakao";
import { trackProductEvent } from "@/lib/analytics/trackProductEvent";
import { getProfile } from "@/lib/auth/profile";
import { isSafeNextPath } from "@/lib/utils/safeNext";

// claude-code-luck-platform-launch-prompt.md §13/§14: 로그인을 시작한 화면(/fortune,
// /my/journal/results, /generate 등)으로 되돌아가야 "번호 저장/결과 확인" 맥락이 끊기지
// 않는다. next는 /api/auth/kakao/login이 이미 검증해 쿠키에 담아둔 값이라 여기서는 존재
// 여부만 보면 되지만, 쿠키 값 자체를 신뢰하지 않는다는 원칙(§13 "next는 내부 허용 경로만
// 인정")을 지키기 위해 콜백에서도 다시 한 번 isSafeNextPath로 검증한다. login=success 같은
// 상태 쿼리는 next가 있어도 항상 덧붙인다 — 홈이 아닌 다른 화면도 이 쿼리를 읽어 온보딩
// 완료 여부에 따라 안내를 바꿀 수 있게 한다.
function buildRedirectUrl(path: string, params: Record<string, string>, requestUrl: string) {
  const url = new URL(path, requestUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

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
  const savedNext = cookieStore.get(KAKAO_OAUTH_NEXT_COOKIE)?.value;
  const savedReason = cookieStore.get(KAKAO_OAUTH_REASON_COOKIE)?.value ?? null;
  cookieStore.delete(KAKAO_OAUTH_STATE_COOKIE);
  cookieStore.delete(KAKAO_OAUTH_NEXT_COOKIE);
  cookieStore.delete(KAKAO_OAUTH_REASON_COOKIE);

  // 로그인을 시작한 화면으로 돌아간다 — 없거나 안전하지 않으면 기존과 동일하게 홈으로 보낸다.
  // 대상 페이지들(/fortune, /my/journal/**, /generate)은 이미 각자 authState를 서버에서 다시
  // 계산해 profile-pending 상태를 스스로 처리하므로(예: app/fortune/page.tsx
  // SignedOutOrPendingView), 여기서 온보딩 완료 여부를 따로 분기할 필요가 없다.
  const destination = isSafeNextPath(savedNext) ? savedNext : "/";

  if (kakaoError) {
    return NextResponse.redirect(
      buildRedirectUrl("/", { login: "error", reason: "kakao_denied" }, request.url)
    );
  }

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(
      buildRedirectUrl("/", { login: "error", reason: "invalid_state" }, request.url)
    );
  }

  try {
    const tokenResponse = await exchangeKakaoCodeForToken(code);
    const kakaoUser = await fetchKakaoUserProfile(tokenResponse.access_token);
    const userId = await establishKakaoSupabaseSession(kakaoUser);

    const profile = await getProfile(userId);

    // §20 login_completed — 카카오 인증 자체가 성공한 시점에 한 번만 기록한다(온보딩 완료
    // 여부와는 무관 — login_started와 동일한 reason으로 짝지어야 "reason별 로그인 시작 대비
    // 완료율"을 계산할 수 있다).
    trackProductEvent("login_completed", { reason: savedReason });

    if (!profile) {
      return NextResponse.redirect(
        buildRedirectUrl(destination, { login: "success", profile: "pending" }, request.url)
      );
    }

    return NextResponse.redirect(
      buildRedirectUrl(destination, { login: "success", profile: "ready" }, request.url)
    );
  } catch (error) {
    // access_token/refresh_token/secret은 절대 로그에 남기지 않는다 — 에러 메시지만 남긴다.
    console.error("[GET /api/auth/kakao/callback] 카카오 로그인 실패", {
      message: error instanceof Error ? error.message : "unknown error",
    });
    return NextResponse.redirect(new URL("/?login=error&reason=server_error", request.url));
  }
}
