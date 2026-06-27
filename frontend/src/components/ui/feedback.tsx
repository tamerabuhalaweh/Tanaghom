import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "./button"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  className?: string
}

function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] px-6 py-12 text-center", className)}>
      {Icon && <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-card)] shadow-sm"><Icon className="h-6 w-6 text-[var(--color-text-muted)]" aria-hidden="true" /></div>}
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-[var(--color-text-muted)]">{description}</p>}
      {action && <Button onClick={action.onClick} size="sm" className="mt-4">{action.label}</Button>}
    </div>
  )
}

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}

function ErrorState({ title = "Something went wrong", description = "An unexpected error occurred. Please try again.", onRetry, className }: ErrorStateProps) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-[var(--color-danger-light)] px-6 py-12 text-center", className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
        <svg className="h-6 w-6 text-[var(--color-danger)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>
      </div>
      <h3 className="text-sm font-semibold text-[var(--color-danger)]">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-[var(--color-text-secondary)]">{description}</p>
      {onRetry && <Button onClick={onRetry} variant="outline" size="sm" className="mt-4">Try again</Button>}
    </div>
  )
}

function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-12" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border-strong)] border-b-[var(--color-info)]" />
        <span className="text-sm text-[var(--color-text-muted)]">{label}</span>
      </div>
    </div>
  )
}

interface PageHeaderProps {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: React.ReactNode
  breadcrumbs?: { label: string; href?: string }[]
}

function PageHeader({ eyebrow, title, subtitle, actions, breadcrumbs }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-2">
            <ol className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
              {breadcrumbs.map((crumb, i) => (
                <li key={crumb.label} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-[var(--color-text-muted)]" aria-hidden="true">/</span>}
                  {crumb.href ? <a href={crumb.href} className="hover:text-[var(--color-text-primary)]">{crumb.label}</a> : <span className="font-medium text-[var(--color-text-secondary)]">{crumb.label}</span>}
                </li>
              ))}
            </ol>
          </nav>
        )}
        {eyebrow && <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{eyebrow}</div>}
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-text-primary)] lg:text-3xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}

export { EmptyState, ErrorState, LoadingState, PageHeader }
export type { EmptyStateProps, ErrorStateProps, PageHeaderProps }
