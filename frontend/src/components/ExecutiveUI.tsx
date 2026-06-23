import type { ReactNode } from 'react';

export function ExecutiveMetric({ label, value, sublabel, trend, icon }: { label: string; value: string | number; sublabel?: string; trend?: 'up' | 'down' | 'flat'; icon?: string }) {
  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          {sublabel && <p className="text-gray-500 text-xs mt-1">{sublabel}</p>}
        </div>
        {icon && <span className="text-2xl opacity-50">{icon}</span>}
        {trend && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${trend === 'up' ? 'bg-green-900/50 text-green-400' : trend === 'down' ? 'bg-red-900/50 text-red-400' : 'bg-gray-700 text-gray-400'}`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </span>
        )}
      </div>
    </div>
  );
}

export function ReadinessGauge({ value, max = 100, label, size = 120 }: { value: number; max?: number; label: string; size?: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = pct >= 75 ? '#22c55e' : pct >= 50 ? '#eab308' : pct >= 25 ? '#f97316' : '#ef4444';

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#374151" strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-in-out' }} />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-2xl font-bold text-white">{value}</span>
        <span className="text-xs text-gray-400">/{max}</span>
      </div>
      <span className="text-xs text-gray-400 mt-2 font-medium">{label}</span>
    </div>
  );
}

export function FlowTimeline({ steps }: { steps: { label: string; status: 'done' | 'active' | 'pending' | 'blocked'; badge?: string }[] }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center">
          <div className={`flex flex-col items-center ${step.status === 'active' ? 'z-10' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
              ${step.status === 'done' ? 'bg-green-600 border-green-500 text-white' :
                step.status === 'active' ? 'bg-blue-600 border-blue-400 text-white ring-4 ring-blue-400/30' :
                step.status === 'blocked' ? 'bg-red-900/50 border-red-700 text-red-400' :
                'bg-gray-800 border-gray-600 text-gray-500'}`}>
              {step.status === 'done' ? '✓' : step.status === 'blocked' ? '✕' : i + 1}
            </div>
            <span className={`text-xs mt-1 whitespace-nowrap ${step.status === 'active' ? 'text-blue-400 font-medium' : step.status === 'done' ? 'text-green-400' : 'text-gray-500'}`}>
              {step.label}
            </span>
            {step.badge && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 mt-0.5">{step.badge}</span>}
          </div>
          {i < steps.length - 1 && <div className={`w-8 h-0.5 mx-1 ${step.status === 'done' ? 'bg-green-600' : 'bg-gray-700'}`} />}
        </div>
      ))}
    </div>
  );
}

export function IntegrationStatusCard({ name, status, direction, icon }: { name: string; status: string; direction: string; icon?: string }) {
  const statusColors: Record<string, string> = {
    working: 'bg-green-900/50 text-green-400 border-green-700',
    mock: 'bg-purple-900/50 text-purple-400 border-purple-700',
    sandbox_ready: 'bg-blue-900/50 text-blue-400 border-blue-700',
    planned: 'bg-gray-700/50 text-gray-400 border-gray-600',
    blocked: 'bg-red-900/50 text-red-400 border-red-700',
  };
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {icon && <span className="text-lg opacity-60">{icon}</span>}
        <div>
          <div className="text-sm font-medium text-gray-200">{name}</div>
          <div className="text-xs text-gray-500">{direction}</div>
        </div>
      </div>
      <span className={`text-xs font-medium px-2 py-0.5 rounded border ${statusColors[status] || statusColors.planned}`}>
        {status.replace('_', ' ')}
      </span>
    </div>
  );
}

export function PlatformPreviewCard({ platform, content, engagement }: { platform: string; content: string; engagement?: string }) {
  const platformStyles: Record<string, { bg: string; accent: string; icon: string }> = {
    linkedin: { bg: 'from-blue-900/30 to-blue-800/20', accent: 'text-blue-400', icon: 'in' },
    instagram: { bg: 'from-pink-900/30 to-purple-800/20', accent: 'text-pink-400', icon: 'ig' },
    twitter: { bg: 'from-sky-900/30 to-sky-800/20', accent: 'text-sky-400', icon: '𝕏' },
  };
  const style = platformStyles[platform] || platformStyles.linkedin;

  return (
    <div className={`bg-gradient-to-br ${style.bg} border border-gray-700 rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-sm font-bold ${style.accent}`}>{style.icon}</span>
        <span className={`text-xs font-medium ${style.accent} capitalize`}>{platform}</span>
        {engagement && <span className="ml-auto text-xs text-green-400">{engagement}</span>}
      </div>
      <p className="text-sm text-gray-300 leading-relaxed line-clamp-4">{content}</p>
    </div>
  );
}

export function SafetyGateCard({ gates }: { gates: { label: string; status: 'blocked' | 'clear' | 'required' }[] }) {
  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-gray-700 p-4">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Safety Gates</h3>
      <div className="grid grid-cols-2 gap-2">
        {gates.map((gate, i) => (
          <div key={i} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-300">{gate.label}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${gate.status === 'blocked' ? 'bg-red-900/60 text-red-400' : gate.status === 'clear' ? 'bg-green-900/60 text-green-400' : 'bg-yellow-900/60 text-yellow-400'}`}>
              {gate.status.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RecommendationCard({ title, value, confidence, icon }: { title: string; value: string; confidence?: number; icon?: string }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        {icon && <span className="text-sm opacity-60">{icon}</span>}
        <span className="text-xs text-gray-400 uppercase tracking-wider">{title}</span>
      </div>
      <p className="text-sm font-medium text-gray-200">{value}</p>
      {confidence !== undefined && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${confidence}%` }} />
          </div>
          <span className="text-[10px] text-gray-500">{confidence}%</span>
        </div>
      )}
    </div>
  );
}

export function Badge({ children, variant = 'default' }: { children: ReactNode; variant?: 'success' | 'warning' | 'danger' | 'info' | 'mock' | 'blocked' | 'default' }) {
  const colors: Record<string, string> = {
    success: 'bg-green-900/50 text-green-400 border-green-700',
    warning: 'bg-yellow-900/50 text-yellow-400 border-yellow-700',
    danger: 'bg-red-900/50 text-red-400 border-red-700',
    info: 'bg-blue-900/50 text-blue-400 border-blue-700',
    mock: 'bg-purple-900/50 text-purple-400 border-purple-700',
    blocked: 'bg-red-900/50 text-red-400 border-red-700',
    default: 'bg-gray-700/50 text-gray-400 border-gray-600',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors[variant]}`}>{children}</span>;
}

export function DemoBanner() {
  return (
    <div className="bg-gradient-to-r from-yellow-900/30 via-yellow-800/20 to-orange-900/30 border border-yellow-700/50 rounded-lg px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-yellow-400 text-sm font-bold">DEMO MODE</span>
        <span className="text-yellow-600 text-xs">|</span>
        <span className="text-yellow-500 text-xs">All external execution blocked</span>
        <span className="text-yellow-600 text-xs">|</span>
        <span className="text-yellow-500 text-xs">M5 disabled</span>
        <span className="text-yellow-600 text-xs">|</span>
        <span className="text-yellow-500 text-xs">Mock providers only</span>
      </div>
      <span className="text-[10px] text-yellow-600 font-mono">v0.1-stitch-foundation-demo</span>
    </div>
  );
}
