export function StatusBadge({
  label,
  variant = 'default',
}: {
  label: string
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'blocked' | 'mock' | 'default'
}) {
  const colors: Record<string, string> = {
    success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    warning: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    danger: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
    info: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
    blocked: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
    mock: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
    default: 'border-slate-600 bg-slate-800 text-slate-300',
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${colors[variant]}`}>
      {label}
    </span>
  )
}

export function Card({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-950/70 shadow-[0_1px_0_rgba(255,255,255,0.04)] ${className}`}>
      {title && (
        <div className="border-b border-slate-800 px-5 py-4">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
      )}
      <div className="p-5 text-slate-300">{children}</div>
    </div>
  )
}

export function MetricCard({ label, value, sublabel }: { label: string; value: string | number; sublabel?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 p-5">
      <div className="text-3xl font-semibold tracking-tight text-white">{value}</div>
      <div className="mt-2 text-sm font-medium text-slate-300">{label}</div>
      {sublabel && <div className="mt-1 text-xs text-slate-500">{sublabel}</div>}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-slate-700 py-8 text-center text-sm text-slate-500">{message}</div>
}

export function LoadingSpinner() {
  return (
    <div className="flex justify-center py-4">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-b-sky-400" />
    </div>
  )
}

export function Alert({ type = 'info', children }: { type?: 'info' | 'success' | 'warning' | 'error'; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    info: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
    error: 'border-rose-500/30 bg-rose-500/10 text-rose-100',
  }
  return <div className={`rounded-xl border px-4 py-3 text-sm ${colors[type]}`}>{children}</div>
}

export function DemoLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
      {children}
    </span>
  )
}

export function BlockedLabel() {
  return (
    <span className="inline-flex items-center rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-300">
      Blocked
    </span>
  )
}
