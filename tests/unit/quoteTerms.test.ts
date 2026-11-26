import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normDay, termsForGenerate, termsForUpdate, validUntilForUpdate, validUntilIsPast } from "@/lib/quoteTerms";
import { es } from "@/lib/i18n/es";

const read = (p: string) => readFileSync(path.resolve(__dirname, "../..", p), "utf8");

describe("B1 normDay", () => {
  it("accepts a date and a date-time, rejects anything else", () => {
    expect(normDay("2026-12-30")).toBe("2026-12-30");
    expect(normDay("2026-12-30T00:00:00")).toBe("2026-12-30");
    expect(normDay(" 2026-12-30 ")).toBe("2026-12-30");
    expect(normDay("")).toBe("");
    expect(normDay(null)).toBe("");
    expect(normDay(undefined)).toBe("");
    expect(normDay("30/12/2026")).toBe("");
  });
});

describe("B1 Estimado de ingeniería: Generar sends both fields", () => {
  it("terms and validity typed: both are in the payload", () => {
    expect(termsForGenerate({ paymentTerms: " Crédito 30 días ", validUntil: "2026-12-30" })).toEqual({
      payment_terms: "Crédito 30 días",
      valid_until: "2026-12-30",
    });
  });
  it("only one typed: only that one is sent", () => {
    expect(termsForGenerate({ paymentTerms: "50/50", validUntil: "" })).toEqual({ payment_terms: "50/50" });
    expect(termsForGenerate({ paymentTerms: "", validUntil: "2026-12-30" })).toEqual({ valid_until: "2026-12-30" });
  });
  it("empty form sends nothing: the keys are absent, not null", () => {
    const out = termsForGenerate({ paymentTerms: "", validUntil: "" });
    expect(out).toEqual({});
    expect(Object.keys(out)).toHaveLength(0);
    expect(JSON.stringify({ client_id: 1, ...out })).toBe('{"client_id":1}');
  });
  it("blank spaces and a malformed date count as empty", () => {
    expect(termsForGenerate({ paymentTerms: "   ", validUntil: "mañana" })).toEqual({});
  });
});

describe("B1 quote edit page: save sends both fields", () => {
  it("both changed: both are in the PUT body", () => {
    expect(termsForUpdate(null, { paymentTerms: " 50/50 ", validUntil: "2026-12-30" })).toEqual({
      payment_terms: "50/50",
      valid_until: "2026-12-30",
    });
  });
  it("validity changed to another date: sent", () => {
    expect(validUntilForUpdate("2026-12-30", "2027-01-15")).toEqual({ valid_until: "2027-01-15" });
  });
  it("validity cleared on purpose: null is sent so the stored date is removed", () => {
    expect(validUntilForUpdate("2026-12-30", "")).toEqual({ valid_until: null });
    expect(termsForUpdate("2026-12-30", { paymentTerms: "x", validUntil: "" })).toEqual({ payment_terms: "x", valid_until: null });
  });
  it("empty stays empty: validity is not in the body at all", () => {
    expect(validUntilForUpdate(null, "")).toEqual({});
    expect(validUntilForUpdate(undefined, "")).toEqual({});
    const body = termsForUpdate(null, { paymentTerms: "", validUntil: "" });
    expect(body).toEqual({ payment_terms: null }); // payment_terms keeps today's behaviour: always sent, null when empty
    expect("valid_until" in body).toBe(false);
  });
  it("an unchanged stored date is never re-sent, so a save cannot alter it", () => {
    expect(validUntilForUpdate("2026-12-30", "2026-12-30")).toEqual({});
    expect(validUntilForUpdate("2026-12-30T00:00:00", "2026-12-30")).toEqual({});
  });
});

describe("B1 past-date hint (never a block)", () => {
  it("flags a newly entered past date only", () => {
    expect(validUntilIsPast(null, "2026-11-01", "2026-11-26")).toBe(true);
    expect(validUntilIsPast(null, "2026-11-26", "2026-11-26")).toBe(false);
    expect(validUntilIsPast(null, "2026-12-01", "2026-11-26")).toBe(false);
    expect(validUntilIsPast(null, "", "2026-11-26")).toBe(false);
  });
  it("a stored past date is not flagged until the user changes it", () => {
    expect(validUntilIsPast("2026-10-23", "2026-10-23", "2026-11-26")).toBe(false);
    expect(validUntilIsPast("2026-10-23", "2026-10-24", "2026-11-26")).toBe(true);
  });
});

describe("B1 one label on quote screens", () => {
  it("the validity label is 'Válida hasta' (the NCF key keeps its own wording)", () => {
    expect(es.cot.validaHasta).toBe("Válida hasta");
    expect(es.est.validaHasta).toBe("Válida hasta");
    expect(es.est.terminosPago).toBe("Términos de pago");
  });
  it("quote screens use it; the old spellings are gone from live quote screens", () => {
    const view = read("app/quotes/[quote_id]/view/page.tsx");
    const form = read("components/quotes/QuoteForm.jsx");
    expect(view).toContain("es.cot.validaHasta");
    expect(view).not.toContain("Válido hasta");
    expect(form).toContain("es.cot.validaHasta");
    expect(form).not.toContain("Válida Hasta");
  });
});

describe("B1 wiring guard (the forms cannot render in a node test, so the call sites are checked)", () => {
  it("the Estimado form posts through termsForGenerate and regenerates the idempotency key when they change", () => {
    const page = read("app/quotes/estimate/page.tsx");
    expect(page).toContain("...termsForGenerate({ paymentTerms, validUntil })");
    expect(page).toContain("[requestKey, clientId, contactId, project, notes, paymentTerms, validUntil]");
  });
  it("the live edit page saves through termsForUpdate and tracks validity in its dirty snapshot", () => {
    const page = read("app/quotes/[quote_id]/edit/page.tsx");
    expect(page).toContain("...termsForUpdate(quote?.valid_until, { paymentTerms, validUntil })");
    expect(page).toContain("valid_until: p.valid_until");
  });
  it("the request type carries both optional fields", () => {
    expect(read("lib/estimatorApi.ts")).toMatch(/payment_terms\?: string;\s*\n\s*valid_until\?: string;/);
    expect(read("lib/quotingApi.ts")).toMatch(/valid_until\?: string \| null;/);
  });
});
