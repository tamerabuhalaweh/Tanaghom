import { cva } from "class-variance-authority"

export const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-info)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] hover:bg-[var(--color-brand-800)] shadow-sm",
        destructive: "bg-[var(--color-danger)] text-[var(--color-text-inverse)] hover:brightness-95 shadow-sm",
        outline: "border border-[var(--color-border-strong)] bg-transparent text-[var(--color-text-primary)] hover:bg-[var(--color-surface-muted)]",
        secondary: "bg-[var(--color-surface-muted)] text-[var(--color-text-primary)] hover:bg-[var(--color-brand-100)]",
        ghost: "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-primary)]",
        link: "text-[var(--color-info)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-lg px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-[var(--color-border-default)] bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]",
        secondary: "border-[var(--color-border-strong)] bg-[var(--color-surface-card)] text-[var(--color-text-primary)]",
        destructive: "border-red-200 bg-[var(--color-danger-light)] text-[var(--color-danger)]",
        outline: "border-[var(--color-border-strong)] text-[var(--color-text-secondary)]",
        success: "border-emerald-200 bg-[var(--color-success-light)] text-[var(--color-success)]",
        warning: "border-amber-200 bg-[var(--color-warning-light)] text-[var(--color-warning)]",
        info: "border-blue-200 bg-[var(--color-info-light)] text-[var(--color-info)]",
        mock: "border-purple-200 bg-purple-50 text-purple-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export const inputVariants = cva(
  "flex h-10 w-full rounded-md border bg-[var(--color-surface-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-muted)] focus-visible:ring-2 focus-visible:ring-[var(--color-info)] disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-[var(--color-border-strong)] focus-visible:border-[var(--color-info)]",
        error: "border-[var(--color-danger)] focus-visible:border-[var(--color-danger)] focus-visible:ring-[var(--color-danger)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)
