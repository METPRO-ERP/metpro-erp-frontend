import { api, checkUnauthorized, safeFetch } from "@/lib/api";
import { es } from "@/lib/i18n/es";

/**
 * Conduce delivery ledger. A conduce documents the physical delivery of the quote's items.
 * Never payments, phase labels or amounts. The backend owns every number and every rule.
 */

export interface ConduceOptions {
  enabled: boolean;
}

/** Fails closed: when the call fails the panel and the pill stay hidden and the old conduce button stays. */
export async function getConduceOptions(): Promise<ConduceOptions> {
  try {
    const d = (await api.get("/conduces/options")) as { enabled?: boolean } | null;
    return { enabled: d?.enabled === true };
  } catch {
    return { enabled: false };
  }
}

export type DeliveryState = "Sin entregas" | "Entrega parcial" | "Entregado" | "Sin items entregables";

export interface DeliveryLine {
  quote_item_id: number;
  product_name: string;
  unit_of_measure: string | null;
  category: string | null;
  quoted: number;
  delivered: number;
  pending: number;
}

export interface ConduceRow {
  id: string;
  conduce_number: string;
  delivery_seq: number;
  delivery_date: string | null;
  created_by: string | null;
  notes: string | null;
  invoice_id: number | null;
  voided: boolean;
  void_reason: string | null;
  line_count: number;
}

export interface LegacyConduce {
  conduce_number: string;
  created_at: string | null;
}

export interface DeliveryView {
  quote_id: string;
  state: DeliveryState;
  lines: DeliveryLine[];
  conduces: ConduceRow[];
  legacy_conduces: LegacyConduce[];
  invoice_id?: number;
  invoice_number?: string;
  invoice_status?: string;
}

export const getInvoiceDelivery = (invoiceId: number) =>
  api.get(`/conduces/invoice/${invoiceId}/state`) as Promise<DeliveryView>;

export const getQuoteDelivery = (quoteId: string) =>
  api.get(`/conduces/quote/${encodeURIComponent(quoteId)}/state`) as Promise<DeliveryView>;

export interface ConduceLineInput {
  quote_item_id: number;
  quantity: number;
}

export interface ConduceInput {
  invoice_id: number;
  delivery_date?: string;
  notes?: string;
  lines: ConduceLineInput[];
}

export const createConduce = (body: ConduceInput) => api.post("/conduces", body);

export const voidConduce = (id: string, reason: string) =>
  api.post(`/conduces/${encodeURIComponent(id)}/void`, { reason });

export async function fetchConducePdf(id: string, printSeal: boolean = false): Promise<Blob> {
  const rawBase = process.env.NEXT_PUBLIC_API_URL;
  if (!rawBase) throw new Error(es.fact.backendFalta);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await safeFetch(
    `${rawBase.replace(/\/+$/, "")}/conduces/${encodeURIComponent(id)}/pdf${printSeal ? "?print_seal=true" : ""}`,
    { method: "GET", headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" }
  );
  if (!res.ok) {
    checkUnauthorized(res);
    let message = es.fact.errorHttp(res.status);
    try {
      const body = await res.json();
      if (body && typeof body.detail === "string") message = body.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }
  return new Blob([await res.arrayBuffer()], { type: "application/pdf" });
}

/* ---------------- pure helpers (unit tested) ---------------- */

export type QtyCheck = { ok: true; value: number | null } | { ok: false; error: string };

/** Accepts "4", "4.5" and "4,5". Empty or 0 means "not in this delivery". At most 2 decimals. Never above pending. */
export function checkQty(raw: string, pending: number): QtyCheck {
  const s = (raw ?? "").trim().replace(",", ".");
  if (s === "") return { ok: true, value: null };
  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    return { ok: false, error: /^\d+\.\d{3,}$/.test(s) ? es.cond.errDecimales : es.cond.errNumero };
  }
  const n = Number(s);
  if (n === 0) return { ok: true, value: null };
  if (Math.round(n * 100) > Math.round(pending * 100)) return { ok: false, error: es.cond.errMaximo(fmtQty(pending)) };
  return { ok: true, value: n };
}

/** 10 -> "10", 60.5 -> "60.5", 100.25 -> "100.25". */
export function fmtQty(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** The form opens with every pending quantity filled in: a full delivery is one tap. */
export function defaultEntries(lines: DeliveryLine[]): Record<number, string> {
  const out: Record<number, string> = {};
  for (const l of lines) out[l.quote_item_id] = l.pending > 0 ? fmtQty(l.pending) : "";
  return out;
}

export type BuildResult =
  | { ok: true; lines: ConduceLineInput[] }
  | { ok: false; errors: Record<number, string>; empty: boolean };

export function buildLines(lines: DeliveryLine[], entries: Record<number, string>): BuildResult {
  const errors: Record<number, string> = {};
  const out: ConduceLineInput[] = [];
  for (const l of lines) {
    const c = checkQty(entries[l.quote_item_id] ?? "", l.pending);
    if (!c.ok) errors[l.quote_item_id] = c.error;
    else if (c.value !== null) out.push({ quote_item_id: l.quote_item_id, quantity: c.value });
  }
  if (Object.keys(errors).length) return { ok: false, errors, empty: false };
  if (!out.length) return { ok: false, errors, empty: true };
  return { ok: true, lines: out };
}

export function stateLabel(state: string | null | undefined): string {
  return (es.cond.estados as Record<string, string>)[state ?? ""] ?? "—";
}

export type Tone = "neutral" | "warning" | "success";
export function stateTone(state: string | null | undefined): Tone {
  if (state === "Entregado") return "success";
  if (state === "Entrega parcial") return "warning";
  return "neutral";
}

/** The server message is already Spanish and names the lines (over-delivery); known codes get a fixed text. */
export function conduceErrorText(err: unknown): string {
  const e = err as { code?: string; message?: string } | null;
  const code = e?.code;
  if (code === "CONDUCE_OVER_DELIVERY") return e?.message || es.cond.errSobreEntrega;
  const fixed = code ? (es.cond.errores as Record<string, string>)[code] : undefined;
  return fixed ?? e?.message ?? es.cond.errGenerico;
}
