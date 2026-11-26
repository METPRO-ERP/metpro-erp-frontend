'use client'
import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";

const t = es.facturacion.modo

/** Shown on Convertir only when the phased-invoicing and NCF switches are on. Two choices, nothing else. */
export default function ConvertModeModal({ quoteLabel, onFull, onPhased, onCancel }) {
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4' role='dialog' aria-modal='true' aria-label={t.titulo}>
      <div className='w-full max-w-md rounded-lg bg-surface p-6 shadow-xl'>
        <h2 className='text-lg font-semibold text-ink'>{t.titulo}</h2>
        <p className='mt-1 text-sm text-muted'>{quoteLabel}</p>
        <p className='mt-3 text-sm text-ink'>{t.descripcion}</p>
        <div className='mt-5 flex flex-col gap-4'>
          <Button onClick={onFull} variant='default'>
            {t.completa}
          </Button>
          <Button onClick={onPhased} variant='outline'>
            {t.fases}
          </Button>
          <Button onClick={onCancel} variant='ghost' size='sm'>
            {es.comun.cancelar}
          </Button>
        </div>
      </div>
    </div>
  )
}
