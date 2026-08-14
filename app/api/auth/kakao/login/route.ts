import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { KAKAO_OAUTH_STATE_COOKIE, buildKakaoAuthorizeUrl } from "@/lib/auth/kakao";

const STATE_COOKIE_MAX_AGE_SECONDS = 600; // 10분 — 로그인 왕복에 충분하고 오래 남기지 않는다.

// GET /api/auth/kakao/login — 카카오 로그인 개시. state를 httpOnly 쿠키에 저장해 콜백에서
// CSRF를 방지한다(docs/AI_ENGINEERING_CONSTITUTION.md §11 CSRF 원칙).
export async function GET() {
  const state = randomUUID();
  const response = NextResponse.redirect(buildKakaoAuthorizeUrl(state));

  response.cookies.set(KAKAO_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });

  return response;
}
