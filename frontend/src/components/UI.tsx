export function StatusBadge({
  label,
  variant = 'default',
}: {
  label: string
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'blocked' | 'mock' | 'default'
}) {
  const colors: Record<string, string> = {
    success: 'border-emerald-700 bg-emerald-950/60 text-emerald-300',
    warning: 'border-amber-700 bg-amber-950/60 text-amber-300',
    danger: 'border-rose-700 bg-rose-950/60 text-rose-300',
    info: 'border-blue-700 bg-blue-950/60 text-blue-300',
    blocked: 'border-rose-700 bg-rose-950/60 text-rose-300',
    mock: 'border-violet-700 bg-violet-950/60 text-violet-300',
    default: 'border-gray-700 bg-gray-800 text-gray-300',
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${colors[variant]}`}>
      {label}
    </span>
  )
}

export function Card({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-gray-800 bg-gray-900 shadow-sm
      [&_.bg-gray-50]:bg-gray-800/50 [&_.bg-gray-100]:bg-gray-800 [&_.bg-blue-100]:bg-blue-950/60
      [&_.text-gray-900]:text-gray-100 [&_.text-gray-800]:text-gray-200 [&_.text-gray-700]:text-gray-300
      [&_.text-gray-600]:text-gray-400 [&_.text-black]:text-gray-100 ${className}`}
    >
      {title && (
        <div className="border-b border-gray-800 px-5 py-4">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

export function MetricCard({ label, value, sublabel }: { label: string; value: string | number; sublabel?: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-800 p-5">
      <div className="text-3xl font-semibold tracking-tight text-white">{value}</div>
      <div className="mt-2 text-sm font-medium text-gray-300">{label}</div>
      {sublabel && <div className="mt-1 text-xs text-gray-500">{sublabel}</div>}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-gray-700 py-8 text-center text-sm text-gray-500">{message}</div>
}

export function LoadingSpinner() {
  return (
    <div className="flex justify-center py-4">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-700 border-b-blue-400" />
    </div>
  )
}

export function Alert({ type = 'info', children }: { type?: 'info' | 'success' | 'warning' | 'error'; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    info: 'border-blue-800/60 bg-blue-950/30 text-blue-100',
    success: 'border-emerald-800/60 bg-emerald-950/30 text-emerald-100',
    warning: 'border-amber-800/60 bg-amber-950/30 text-amber-100',
    error: 'border-rose-800/60 bg-rose-950/30 text-rose-100',
  }
  return <div className={`rounded-lg border px-4 py-3 text-sm ${colors[type]}`}>{children}</div>
}

export function DemoLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-700 bg-amber-950/60 px-3 py-1 text-xs font-medium text-amber-300">
      {children}
    </span>
  )
}

export function BlockedLabel() {
  return (
    <span className="inline-flex items-center rounded-full border border-rose-700 bg-rose-950/60 px-3 py-1 text-xs font-medium text-rose-300">
      Blocked
    </span>
  )
}
