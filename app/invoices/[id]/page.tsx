"use client";

import { useEffect, useState } from "react";
import { fmtDay } from "@/lib/dates"
import { money } from "@/lib/money"
import { ncfDisplay } from "@/lib/invoiceNcf"
import Link from "next/link";
import { useParams } from "next/navigation";
import { fetchInvoiceWithPayments, voidPayment, correctPayment, fetchPaymentOptions } from "@/lib/invoiceApi";
import { useCurrentRole } from "@/lib/currentRole";
import toast from "react-hot-toast";
import RecordPaymentModal from "@/components/invoices/RecordPaymentModal";
import StatusPill from "@/components/ui/StatusPill";
import StatusHistoryLink from "@/components/StatusHistoryLink";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import SendToClientButton from "@/components/SendToClientButton";
import FullCopyButton from "@/components/FullCopyButton";
import InvoiceDocPreviewModal from "@/components/invoices/InvoiceDocPreviewModal";
import { type InvoiceDocKind } from "@/lib/invoiceDocs";
import ConducePanel from "@/components/invoices/ConducePanel";
import DueDatePanel from "@/components/invoices/DueDatePanel";
import { ResponsiveList, ListCard, TableScroll } from "@/components/ui/responsive-list";
import { dt } from "@/components/ui/data-table";
import { getConduceOptions } from "@/lib/conduceApi";
import { openReceipt, showReceiptButton, useReceiptEnabled } from "@/lib/receipt";

interface Payment {
  id: number;
  amount: number;
  method: string;
  notes: string | null;
  payment_date: string;
  voided_at?: string | null;
  void_reason?: string | null;
  voided_by_name?: string | null;
  created_at?: string | null;
  created_by_name?: string | null;
  backfilled?: boolean;
  /** R3: true when the payment has stored receipt figures (recorded after R3 and not voided). */
  has_receipt?: boolean;
  corrects_payment_id?: number | null;
  corrected_by_payment_id?: number | null;
  correction_chain_id?: number | null;
}

interface Invoice {
  id: number;
  invoice_number: string;
  client_name: string;
  invoice_date: string;
  status: string;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  created_by_name?: string | null;
  ncf?: string | null;
  ncf_valid_until?: string | null;
  /** B2: present only with PAYMENT_DUE_ENABLED on. */
  due_date?: string | null;
  payments: Payment[];
  items?: InvoiceLine[];
  payments_error?: string | null;
}

