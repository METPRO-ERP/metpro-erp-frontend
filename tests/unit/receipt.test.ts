import { describe, it, expect } from "vitest";
import { showReceiptButton, receiptPath } from "@/lib/receipt";

describe("showReceiptButton (R3, fail closed)", () => {
  const live = { voided_at: null, has_receipt: true };
  it("shows for an admin, switch on, live payment with stored figures", () => {
    expect(showReceiptButton(true, true, live)).toBe(true);
  });
  it("hides when the switch is off or unknown", () => {
    expect(showReceiptButton(true, false, live)).toBe(false);
  });
  it("hides for a non-admin", () => {
    expect(showReceiptButton(false, true, live)).toBe(false);
  });
  it("hides for a voided payment", () => {
    expect(showReceiptButton(true, true, { voided_at: "2026-11-20T10:00:00Z", has_receipt: true })).toBe(false);
  });
  it("hides for a payment without stored figures or when the flag is missing", () => {
    expect(showReceiptButton(true, true, { voided_at: null, has_receipt: false })).toBe(false);
    expect(showReceiptButton(true, true, { voided_at: null })).toBe(false);
  });
});

describe("receiptPath", () => {
  it("points at the invoice payment receipt route", () => {
    expect(receiptPath(12, 345)).toBe("/invoices/12/payments/345/receipt");
  });
});
