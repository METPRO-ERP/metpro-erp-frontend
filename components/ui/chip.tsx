import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * C3: the neutral tag that sits beside a status pill (a line type, a category). Same shape and ring as StatusPill
 * (rounded-md, px-2 py-0.5, text-xs, ring-1), so every chip on a screen reads as one family. Presentation only.
 */
export function Chip({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("inline-flex items-center rounded-md bg-canvas px-2 py-0.5 text-xs font-medium text-muted ring-1 ring-inset ring-line", className)}
      {...props}
    />
  )
}
