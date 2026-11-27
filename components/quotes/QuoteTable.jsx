import { es } from "@/lib/i18n/es";
import { money } from "@/lib/money"
import { dt } from "@/components/ui/data-table";
import { ResponsiveList, ListCard } from '@/components/ui/responsive-list'
import { quoteRowKey } from '@/lib/listFields'
import StatusPill from '@/components/ui/StatusPill'
import { fmtTimestamp } from '@/lib/dates'
import StatusActor from '@/components/StatusActor'
import PrimaryActionButton from './PrimaryActionButton'
import OverflowMenu from './OverflowMenu'
import SentBadge from '@/components/SentBadge'
import SendToClientButton from '@/components/SendToClientButton'

// Same list as the backend (quotes.service.SENDABLE_STATUSES). Invoiced and Rejected quotes cannot be emailed.
const SENDABLE_QUOTE_STATUSES = ['Final', 'Sent', 'Approved']

export default function QuoteTable({ 
  quotes,
  onPreviewPDF,
  onDownloadPDF,
  onGenerateConduce,
  onDuplicate,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  onConvertToInvoice,
  onOpenPhases,
  onViewInvoice,
  canManage = true,
  sentMap,
  setSentMap,
  onSent
}) {
  if (quotes.length === 0) {
    return (
      <div className='p-8 text-center text-muted'>
        {es.cot.sinResultados}
      </div>
    )
  }

  const numberOf = (quote) => quote.quote_number != null ? `Q-${quote.quote_number}` : '—'
  const dateOf = (quote) => quote.created_at ? fmtTimestamp(String(quote.created_at)) : '—'
  const amountOf = (quote) => money(Number(quote.grand_total ?? quote.total_amount ?? 0))

  // Same actions in the table row and the phone card (both are in the DOM; CSS picks one).
  const renderActions = (quote) => (
    <>
      {sentMap[quote.quote_id] && quote.status !== 'Sent' && <SentBadge />}
      {SENDABLE_QUOTE_STATUSES.includes(quote.status) && (
        <SendToClientButton
          id={quote.quote_id}
          type="quote"
          onSent={() => {
            setSentMap(prev => ({ ...prev, [quote.quote_id]: true }))
            // Reload so the status pill shows Enviada without a manual refresh.
            if (onSent) onSent(quote.quote_id)
          }}
        />
      )}
      <PrimaryActionButton
        quote={quote}
        onApprove={() => onApprove(quote.quote_id)}
        onConvert={() => onConvertToInvoice(quote.quote_id)}
        onViewInvoice={() => onViewInvoice(quote)}
        canManage={canManage}
      />

      <OverflowMenu
        quote={quote}
        onPreviewPDF={() => onPreviewPDF(quote.quote_id)}
        onDownloadPDF={() => onDownloadPDF(quote.quote_id)}
        onGenerateConduce={() => onGenerateConduce(quote.quote_id)}
        onDuplicate={() => onDuplicate(quote.quote_id)}
        onEdit={() => onEdit(quote)}
        onDelete={() => onDelete(quote.quote_id, quote.status)}
        onApprove={() => onApprove(quote.quote_id)}
        onReject={onReject ? () => onReject(quote.quote_id) : undefined}
        onConvertToInvoice={() => onConvertToInvoice(quote.quote_id)}
        onOpenPhases={onOpenPhases ? () => onOpenPhases(quote.quote_id) : undefined}
        canManage={canManage}
      />
    </>
  )

  const renderActor = (quote) => (
    <StatusActor kind='quote' id={quote.quote_id} createdBy={quote.created_by_name}
      lastBy={quote.last_status_by} lastAt={quote.last_status_at} />
  )

  return (
    <ResponsiveList
      bare
      items={quotes}
      getKey={(quote, i) => quoteRowKey(quote, i)}
      renderCard={(quote) => (
        <ListCard
          title={numberOf(quote)}
          chip={<StatusPill status={quote.status} gender="f" />}
          subtitle={quote.client_name}
          fields={[
            { label: es.cot.colProyecto, value: quote.project_name || '-', wide: true },
            { label: es.cot.colFecha, value: dateOf(quote) },
            { label: es.cot.colMonto, value: amountOf(quote), numeric: true },
          ]}
          extra={
            <>
              {renderActor(quote)}
              {quote.has_invoice && (
                <div className='text-xs text-accent mt-1'>
                  {es.cot.facturaLabel} {quote.invoice_number}
                </div>
              )}
            </>
          }
          actions={renderActions(quote)}
        />
      )}
    >
    <table className={dt.table}>
      <thead className={dt.thead}>
        <tr>
          <th className={dt.th}>{es.cot.colNumero}</th>
          <th className={dt.th}>{es.cot.colCliente}</th>
          <th className={dt.th}>{es.cot.colProyecto}</th>
          <th className={dt.th}>{es.cot.colFecha}</th>
          <th className={dt.thRight}>{es.cot.colMonto}</th>
          <th className={dt.th}>{es.cot.colEstado}</th>
          <th className={dt.thSticky}>{es.cot.colAcciones}</th>
        </tr>
      </thead>

      <tbody className={dt.tbody}>
        {quotes.map((quote, i) => (
          <tr key={quoteRowKey(quote, i)} className={dt.tr}>
            <td className={dt.td}>{numberOf(quote)}</td>
            <td className={dt.tdTrunc} title={quote.client_name}>{quote.client_name}</td>
            <td className={dt.tdTrunc} title={quote.project_name || undefined}>{quote.project_name || '-'}</td>
            <td className={dt.td}>{dateOf(quote)}</td>

            <td className={dt.tdRight}>{amountOf(quote)}</td>

            <td className={dt.td}>
              <StatusPill status={quote.status} gender="f" />
              {renderActor(quote)}
              {quote.has_invoice && (
                <div className='text-xs text-accent mt-1'>
                  {es.cot.facturaLabel} {quote.invoice_number}
                </div>
              )}
            </td>

            <td className={dt.tdSticky}>
              <div className='flex items-center gap-3 justify-end'>
                {renderActions(quote)}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </ResponsiveList>
  )
}
