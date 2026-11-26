import { describe, expect, it } from "vitest";
import {
  buildLines, checkQty, conduceErrorText, defaultEntries, fmtQty, stateLabel, stateTone, type DeliveryLine,
} from "@/lib/conduceApi";

const L = (id: number, quoted: number, delivered: number): DeliveryLine => ({
  quote_item_id: id, product_name: `Item ${id}`, unit_of_measure: "und", category: null,
  quoted, delivered, pending: Math.max(quoted - delivered, 0),
});

describe("conduce quantities", () => {
  it("parses whole, decimal and comma input", () => {
    expect(checkQty("4", 10)).toEqual({ ok: true, value: 4 });
    expect(checkQty("4,5", 10)).toEqual({ ok: true, value: 4.5 });
    expect(checkQty(" 10 ", 10)).toEqual({ ok: true, value: 10 });
  });
  it("blank and zero mean not in this delivery", () => {
    expect(checkQty("", 10)).toEqual({ ok: true, value: null });
    expect(checkQty("0", 10)).toEqual({ ok: true, value: null });
  });
  it("rejects junk, negatives and 3 decimals", () => {
    expect(checkQty("abc", 10).ok).toBe(false);
    expect(checkQty("-1", 10).ok).toBe(false);
    const r = checkQty("1.005", 10);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Máximo 2 decimales.");
  });
  it("never accepts more than pending, and accepts exactly pending", () => {
    const over = checkQty("5", 4);
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error).toBe("Máximo pendiente: 4");
    expect(checkQty("100.5", 100.5)).toEqual({ ok: true, value: 100.5 });
    expect(checkQty("100.51", 100.5).ok).toBe(false);
  });
  it("formats without trailing zeros", () => {
    expect([fmtQty(10), fmtQty(60.5), fmtQty(100.25)]).toEqual(["10", "60.5", "100.25"]);
  });
});

describe("conduce form", () => {
  const lines = [L(1, 10, 6), L(2, 5, 5), L(3, 100.5, 0)];
  it("opens with every pending quantity filled in and nothing for finished lines", () => {
    expect(defaultEntries(lines)).toEqual({ 1: "4", 2: "", 3: "100.5" });
  });
  it("the default form is a valid full delivery of what is pending", () => {
    const b = buildLines(lines, defaultEntries(lines));
    expect(b).toEqual({ ok: true, lines: [{ quote_item_id: 1, quantity: 4 }, { quote_item_id: 3, quantity: 100.5 }] });
  });
  it("reports per-line errors and sends nothing", () => {
    const b = buildLines(lines, { 1: "9", 3: "1" });
    expect(b.ok).toBe(false);
    if (!b.ok) expect(Object.keys(b.errors)).toEqual(["1"]);
  });
  it("an all-empty form is flagged as empty", () => {
    const b = buildLines(lines, { 1: "", 3: "0" });
    expect(b).toEqual({ ok: false, errors: {}, empty: true });
  });
});

describe("delivery state and errors", () => {
  it("labels and tones", () => {
    expect(stateLabel("Entrega parcial")).toBe("Entrega parcial");
    expect(stateLabel("Entregado")).toBe("Entregado");
    expect(stateLabel(undefined)).toBe("—");
    expect([stateTone("Entregado"), stateTone("Entrega parcial"), stateTone("Sin entregas")]).toEqual(["success", "warning", "neutral"]);
  });
  it("shows the server message for over-delivery and fixed text for known codes", () => {
    const e = Object.assign(new Error("Viga: pendiente 4.00, solicitado 5.00"), { code: "CONDUCE_OVER_DELIVERY" });
    expect(conduceErrorText(e)).toBe("Viga: pendiente 4.00, solicitado 5.00");
    expect(conduceErrorText({ code: "CONDUCE_INVOICE_CANCELLED", message: "x" })).toMatch(/cancelada/);
    expect(conduceErrorText(new Error("boom"))).toBe("boom");
    expect(conduceErrorText(null)).toBe("No se pudo completar la operación.");
  });
});
