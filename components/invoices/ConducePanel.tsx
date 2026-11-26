"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { es } from "@/lib/i18n/es";
import { fmtDay } from "@/lib/dates";
import {
  buildLines,
  conduceErrorText,
  createConduce,
  defaultEntries,
  fetchConducePdf,
  fmtQty,
  getInvoiceDelivery,
  stateLabel,
  voidConduce,
  type ConduceRow,
  type DeliveryView,
} from "@/lib/conduceApi";
import { saveBlob } from "@/lib/invoiceDocs";
import DeliveryPill from "@/components/quotes/DeliveryPill";

const c = es.cond;
const inputCls = "w-full rounded border border-line bg-surface p-2 text-sm text-ink";

function todayLocal(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function PdfModal({ row, onClose }: { row: ConduceRow; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    fetchConducePdf(row.id)
      .then((b) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(b);
        setBlob(b);
        setUrl(objectUrl);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [row.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${c.pdfTitulo} ${row.conduce_number}`}
      onClick={onClose}
    >
      <div
        className="flex h-full max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold text-ink">
            {c.pdfTitulo} · {row.conduce_number}
          </h2>
          <div className="flex items-center gap-2">
            <Button onClick={() => blob && saveBlob(blob, `${row.conduce_number}_conduce.pdf`)} disabled={!blob}>
              {c.descargar}
            </Button>
            <Button variant="outline" onClick={onClose}>
              {c.cerrar}
            </Button>
          </div>
        </div>
        <div className="flex-1 bg-canvas">
          {!url && !error && <p className="p-6 text-sm text-muted">{c.generando}</p>}
          {error && (
            <p role="alert" className="m-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {url && <iframe title={`${c.pdfTitulo} ${row.conduce_number}`} src={url} className="h-full w-full border-0" />}
        </div>
      </div>
    </div>
  );
}

interface Props {
  invoiceId: number;
  isAdmin: boolean;
}

/** Delivery ledger for the invoice's quote. Shown only when CONDUCE_LEDGER_ENABLED is on (the page checks the options). */
export default function ConducePanel({ invoiceId, isAdmin }: Props) {
  const [view, setView] = useState<DeliveryView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [entries, setEntries] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [date, setDate] = useState(todayLocal());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [pdfRow, setPdfRow] = useState<ConduceRow | null>(null);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setView(await getInvoiceDelivery(invoiceId));
      setLoadError(null);
    } catch (e) {
      setLoadError(conduceErrorText(e) || c.errCarga);
    }
  }, [invoiceId]);

  useEffect(() => {
    load();
  }, [load]);

  const openForm = () => {
    setEntries(defaultEntries(view?.lines ?? []));
    setErrors({});
    setFormError(null);
    setDate(todayLocal());
    setNotes("");
    setCreating(true);
  };

  const submit = async () => {
    if (!view || saving) return;
    const built = buildLines(view.lines, entries);
    if (!built.ok) {
      setErrors(built.errors);
      setFormError(built.empty ? c.sinLineas : null);
      return;
    }
    setErrors({});
    setFormError(null);
    setSaving(true);
    try {
      const res = (await createConduce({
        invoice_id: invoiceId,
        delivery_date: date || undefined,
        notes: notes.trim() || undefined,
        lines: built.lines,
      })) as { conduce_number?: string } | null;
      toast.success(c.creado(res?.conduce_number ?? ""));
      setCreating(false);
      await load();
    } catch (e) {
      setFormError(conduceErrorText(e));
      await load(); // pending may have changed under us
    } finally {
      setSaving(false);
    }
  };

  const confirmVoid = async () => {
    if (!voidId) return;
    if (!voidReason.trim()) {
      setVoidError(es.cond.errores.CONDUCE_VOID_REASON_REQUIRED);
      return;
    }
    try {
      await voidConduce(voidId, voidReason.trim());
      toast.success(c.anulado_ok);
      setVoidId(null);
      setVoidReason("");
      setVoidError(null);
      await load();
    } catch (e) {
      setVoidError(conduceErrorText(e));
    }
  };

  if (loadError && !view) {
    return (
      <div className="mb-6 rounded-lg bg-canvas p-4">
        <p role="alert" className="text-sm text-red-700">{loadError}</p>
      </div>
    );
  }
  if (!view) {
    return <div className="mb-6 rounded-lg bg-canvas p-4 text-sm text-muted">{c.cargando}</div>;
  }

  const cancelled = view.invoice_status === "Cancelled";
  const hasLines = view.lines.length > 0;
  const hasPending = view.lines.some((l) => l.pending > 0);
  const active = (view.conduces ?? []).filter((r) => !r.voided).length;

  return (
    <section className="mb-6 rounded-lg bg-canvas p-4" aria-labelledby="conduce-title">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 id="conduce-title" className="text-xl font-semibold">{c.titulo}</h2>
        <DeliveryPill state={view.state} />
      </div>
      <p className="mb-4 text-sm text-muted">{c.ayuda}</p>

      {!hasLines && <p className="text-sm text-muted">{c.sinEntregables}</p>}

      {hasLines && (
        <ul className="mb-4 space-y-2" aria-label={c.estado}>
          {view.lines.map((l) => (
            <li key={l.quote_item_id} className="rounded border border-line bg-surface p-3">
              <p className="text-sm font-medium text-ink break-words">{l.product_name}</p>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-muted">{c.cotizado}</dt>
                  <dd className="text-sm text-ink">{fmtQty(l.quoted)} {l.unit_of_measure ?? ""}</dd>
                </div>
                <div>
                  <dt className="text-muted">{c.entregado}</dt>
                  <dd className="text-sm text-ink">{fmtQty(l.delivered)}</dd>
                </div>
                <div>
                  <dt className="text-muted">{c.pendiente}</dt>
                  <dd className="text-sm font-semibold text-ink">{fmtQty(l.pending)}</dd>
                </div>
              </dl>
              {creating && l.pending > 0 && (
                <div className="mt-3">
                  <label className="mb-1 block text-xs text-muted" htmlFor={`q-${l.quote_item_id}`}>
                    {c.estaEntrega}
                  </label>
                  <input
                    id={`q-${l.quote_item_id}`}
                    inputMode="decimal"
                    className={inputCls}
                    value={entries[l.quote_item_id] ?? ""}
                    onChange={(e) => setEntries((p) => ({ ...p, [l.quote_item_id]: e.target.value }))}
                    aria-invalid={!!errors[l.quote_item_id]}
                    aria-describedby={errors[l.quote_item_id] ? `qe-${l.quote_item_id}` : undefined}
                  />
                  {errors[l.quote_item_id] && (
                    <p id={`qe-${l.quote_item_id}`} role="alert" className="mt-1 text-xs text-red-700">
                      {errors[l.quote_item_id]}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {hasLines && cancelled && <p className="mb-4 text-sm text-amber-700">{c.facturaCancelada}</p>}
      {hasLines && !cancelled && !hasPending && !creating && <p className="mb-4 text-sm text-muted">{c.todoEntregado}</p>}

      {hasLines && !cancelled && hasPending && !creating && (
        <Button onClick={openForm}>{c.nuevaEntrega}</Button>
      )}

      {creating && (
        <div className="mb-4 space-y-3 rounded border border-line bg-surface p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted" htmlFor="cond-date">{c.fecha}</label>
              <input id="cond-date" type="date" className={inputCls} value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted" htmlFor="cond-notes">{c.notas}</label>
              <input id="cond-notes" className={inputCls} value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          {formError && (
            <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700 whitespace-pre-line">
              {formError}
            </p>
          )}
          <p className="text-xs text-muted">{c.resumen(Object.values(entries).filter((v) => v.trim() !== "").length)}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={submit} disabled={saving}>{saving ? c.creando : c.crear}</Button>
            <Button variant="outline" onClick={() => setEntries(defaultEntries(view.lines))} disabled={saving}>
              {c.entregarPendiente}
            </Button>
            <Button variant="outline" onClick={() => setCreating(false)} disabled={saving}>{c.cancelar}</Button>
          </div>
        </div>
      )}

      <h3 className="mb-2 mt-2 text-sm font-semibold text-ink">{c.historial}</h3>
      {view.conduces.length === 0 && view.legacy_conduces.length === 0 && (
        <p className="text-sm text-muted">{c.sinConduces}</p>
      )}
      <ul className="space-y-2">
        {view.conduces.map((r) => (
          <li key={r.id} className="rounded border border-line bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-ink">
                {r.conduce_number}
                {r.voided && (
                  <span className="ml-2 rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
                    {c.anulado}
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPdfRow(r)}>{c.verPdf}</Button>
                {isAdmin && !r.voided && (
                  <Button variant="outline" onClick={() => { setVoidId(r.id); setVoidReason(""); setVoidError(null); }}>
                    {c.anular}
                  </Button>
                )}
              </div>
            </div>
            <p className="mt-1 text-xs text-muted">
              {r.delivery_date ? fmtDay(r.delivery_date) : "—"} · {c.lineasN(r.line_count)}
              {r.created_by ? ` · ${r.created_by}` : ""}
            </p>
            {r.notes && <p className="mt-1 text-xs text-muted break-words">{r.notes}</p>}
            {r.voided && r.void_reason && <p className="mt-1 text-xs text-red-700 break-words">{r.void_reason}</p>}
            {voidId === r.id && (
              <div className="mt-3 space-y-2">
                <label className="block text-xs text-muted" htmlFor={`void-${r.id}`}>{c.motivo}</label>
                <input id={`void-${r.id}`} className={inputCls} value={voidReason} maxLength={300} onChange={(e) => setVoidReason(e.target.value)} />
                {voidError && <p role="alert" className="text-xs text-red-700">{voidError}</p>}
                <div className="flex gap-2">
                  <Button onClick={confirmVoid}>{c.confirmarAnular}</Button>
                  <Button variant="outline" onClick={() => setVoidId(null)}>{c.cancelar}</Button>
                </div>
              </div>
            )}
          </li>
        ))}
        {view.legacy_conduces.map((r) => (
          <li key={r.conduce_number} className="rounded border border-dashed border-line bg-surface p-3">
            <p className="text-sm text-ink">{r.conduce_number}</p>
            <p className="mt-1 text-xs text-muted">{c.registroAnterior}</p>
          </li>
        ))}
      </ul>
      {active > 0 && <span className="sr-only">{stateLabel(view.state)}</span>}

      {pdfRow && <PdfModal row={pdfRow} onClose={() => setPdfRow(null)} />}
    </section>
  );
}