interface InvoiceLine {
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_value?: number;
  total?: number;
}

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const invoiceId = Number(id);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [preview, setPreview] = useState<InvoiceDocKind | null>(null);
  const { isAdmin } = useCurrentRole();
  const [conduceLedger, setConduceLedger] = useState(false);
  useEffect(() => {
    let active = true;
    getConduceOptions().then((o) => { if (active) setConduceLedger(o.enabled); });
    return () => { active = false; };
  }, []);
  // B-14: payment being voided (admin) and the reason typed for it.
  const [voiding, setVoiding] = useState<Payment | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidBusy, setVoidBusy] = useState(false);

  // A2: void-and-correct. The action only shows when the backend switch is on.
  const [correctionEnabled, setCorrectionEnabled] = useState(false);
  const [recordAdminOnly, setRecordAdminOnly] = useState(false);
  const receiptEnabled = useReceiptEnabled();
  const [receiptBusy, setReceiptBusy] = useState<number | null>(null);
  const printReceipt = async (p: Payment) => {
    setReceiptBusy(p.id);
    try {
      await openReceipt(invoiceId, p.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo abrir el recibo.");
    } finally {
      setReceiptBusy(null);
    }
  };
  const [correcting, setCorrecting] = useState<Payment | null>(null);
  const [corr, setCorr] = useState({ amount: "", method: "", notes: "", payment_date: "", reason: "" });
  const [corrBusy, setCorrBusy] = useState(false);

  useEffect(() => {
    fetchPaymentOptions().then((o) => {
      setCorrectionEnabled(o.correction_enabled);
      setRecordAdminOnly(o.record_admin_only);
    });
  }, []);

  const openCorrection = (p: Payment) => {
    setCorrecting(p);
    setCorr({ amount: String(p.amount), method: p.method, notes: p.notes ?? "", payment_date: p.payment_date.slice(0, 10), reason: "" });
  };

  const confirmCorrection = async () => {
    if (!correcting) return;
    const amount = Number(corr.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("El monto debe ser mayor que cero.");
      return;
    }
    if (corr.reason.trim().length < 3) {
      toast.error("Indique el motivo de la corrección.");
      return;
    }
    setCorrBusy(true);
    try {
      await correctPayment(invoiceId, correcting.id, {
        amount,
        method: corr.method,
        notes: corr.notes,
        payment_date: corr.payment_date,
        reason: corr.reason.trim(),
      });
      toast.success("Pago corregido");
      setCorrecting(null);
      await loadInvoice();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo corregir el pago.");
    } finally {
      setCorrBusy(false);
    }
  };

  const confirmVoid = async () => {
    if (!voiding) return;
    if (voidReason.trim().length < 3) {
      toast.error("Indique el motivo de la anulación.");
      return;
    }
    setVoidBusy(true);
    try {
      await voidPayment(invoiceId, voiding.id, voidReason.trim());
      toast.success("Pago anulado. El saldo se recalculó.");
      setVoiding(null);
      setVoidReason("");
      await loadInvoice();
    } catch (err) {
      toast.error("No se pudo anular el pago: " + (err instanceof Error ? err.message : ""));
    } finally {
      setVoidBusy(false);
    }
  };

  // C3 fix: after an audited due-date edit the page shows the saved value at once (taken from the PATCH answer),
  // then refetches the invoice. Client-side only.
  const applySavedDueDate = async (saved?: string | null) => {
    if (saved) setInvoice((prev) => (prev ? { ...prev, due_date: saved } : prev));
    await loadInvoice();
  };

  const loadInvoice = async () => {
    try {
      const data = await fetchInvoiceWithPayments(invoiceId);
      setInvoice(data as Invoice);
    } catch (err) {
      console.error("Error loading invoice:", err);
      setError(err instanceof Error ? err.message : "No se pudo cargar la factura.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoice();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted">Cargando factura...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          No se pudo cargar la factura: {error || "no encontrada"}
        </p>
        <Link href="/invoices" className={`mt-4 text-sm ${dt.link}`}>
          Volver a facturas
        </Link>
      </div>
    );
  }

  const lines = invoice.items ?? [];
  const ncf = ncfDisplay(invoice);

  const payments = invoice.payments ?? [];

  return (
    <div className="min-h-screen bg-canvas p-6">
      <div className="max-w-4xl mx-auto bg-surface shadow rounded-lg p-6">

        <PageHeader title={`Factura #${invoice.invoice_number}`} />

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-muted">Cliente</p>
            <p className="break-words font-medium">{invoice.client_name}</p>
          </div>

          <div>
            <p className="text-muted">Fecha</p>
            <p className="font-medium">
              {fmtDay(invoice.invoice_date)}
            </p>
          </div>

          <div>
            <p className="text-muted">Estado</p>
            <StatusPill status={invoice.status} gender="f" />
            <StatusHistoryLink kind="invoice" id={invoiceId} refreshKey={invoice.status} />
          </div>

          <div>
            <p className="text-muted">Creado por</p>
            <p className="font-medium">{invoice.created_by_name || "—"}</p>
          </div>

          {ncf && (
            <div>
              <p className="text-muted">NCF</p>
              <p className="break-all font-medium">{ncf.ncf}</p>
            </div>
          )}

          {ncf?.validUntil && (
            <div>
              <p className="text-muted">Vence NCF</p>
              <p className="break-words font-medium">{ncf.validUntil}</p>
            </div>
          )}

          <DueDatePanel invoiceId={invoiceId} dueDate={invoice.due_date} isAdmin={isAdmin} onChanged={applySavedDueDate} />
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Detalle</h2>
          {lines.length === 0 ? (
            <p className="text-muted">Sin líneas.</p>
          ) : (
            <ResponsiveList
              below="sm"
              items={lines}
              getKey={(_l, i) => i}
              renderCard={(l) => {
                const gross = Number(l.quantity || 0) * Number(l.unit_price || 0);
                const total = l.total ?? gross - Number(l.discount_value || 0);
                return (
                  <ListCard
                    title={<span className="break-words">{l.product_name}</span>}
                    fields={[
                      { label: "Cant.", value: Number(l.quantity || 0) },
                      { label: "Precio", value: money(Number(l.unit_price || 0)), numeric: true },
                      { label: "Desc.", value: money(Number(l.discount_value || 0)), numeric: true },
                      { label: "Total", value: <span className="font-medium">{money(Number(total))}</span>, numeric: true },
                    ]}
                  />
                );
              }}
            >
              <table className={dt.table}>
                <thead className={dt.thead}>
                  <tr>
                    <th className={dt.th}>Descripción</th>
                    <th className={dt.thRight}>Cant.</th>
                    <th className={dt.thRight}>Precio</th>
                    <th className={dt.thRight}>Desc.</th>
                    <th className={dt.thRight}>Total</th>
                  </tr>
                </thead>
                <tbody className={dt.tbody}>
                  {lines.map((l, i) => {
                    const gross = Number(l.quantity || 0) * Number(l.unit_price || 0);
                    const total = l.total ?? gross - Number(l.discount_value || 0);
                    return (
                      <tr key={i} className={dt.tr}>
                        <td className="px-4 py-3 text-ink">{l.product_name}</td>
                        <td className={dt.tdRight}>{Number(l.quantity || 0)}</td>
                        <td className={dt.tdRight}>{money(Number(l.unit_price || 0))}</td>
                        <td className={dt.tdRight}>{money(Number(l.discount_value || 0))}</td>
                        <td className={`${dt.tdRight} font-medium`}>{money(Number(total))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ResponsiveList>
          )}
        </div>

        <div className="bg-canvas p-4 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-3">Totales</h2>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <div className="flex items-baseline justify-between gap-3 sm:block">
              <p className="text-muted">Total</p>
              <p className="font-bold text-lg">
                {money((invoice.total_amount ?? 0))}
              </p>
            </div>

            <div className="flex items-baseline justify-between gap-3 sm:block">
              <p className="text-muted">Pagado</p>
              <p className="font-bold text-lg text-emerald-600">
                {money((invoice.amount_paid ?? 0))}
              </p>
            </div>

            <div className="flex items-baseline justify-between gap-3 sm:block">
              <p className="text-muted">Pendiente</p>
              <p className="font-bold text-lg text-red-600">
                {money((invoice.amount_due ?? 0))}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-canvas p-4 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-3">Acciones</h2>
          <div className="flex flex-wrap gap-3">
            {invoice.status !== "Cancelled" && <SendToClientButton id={invoiceId} type="invoice" />}
            <Button onClick={() => setPreview("factura")}>Vista previa Factura</Button>
            {!conduceLedger && <Button onClick={() => setPreview("conduce")}>Vista previa Conduce</Button>}
            <FullCopyButton kind="invoice" id={invoiceId} />
            {recordAdminOnly && !isAdmin ? null : <Button onClick={() => setPaymentOpen(true)}>Pago</Button>}
          </div>
        </div>

        {conduceLedger && <ConducePanel invoiceId={invoiceId} isAdmin={isAdmin} />}

        <div>
          <h2 className="text-xl font-semibold mb-3">Historial de Pagos</h2>
          {invoice.payments_error && (
            <p role="alert" className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              No se pudo cargar el historial de pagos: {invoice.payments_error}
            </p>
          )}

          {payments.length === 0 ? (
            <p className="text-muted">No hay pagos registrados.</p>
          ) : (
            <TableScroll>
            <table className={dt.table}>
              <thead className={dt.thead}>
                <tr>
                  <th className={dt.th}>
                    Fecha
                  </th>
                  <th className={dt.th}>
                    Método
                  </th>
                  <th className={dt.thRight}>
                    Monto
                  </th>
                  <th className={dt.th}>
                    Notas
                  </th>
                  {isAdmin && <th className={dt.th}><span className="sr-only">Acciones</span></th>}
                </tr>
              </thead>

              <tbody className={dt.tbody}>
                {payments.map((p) => (
                  <tr key={p.id} className={`${dt.tr} ${p.voided_at ? "text-muted" : ""}`}>
                    <td className={dt.td}>
                      {fmtDay(p.payment_date)}
                    </td>
                    <td className={dt.td}>{p.method}</td>
                    <td className={`${dt.tdRight} font-medium ${p.voided_at ? "line-through" : ""}`}>
                      {money((p.amount ?? 0))}
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {p.notes || "-"}
                      {p.voided_at && (
                        <div className="text-xs text-red-700">
                          Anulado{p.voided_by_name ? ` por ${p.voided_by_name}` : ""}: {p.void_reason}
                        </div>
                      )}
                      {p.corrects_payment_id != null && (
                        <div className="text-xs text-muted">Corrige el pago #{p.corrects_payment_id}</div>
                      )}
                      {p.corrected_by_payment_id != null && (
                        <div className="text-xs text-muted">Reemplazado por el pago #{p.corrected_by_payment_id}</div>
                      )}
                      <div className="text-xs text-muted">
                        {p.backfilled
                          ? "Registro anterior al control de auditoría"
                          : `Registrado${p.created_by_name ? ` por ${p.created_by_name}` : ""}${p.created_at ? ` el ${fmtDay(p.created_at)}` : ""}`}
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {!p.voided_at && (
                          <div className="flex justify-end gap-2">
                            {showReceiptButton(isAdmin, receiptEnabled, p) && (
                              <Button variant="outline" disabled={receiptBusy === p.id} onClick={() => printReceipt(p)}>
                                Recibo
                              </Button>
                            )}
                            {correctionEnabled && invoice.status !== "Cancelled" && (
                              <Button variant="outline" onClick={() => openCorrection(p)}>Corregir pago</Button>
                            )}
                            <Button variant="outline" onClick={() => { setVoiding(p); setVoidReason(""); }}>
                              Anular pago
                            </Button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </TableScroll>
          )}
        </div>
      </div>

      {voiding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="void-title">
          <div className="w-full max-w-md rounded-lg bg-surface p-6 shadow-card">
            <h2 id="void-title" className="text-lg font-semibold text-ink">Anular pago</h2>
            <p className="mt-1 text-sm text-muted">
              {money(voiding.amount)} del {fmtDay(voiding.payment_date)} ({voiding.method}). El pago queda en el historial como
              anulado y deja de contar en el saldo y los reportes.
            </p>
            <label htmlFor="void-reason" className="mt-4 block text-sm font-medium text-ink">Motivo</label>
            <textarea
              id="void-reason"
              rows={3}
              className="mt-1 w-full rounded border border-line px-3 py-2 text-sm"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setVoiding(null)} disabled={voidBusy}>Cancelar</Button>
              <Button onClick={confirmVoid} disabled={voidBusy}>{voidBusy ? "Anulando…" : "Anular pago"}</Button>
            </div>
          </div>
        </div>
      )}

      {correcting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="corr-title">
          <div className="w-full max-w-md rounded-lg bg-surface p-6 shadow-card">
            <h2 id="corr-title" className="text-lg font-semibold text-ink">Corregir pago</h2>
            <p className="mt-1 text-sm text-muted">
              El pago original ({money(correcting.amount)} del {fmtDay(correcting.payment_date)}) queda anulado en el historial y se
              registra uno nuevo enlazado a él.
            </p>
            {(["amount", "method", "payment_date", "notes", "reason"] as const).map((f) => (
              <div key={f} className="mt-3">
                <label htmlFor={`corr-${f}`} className="block text-sm font-medium text-ink">
                  {{ amount: "Monto", method: "Método", payment_date: "Fecha", notes: "Notas", reason: "Motivo de la corrección" }[f]}
                </label>
                <input
                  id={`corr-${f}`}
                  type={f === "amount" ? "number" : f === "payment_date" ? "date" : "text"}
                  step={f === "amount" ? "0.01" : undefined}
                  className="mt-1 w-full rounded border border-line px-3 py-2 text-sm"
                  value={corr[f]}
                  onChange={(e) => setCorr({ ...corr, [f]: e.target.value })}
                />
              </div>
            ))}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCorrecting(null)} disabled={corrBusy}>Cancelar</Button>
              <Button onClick={confirmCorrection} disabled={corrBusy}>{corrBusy ? "Guardando…" : "Corregir pago"}</Button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <InvoiceDocPreviewModal
          key={preview}
          open
          kind={preview}
          invoiceId={invoiceId}
          invoiceNumber={invoice.invoice_number}
          onClose={() => setPreview(null)}
        />
      )}

      <RecordPaymentModal
        invoiceId={invoiceId}
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        onSuccess={loadInvoice}
      />
    </div>
  );
}
