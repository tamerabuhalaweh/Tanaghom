export function StatusBadge({
  label,
  variant = 'default',
}: {
  label: string
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'blocked' | 'mock' | 'default'
}) {
  const colors: Record<string, string> = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    danger: 'border-rose-200 bg-rose-50 text-rose-800',
    info: 'border-sky-200 bg-sky-50 text-sky-800',
    blocked: 'border-rose-200 bg-rose-50 text-rose-800',
    mock: 'border-violet-200 bg-violet-50 text-violet-800',
    default: 'border-black/10 bg-black/[0.03] text-black/70',
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${colors[variant]}`}>
      {label}
    </span>
  )
}

export function Card({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-black/10 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)] ${className}`}>
      {title && (
        <div className="border-b border-black/10 px-5 py-4">
          <h3 className="text-sm font-semibold text-black">{title}</h3>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

export function MetricCard({ label, value, sublabel }: { label: string; value: string | number; sublabel?: string }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-5">
      <div className="text-3xl font-semibold tracking-tight text-black">{value}</div>
      <div className="mt-2 text-sm font-medium text-black/70">{label}</div>
      {sublabel && <div className="mt-1 text-xs text-black/45">{sublabel}</div>}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return <div className="rounded-md border border-dashed border-black/15 py-8 text-center text-sm text-black/45">{message}</div>
}

export function LoadingSpinner() {
  return (
    <div className="flex justify-center py-4">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-black/15 border-b-black" />
    </div>
  )
}

export function Alert({ type = 'info', children }: { type?: 'info' | 'success' | 'warning' | 'error'; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    info: 'border-black/10 bg-white text-black',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-rose-200 bg-rose-50 text-rose-900',
  }
  return <div className={`rounded-lg border px-4 py-3 text-sm ${colors[type]}`}>{children}</div>
}

export function DemoLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
      {children}
    </span>
  )
}

export function BlockedLabel() {
  return (
    <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-800">
      Blocked
    </span>
  )
}
