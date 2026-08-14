import { describe, expect, it } from "vitest";

import { getGenerationMethodLabel } from "./generationMethodLabel";

describe("getGenerationMethodLabel", () => {
  it("labels every value that user_numbers_generation_method actually supports", () => {
    expect(getGenerationMethodLabel("auto")).toBe("자동 생성");
    expect(getGenerationMethodLabel("custom")).toBe("직접 지정");
    expect(getGenerationMethodLabel("dream")).toBe("꿈 연동");
    expect(getGenerationMethodLabel("fortune")).toBe("운세 연동");
  });

  it("falls back to the raw value for an unrecognized method instead of throwing", () => {
    expect(getGenerationMethodLabel("something-else")).toBe("something-else");
  });
});
