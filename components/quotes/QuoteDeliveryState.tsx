"use client";

import { useEffect, useState } from "react";
import { es } from "@/lib/i18n/es";
import { getConduceOptions, getQuoteDelivery } from "@/lib/conduceApi";
import DeliveryPill from "@/components/quotes/DeliveryPill";

/** "Entrega: <pill>" on the quote view. Renders nothing when the switch is off or any call fails (fail-closed). */
export default function QuoteDeliveryState({ quoteId }: { quoteId: string }) {
  const [state, setState] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const o = await getConduceOptions();
      if (!o.enabled) return;
      try {
        const v = await getQuoteDelivery(quoteId);
        if (active) setState(v.state);
      } catch {
        /* hidden on failure */
      }
    })();
    return () => {
      active = false;
    };
  }, [quoteId]);

  if (!state) return null;
  return (
    <div className="print:hidden">
      <span className="font-semibold">{es.cond.entregaPill}:</span> <DeliveryPill state={state} />
    </div>
  );
}
