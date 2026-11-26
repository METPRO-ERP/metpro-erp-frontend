"use client";

import { useEffect, useState } from "react";
import { es } from "@/lib/i18n/es";
import { getPhaseOptions, getPhases, type PhasesView } from "@/lib/billingApi";

const t = es.facturacion.fases;
const money = (n: number) => n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Project view: the phased-invoicing aggregate of the project's quote (plan 3.5).
 * Renders nothing unless PHASED_INVOICING_ENABLED is on and the quote is in phased mode. Fails closed.
 */
export default function PhaseAggregateBlock({ quoteId }: { quoteId: string }) {
  const [view, setView] = useState<PhasesView | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const opts = await getPhaseOptions();
      if (!opts.phased_enabled) return;
      try {
        const v = await getPhases(quoteId);
        if (active && v.billing_mode === "PHASED") setView(v);
      } catch {
        // not an admin, or the quote cannot be read: show nothing
      }
    })();
    return () => {
      active = false;
    };
  }, [quoteId]);

  if (!view) return null;
  const a = view.aggregate;
  return (
    <div className="sm:col-span-2">
      <dt className="text-muted">{t.titulo}</dt>
      <dd>
        <dl className="mt-1 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
          <div><dt className="text-muted">{t.total}</dt><dd className="font-medium">{money(a.total)}</dd></div>
          <div><dt className="text-muted">{t.facturado}</dt><dd className="font-medium">{money(a.invoiced_to_date)}</dd></div>
          <div><dt className="text-muted">{t.pagado}</dt><dd className="font-medium">{money(a.paid_to_date)}</dd></div>
          <div><dt className="text-muted">{t.porFacturar}</dt><dd className="font-medium">{money(a.pending_to_invoice)}</dd></div>
          <div><dt className="text-muted">{t.porCobrar}</dt><dd className="font-medium">{money(a.pending_to_pay)}</dd></div>
        </dl>
      </dd>
    </div>
  );
}
