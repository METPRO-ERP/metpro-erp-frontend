import * as React from "react"

import { cn } from "@/lib/utils"
import { dt } from "@/components/ui/data-table"

/**
 * C1b shared list pieces. Presentation only: the same rows, the same actions, the same data.
 *
 *   <ResponsiveList items={rows} getKey={(r) => r.id} renderCard={(r) => <ListCard ... />}>
 *     <table className={dt.table}>…</table>
 *   </ResponsiveList>
 *
 * Below md (768px): one card per row. From md up: the table inside the shared scroll wrapper.
 * Both are in the DOM and CSS picks one, so there is no hydration flicker.
 */

/** The one scroll wrapper for tables. `bare` drops the card chrome when the table sits inside a card. */
export function TableScroll({ children, bare = false, className }: { children: React.ReactNode; bare?: boolean; className?: string }) {
  return <div className={cn(bare ? "overflow-x-auto" : dt.wrap, className)}>{children}</div>
}

export interface ResponsiveListProps<T> {
  items: T[]
  getKey: (item: T, index: number) => React.Key
  renderCard: (item: T) => React.ReactNode
  /** The desktop table. */
  children: React.ReactNode
  bare?: boolean
  /** Where cards give way to the table: below md (default, lists) or below sm (detail pages, C3). */
  below?: "sm" | "md"
}

// Static class names so Tailwind sees them.
const CARDS_ONLY = { sm: "sm:hidden", md: "md:hidden" } as const
const TABLE_ONLY = { sm: "hidden sm:block", md: "hidden md:block" } as const

export function ResponsiveList<T>({ items, getKey, renderCard, children, bare, below = "md" }: ResponsiveListProps<T>) {
  return (
    <>
      <ul className={cn("space-y-3", CARDS_ONLY[below])}>
        {items.map((item, i) => (
          <li key={getKey(item, i)}>{renderCard(item)}</li>
        ))}
      </ul>
      <div className={TABLE_ONLY[below]}>
        <TableScroll bare={bare}>{children}</TableScroll>
      </div>
    </>
  )
}

export interface ListCardField {
  label: string
  value: React.ReactNode
  /** Right-align the value (money). */
  numeric?: boolean
  /** Span both columns (long text). */
  wide?: boolean
}

export interface ListCardProps {
  title: React.ReactNode
  /** The one status chip (StatusPill). */
  chip?: React.ReactNode
  subtitle?: React.ReactNode
  fields?: ListCardField[]
  /** Anything under the fields that is not an action (invoice reference, "last change by"). */
  extra?: React.ReactNode
  /** Action row. Spacing between buttons is 12px so their 44px tap zones never overlap. */
  actions?: React.ReactNode
}

export function ListCard({ title, chip, subtitle, fields = [], extra, actions }: ListCardProps) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 text-sm font-medium text-ink">{title}</div>
        {chip ? <div className="shrink-0">{chip}</div> : null}
      </div>
      {subtitle ? <div className="mt-0.5 truncate text-sm text-muted">{subtitle}</div> : null}
      {fields.length > 0 ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {fields.map((f) => (
            <div key={f.label} className={cn("min-w-0", f.wide && "col-span-2", f.numeric && "text-right")}>
              <dt className="text-xs text-muted">{f.label}</dt>
              <dd className={cn("break-words text-ink", f.numeric && "tabular-nums")}>{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {extra ? <div className="mt-2">{extra}</div> : null}
      {actions ? <div className="mt-3 flex flex-wrap items-center justify-end gap-3 border-t border-line pt-3">{actions}</div> : null}
    </div>
  )
}
