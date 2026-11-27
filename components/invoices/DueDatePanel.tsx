"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { fmtDay } from "@/lib/dates";
import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import {
  fetchDueDateAudit,
  updateInvoiceDueDate,
  usePaymentDueEnabled,
  type DueDateAuditRow,
} from "@/lib/paymentDue";

/**
 * B2: the invoice due date (a stored snapshot) and the admin-only edit.
 * Hidden with the switch off. The backend refuses non-admins and edits without a note; this only mirrors it.
 */
export default function DueDatePanel({
  invoiceId,
  dueDate,
  isAdmin,
  onChanged,
}: {
  invoiceId: number;
  dueDate: string | null | undefined;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const enabled = usePaymentDueEnabled();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [history, setHistory] = useState<DueDateAuditRow[] | null>(null);

  if (!enabled) return null;
  if (!dueDate && !isAdmin) return null;

  function openEditor() {
    setDate(dueDate ? dueDate.slice(0, 10) : "");
    setNote("");
    setErr(null);
    setOpen(true);
  }

  async function save() {
    if (!date) return;
    if (!note.trim()) {
      setErr(es.vencimiento.notaRequerida);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await updateInvoiceDueDate(invoiceId, date, note);
      setOpen(false);
      setHistory(null);
      toast.success(es.vencimiento.etiqueta);
      onChanged();
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : es.vencimiento.errorGuardar);
    } finally {
      setBusy(false);
    }
  }

  async function toggleHistory() {
    if (history) {
      setHistory(null);
      return;
    }
    try {
      setHistory(await fetchDueDateAudit(invoiceId));
    } catch {
      setHistory([]);
    }
  }

  return (
    <div>
      <p className="text-muted">{es.vencimiento.etiqueta}</p>
      <p className="font-medium">{dueDate ? fmtDay(dueDate) : "—"}</p>
      {isAdmin ? (
        <div className="mt-1 flex flex-wrap gap-2">
          <Button variant="outline" onClick={openEditor}>{es.vencimiento.editar}</Button>
          <Button variant="outline" onClick={toggleHistory}>{es.vencimiento.historial}</Button>
        </div>
      ) : null}
      {history ? (
        <ul className="mt-2 space-y-1 text-xs text-muted">
          {history.length === 0 ? <li>{es.vencimiento.sinHistorial}</li> : null}
          {history.map((h) => (
            <li key={h.id}>
              {h.old_due_date ? fmtDay(h.old_due_date) : "—"} → {fmtDay(h.new_due_date)} · {h.note}
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <ModalShell
          title={es.vencimiento.editar}
          footer={
            <>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>{es.vencimiento.cancelar}</Button>
              <Button onClick={save} disabled={busy || !date}>{es.vencimiento.guardar}</Button>
            </>
          }
        >
          <label htmlFor="due-date-new" className="block text-sm font-medium text-ink">{es.vencimiento.nuevaFecha}</label>
          <input
            id="due-date-new"
            type="date"
            className="mt-1 w-full rounded border border-line px-3 py-2 text-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <label htmlFor="due-date-note" className="mt-3 block text-sm font-medium text-ink">{es.vencimiento.nota}</label>
          <textarea
            id="due-date-note"
            rows={3}
            maxLength={500}
            className="mt-1 w-full rounded border border-line px-3 py-2 text-sm"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {err ? <p className="mt-2 text-sm text-red-700" role="alert">{err}</p> : null}
        </ModalShell>
      ) : null}
    </div>
  );
}
