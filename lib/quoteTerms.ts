/**
 * Release B1: validity date (valid_until) and payment terms on a quote.
 * Pure helpers. No I/O, no business rule beyond "send only what the user entered".
 * Both fields already exist on quotes; the backend accepts them on create, update and estimator generate.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A stored or typed date as YYYY-MM-DD, or "" when empty or not a date. */
export function normDay(value: string | null | undefined): string {
  const v = String(value ?? "").trim().slice(0, 10);
  return DAY.test(v) ? v : "";
}

/**
 * Estimador "Generar": the optional fields of the payload.
 * An empty field is left OUT (not sent as null), so an empty form posts exactly what it posted before B1.
 */
export function termsForGenerate(input: {
  paymentTerms: string;
  validUntil: string;
}): { payment_terms?: string; valid_until?: string } {
  const out: { payment_terms?: string; valid_until?: string } = {};
  const terms = input.paymentTerms.trim();
  const day = normDay(input.validUntil);
  if (terms) out.payment_terms = terms;
  if (day) out.valid_until = day;
  return out;
}

/**
 * Quote edit page, save: valid_until is sent only when it differs from the stored value.
 * Unchanged (including "empty stays empty") sends nothing, so a save can never alter a stored date by accident.
 * Cleared on purpose sends null.
 */
export function validUntilForUpdate(
  stored: string | null | undefined,
  current: string
): { valid_until?: string | null } {
  const before = normDay(stored);
  const now = normDay(current);
  if (before === now) return {};
  return { valid_until: now || null };
}

/**
 * Quote edit page, save: the two B1 fields of the PUT body.
 * payment_terms keeps today's behaviour (always sent, null when empty); valid_until follows validUntilForUpdate.
 */
export function termsForUpdate(
  storedValidUntil: string | null | undefined,
  current: { paymentTerms: string; validUntil: string }
): { payment_terms: string | null; valid_until?: string | null } {
  return {
    payment_terms: current.paymentTerms.trim() || null,
    ...validUntilForUpdate(storedValidUntil, current.validUntil),
  };
}

/**
 * Hint for a validity date entered in the past. Not a block: the save still goes through.
 * A date that is already stored is never flagged (only a change is).
 */
export function validUntilIsPast(stored: string | null | undefined, current: string, today: string): boolean {
  const now = normDay(current);
  if (!now) return false;
  if (now === normDay(stored)) return false;
  return now < today;
}
