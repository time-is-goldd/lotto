import { afterEach, describe, expect, it, vi } from "vitest";

import { trackProductEvent } from "./trackProductEvent";

describe("trackProductEvent", () => {
  const originalEndpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;

  afterEach(() => {
    if (originalEndpoint === undefined) {
      delete process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
    } else {
      process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT = originalEndpoint;
    }
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("does not call fetch when NEXT_PUBLIC_ANALYTICS_ENDPOINT is unset", () => {
    delete process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    trackProductEvent("login_started", { reason: "save-number" });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs to console.info in non-production when no endpoint is set", () => {
    delete process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
    vi.stubEnv("NODE_ENV", "development");
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    trackProductEvent("numbers_generated", { source: "dream", dream_number_count: 2 });

    expect(infoSpy).toHaveBeenCalledWith(
      "[analytics] numbers_generated",
      { source: "dream", dream_number_count: 2 }
    );
  });

  it("does not log to console in production when no endpoint is set", () => {
    delete process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
    vi.stubEnv("NODE_ENV", "production");
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    trackProductEvent("numbers_generated", { source: "general", dream_number_count: 0 });

    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("POSTs a JSON payload with event/properties/timestamp when an endpoint is set", async () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT = "https://analytics.example.com/collect";
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    trackProductEvent("number_saved", { source: "dream", draw_id: "1234" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://analytics.example.com/collect");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });

    const body = JSON.parse(init.body);
    expect(body.event).toBe("number_saved");
    expect(body.properties).toEqual({ source: "dream", draw_id: "1234" });
    expect(typeof body.timestamp).toBe("string");
  });

  it("does not throw when the fetch call rejects", () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT = "https://analytics.example.com/collect";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down"))
    );

    expect(() =>
      trackProductEvent("login_completed", { reason: null })
    ).not.toThrow();
  });
});
