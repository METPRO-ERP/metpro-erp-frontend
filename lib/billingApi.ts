import { api } from "@/lib/api";

/** Phased invoicing and fiscal sequence (NCF) screens. Admin and superadmin only. Every number is computed by the backend. */

export interface PhaseOptions {
  phased_enabled: boolean;
}

/** Fails closed: when the call fails the mode choice and the phase panel stay hidden. */
export async function getPhaseOptions(): Promise<PhaseOptions> {
  try {
    const d = (await api.get("/phases/options")) as { phased_enabled?: boolean } | null;
    return { phased_enabled: d?.phased_enabled === true };
  } catch {
    return { phased_enabled: false };
  }
}

export interface PhaseRow {
  id: number;
  phase_order: number;
  label: string;
  amount_input_type: "percent" | "fixed" | "final";
  amount_snapshot: number;
  itbis_snapshot: number;
  status: "Planned" | "Invoiced";
  invoice_id: number | null;
  invoice_number: string | null;
  invoice_status: string | null;
  ncf: string | null;
  amount_paid: number;
}

export interface PhaseAggregate {
  total: number;
  itbis: number;
  invoiced_to_date: number;
  paid_to_date: number;
  pending_to_invoice: number;
  pending_to_pay: number;
  remaining_for_new_phase: number;
}

export interface PhasesView {
  quote_id: string;
  billing_mode: "FULL" | "PHASED";
  quote_status: string;
  phases: PhaseRow[];
  aggregate: PhaseAggregate;
}

export interface PhaseInput {
  label: string;
  amount_input_type: "percent" | "fixed" | "final";
  amount_input_value: number | null;
}

export const getPhases = (quoteId: string) => api.get(`/quotes/${encodeURIComponent(quoteId)}/phases`) as Promise<PhasesView>;

export const createPhase = (quoteId: string, body: PhaseInput) =>
  api.post(`/quotes/${encodeURIComponent(quoteId)}/phases`, body) as Promise<{ id: number; amount: number; itbis: number; base: number; is_final: boolean }>;

export const invoicePhase = (phaseId: number) =>
  api.post(`/phases/${phaseId}/invoice`) as Promise<{
    invoice_id: number;
    invoice_number: string;
    ncf: string | null;
    quote_fully_invoiced: boolean;
    ncf_warning?: { expiry: boolean; exhaustion: boolean };
  }>;

// ---------------- Fiscal sequence ----------------

export interface FiscalStatus {
  ncf_enabled: boolean;
  configured: boolean;
  state: "ok" | "inactive" | "incomplete" | "expired" | "exhausted";
  remaining: number | null;
  days_to_expiry: number | null;
  warn_expiry: boolean;
  warn_exhaustion: boolean;
  series?: string;
  next_number?: number;
  range_start?: number;
  range_end?: number;
  expiry_date?: string | null;
  locked?: boolean;
  next_ncf?: string | null;
}

export interface FiscalBatchInput {
  series: string;
  next_number: number;
  next_number_confirm: number;
  range_start: number;
  range_end: number;
  expiry_date: string;
  confirm: boolean;
}

export interface FiscalPreview {
  confirmed: boolean;
  batch: {
    series: string;
    next_number: number;
    range_start: number;
    range_end: number;
    expiry_date: string;
    next_ncf: string;
    last_ncf: string;
    quantity: number;
  };
}

export const getFiscalStatus = () => api.get("/fiscal/sequence") as Promise<FiscalStatus>;
export const activateFiscalBatch = (b: FiscalBatchInput) => api.post("/fiscal/sequence/activate", b) as Promise<FiscalPreview>;
export const correctFiscalBatch = (b: FiscalBatchInput) => api.post("/fiscal/sequence/correct", b) as Promise<FiscalPreview>;
