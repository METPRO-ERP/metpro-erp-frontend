"use client";

import * as React from "react";
import Link from "next/link";

import { fmtDay } from "@/lib/dates";
import { money } from "@/lib/money";
import { dt } from "@/components/ui/data-table";
import { Chip } from "@/components/ui/chip";
import { ResponsiveList, ListCard } from "@/components/ui/responsive-list";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { cn } from "@/lib/utils";
import {
  BUCKET_LABEL, TONE_CLASS, daysLabel, fetchOverdue, pastDueTone, type OverdueReport, type OverdueRow,
} from "@/lib/overdue";

/** The strip and both lists, from a report. Pure render: no fetching, no state (tested by static markup). */
export function OverdueReportView({ report }: { report: OverdueReport }) {
  const { overdue, sin_plazo } = report;
  return (
    <div className="space-y-8">
      <section aria-labelledby="od-ageing">
        <h2 id="od-ageing" className="text-base font-semibold text-ink">Vencidas por fecha</h2>
        <p className="mt-1 text-sm text-muted">
          {overdue.count === 0
            ? "No hay facturas vencidas por fecha."
            : `${overdue.count} ${overdue.count === 1 ? "factura" : "facturas"} · ${money(overdue.amount_due)} pendiente`}
          {report.as_of ? ` · al ${fmtDay(report.as_of)}` : ""}
        </p>
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="ageing-strip">
          {overdue.buckets.map((b) => (
            <li key={b.key} className="rounded-lg border border-line bg-surface p-3 shadow-card">
              <div className="text-xs text-muted">{b.label}</div>
              <div className="mt-1 text-sm font-semibold tabular-nums text-ink sm:text-lg">{money(b.amount_due)}</div>
              <div className="text-xs text-muted">{b.count} {b.count === 1 ? "factura" : "facturas"}</div>
            </li>
          ))}
        </ul>

        {overdue.rows.length > 0 && (
          <div className="mt-4" data-testid="overdue-list">
            <ResponsiveList
              items={overdue.rows}
              getKey={(r: OverdueRow) => r.id}
              renderCard={(r: OverdueRow) => (
                <ListCard
                  title={<InvoiceLink row={r} />}
                  chip={<DaysChip days={r.days_past_due} />}
                  subtitle={r.client_name}
                  fields={[
                    { label: "Vence", value: fmtDay(r.due_date) },
                    { label: "Rango", value: r.bucket ? BUCKET_LABEL[r.bucket] : "—" },
                    { label: "Pendiente", value: money(r.amount_due), numeric: true, wide: true },
                  ]}
                />
              )}
            >
              <table className={dt.table}>
                <thead className={dt.thead}>
                  <tr>
                    <th className={dt.th}>Factura #</th>
                    <th className={dt.th}>Cliente</th>
                    <th className={dt.th}>Vence</th>
                    <th className={dt.th}>Vencida</th>
                    <th className={dt.th}>Rango</th>
                    <th className={dt.thRight}>Pendiente</th>
                  </tr>
                </thead>
                <tbody className={dt.tbody}>
                  {overdue.rows.map((r) => (
                    <tr key={r.id} className={dt.tr}>
                      <td className={dt.td}><InvoiceLink row={r} /></td>
                      <td className={dt.tdTrunc} title={r.client_name}>{r.client_name}</td>
                      <td className={dt.td}>{fmtDay(r.due_date)}</td>
                      <td className={dt.td}><DaysChip days={r.days_past_due} /></td>
                      <td className={dt.td}>{r.bucket ? BUCKET_LABEL[r.bucket] : "—"}</td>
                      <td className={dt.tdRight}>{money(r.amount_due)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveList>
          </div>
        )}
      </section>

      <section aria-labelledby="od-sin-plazo" className="border-t border-line pt-6" data-testid="sin-plazo">
        <h2 id="od-sin-plazo" className="text-base font-semibold text-ink">Sin plazo</h2>
        <p className="mt-1 text-sm text-muted">
          Facturas abiertas sin fecha de vencimiento. No cuentan como vencidas: el plazo se fija desde el detalle de cada factura.
          {sin_plazo.count > 0 ? ` ${sin_plazo.count} ${sin_plazo.count === 1 ? "factura" : "facturas"} · ${money(sin_plazo.amount_due)} pendiente.` : ""}
        </p>
        {sin_plazo.rows.length === 0 ? (
          <p className={dt.empty}>No hay facturas abiertas sin plazo.</p>
        ) : (
          <div className="mt-3">
            <ResponsiveList
              items={sin_plazo.rows}
              getKey={(r: OverdueRow) => r.id}
              renderCard={(r: OverdueRow) => (
                <ListCard
                  title={<InvoiceLink row={r} />}
                  chip={r.marked_overdue ? <MarkedChip /> : undefined}
                  subtitle={r.client_name}
                  fields={[
                    { label: "Emitida", value: fmtDay(r.invoice_date) },
                    { label: "Desde la emisión", value: daysLabel(r.days_since_issue) },
                    { label: "Pendiente", value: money(r.amount_due), numeric: true, wide: true },
                  ]}
                />
              )}
            >
              <table className={dt.table}>
                <thead className={dt.thead}>
                  <tr>
                    <th className={dt.th}>Factura #</th>
                    <th className={dt.th}>Cliente</th>
                    <th className={dt.th}>Emitida</th>
                    <th className={dt.th}>Desde la emisión</th>
                    <th className={dt.th}>Nota</th>
                    <th className={dt.thRight}>Pendiente</th>
                  </tr>
                </thead>
                <tbody className={dt.tbody}>
                  {sin_plazo.rows.map((r) => (
                    <tr key={r.id} className={dt.tr}>
                      <td className={dt.td}><InvoiceLink row={r} /></td>
                      <td className={dt.tdTrunc} title={r.client_name}>{r.client_name}</td>
                      <td className={dt.td}>{fmtDay(r.invoice_date)}</td>
                      <td className={dt.td}>{daysLabel(r.days_since_issue)}</td>
                      <td className={dt.td}>{r.marked_overdue ? <MarkedChip /> : null}</td>
                      <td className={dt.tdRight}>{money(r.amount_due)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveList>
          </div>
        )}
      </section>
    </div>
  );
}

function InvoiceLink({ row }: { row: OverdueRow }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Link href={`/invoices/${row.id}`} className={dt.link} title="Ver detalle y pagos">
        {row.invoice_number}
      </Link>
      {row.is_phase ? <Chip>Fase</Chip> : null}
    </span>
  );
}

function DaysChip({ days }: { days: number | null }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset", TONE_CLASS[pastDueTone(days)])}>
      {daysLabel(days)}
    </span>
  );
}

function MarkedChip() {
  return <Chip>Marcada vencida</Chip>;
}

/** Fetches the report when mounted. Loading and error states; the lists never block the rest of the page. */
export default function OverdueView() {
  const [report, setReport] = React.useState<OverdueReport | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchOverdue()
      .then((r) => { if (!cancelled) setReport(r); })
      .catch((e: Error) => { if (!cancelled) setError(`No se pudo cargar la vista de vencidas: ${e.message}`); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!report) return <p className="py-10 text-center text-sm text-muted">Cargando vencidas...</p>;
  return <OverdueReportView report={report} />;
}
