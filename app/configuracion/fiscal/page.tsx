"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { es } from "@/lib/i18n/es";
import { useCurrentRole } from "@/lib/currentRole";
import {
  activateFiscalBatch,
  correctFiscalBatch,
  getFiscalStatus,
  type FiscalBatchInput,
  type FiscalPreview,
  type FiscalStatus,
} from "@/lib/billingApi";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

const t = es.fiscal.ncf;
const inputClass =
  "h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent";

interface Form {
  series: string;
  next_number: string;
  next_number_confirm: string;
  range_start: string;
  range_end: string;
  expiry_date: string;
}

const EMPTY: Form = { series: "B", next_number: "", next_number_confirm: "", range_start: "", range_end: "", expiry_date: "" };

function toInput(f: Form, confirm: boolean): FiscalBatchInput {
  return {
    series: f.series.trim().toUpperCase(),
    next_number: Number(f.next_number),
    next_number_confirm: Number(f.next_number_confirm),
    range_start: Number(f.range_start),
    range_end: Number(f.range_end),
    expiry_date: f.expiry_date,
    confirm,
  };
}

/**
 * Admin only. Status panel and the batch form. The two next_number entries must match, the batch is shown back
 * on a confirmation screen before it goes active, and it can be corrected only until the first NCF is issued.
 * Entering a batch never turns the NCF switch on.
 */
export default function FiscalPage() {
  const { isAdmin, loading: roleLoading } = useCurrentRole();
  const [status, setStatus] = useState<FiscalStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [review, setReview] = useState<FiscalPreview | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus(await getFiscalStatus());
    } catch (e) {
      setError(`${t.errorCargar}: ${(e as Error).message}`);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  if (roleLoading) return <p className="p-6 text-sm text-muted">{es.comun.cargando}</p>;
  if (!isAdmin) {
    return (
      <p role="alert" className="m-6 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {t.soloAdmin}
      </p>
    );
  }
  if (error) return <p role="alert" className="m-6 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  if (!status) return <p className="p-6 text-sm text-muted">{es.comun.cargando}</p>;

  const correcting = status.configured && !status.locked;
  const canEnter = !status.configured || correcting;
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function handleReview(ev: React.FormEvent) {
    ev.preventDefault();
    if (form.next_number !== form.next_number_confirm) {
      toast.error(t.noCoinciden);
      return;
    }
    setBusy(true);
    try {
      const call = correcting ? correctFiscalBatch : activateFiscalBatch;
      setReview(await call(toInput(form, false)));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    setBusy(true);
    try {
      const call = correcting ? correctFiscalBatch : activateFiscalBatch;
      await call(toInput(form, true));
      toast.success(correcting ? t.corregido : t.activado);
      setReview(null);
      setForm(EMPTY);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title={t.titulo} subtitle={t.subtitulo} />

      <p role="status" className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        {status.ncf_enabled ? t.interruptorEncendido : t.interruptorApagado}
      </p>
      {status.warn_expiry && <p role="alert" className="mb-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{t.aviso.vence}</p>}
      {status.warn_exhaustion && <p role="alert" className="mb-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{t.aviso.agota}</p>}

      <section className="mb-6 rounded-lg border border-line bg-surface p-4 shadow-card">
        {!status.configured ? (
          <p className="text-sm text-muted">{t.sinConfigurar}</p>
        ) : (
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-muted">{t.serie}</dt><dd className="font-medium text-ink">{status.series}</dd></div>
            <div><dt className="text-muted">{t.siguienteNcf}</dt><dd className="font-medium text-ink">{status.next_ncf}</dd></div>
            <div><dt className="text-muted">{t.estado}</dt><dd className="font-medium text-ink">{t.estados[status.state]}</dd></div>
            <div><dt className="text-muted">{t.desde}</dt><dd className="text-ink">{status.range_start}</dd></div>
            <div><dt className="text-muted">{t.hasta}</dt><dd className="text-ink">{status.range_end}</dd></div>
            <div><dt className="text-muted">{t.restantes}</dt><dd className="text-ink">{status.remaining}</dd></div>
            <div><dt className="text-muted">{t.vence}</dt><dd className="text-ink">{status.expiry_date}</dd></div>
            <div><dt className="text-muted">{t.diasParaVencer}</dt><dd className="text-ink">{status.days_to_expiry}</dd></div>
          </dl>
        )}
        {status.configured && status.locked && <p className="mt-3 text-sm text-ink">{t.bloqueado}</p>}
      </section>

      {canEnter && !review && (
        <form onSubmit={handleReview} className="rounded-lg border border-line bg-surface p-4 shadow-card">
          <h2 className="mb-1 text-base font-semibold text-ink">{correcting ? t.corregir : t.activar}</h2>
          {correcting && <p className="mb-3 text-sm text-muted">{t.corregirAviso}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm"><span className="text-muted">{t.serie}</span>
              <input className={inputClass} value={form.series} onChange={set("series")} maxLength={1} required /></label>
            <label className="text-sm"><span className="text-muted">{t.vencimiento}</span>
              <input className={inputClass} type="date" value={form.expiry_date} onChange={set("expiry_date")} required /></label>
            <label className="text-sm"><span className="text-muted">{t.desde}</span>
              <input className={inputClass} type="number" min={1} value={form.range_start} onChange={set("range_start")} required /></label>
            <label className="text-sm"><span className="text-muted">{t.hasta}</span>
              <input className={inputClass} type="number" min={1} value={form.range_end} onChange={set("range_end")} required /></label>
            <label className="text-sm"><span className="text-muted">{t.proximo}</span>
              <input className={inputClass} type="number" min={1} value={form.next_number} onChange={set("next_number")} required /></label>
            <label className="text-sm"><span className="text-muted">{t.proximoConfirmar}</span>
              <input className={inputClass} type="number" min={1} value={form.next_number_confirm} onChange={set("next_number_confirm")} required /></label>
          </div>
          <div className="mt-4">
            <Button type="submit" disabled={busy}>{t.revisar}</Button>
          </div>
        </form>
      )}

      {canEnter && review && (
        <section className="rounded-lg border border-line bg-surface p-4 shadow-card">
          <h2 className="mb-1 text-base font-semibold text-ink">{t.confirmarTitulo}</h2>
          <p className="mb-3 text-sm text-amber-900">{t.confirmarAviso}</p>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-muted">{t.serie}</dt><dd className="font-medium text-ink">{review.batch.series}</dd></div>
            <div><dt className="text-muted">{t.siguienteNcf}</dt><dd className="font-medium text-ink">{review.batch.next_ncf}</dd></div>
            <div><dt className="text-muted">{t.ultimoNcf}</dt><dd className="font-medium text-ink">{review.batch.last_ncf}</dd></div>
            <div><dt className="text-muted">{t.desde}</dt><dd className="text-ink">{review.batch.range_start}</dd></div>
            <div><dt className="text-muted">{t.hasta}</dt><dd className="text-ink">{review.batch.range_end}</dd></div>
            <div><dt className="text-muted">{t.cantidad}</dt><dd className="text-ink">{review.batch.quantity}</dd></div>
            <div><dt className="text-muted">{t.vencimiento}</dt><dd className="text-ink">{review.batch.expiry_date}</dd></div>
          </dl>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleConfirm} disabled={busy}>{t.confirmar}</Button>
            <Button variant="outline" onClick={() => setReview(null)} disabled={busy}>{t.volver}</Button>
          </div>
        </section>
      )}
    </div>
  );
}
