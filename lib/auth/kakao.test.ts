import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildKakaoAuthorizeUrl,
  deriveKakaoSyntheticEmail,
  getKakaoRedirectUri,
} from "@/lib/auth/kakao";

describe("deriveKakaoSyntheticEmail", () => {
  it("returns a deterministic, non-deliverable placeholder email for a kakao user id", () => {
    expect(deriveKakaoSyntheticEmail(12345)).toBe("kakao-12345@users.noreply.luckplatform.local");
  });

  it("produces the same email for the same id across calls (재로그인 시 동일 사용자로 매핑되는 근거)", () => {
    expect(deriveKakaoSyntheticEmail(999)).toBe(deriveKakaoSyntheticEmail(999));
  });
});

describe("getKakaoRedirectUri / buildKakaoAuthorizeUrl", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    process.env.KAKAO_REST_API_KEY = "test-client-id";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("builds redirect_uri from NEXT_PUBLIC_SITE_URL", () => {
    expect(getKakaoRedirectUri()).toBe("http://localhost:3000/api/auth/kakao/callback");
  });

  it("builds an authorize URL with client_id/redirect_uri/response_type/state", () => {
    const url = new URL(buildKakaoAuthorizeUrl("test-state"));

    expect(url.origin + url.pathname).toBe("https://kauth.kakao.com/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("test-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/auth/kakao/callback"
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("test-state");
  });
});
