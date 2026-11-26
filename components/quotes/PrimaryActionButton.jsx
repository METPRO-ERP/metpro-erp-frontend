import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
export default function PrimaryActionButton({ quote, onApprove, onConvert, onViewInvoice, canManage = true }) {
  // ROLE_POLICY: approve and convert are for admin and superadmin only. The backend enforces it too.
  if (!canManage && !quote.has_invoice) return null
  // Approve after finalize: Final or Sent. A Draft has no public_token and cannot be approved.
  if (quote.status === 'Final' || quote.status === 'Sent') {
    return (
      <Button
        onClick={onApprove}
        variant='default'
      >
        {es.cot.aprobarCorto}
      </Button>
    )
  }

  if (quote.status === 'Approved' && !quote.has_invoice) {
    return (
      <Button
        onClick={onConvert}
        variant='default'
      >
        {es.cot.convertir}
      </Button>
    )
  }

  if (quote.has_invoice) {
    return (
      <Button
        onClick={onViewInvoice}
        variant='default'
      >
        {es.cot.verFactura}
      </Button>
    )
  }

  return null
}
