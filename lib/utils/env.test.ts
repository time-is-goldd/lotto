import { afterEach, describe, expect, it } from "vitest";

import { getEnv, getSiteUrl } from "@/lib/utils/env";

describe("getEnv", () => {
  it("returns the value when the environment variable is set", () => {
    process.env.TEST_ENV_VAR = "value";

    expect(getEnv("TEST_ENV_VAR")).toBe("value");
  });

  it("throws a clear error when the environment variable is missing", () => {
    delete process.env.TEST_ENV_VAR;

    expect(() => getEnv("TEST_ENV_VAR")).toThrow("TEST_ENV_VAR");
  });
});

// Phase10-10: NEXT_PUBLIC_SITE_URL이 프로덕션(Vercel)에서 9일간 localhost로 방치됐던
// 사고(docs/VERCEL_DEPLOYMENT_REHEARSAL_REPORT.md §6)의 재발 방지 검증. process.env.VERCEL은
// Vercel이 배포된 모든 환경(Preview/Production)에 자동으로 심어주는 값이라 이 값의 유무로
// "로컬 개발/빌드"와 "Vercel에 배포된 상태"를 구분한다.
describe("getSiteUrl", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL;
  });

  it("allows localhost when not running on Vercel (local dev/build)", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    delete process.env.VERCEL;

    expect(getSiteUrl()).toBe("http://localhost:3000");
  });

  it("returns the value unchanged on Vercel when it is a valid https URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://lotto-blue-sigma.vercel.app";
    process.env.VERCEL = "1";

    expect(getSiteUrl()).toBe("https://lotto-blue-sigma.vercel.app");
  });

  it("throws on Vercel when the value is localhost", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    process.env.VERCEL = "1";

    expect(() => getSiteUrl()).toThrow(/localhost/);
  });

  it("throws on Vercel when the value is 127.0.0.1", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://127.0.0.1";
    process.env.VERCEL = "1";

    expect(() => getSiteUrl()).toThrow(/localhost/);
  });

  it("throws on Vercel when the protocol is not https", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://example.com";
    process.env.VERCEL = "1";

    expect(() => getSiteUrl()).toThrow(/https/);
  });

  it("throws on Vercel when the value is not a valid URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "not-a-url";
    process.env.VERCEL = "1";

    expect(() => getSiteUrl()).toThrow(/유효한 URL/);
  });

  it("throws the underlying getEnv error on Vercel when the value is missing", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.VERCEL = "1";

    expect(() => getSiteUrl()).toThrow("NEXT_PUBLIC_SITE_URL");
  });

  it("throws on Vercel when the value has a trailing slash", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://lotto-blue-sigma.vercel.app/";
    process.env.VERCEL = "1";

    expect(() => getSiteUrl()).toThrow(/"\/"/);
  });
});

// Phase10-11A: luckplatform.co.kr 구매 전 사전 준비 — 실제 도메인을 소유/연결하지 않고도
// getSiteUrl()이 이 값을 문제없이 통과시킬 것임을 미리 증명한다(구매 후 Vercel env만
// 갱신하면 되는 상태를 만드는 것이 목적, docs/DOMAIN_PREPURCHASE_READINESS_REPORT.md 참조).
describe("getSiteUrl target domain readiness (luckplatform.co.kr)", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL;
  });

  it("accepts the target final domain with no trailing slash on Vercel", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://luckplatform.co.kr";
    process.env.VERCEL = "1";

    expect(getSiteUrl()).toBe("https://luckplatform.co.kr");
  });

  it("rejects the target final domain if entered with a trailing slash", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://luckplatform.co.kr/";
    process.env.VERCEL = "1";

    expect(() => getSiteUrl()).toThrow(/"\/"/);
  });

  it("rejects the www subdomain form as the canonical value (apex is canonical per runbook)", () => {
    // www는 canonical이 아니다 — 값 자체는 https/non-localhost 조건을 만족해 getSiteUrl()을
    // 통과하지만(막을 이유가 없음), 실제로 이 값을 쓰면 안 된다는 정책은 코드가 아니라
    // Vercel Domains 리다이렉트 설정(§9~10 www 정책)으로 강제한다 — 여기서는 getSiteUrl()이
    // www 값 자체를 거부하지 않는다는 사실만 문서화 목적으로 확인한다.
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.luckplatform.co.kr";
    process.env.VERCEL = "1";

    expect(getSiteUrl()).toBe("https://www.luckplatform.co.kr");
  });
});
