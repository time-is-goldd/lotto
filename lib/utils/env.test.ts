import { describe, expect, it } from "vitest";

import { getEnv } from "@/lib/utils/env";

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
