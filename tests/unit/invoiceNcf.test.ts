import { describe, expect, it } from "vitest";
import { ncfDisplay } from "@/lib/invoiceNcf";

describe("invoice detail NCF block", () => {
  it("shows the NCF and its expiry as dd/mm/aaaa", () => {
    expect(ncfDisplay({ ncf: "B0100000326", ncf_valid_until: "2026-12-31" })).toEqual({ ncf: "B0100000326", validUntil: "31/12/2026" });
  });
  it("shows the NCF without an expiry when the sequence date is unknown", () => {
    expect(ncfDisplay({ ncf: "B0100000326", ncf_valid_until: null })).toEqual({ ncf: "B0100000326", validUntil: null });
  });
  it("shows nothing for an invoice without an NCF", () => {
    expect(ncfDisplay({})).toBeNull();
    expect(ncfDisplay({ ncf: null, ncf_valid_until: "2026-12-31" })).toBeNull();
    expect(ncfDisplay({ ncf: "  " })).toBeNull();
  });
});
