import { es } from "@/lib/i18n/es";
import SealCheckbox from "@/components/SealCheckbox";
import { Button } from "@/components/ui/button";

// sealAvailable: a company seal exists. printSeal / onSealChange: the per-document choice for this preview.
export default function PDFPreviewModal({ isOpen, onClose, quoteId, quoteLabel, pdfUrl, sealAvailable = false, printSeal = false, onSealChange }) {
  if (!isOpen) return null

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'>
      <div className='bg-surface rounded-lg shadow-card w-full max-w-6xl h-[90vh] flex flex-col'>
        <div className='flex items-center justify-between p-4 border-b'>
          <h3 className='text-xl font-bold text-ink'>
            {es.cot.vistaPreviaCot} {quoteLabel || quoteId}
          </h3>
          <Button
            onClick={onClose}
            variant='ghost' size='icon' aria-label={es.comun.cerrar}
          >
            &times;
          </Button>
        </div>

        <div className='flex-1 overflow-hidden'>
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              className='w-full h-full'
              title={es.cot.previewTitulo(quoteId)}
            />
          ) : (
            <div className='flex items-center justify-center h-full'>
              <div className='text-center'>
                <p className='text-muted'>{es.cot.cargandoPdf}</p>
              </div>
            </div>
          )}
        </div>

        <div className='p-4 border-t bg-canvas flex items-center justify-end gap-4'>
          {sealAvailable && onSealChange && (
            <SealCheckbox checked={printSeal} onChange={onSealChange} disabled={!pdfUrl} />
          )}
          <Button
            onClick={onClose}
            variant='outline'
          >
            {es.comun.cerrar}
          </Button>
        </div>
      </div>
    </div>
  )
}
