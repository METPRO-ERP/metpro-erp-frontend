import { describe, it, expect } from "vitest";
import { parseDays, presetKey, creditDaysForCreate, creditDaysForUpdate, PRESETS, CUSTOM, NO_PRESET } from "@/lib/paymentDue";

describe("parseDays", () => {
  it("accepts whole days 0..365", () => {
    expect(parseDays("0")).toBe(0);
    expect(parseDays(" 30 ")).toBe(30);
    expect(parseDays(365)).toBe(365);
  });
  it("rejects empty, decimals, negatives, out of range", () => {
    for (const v of ["", " ", "1.5", "-1", "366", "abc", null, undefined]) expect(parseDays(v as never)).toBeNull();
  });
});

describe("presets (D4)", () => {
  it("has Contado and 15/30/45/60 only, no 50/50 preset", () => {
    expect(PRESETS.map((p) => p.days)).toEqual([0, 15, 30, 45, 60]);
    expect(PRESETS[0].label).toBe("Contado");
    expect(PRESETS.some((p) => /anticipo/i.test(p.label))).toBe(false);
  });
  it("maps days to a preset, none, or custom", () => {
    expect(presetKey(null)).toBe(NO_PRESET);
    expect(presetKey(0)).toBe("0");
    expect(presetKey(45)).toBe("45");
    expect(presetKey(20)).toBe(CUSTOM);
  });
});

describe("payload helpers", () => {
  it("create: nothing when off or empty", () => {
    expect(creditDaysForCreate(false, 30)).toEqual({});
    expect(creditDaysForCreate(true, null)).toEqual({});
    expect(creditDaysForCreate(true, 0)).toEqual({ credit_days: 0 });
    expect(creditDaysForCreate(true, 30)).toEqual({ credit_days: 30 });
  });
  it("update: only a change is sent; cleared is null; off sends nothing", () => {
    expect(creditDaysForUpdate(false, 15, 30)).toEqual({});
    expect(creditDaysForUpdate(true, 30, 30)).toEqual({});
    expect(creditDaysForUpdate(true, undefined, null)).toEqual({});
    expect(creditDaysForUpdate(true, null, null)).toEqual({});
    expect(creditDaysForUpdate(true, 30, 45)).toEqual({ credit_days: 45 });
    expect(creditDaysForUpdate(true, 30, null)).toEqual({ credit_days: null });
    expect(creditDaysForUpdate(true, null, 0)).toEqual({ credit_days: 0 });
  });
});
