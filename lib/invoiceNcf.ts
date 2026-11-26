import { fmtDay } from "@/lib/dates";

/**
 * NCF block for the invoice detail page. The NCF is a stored fact of the document, so it is shown whenever the
 * invoice has one, regardless of the fiscal switch. Returns null for an invoice without an NCF (nothing to show).
 */
export function ncfDisplay(inv: { ncf?: string | null; ncf_valid_until?: string | null }):
  { ncf: string; validUntil: string | null } | null {
  const ncf = (inv.ncf ?? "").trim();
  if (!ncf) return null;
  const until = fmtDay(inv.ncf_valid_until);
  return { ncf, validUntil: until || null };
}
