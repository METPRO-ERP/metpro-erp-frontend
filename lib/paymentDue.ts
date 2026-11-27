"use client";

/**
 * Release B2: structured payment term (credit_days) on a quote and the due date on an invoice.
 * Pure helpers plus a fail-closed switch hook (GET /quotes/payment-due-options).
 * Switch OFF or call failed: every control stays hidden and no field is sent.
 */

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export const CREDIT_DAYS_MAX = 365;

/** D4 presets. "Personalizado" is derived (anything else), not stored. */
export const PRESETS: ReadonlyArray<{ key: string; days: number; label: string }> = [
  { key: "0", days: 0, label: "Contado" },
  { key: "15", days: 15, label: "Crédito 15 días" },
  { key: "30", days: 30, label: "Crédito 30 días" },
  { key: "45", days: 45, label: "Crédito 45 días" },
  { key: "60", days: 60, label: "Crédito 60 días" },
];

export const NO_PRESET = "";
export const CUSTOM = "custom";

/** Days from a stored value or a typed string. "" or invalid gives null. Whole numbers 0..365 only. */
export function parseDays(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!/^\d{1,3}$/.test(s)) return null;
  const n = Number(s);
  return n >= 0 && n <= CREDIT_DAYS_MAX ? n : null;
}

/** Preset key for the current days. null days: none. A days value outside the presets: custom. */
export function presetKey(days: number | null): string {
  if (days === null) return NO_PRESET;
  const hit = PRESETS.find((p) => p.days === days);
  return hit ? hit.key : CUSTOM;
}

/** Due date shown as a hint only (the stored value is computed by the backend at conversion). */
export function creditDaysForCreate(enabled: boolean, days: number | null): { credit_days?: number } {
  if (!enabled || days === null) return {};
  return { credit_days: days };
}

/**
 * Quote edit page, save: credit_days only when it changed. Cleared on purpose sends null.
 * Unchanged sends nothing, so a save never alters it by accident.
 */
export function creditDaysForUpdate(
  enabled: boolean,
  stored: number | null | undefined,
  current: number | null
): { credit_days?: number | null } {
  if (!enabled) return {};
  const before = stored === undefined ? null : stored;
  if (before === current) return {};
  return { credit_days: current };
}

/**
 * Release R4: client-level default payment term. The default is a PREFILL on the new-quote form only.
 * Backend stores what the form sends; it never inherits, and a client default edit never moves an existing quote or invoice.
 */
export interface ClientDefaultTerms {
  default_credit_days?: number | null;
  default_payment_terms?: string | null;
}

/** The client's default as form values, or null when switch is off or the client has none. */
export function clientDefaultTerms(
  enabled: boolean,
  c: ClientDefaultTerms | null | undefined
): { days: string; terms: string } | null {
  if (!enabled || !c) return null;
  const d = parseDays(c.default_credit_days ?? null);
  const t = typeof c.default_payment_terms === "string" ? c.default_payment_terms.trim() : "";
  if (d === null && !t) return null;
  return { days: d === null ? "" : String(d), terms: t };
}

export interface TermsEdit {
  terms: string;
  days: string;
}

/**
 * Pure rule. `edited` is null until the user types in either field. Once set, the quote's own value wins and the
 * client's default is never applied again. Untouched: the client's default fills both fields (switch off or no
 * default: empty). Derived on every render, so there is no effect and no stale inherited value when the client changes.
 */
export function resolveTerms(
  edited: TermsEdit | null,
  enabled: boolean,
  c: ClientDefaultTerms | null | undefined
): { terms: string; days: string; inherited: boolean } {
  if (edited) return { ...edited, inherited: false };
  const d = clientDefaultTerms(enabled, c);
  return d ? { terms: d.terms, days: d.days, inherited: true } : { terms: "", days: "", inherited: false };
}

/** State for the two term fields with inheritance. Any edit by the user marks them touched and hides the note. */
export function useClientTermsInheritance(enabled: boolean, c: ClientDefaultTerms | null | undefined) {
  const [edited, setEdited] = useState<TermsEdit | null>(null);
  const cur = resolveTerms(edited, enabled, c);
  const setTerms = (terms: string) => setEdited({ terms, days: cur.days });
  const setDays = (days: string) => setEdited({ terms: cur.terms, days });
  return { ...cur, setTerms, setDays };
}

let cached: Promise<boolean> | null = null;

export function getPaymentDueEnabled(): Promise<boolean> {
  if (!cached) {
    cached = (async () => {
      try {
        const r = (await api("/quotes/payment-due-options")) as { payment_due_enabled?: unknown } | null;
        return r?.payment_due_enabled === true;
      } catch {
        cached = null;
        return false;
      }
    })();
  }
  return cached;
}

export function usePaymentDueEnabled(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getPaymentDueEnabled().then((v) => {
      if (!cancelled) setOn(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return on;
}

export interface DueDateAuditRow {
  id: number;
  old_due_date: string | null;
  new_due_date: string;
  note: string;
  changed_by: string | null;
  changed_at: string;
}

/** Admin edit of an invoice due date. The note is mandatory (backend enforces it too). */
export async function updateInvoiceDueDate(invoiceId: number, dueDate: string, note: string) {
  return api.patch(`/invoices/${invoiceId}/due-date`, { due_date: dueDate, note: note.trim() });
}

export async function fetchDueDateAudit(invoiceId: number): Promise<DueDateAuditRow[]> {
  const r = await api.get(`/invoices/${invoiceId}/due-date-audit`);
  return Array.isArray(r) ? (r as DueDateAuditRow[]) : [];
}
