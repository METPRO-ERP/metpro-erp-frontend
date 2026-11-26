'use client'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { es } from "@/lib/i18n/es";
import { createPhase, getPhases, invoicePhase } from '@/lib/billingApi'
import { convertToInvoice } from '@/components/quotes/QuoteActions'
import { useToken } from '@/components/quotes/useToken'

const t = es.facturacion.fases
const money = (n) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const inputClass = 'h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent'

// Backend error codes to the Spanish text of the plan. Anything else shows the backend message.
const CODE_TEXT = {
  PHASE_EXCEEDS_BALANCE: t.error.excede,
  PHASE_AMOUNT_ZERO: t.error.cero,
  PHASE_ALREADY_INVOICED: t.error.yaFacturada,
  QUOTE_TOTAL_LOCKED_PHASED: t.error.totalCambio,
  BILLING_MODE_LOCKED: t.error.modoFijo,
}
const errorText = (e) => CODE_TEXT[e?.code] || e?.message || ''

/**
 * Phase panel for one quote: balance, phase list, one new phase at a time, generate the phase invoice.
 * Rendered only when PHASED_INVOICING_ENABLED is on (the page checks GET /phases/options first).
 * Amounts, ITBIS and the final-phase remainder are all computed by the backend.
 */
export default function PhasePanel({ quoteId, quoteLabel, onClose, onChanged }) {
  const token = useToken()
  const [view, setView] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [label, setLabel] = useState(t.presetInicial)
  const [kind, setKind] = useState('percent')
  const [value, setValue] = useState('')

  const load = useCallback(async () => {
    try {
      setView(await getPhases(quoteId))
      setError('')
    } catch (e) {
      setError(`${t.errorCargar}: ${errorText(e)}`)
    }
  }, [quoteId])

  useEffect(() => { load() }, [load])

  async function startPhased() {
    setBusy(true)
    try {
      await convertToInvoice(quoteId, token, 'PHASED')
      toast.success(t.exitoModo)
      await load()
      onChanged?.()
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function addPhase(ev) {
    ev.preventDefault()
    setBusy(true)
    try {
      await createPhase(quoteId, {
        label: label.trim(),
        amount_input_type: kind,
        amount_input_value: kind === 'final' ? null : Number(value),
      })
      toast.success(t.exitoFase)
      setValue('')
      await load()
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function generate(phase) {
    if (!confirm(t.confirmarGenerar)) return
    setBusy(true)
    try {
      const out = await invoicePhase(phase.id)
      toast.success(t.exitoFactura(out.invoice_number))
      if (out.ncf_warning?.expiry) toast(es.fiscal.ncf.aviso.vence)
      if (out.ncf_warning?.exhaustion) toast(es.fiscal.ncf.aviso.agota)
      await load()
      onChanged?.()
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const agg = view?.aggregate
  const planned = view?.phases?.some((p) => p.status === 'Planned')
  const phased = view?.billing_mode === 'PHASED'
  const nothingLeft = agg ? agg.remaining_for_new_phase <= 0 : true

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4' role='dialog' aria-modal='true' aria-label={t.titulo}>
      <div className='max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-surface p-6 shadow-xl'>
        <div className='flex items-start justify-between'>
          <div>
            <h2 className='text-lg font-semibold text-ink'>{t.titulo}</h2>
            <p className='text-sm text-muted'>{quoteLabel}</p>
          </div>
          <button onClick={onClose} className='text-sm text-muted hover:text-ink'>{t.cerrar}</button>
        </div>

        {error && <p role='alert' className='mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700'>{error}</p>}

        {view && !phased && (
          <div className='mt-4'>
            <p className='text-sm text-ink'>{t.noIniciada}</p>
            {view.quote_status === 'Approved' && (
              <button disabled={busy} onClick={startPhased} className='mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50'>
                {t.iniciar}
              </button>
            )}
          </div>
        )}

        {view && phased && (
          <>
            <dl className='mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4'>
              <div><dt className='text-muted'>{t.total}</dt><dd className='font-medium text-ink'>{money(agg.total)}</dd></div>
              <div><dt className='text-muted'>{t.facturado}</dt><dd className='font-medium text-ink'>{money(agg.invoiced_to_date)}</dd></div>
              <div><dt className='text-muted'>{t.pagado}</dt><dd className='font-medium text-ink'>{money(agg.paid_to_date)}</dd></div>
              <div><dt className='text-muted'>{t.saldo}</dt><dd className='font-semibold text-ink'>{money(agg.remaining_for_new_phase)}</dd></div>
              <div><dt className='text-muted'>{t.porFacturar}</dt><dd className='text-ink'>{money(agg.pending_to_invoice)}</dd></div>
              <div><dt className='text-muted'>{t.porCobrar}</dt><dd className='text-ink'>{money(agg.pending_to_pay)}</dd></div>
            </dl>

            <div className='mt-5'>
              {view.phases.length === 0 ? (
                <p className='text-sm text-muted'>{t.sinFases}</p>
              ) : (
                <table className='w-full text-sm'>
                  <thead>
                    <tr className='border-b border-line text-left text-muted'>
                      <th className='py-1'>#</th><th>{t.etiqueta}</th><th className='text-right'>{es.comun.total ?? 'Total'}</th>
                      <th className='text-right'>{t.itbisFase}</th><th>{es.fiscal.ncf.etiqueta}</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {view.phases.map((p) => (
                      <tr key={p.id} className='border-b border-line'>
                        <td className='py-1'>{p.phase_order}</td>
                        <td>{p.label}</td>
                        <td className='text-right'>{money(p.amount_snapshot)}</td>
                        <td className='text-right'>{money(p.itbis_snapshot)}</td>
                        <td>{p.ncf ?? '—'}{p.invoice_number ? ` (${p.invoice_number})` : ''}</td>
                        <td className='text-right'>
                          {p.status === 'Planned' ? (
                            <button disabled={busy} onClick={() => generate(p)} className='rounded bg-accent px-2 py-1 text-xs text-white hover:bg-accent-strong disabled:opacity-50'>
                              {t.generar}
                            </button>
                          ) : (
                            <span className='text-xs text-muted'>{p.invoice_status}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {view.quote_status === 'Approved' && !planned && !nothingLeft && (
              <form onSubmit={addPhase} className='mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-3'>
                <label className='text-sm sm:col-span-3'>
                  <span className='text-muted'>{t.etiqueta}</span>
                  <input className={inputClass} list='fase-presets' value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={120} />
                  <datalist id='fase-presets'>
                    <option value={t.presetInicial} /><option value={t.presetSegundo} /><option value={t.pagoFinal} />
                  </datalist>
                </label>
                <label className='text-sm'>
                  <span className='text-muted'>{t.tipoMonto}</span>
                  <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value)}>
                    <option value='percent'>{t.porcentaje}</option>
                    <option value='fixed'>{t.montoFijo}</option>
                    <option value='final'>{t.saldoRestante}</option>
                  </select>
                </label>
                {kind !== 'final' && (
                  <label className='text-sm'>
                    <span className='text-muted'>{t.valor}</span>
                    <input className={inputClass} type='number' step='0.01' min='0' value={value} onChange={(e) => setValue(e.target.value)} required />
                  </label>
                )}
                <div className='flex items-end'>
                  <button disabled={busy} type='submit' className='rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50'>
                    {t.agregar}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
