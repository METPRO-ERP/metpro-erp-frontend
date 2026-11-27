import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * C2 shared modal shell. Presentation only: it changes where things sit, never what a dialog does.
 *
 *   - outer padding, so the card never touches a screen edge
 *   - max height = the viewport minus the padding (dvh where supported), body scrolls inside
 *   - header and footer stay pinned, so the actions are always reachable
 *
 * Open/close, Escape, focus and every handler stay with the caller, exactly as before.
 *
 *   <ModalShell title="…" subtitle="…" headerAction={<Button …/>} footer={<>buttons</>}>body</ModalShell>
 */
export type ModalSize = "md" | "2xl"

export const MODAL_SIZE_CLASS: Record<ModalSize, string> = {
  md: "max-w-md",
  "2xl": "max-w-2xl",
}

export const MODAL_OVERLAY_CLASS = "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"

// vh first, dvh where the browser knows it (mobile address bars change vh).
export const MODAL_CARD_CLASS =
  "flex max-h-[calc(100vh-2rem)] supports-[height:100dvh]:max-h-[calc(100dvh-2rem)] w-full flex-col rounded-lg bg-surface shadow-card"

export interface ModalShellProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Right side of the header (for example a close button). */
  headerAction?: React.ReactNode
  /** Pinned action row. Omit when the dialog has none. */
  footer?: React.ReactNode
  /** Footer layout: a right-aligned row (default) or a column of full-width actions. */
  footerLayout?: "row" | "stack"
  size?: ModalSize
  /** Centre the title (Send to client keeps its centred title). */
  centerTitle?: boolean
  ariaLabel?: string
  children: React.ReactNode
}

export function ModalShell({
  title,
  subtitle,
  headerAction,
  footer,
  footerLayout = "row",
  size = "md",
  centerTitle = false,
  ariaLabel,
  children,
}: ModalShellProps) {
  return (
    <div
      className={MODAL_OVERLAY_CLASS}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? (typeof title === "string" ? title : undefined)}
    >
      <div className={cn(MODAL_CARD_CLASS, MODAL_SIZE_CLASS[size])}>
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-5">
          <div className={cn("min-w-0", centerTitle && "flex-1 text-center")}>
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
          </div>
          {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? (
          <div
            className={cn(
              "shrink-0 border-t border-line px-5 py-3",
              footerLayout === "stack" ? "flex flex-col gap-4" : "flex justify-end gap-3"
            )}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
