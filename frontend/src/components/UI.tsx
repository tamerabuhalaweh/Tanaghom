export function StatusBadge({
  label,
  variant = 'default',
}: {
  label: string
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'blocked' | 'mock' | 'default'
}) {
  const colors: Record<string, string> = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    danger: 'border-red-200 bg-red-50 text-red-700',
    info: 'border-blue-200 bg-blue-50 text-blue-700',
    blocked: 'border-red-200 bg-red-50 text-red-700',
    mock: 'border-violet-200 bg-violet-50 text-violet-700',
    default: 'border-neutral-200 bg-neutral-100 text-neutral-700',
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${colors[variant]}`}>
      {label}
    </span>
  )
}

export function Card({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-neutral-200 bg-white shadow-sm ${className}`}>
      {title && (
        <div className="border-b border-neutral-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-neutral-950">{title}</h3>
        </div>
      )}
      <div className="p-5 text-neutral-700">{children}</div>
    </div>
  )
}

export function MetricCard({ label, value, sublabel }: { label: string; value: string | number; sublabel?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="text-3xl font-semibold tracking-tight text-neutral-950">{value}</div>
      <div className="mt-2 text-sm font-medium text-neutral-700">{label}</div>
      {sublabel && <div className="mt-1 text-xs text-neutral-500">{sublabel}</div>}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 py-8 text-center text-sm text-neutral-500">{message}</div>
}

export function LoadingSpinner() {
  return (
    <div className="flex justify-center py-4">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-200 border-b-blue-600" />
    </div>
  )
}

export function Alert({ type = 'info', children }: { type?: 'info' | 'success' | 'warning' | 'error'; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    info: 'border-blue-200 bg-blue-50 text-blue-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-red-200 bg-red-50 text-red-800',
  }
  return <div className={`rounded-xl border px-4 py-3 text-sm ${colors[type]}`}>{children}</div>
}

export function DemoLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
      {children}
    </span>
  )
}

export function BlockedLabel() {
  return (
    <span className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
      Blocked
    </span>
  )
}
