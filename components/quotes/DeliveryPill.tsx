"use client";

import { stateLabel, stateTone } from "@/lib/conduceApi";

const TONES = {
  neutral: "bg-canvas text-muted ring-line",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
} as const;

/** Read-only delivery state. The state comes from the ledger only. */
export default function DeliveryPill({ state }: { state: string | null | undefined }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[stateTone(state)]}`}>
      {stateLabel(state)}
    </span>
  );
}
