import { describe, expect, it } from "vitest";
import {
  attemptMessage, attemptProblem, buildLines, checkQty, conduceErrorText, firstViolationId, defaultEntries, fmtQty, selectAllPending, selectedCount, setLineSelected, stateLabel, stateTone, type DeliveryLine, type Selection,
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
  it("ignores a stale entry on a line that became fully delivered", () => {
    const b = buildLines(lines, { 1: "4", 2: "3", 3: "10" });
    expect(b).toEqual({ ok: true, lines: [{ quote_item_id: 1, quantity: 4 }, { quote_item_id: 3, quantity: 10 }] });
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

describe("create attempt message (nit fix)", () => {
  const lines = [L(1, 10, 6), L(2, 5, 5), L(3, 100.5, 0)];
  it("an over-pending entry blocks the attempt and the message names the problem", () => {
    const entries = { 1: "9", 3: "10" };
    expect(buildLines(lines, entries).ok).toBe(false);
    expect(attemptProblem(lines, entries)).toBe("over");
    expect(attemptMessage("over")).toBe("Hay líneas que exceden lo pendiente. Revise las cantidades marcadas.");
  });
  it("scrolls to the first violating line in display order, skipping finished lines", () => {
    expect(firstViolationId(lines, { 1: "4", 2: "9", 3: "999" })).toBe(3);
    expect(firstViolationId(lines, { 1: "9", 3: "999" })).toBe(1);
  });
  it("junk input gets the invalid message, an empty form keeps its own", () => {
    expect(attemptProblem(lines, { 1: "abc", 3: "1" })).toBe("invalid");
    expect(attemptMessage("invalid")).toBe("Hay cantidades no válidas. Revise las cantidades marcadas.");
    expect(attemptProblem(lines, { 1: "", 3: "0" })).toBe("empty");
    expect(attemptMessage("empty")).toBe("Indique al menos una cantidad a entregar.");
  });
  it("a valid form has no problem, no message, no violation, and builds the same payload as before", () => {
    const entries = defaultEntries(lines);
    expect(attemptProblem(lines, entries)).toBeNull();
    expect(attemptMessage(null)).toBeNull();
    expect(firstViolationId(lines, entries)).toBeNull();
    expect(buildLines(lines, entries)).toEqual({ ok: true, lines: [{ quote_item_id: 1, quantity: 4 }, { quote_item_id: 3, quantity: 100.5 }] });
  });
  it("a stale entry on a finished line is not a violation", () => {
    expect(attemptProblem(lines, { 1: "4", 2: "3", 3: "10" })).toBeNull();
  });
});

describe("conduce item selection (safety checkbox)", () => {
  const lines = [L(1, 10, 6), L(2, 5, 5), L(3, 100.5, 0), L(4, 8, 0)]; // line 2 is finished
  const none: Selection = {};

  it("opens with nothing selected: nothing is submitted and the message is the selection one", () => {
    expect(buildLines(lines, {}, none)).toEqual({ ok: false, errors: {}, empty: true });
    expect(attemptProblem(lines, {}, none)).toBe("none");
    expect(attemptMessage("none")).toBe("Selecciona al menos un artículo");
  });

  it("unchecked lines are not submitted, even if a stale quantity is still in their input", () => {
    const sel: Selection = { 1: true };
    const b = buildLines(lines, { 1: "4", 3: "50", 4: "8" }, sel);
    expect(b).toEqual({ ok: true, lines: [{ quote_item_id: 1, quantity: 4 }] });
  });

  it("ticking a line prefills its full pending quantity; unticking clears it", () => {
    const on = setLineSelected(lines[0], true, {}, {});
    expect(on.entries[1]).toBe("4");
    expect(on.selected[1]).toBe(true);
    const off = setLineSelected(lines[0], false, on.entries, on.selected);
    expect(off.entries[1]).toBe("");
    expect(off.selected[1]).toBe(false);
    expect(buildLines(lines, off.entries, off.selected)).toEqual({ ok: false, errors: {}, empty: true });
  });

  it("a finished line can never be ticked", () => {
    const r = setLineSelected(lines[1], true, {}, {});
    expect(r.selected[2]).toBeUndefined();
    expect(r.entries[2]).toBeUndefined();
  });

  it("the ticked quantity can be edited down and never above pending", () => {
    const sel: Selection = { 1: true };
    expect(buildLines(lines, { 1: "2.5" }, sel)).toEqual({ ok: true, lines: [{ quote_item_id: 1, quantity: 2.5 }] });
    const over = buildLines(lines, { 1: "5" }, sel);
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.errors[1]).toBe("Máximo pendiente: 4");
    expect(attemptProblem(lines, { 1: "5" }, sel)).toBe("over");
  });

  it("a ticked line at 0 or blank is refused on that line, with the line named", () => {
    const sel: Selection = { 1: true, 3: true };
    const b = buildLines(lines, { 1: "0", 3: "10" }, sel);
    expect(b.ok).toBe(false);
    if (!b.ok) {
      expect(Object.keys(b.errors)).toEqual(["1"]);
      expect(b.errors[1]).toBe("Indique una cantidad mayor que 0.");
    }
    expect(buildLines(lines, { 1: "", 3: "10" }, sel).ok).toBe(false);
    expect(attemptProblem(lines, { 1: "0", 3: "10" }, sel)).toBe("zero");
    expect(attemptMessage("zero")).toBe("Hay artículos marcados sin cantidad. Indique una cantidad mayor que 0.");
    expect(firstViolationId(lines, { 1: "4", 3: "0" }, sel)).toBe(3);
  });

  it("an unticked line at 0 is not a violation (it is simply not in the delivery)", () => {
    const sel: Selection = { 3: true };
    expect(firstViolationId(lines, { 1: "0", 3: "10" }, sel)).toBeNull();
    expect(buildLines(lines, { 1: "0", 3: "10" }, sel)).toEqual({ ok: true, lines: [{ quote_item_id: 3, quantity: 10 }] });
  });

  it("Entregar todo lo pendiente ticks every line with pending and fills each with its pending quantity", () => {
    const all = selectAllPending(lines);
    expect(all.selected).toEqual({ 1: true, 3: true, 4: true });
    expect(all.entries).toEqual({ 1: "4", 2: "", 3: "100.5", 4: "8" });
    expect(buildLines(lines, all.entries, all.selected)).toEqual({
      ok: true,
      lines: [{ quote_item_id: 1, quantity: 4 }, { quote_item_id: 3, quantity: 100.5 }, { quote_item_id: 4, quantity: 8 }],
    });
    expect(attemptProblem(lines, all.entries, all.selected)).toBeNull();
  });

  it("counts only ticked lines that still have pending", () => {
    expect(selectedCount(lines, { 1: true, 2: true, 4: true })).toBe(2);
    expect(selectedCount(lines, {})).toBe(0);
  });

  it("without a selection argument the old rules are unchanged", () => {
    expect(buildLines(lines, defaultEntries(lines)).ok).toBe(true);
    expect(attemptProblem(lines, { 1: "", 3: "0", 4: "" })).toBe("empty");
  });
});
