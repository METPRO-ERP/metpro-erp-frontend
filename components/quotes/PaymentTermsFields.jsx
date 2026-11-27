import { useState } from "react";
import { es } from "@/lib/i18n/es";
import { PRESETS, CUSTOM, NO_PRESET, CREDIT_DAYS_MAX, parseDays, presetKey } from "@/lib/paymentDue";

/**
 * B2 days control. Rendered only when PAYMENT_DUE_ENABLED is on (the caller decides).
 * value is the days as a string ("" = no structured term). The free payment_terms text stays a separate field.
 */
export default function PaymentTermsFields({ value, onChange, inputClass = "w-full border p-2 rounded", disabled = false }) {
  const days = parseDays(value);
  const [forceCustom, setForceCustom] = useState(false);
  const key = forceCustom ? CUSTOM : presetKey(days);

  function onPreset(e) {
    const k = e.target.value;
    if (k === CUSTOM) {
      setForceCustom(true);
      return;
    }
    setForceCustom(false);
    if (k === NO_PRESET) onChange("");
    else onChange(k);
  }

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-2" htmlFor="plazo-pago">{es.vencimiento.plazo}</label>
      <select
        id="plazo-pago"
        aria-label={es.vencimiento.plazo}
        value={key}
        onChange={onPreset}
        className={inputClass}
        disabled={disabled}
      >
        <option value={NO_PRESET}>{es.vencimiento.sinPlazo}</option>
        {PRESETS.map((p) => (
          <option key={p.key} value={p.key}>{p.label}</option>
        ))}
        <option value={CUSTOM}>{es.vencimiento.personalizado}</option>
      </select>
      {key === CUSTOM && (
        <div className="mt-2">
          <label className="block text-sm font-medium mb-1" htmlFor="plazo-dias">{es.vencimiento.dias}</label>
          <input
            id="plazo-dias"
            aria-label={es.vencimiento.dias}
            type="number"
            inputMode="numeric"
            min={0}
            max={CREDIT_DAYS_MAX}
            step={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
        disabled={disabled}
          />
          <p className="text-xs text-muted mt-1">{es.vencimiento.diasAyuda}</p>
        </div>
      )}
    </div>
  );
}
