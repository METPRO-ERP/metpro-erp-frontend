'use client'
import { api } from "@/lib/api"
import { money } from "@/lib/money"
import { businessMonth, localDateEsDO } from '@/lib/dates'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { useCurrentRole } from '@/lib/currentRole'
import { es } from '@/lib/i18n/es'
import { getRfqOptions } from '@/lib/rfqApi'
import { quoteNumberLabel, invoiceNumberLabel, quoteRowKey, moneyTone, MONEY_TONE_CLASS } from '@/lib/listFields'

// Counts follow the quote and invoice status matrices.
const PENDING_QUOTE_STATUSES = ['Draft', 'Final', 'Sent']
const OPEN_INVOICE_STATUSES = ['Pending', 'Overdue']

export default function DashboardPage() {
  // Display name from GET /auth/me: full name, then username, then 'User'.
  const [displayName, setDisplayName] = useState('Usuario')
  const [loadErrors, setLoadErrors] = useState([])
  const [loading, setLoading] = useState(true) // E-09: no 0 / $0.00 flash before data arrives
  const { isAdmin } = useCurrentRole()
  // RFQ / P.O card: shown only when the backend switch RFQ_ENABLED is on.
  const [rfqEnabled, setRfqEnabled] = useState(false)
  useEffect(() => {
    getRfqOptions().then((o) => setRfqEnabled(o.rfq_enabled))
  }, [])
  const [stats, setStats] = useState({
    clients: 0,
    pendingQuotes: 0,
    openInvoices: 0,
    totalExpenses: 0,
    monthlyExpenses: 0,
    revenue: 0,
    profit: 0
  })

  const [recentQuotes, setRecentQuotes] = useState([])
  const [recentInvoices, setRecentInvoices] = useState([])
  const [recentExpenses, setRecentExpenses] = useState([])

  // Display name
  useEffect(() => {
    let cancelled = false
    api('/auth/me')
      .then((me) => {
        if (!cancelled && me) setDisplayName(me.name || me.username || 'User')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Load dashboard data. Each source loads independently; a failure is shown, not zeroed silently.
  useEffect(() => {
    let cancelled = false
    async function loadDashboardData() {
      const sources = [
        ['Clientes', '/clients/'],
        ['Cotizaciones', '/quotes/'],
        ['Facturas', '/invoices/'],
        ['Gastos', '/expenses/'],
      ]
      const results = await Promise.allSettled(sources.map(([, path]) => api(path)))
      if (cancelled) return

      const errors = []
      const data = results.map((r, i) => {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) return r.value
        errors.push(`${sources[i][0]}: ${r.status === 'rejected' ? r.reason?.message || 'error' : es.dashboard.respuestaInvalida}`)
        return null
      })
      setLoadErrors(errors)
      const [clients, quotes, invoices, expenses] = data

      const sumBy = (rows, f) => (rows || []).reduce((acc, x) => acc + Number(f(x) || 0), 0)
      const currentMonth = businessMonth() // Santo Domingo month (E-05)

      const totalExpenses = sumBy(expenses, e => e.amount)
      const monthlyExpenses = sumBy((expenses || []).filter(e => String(e.date || '').startsWith(currentMonth)), e => e.amount)
      // Collected money: payments recorded on invoices, excluding cancelled ones.
      const activeInvoices = (invoices || []).filter(inv => inv.status !== 'Cancelled')
      const revenue = sumBy(activeInvoices, inv => inv.amount_paid)
      // X-04: profit uses collected money WITHOUT ITBIS (tax owed to DGII), same basis as the reports:
      // each payment counts its share (total - itbis) / total of its invoice.
      const revenueNet = sumBy(activeInvoices, inv => {
        const total = Number(inv.total_amount || 0)
        const itbis = Number(inv.itbis_total || 0)
        return total > 0 ? Number(inv.amount_paid || 0) * (total - itbis) / total : Number(inv.amount_paid || 0)
      })

      setStats({
        clients: clients ? clients.length : 0,
        pendingQuotes: (quotes || []).filter(q => PENDING_QUOTE_STATUSES.includes(q.status)).length,
        openInvoices: (invoices || []).filter(inv => OPEN_INVOICE_STATUSES.includes(inv.status)).length,
        totalExpenses,
        monthlyExpenses,
        revenue,
        profit: revenueNet - totalExpenses
      })

      const recent = (rows) => [...(rows || [])]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5)
      setRecentQuotes(recent(quotes))
      setRecentInvoices(recent(invoices))
      setRecentExpenses(recent(expenses))
      setLoading(false)
    }

    loadDashboardData()
    return () => {
      cancelled = true
    }
  }, [])

  const modules = [
    {
      name: 'Clientes',
      description: 'Gestionar información y contactos de clientes',
      href: '/clients',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      )
    },
    {
      name: 'Productos',
      description: 'Gestionar catálogo y precios de productos',
      href: '/products',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      )
    },
    {
      name: 'Cotizaciones',
      description: 'Crear y gestionar cotizaciones de precios',
      href: '/quotes',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      )
    },
    {
      name: 'Facturas',
      description: 'Generar y rastrear facturas',
      href: '/invoices',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z"
          />
        </svg>
      )
    },
    {
      name: 'Proyectos',
      description: 'Dar seguimiento a proyectos y trabajos aprobados',
      href: '/proyectos',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
      )
    },
    {
      name: 'Gastos',
      description: 'Registrar y analizar gastos operativos',
      href: '/expenses',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8c-1.657 0-3 1.343-3 3h6c0-1.657-1.343-3-3-3zm0 0V5m0 6v6m0 0h3m-3 0H9"
          />
        </svg>
      )
    },
    {
      name: 'Reportes',
      description: 'Ver análisis y reportes',
      href: '/reports',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      )
    }
  ]

  // RFQ / P.O: all users. Hidden while the switch is off.
  const purchasingModules = rfqEnabled ? [
    {
      name: 'RFQ / P.O',
      description: 'Solicitudes de cotización y órdenes de compra a suplidores',
      href: '/compras',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
          />
        </svg>
      )
    }
  ] : []

  // Admin-only module: one "Ajustes" card that opens /ajustes (Usuarios, Encabezados PDF, Plantillas, Sello, Términos).
  const adminModules = [
    {
      name: 'Ajustes',
      description: 'Usuarios, encabezados PDF, plantillas, sello y términos',
      href: '/ajustes',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      )
    }
  ]

  const allModules = [...modules, ...purchasingModules, ...(isAdmin ? adminModules : [])]

  return (
    <div className="text-ink">

      {/* HEADER */}
      <PageHeader
        title="Panel"
        subtitle="Sistema ERP Metpro"
        actions={<span className="text-sm font-medium text-ink">Bienvenido, {displayName}</span>}
      />

      {loadErrors.length > 0 && (
        <div role="alert" className="mb-6 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          No se pudieron cargar algunos datos; las cifras pueden estar incompletas.
          <ul className="mt-1 list-disc pl-5">
            {loadErrors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* NUMBERS: one grid so column edges line up. Counts first, then money. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" aria-busy={loading}>
        <StatCard label="Clientes" value={loading ? '…' : stats.clients} />
        <StatCard label="Cotizaciones Pendientes" value={loading ? '…' : stats.pendingQuotes} />
        <StatCard label="Facturas Abiertas" value={loading ? '…' : stats.openInvoices} />
        <StatCard label="Gastos Totales" value={loading ? '…' : money(stats.totalExpenses)} />

        <StatCard
          money
          label="Cobrado (pagos recibidos, con ITBIS)"
          value={loading ? '…' : money(stats.revenue)}
          tone={MONEY_TONE_CLASS[moneyTone('income', stats.revenue)]}
        />
        <StatCard
          money
          label="Gastos del Mes"
          value={loading ? '…' : money(stats.monthlyExpenses)}
          tone={MONEY_TONE_CLASS[moneyTone('spend', stats.monthlyExpenses)]}
        />
        <StatCard
          money
          wide
          label="Ganancia Neta (cobrado sin ITBIS − gastos)"
          value={loading ? '…' : money(stats.profit)}
          tone={MONEY_TONE_CLASS[moneyTone('net', stats.profit)]}
        />
      </div>

      {/* MODULE SHORTCUTS (the app's navigation) */}
      <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {allModules.map((module) => (
          <li key={module.name}>
            <Link
              href={module.href}
              className="flex h-full items-center gap-2.5 rounded-lg border border-line bg-surface p-2.5 shadow-card sm:gap-3 sm:p-3 transition-colors hover:border-accent"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
                {module.icon}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-ink sm:text-sm">{module.name}</span>
                <span className="mt-0.5 hidden text-xs text-muted md:block">{module.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/* RECENT ACTIVITY */}
      <div className="mt-6 grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">

        <RecentCard title="Cotizaciones Recientes" empty="No hay cotizaciones recientes" rows={recentQuotes.map((q, i) => ({
          key: quoteRowKey(q, i),
          label: quoteNumberLabel(q.quote_number),
          text: q.client_name,
          right: localDateEsDO(q.created_at),
        }))} />

        <RecentCard title="Facturas Recientes" empty="No hay facturas recientes" rows={recentInvoices.map((inv) => ({
          key: inv.id,
          label: invoiceNumberLabel(inv.invoice_number),
          text: inv.client_name,
          right: localDateEsDO(inv.created_at),
        }))} />

        <RecentCard title="Gastos Recientes" empty="No hay gastos recientes" rows={recentExpenses.map((exp) => ({
          key: exp.expense_id,
          text: exp.category,
          right: money(Number(exp.amount)),
          rightStrong: true,
        }))} />

      </div>

    </div>
  )
}

// One stat tile. Money tiles are a label/value row below md and a stacked tile from md up.
function StatCard({ label, value, tone = 'text-ink', money: isMoney = false, wide = false }) {
  return (
    <div className={[
      'rounded-lg border border-line bg-surface p-4 shadow-card',
      isMoney ? 'col-span-2 flex items-baseline justify-between gap-3 md:block' : '',
      isMoney && !wide ? 'md:col-span-1' : '',
      wide ? 'md:col-span-2' : '',
    ].join(' ')}>
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums md:mt-1 ${tone}`}>{value}</div>
    </div>
  )
}

// Recent activity card: one-line rows (label + truncated text, value on the right), sized to content.
function RecentCard({ title, empty, rows }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4 shadow-card">
      <h2 className="mb-2 text-base font-semibold text-ink">{title}</h2>
      {rows.length === 0 && <p className="text-sm text-muted">{empty}</p>}
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.key} className="flex h-10 items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              {r.label && <span className="shrink-0 font-medium tabular-nums text-ink">{r.label}</span>}
              <span className="truncate text-ink" title={r.text}>{r.text}</span>
            </span>
            <span className={`shrink-0 tabular-nums ${r.rightStrong ? 'text-ink' : 'text-muted'}`}>{r.right}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
