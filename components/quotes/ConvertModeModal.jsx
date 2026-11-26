'use client'
import { es } from "@/lib/i18n/es";

const t = es.facturacion.modo

/** Shown on Convertir only when the phased-invoicing and NCF switches are on. Two choices, nothing else. */
export default function ConvertModeModal({ quoteLabel, onFull, onPhased, onCancel }) {
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4' role='dialog' aria-modal='true' aria-label={t.titulo}>
      <div className='w-full max-w-md rounded-lg bg-surface p-6 shadow-xl'>
        <h2 className='text-lg font-semibold text-ink'>{t.titulo}</h2>
        <p className='mt-1 text-sm text-muted'>{quoteLabel}</p>
        <p className='mt-3 text-sm text-ink'>{t.descripcion}</p>
        <div className='mt-5 flex flex-col gap-2'>
          <button onClick={onFull} className='rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong'>
            {t.completa}
          </button>
          <button onClick={onPhased} className='rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-canvas'>
            {t.fases}
          </button>
          <button onClick={onCancel} className='px-4 py-2 text-sm text-muted hover:text-ink'>
            {es.comun.cancelar}
          </button>
        </div>
      </div>
    </div>
  )
}
