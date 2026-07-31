import { NextResponse } from "next/server";

// Phase 2에서 세션 갱신 및 /my/*, /admin/* 접근 제어 로직을 채운다.
// matcher가 비어 있으므로 지금은 어떤 요청에도 개입하지 않는다.
// (Next.js 16부터 파일명은 proxy.ts, export 함수명은 proxy — 구 middleware 컨벤션의 후신)
export function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
