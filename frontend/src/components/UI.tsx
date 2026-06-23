export function StatusBadge({ label, variant = 'default' }: { label: string; variant?: 'success' | 'warning' | 'danger' | 'info' | 'blocked' | 'mock' | 'default' }) {
  const colors: Record<string, string> = {
    success: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    danger: 'bg-red-100 text-red-800 border-red-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
    blocked: 'bg-red-50 text-red-700 border-red-200',
    mock: 'bg-purple-100 text-purple-800 border-purple-200',
    default: 'bg-gray-100 text-gray-700 border-gray-200',
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[variant]}`}>{label}</span>;
}

export function Card({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border rounded-lg shadow-sm ${className}`}>
      {title && <div className="px-4 py-3 border-b"><h3 className="font-semibold text-gray-900">{title}</h3></div>}
      <div className="p-4">{children}</div>
    </div>
  );
}

export function MetricCard({ label, value, sublabel }: { label: string; value: string | number; sublabel?: string }) {
  return (
    <div className="bg-white border rounded-lg p-4 text-center">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm font-medium text-gray-600">{label}</div>
      {sublabel && <div className="text-xs text-gray-400 mt-1">{sublabel}</div>}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="text-center py-8 text-gray-400 text-sm">{message}</div>;
}

export function LoadingSpinner() {
  return <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div></div>;
}

export function Alert({ type = 'info', children }: { type?: 'info' | 'success' | 'warning' | 'error'; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    error: 'bg-red-50 border-red-200 text-red-800',
  };
  return <div className={`border rounded-lg p-3 text-sm ${colors[type]}`}>{children}</div>;
}

export function DemoLabel({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">{children}</span>;
}

export function BlockedLabel() {
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 border border-red-200">Blocked</span>;
}
