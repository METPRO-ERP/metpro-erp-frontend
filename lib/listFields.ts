/**
 * C1b: display helpers for the list cards and the dashboard rows. Pure, no I/O.
 * They only choose which already-loaded field to print and how to format it.
 */

/** "Q-32719", or an em dash when the quote has no number (same format as the public quote page). */
export function quoteNumberLabel(n: number | string | null | undefined): string {
  return n === null || n === undefined || n === "" ? "—" : `Q-${n}`
}

/** invoice_number already carries its "F-" prefix: print it as stored, no second marker. */
export function invoiceNumberLabel(n: string | number | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—"
  return String(n).replace(/^#+/, "")
}

/** React key for a recent-quote row: quote_id (the API field), never q.id (absent). */
export function quoteRowKey(q: { quote_id?: string | number | null; id?: string | number | null }, index: number): string {
  const k = q.quote_id ?? q.id
  return k === null || k === undefined ? `q-${index}` : String(k)
}

export type MoneyTone = "positive" | "spend" | "negative" | "neutral"

/** One definition of the money colours (token classes). value is the amount shown. */
export function moneyTone(kind: "income" | "spend" | "net", value: number): MoneyTone {
  if (kind === "income") return "positive"
  if (kind === "spend") return "spend"
  return value < 0 ? "negative" : "positive"
}

export const MONEY_TONE_CLASS: Record<MoneyTone, string> = {
  positive: "text-emerald-600",
  spend: "text-amber-600",
  negative: "text-red-600",
  neutral: "text-ink",
}
