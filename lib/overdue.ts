/**
 * R2: the overdue view on the Facturas list. Read-only. Rides PAYMENT_DUE_ENABLED (GET /quotes/payment-due-options):
 * switch off or call failed = the filter never shows. The backend does the test and the ageing; this file only shapes
 * what the screen needs and never computes whether an invoice is overdue.
 */
import { api } from "@/lib/api";

export interface OverdueRow {
  id: number;
  invoice_number: string;
  client_name: string;
  invoice_date: string | null;
  due_date: string | null;
  days_past_due: number | null;
  days_since_issue: number | null;
  amount_due: number;
  status: string;
  is_phase: boolean;
  bucket?: string;
  marked_overdue?: boolean;
}

export interface OverdueBucket {
  key: string;
  label: string;
  count: number;
  amount_due: number;
}

export interface OverdueReport {
  as_of: string;
  overdue: { count: number; amount_due: number; buckets: OverdueBucket[]; rows: OverdueRow[] };
  sin_plazo: { count: number; amount_due: number; rows: OverdueRow[] };
}

const BUCKET_KEYS = ["1-30", "31-60", "61-90", "90+"] as const;
const BUCKET_LABELS: Record<string, string> = {
  "1-30": "1 a 30 días",
  "31-60": "31 a 60 días",
  "61-90": "61 a 90 días",
  "90+": "Más de 90 días",
};

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

function rows(v: unknown): OverdueRow[] {
  return Array.isArray(v) ? (v as OverdueRow[]) : [];
}

/** Defensive shape: a partial or odd payload still renders (four buckets always present, in order). */
export function normalizeReport(raw: unknown): OverdueReport {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const o = r.overdue ?? {};
  const s = r.sin_plazo ?? {};
  const given: OverdueBucket[] = Array.isArray(o.buckets) ? o.buckets : [];
  return {
    as_of: typeof r.as_of === "string" ? r.as_of : "",
    overdue: {
      count: num(o.count),
      amount_due: num(o.amount_due),
      buckets: BUCKET_KEYS.map((key) => {
        const b = given.find((x) => x?.key === key);
        return { key, label: BUCKET_LABELS[key], count: num(b?.count), amount_due: num(b?.amount_due) };
      }),
      rows: rows(o.rows),
    },
    sin_plazo: { count: num(s.count), amount_due: num(s.amount_due), rows: rows(s.rows) },
  };
}

export async function fetchOverdue(): Promise<OverdueReport> {
  return normalizeReport(await api.get("/invoices/overdue"));
}

/** "1 día", "12 días". */
export function daysLabel(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n === 1 ? "1 día" : `${n} días`;
}

/** Colour of the days chip: amber up to 30 days past due, red beyond. Presentation only. */
export function pastDueTone(days: number | null | undefined): "amber" | "red" {
  return (days ?? 0) > 30 ? "red" : "amber";
}

export const TONE_CLASS: Record<"amber" | "red", string> = {
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
};

export const BUCKET_LABEL = BUCKET_LABELS;
