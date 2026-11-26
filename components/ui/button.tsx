import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// C1a button system. One radius (6px), one weight (medium), four looks, four sizes.
// primary = default, secondary = outline (secondary kept as an alias), danger = destructive, ghost.
// `link` is for inline text inside prose only. Heights: sm 28, md 32 (default), lg 40, icon 32 square.
// `hit-44` (app/globals.css) adds an invisible 44px tap zone below 768px and on touch devices only.
const buttonVariants = cva(
  "hit-44 relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-white shadow-sm hover:bg-accent-strong active:bg-accent-strong",
        destructive:
          "bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800",
        outline:
          "border border-line bg-surface text-ink hover:border-ink/25 hover:bg-canvas active:bg-line/60",
        secondary:
          "border border-line bg-surface text-ink hover:border-ink/25 hover:bg-canvas active:bg-line/60",
        ghost: "text-muted hover:bg-canvas hover:text-ink active:bg-line/60",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3 text-[13px]",
        sm: "h-7 px-2.5 text-xs",
        lg: "h-10 px-4 text-sm",
        icon: "hit-44 h-8 w-8 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
