"use client";

import { es } from "@/lib/i18n/es";
import { usePdfOptions } from "@/lib/pdfOptions";

/**
 * "Mostrar productos en el PDF". Off = the PDFs show the project, charges and totals only.
 * Totals never change. Shown only when the backend switch is on, or when the quote already has it off
 * (so the user can always turn it back on).
 */
export function PrintItemsToggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const { print_items_enabled } = usePdfOptions();
  if (!print_items_enabled && checked) return null;
  return (
    <label className="flex items-start gap-2 text-sm text-ink max-md:min-h-11 max-md:items-center">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 max-md:mt-0 max-md:h-6 max-md:w-6"
        data-testid="print-items-toggle"
      />
      <span>
        {es.pdf.mostrarProductos}
        <span className="block text-xs text-muted">{es.pdf.mostrarProductosAyuda}</span>
      </span>
    </label>
  );
}
