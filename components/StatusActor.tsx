"use client";

import { useState } from "react";
import { es } from "@/lib/i18n/es";
import { lastChangeText, type HistoryKind } from "@/lib/statusHistory";
import StatusHistoryModal from "@/components/StatusHistoryModal";
import { Button } from "@/components/ui/button";

interface Props {
  kind: HistoryKind;
  id: string | number;
  createdBy?: string | null;
  lastBy?: string | null;
  lastAt?: string | null;
}

/**
 * Line under the status pill. With history: "por Ana · 23/10/2026 12:05" and a click opens the full history.
 * Without it (switch off, or a record from before the switch): the old "Creado por <name>" text, unchanged.
 */
export default function StatusActor({ kind, id, createdBy, lastBy, lastAt }: Props) {
  const [open, setOpen] = useState(false);
  const text = lastChangeText(lastBy, lastAt);
  if (!text) {
    return <div className="text-xs text-muted mt-1">{es.cot.creadoPor} {createdBy || "—"}</div>;
  }
  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        title={es.historial.verHistorial}
        variant="ghost" size="sm" className="mt-1 text-left text-accent hover:bg-accent/10 hover:text-accent-strong"
      >
        {text}
      </Button>
      {open && <StatusHistoryModal kind={kind} id={id} onClose={() => setOpen(false)} />}
    </>
  );
}
