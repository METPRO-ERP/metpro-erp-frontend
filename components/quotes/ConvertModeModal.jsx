'use client'
import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";

const t = es.facturacion.modo

/** Shown on Convertir only when the phased-invoicing and NCF switches are on. Two choices, nothing else. */
export default function ConvertModeModal({ quoteLabel, onFull, onPhased, onCancel }) {
  return (
    <ModalShell
      title={t.titulo}
      subtitle={quoteLabel}
      footerLayout='stack'
      footer={
        <>
          <Button onClick={onFull} variant='default'>
            {t.completa}
          </Button>
          <Button onClick={onPhased} variant='outline'>
            {t.fases}
          </Button>
          <Button onClick={onCancel} variant='ghost' size='sm'>
            {es.comun.cancelar}
          </Button>
        </>
      }
    >
      <p className='text-sm text-ink'>{t.descripcion}</p>
    </ModalShell>
  )
}
