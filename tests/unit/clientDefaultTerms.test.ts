import { describe, it, expect } from "vitest";
import { resolveTerms, clientDefaultTerms, creditDaysForCreate, parseDays } from "@/lib/paymentDue";

const C30 = { default_credit_days: 30, default_payment_terms: "30 dias neto" };

describe("R4 clientDefaultTerms", () => {
  it("switch off: no default, whatever the client carries", () => {
    expect(clientDefaultTerms(false, C30)).toBeNull();
  });
  it("on: days and terms as form strings; 0 is Contado, not empty", () => {
    expect(clientDefaultTerms(true, C30)).toEqual({ days: "30", terms: "30 dias neto" });
    expect(clientDefaultTerms(true, { default_credit_days: 0 })).toEqual({ days: "0", terms: "" });
  });
  it("on: a client with no default, or junk, gives null", () => {
    expect(clientDefaultTerms(true, null)).toBeNull();
    expect(clientDefaultTerms(true, {})).toBeNull();
    expect(clientDefaultTerms(true, { default_credit_days: null, default_payment_terms: "  " })).toBeNull();
    expect(clientDefaultTerms(true, { default_credit_days: 999 })).toBeNull();
  });
});

describe("R4 resolveTerms (inheritance at quote creation)", () => {
  it("untouched: the client's default fills both fields and is flagged inherited", () => {
    expect(resolveTerms(null, true, C30)).toEqual({ terms: "30 dias neto", days: "30", inherited: true });
  });
  it("the quote's own value wins: once edited, a client default never replaces it", () => {
    const own = { terms: "10 dias", days: "10" };
    expect(resolveTerms(own, true, C30)).toEqual({ ...own, inherited: false });
    expect(resolveTerms(own, true, { default_credit_days: 60 })).toEqual({ ...own, inherited: false });
  });
  it("an edit of one field keeps the other as it was shown", () => {
    const shown = resolveTerms(null, true, C30);
    expect(resolveTerms({ terms: shown.terms, days: "45" }, true, C30)).toEqual({ terms: "30 dias neto", days: "45", inherited: false });
  });
  it("switching client while untouched follows the new client; a client without a default gives empty", () => {
    expect(resolveTerms(null, true, { default_credit_days: 60, default_payment_terms: "60 dias" })).toEqual({ terms: "60 dias", days: "60", inherited: true });
    expect(resolveTerms(null, true, {})).toEqual({ terms: "", days: "", inherited: false });
  });
  it("a value typed by hand is never cleared by a client without a default", () => {
    const typed = { terms: "x", days: "5" };
    expect(resolveTerms(typed, true, {})).toEqual({ ...typed, inherited: false });
  });
  it("switch off: nothing is inherited and nothing is sent", () => {
    expect(resolveTerms(null, false, C30)).toEqual({ terms: "", days: "", inherited: false });
    expect(creditDaysForCreate(false, parseDays("30"))).toEqual({});
  });
  it("what the prefilled form sends is the inherited days", () => {
    const s = resolveTerms(null, true, C30);
    expect(creditDaysForCreate(true, parseDays(s.days))).toEqual({ credit_days: 30 });
  });
});
