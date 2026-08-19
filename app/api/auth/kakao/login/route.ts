import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  KAKAO_OAUTH_NEXT_COOKIE,
  KAKAO_OAUTH_REASON_COOKIE,
  KAKAO_OAUTH_STATE_COOKIE,
  buildKakaoAuthorizeUrl,
} from "@/lib/auth/kakao";
import { trackProductEvent } from "@/lib/analytics/trackProductEvent";
import { isSafeNextPath } from "@/lib/utils/safeNext";

const STATE_COOKIE_MAX_AGE_SECONDS = 600; // 10분 — 로그인 왕복에 충분하고 오래 남기지 않는다.
const MAX_REASON_LENGTH = 32; // app/login/page.tsx REASON_COPY 키보다 넉넉한 여유치.

// GET /api/auth/kakao/login — 카카오 로그인 개시. state를 httpOnly 쿠키에 저장해 콜백에서
// CSRF를 방지한다(docs/AI_ENGINEERING_CONSTITUTION.md §11 CSRF 원칙).
//
// ?next= 는 여기서 한 번 검증하고(isSafeNextPath), 콜백이 되돌아오는 시점까지 살아있어야
// 하므로 쿼리스트링이 아니라 httpOnly 쿠키에 저장한다(카카오 authorize URL에는 우리가 만든
// redirect_uri만 등록되어 있어 next를 쿼리로 그대로 왕복시킬 수 없다). 검증되지 않은 값은
// 저장하지 않는다 — 로그인은 그대로 진행하고 콜백은 기본 목적지로 보낸다.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawNext = url.searchParams.get("next");
  const rawReason = url.searchParams.get("reason");
  const reason =
    rawReason && rawReason.length > 0 && rawReason.length <= MAX_REASON_LENGTH ? rawReason : null;

  const state = randomUUID();
  const response = NextResponse.redirect(buildKakaoAuthorizeUrl(state));

  response.cookies.set(KAKAO_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });

  if (isSafeNextPath(rawNext)) {
    response.cookies.set(KAKAO_OAUTH_NEXT_COOKIE, rawNext, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
      path: "/",
    });
  }

  if (reason) {
    response.cookies.set(KAKAO_OAUTH_REASON_COOKIE, reason, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
      path: "/",
    });
  }

  trackProductEvent("login_started", { reason });

  return response;
}
