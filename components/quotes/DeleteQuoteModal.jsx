import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
export default function DeleteQuoteModal({ isOpen, onClose, onConfirm, quoteId, quoteLabel, quoteStatus }) {
  if (!isOpen) return null

  const isInvoiced = quoteStatus === 'Invoiced'

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'>
      <div className='bg-surface rounded-lg shadow-card max-w-md w-full'>
        <div className='p-6'>
          <div className='flex items-center gap-3 mb-4'>
            <h3 className='text-xl font-bold text-ink'>{es.cot.eliminarTitulo}</h3>
          </div>

          {isInvoiced ? (
            <div className='mb-6'>
              <p className='text-red-600 font-medium mb-2'>
                {es.cot.eliminarConFactura}
              </p>
              <p className='text-ink'>
                {es.cot.eliminarConFacturaAviso}
              </p>
            </div>
          ) : (
            <div className='mb-6'>
              <p className='text-ink'>
                {es.cot.confirmarEliminarCot} <span className='font-bold'>{quoteLabel || quoteId}</span>?
              </p>
              <p className='text-muted text-sm mt-2'>
                {es.cot.eliminarAviso}
              </p>
            </div>
          )}

          <div className='flex gap-3 justify-end'>
            <Button
              onClick={onClose}
              variant='outline'
            >
              {es.cot.cancelar}
            </Button>
            <Button
              onClick={onConfirm}
              variant='destructive'
            >
              {es.cot.eliminar}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
