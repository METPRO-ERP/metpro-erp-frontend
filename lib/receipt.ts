"use client";

/**
 * Release R3: recibo de pago. A "Recibo" button per payment row in the invoice's payment history.
 * Fail-closed: shown only to an admin, only when the backend switch RECEIPT_ENABLED is on (GET /quotes/receipt-options),
 * only for a live payment that has stored receipt figures (has_receipt). Switch off or call failed: no button.
 */

import { useEffect, useState } from "react";
import { api, checkUnauthorized, safeFetch } from "@/lib/api";

export interface ReceiptPayment {
  voided_at?: string | null;
  has_receipt?: boolean;
}

/** The one place that decides whether a payment row shows the Recibo button. */
export function showReceiptButton(isAdmin: boolean, enabled: boolean, p: ReceiptPayment): boolean {
  return isAdmin === true && enabled === true && !p.voided_at && p.has_receipt === true;
}

export function receiptPath(invoiceId: number, paymentId: number): string {
  return `/invoices/${invoiceId}/payments/${paymentId}/receipt`;
}

let cached: Promise<boolean> | null = null;

export function getReceiptEnabled(): Promise<boolean> {
  if (!cached) {
    cached = (async () => {
      try {
        const r = (await api("/quotes/receipt-options")) as { receipt_enabled?: unknown } | null;
        return r?.receipt_enabled === true;
      } catch {
        cached = null;
        return false;
      }
    })();
  }
  return cached;
}

export function useReceiptEnabled(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getReceiptEnabled().then((v) => {
      if (!cancelled) setOn(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return on;
}

/** Opens the recibo PDF in a new tab (print from there). Throws an Error with the backend message on a refusal. */
export async function openReceipt(invoiceId: number, paymentId: number): Promise<void> {
  const tab = window.open("", "_blank"); // opened first so the browser does not block it
  try {
    const base = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
    const token = localStorage.getItem("token");
    const res = await safeFetch(`${base}${receiptPath(invoiceId, paymentId)}`, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
    if (!res.ok) {
      checkUnauthorized(res);
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (body && typeof body.detail === "string") message = body.detail;
      } catch {
        /* non-JSON error body */
      }
      throw new Error(message);
    }
    const url = URL.createObjectURL(new Blob([await res.arrayBuffer()], { type: "application/pdf" }));
    if (tab) tab.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    tab?.close();
    throw e;
  }
}
