import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { normalizeReport, daysLabel, pastDueTone, type OverdueReport, type OverdueRow } from "@/lib/overdue";
import { OverdueReportView } from "@/components/invoices/OverdueView";

const row = (over: Partial<OverdueRow>): OverdueRow => ({
  id: 1, invoice_number: "F-10001", client_name: "Cliente SRL", invoice_date: "2026-09-01", due_date: "2026-10-01",
  days_past_due: 57, days_since_issue: 87, amount_due: 1000, status: "Pending", is_phase: false, bucket: "31-60", ...over,
});

const report = (): OverdueReport => ({
  as_of: "2026-11-27",
  overdue: {
    count: 2, amount_due: 1500,
    buckets: [
      { key: "1-30", label: "x", count: 1, amount_due: 500 }, { key: "31-60", label: "x", count: 1, amount_due: 1000 },
      { key: "61-90", label: "x", count: 0, amount_due: 0 }, { key: "90+", label: "x", count: 0, amount_due: 0 },
    ],
    rows: [row({ id: 1 }), row({ id: 2, invoice_number: "F-10002-2", is_phase: true, days_past_due: 5, bucket: "1-30", amount_due: 500 })],
  },
  sin_plazo: {
    count: 2, amount_due: 900,
    rows: [row({ id: 3, invoice_number: "F-10003", due_date: null, days_past_due: null, days_since_issue: 200, bucket: undefined, amount_due: 600 }),
           row({ id: 4, invoice_number: "F-10004", due_date: null, days_past_due: null, days_since_issue: 20, bucket: undefined, amount_due: 300, marked_overdue: true })],
  },
});

describe("daysLabel / pastDueTone", () => {
  it("singular and plural", () => {
    expect(daysLabel(1)).toBe("1 día");
    expect(daysLabel(12)).toBe("12 días");
    expect(daysLabel(null)).toBe("—");
  });
  it("amber up to 30 days, red beyond", () => {
    expect(pastDueTone(30)).toBe("amber");
    expect(pastDueTone(31)).toBe("red");
  });
});

describe("normalizeReport", () => {
  it("always returns the four buckets in order, even from an empty or odd payload", () => {
    for (const raw of [null, undefined, {}, "x", { overdue: { buckets: [{ key: "90+", count: 2, amount_due: 5 }] } }]) {
      const r = normalizeReport(raw);
      expect(r.overdue.buckets.map((b) => b.key)).toEqual(["1-30", "31-60", "61-90", "90+"]);
      expect(Array.isArray(r.overdue.rows) && Array.isArray(r.sin_plazo.rows)).toBe(true);
    }
    expect(normalizeReport({ overdue: { buckets: [{ key: "90+", count: 2, amount_due: 5 }] } }).overdue.buckets[3]).toMatchObject({ count: 2, amount_due: 5 });
  });
  it("keeps rows and totals as given", () => {
    const r = normalizeReport(report());
    expect(r.overdue.rows).toHaveLength(2);
    expect(r.sin_plazo.count).toBe(2);
  });
});

describe("OverdueReportView (static markup)", () => {
  const html = renderToStaticMarkup(React.createElement(OverdueReportView, { report: normalizeReport(report()) }));
  it("shows the ageing strip with the four ranges", () => {
    for (const label of ["1 a 30 días", "31 a 60 días", "61 a 90 días", "Más de 90 días"]) expect(html).toContain(label);
    expect(html).toContain("$500.00");
    expect(html).toContain("$1,000.00");
  });
  it("keeps Sin plazo in its own section, apart from the overdue rows", () => {
    const split = html.indexOf('data-testid="sin-plazo"');
    expect(split).toBeGreaterThan(0);
    const before = html.slice(0, split);
    const after = html.slice(split);
    expect(before).toContain("F-10001");
    expect(before).not.toContain("F-10003");
    expect(after).toContain("F-10003");
    expect(after).not.toContain("F-10001");
    expect(after).toContain("No cuentan como vencidas");
  });
  it("tags a phase invoice and a stored-overdue dateless invoice", () => {
    expect(html).toContain(">Fase<");
    expect(html).toContain("Marcada vencida");
  });
  it("links every row to the invoice detail and offers no write control", () => {
    for (const id of [1, 2, 3, 4]) expect(html).toContain(`href="/invoices/${id}"`);
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<select");
  });
  it("shows the empty states", () => {
    const empty = renderToStaticMarkup(React.createElement(OverdueReportView, { report: normalizeReport({}) }));
    expect(empty).toContain("No hay facturas vencidas por fecha.");
    expect(empty).toContain("No hay facturas abiertas sin plazo.");
  });
});
