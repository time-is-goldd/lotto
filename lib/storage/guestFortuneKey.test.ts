import { describe, expect, it } from "vitest";

import {
  GUEST_FORTUNE_SCHEMA_VERSION,
  buildProfileKeyMaterial,
  normalizeBirthTimeForKey,
  normalizeGenderForKey,
} from "./guestFortuneKey";

describe("normalizeGenderForKey", () => {
  it("passes through M and F", () => {
    expect(normalizeGenderForKey("M")).toBe("M");
    expect(normalizeGenderForKey("F")).toBe("F");
  });

  it("treats N, null, undefined, and empty string as unknown", () => {
    expect(normalizeGenderForKey("N")).toBe("unknown");
    expect(normalizeGenderForKey(null)).toBe("unknown");
    expect(normalizeGenderForKey(undefined)).toBe("unknown");
    expect(normalizeGenderForKey("")).toBe("unknown");
  });
});

describe("normalizeBirthTimeForKey", () => {
  it("truncates HH:MM:SS to HH:MM", () => {
    expect(normalizeBirthTimeForKey("14:30:00")).toBe("14:30");
  });

  it("passes through HH:MM unchanged", () => {
    expect(normalizeBirthTimeForKey("14:30")).toBe("14:30");
  });

  it("treats null/undefined/empty as unknown", () => {
    expect(normalizeBirthTimeForKey(null)).toBe("unknown");
    expect(normalizeBirthTimeForKey(undefined)).toBe("unknown");
    expect(normalizeBirthTimeForKey("")).toBe("unknown");
  });
});

describe("buildProfileKeyMaterial", () => {
  it("is deterministic for identical inputs", () => {
    const a = buildProfileKeyMaterial("salt-1", "1995-03-14", "F", "14:30");
    const b = buildProfileKeyMaterial("salt-1", "1995-03-14", "F", "14:30");
    expect(a).toBe(b);
  });

  it("changes when the device salt changes (same person, different browser)", () => {
    const a = buildProfileKeyMaterial("salt-1", "1995-03-14", "F", "14:30");
    const b = buildProfileKeyMaterial("salt-2", "1995-03-14", "F", "14:30");
    expect(a).not.toBe(b);
  });

  it("changes when birthDate, gender, or birthTime changes", () => {
    const base = buildProfileKeyMaterial("salt-1", "1995-03-14", "F", "14:30");
    expect(buildProfileKeyMaterial("salt-1", "1995-03-15", "F", "14:30")).not.toBe(base);
    expect(buildProfileKeyMaterial("salt-1", "1995-03-14", "M", "14:30")).not.toBe(base);
    expect(buildProfileKeyMaterial("salt-1", "1995-03-14", "F", "09:00")).not.toBe(base);
  });

  it("produces the same material for gender omitted vs explicit 'N'", () => {
    const omitted = buildProfileKeyMaterial("salt-1", "1995-03-14", null, null);
    const explicitN = buildProfileKeyMaterial("salt-1", "1995-03-14", "N", undefined);
    expect(omitted).toBe(explicitN);
  });

  it("produces the same material for birthTime HH:MM and HH:MM:SS", () => {
    const short = buildProfileKeyMaterial("salt-1", "1995-03-14", "F", "14:30");
    const long = buildProfileKeyMaterial("salt-1", "1995-03-14", "F", "14:30:00");
    expect(short).toBe(long);
  });

  it("embeds the schema version so a future version bump changes every key", () => {
    expect(buildProfileKeyMaterial("salt-1", "1995-03-14", "F", "14:30")).toContain(
      String(GUEST_FORTUNE_SCHEMA_VERSION)
    );
  });
});
