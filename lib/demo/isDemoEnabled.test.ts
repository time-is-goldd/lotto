import { afterEach, describe, expect, it, vi } from "vitest";

import { isPublicDemoEnabled } from "./isDemoEnabled";

describe("isPublicDemoEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true only for the exact string 'true'", () => {
    vi.stubEnv("ENABLE_PUBLIC_DEMO", "true");
    expect(isPublicDemoEnabled()).toBe(true);
  });

  it("returns false when unset", () => {
    vi.stubEnv("ENABLE_PUBLIC_DEMO", "");
    expect(isPublicDemoEnabled()).toBe(false);
  });

  it("returns false for truthy-looking but non-exact values (fail-closed)", () => {
    vi.stubEnv("ENABLE_PUBLIC_DEMO", "1");
    expect(isPublicDemoEnabled()).toBe(false);
    vi.stubEnv("ENABLE_PUBLIC_DEMO", "True");
    expect(isPublicDemoEnabled()).toBe(false);
    vi.stubEnv("ENABLE_PUBLIC_DEMO", "yes");
    expect(isPublicDemoEnabled()).toBe(false);
  });
});
