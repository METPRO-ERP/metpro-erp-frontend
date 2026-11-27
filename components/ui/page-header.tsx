import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Standard page header (item 13, module 3).
 * Title and optional subtitle on the left. Page actions on the top right.
 * Actions render in the order given. They wrap on narrow screens.
 */
export interface PageHeaderProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? (
        <div className="flex max-w-full flex-wrap items-center gap-3 sm:shrink-0">{actions}</div>
      ) : null}
    </header>
  )
}
