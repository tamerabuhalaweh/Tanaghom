import type { ReactNode } from 'react';

export function ExecutiveMetric({ label, value, sublabel, trend, icon }: { label: string; value: string | number; sublabel?: string; trend?: 'up' | 'down' | 'flat'; icon?: string }) {
  return (
    <div className="bg-gradient-to-br from-slate-950 to-slate-900 rounded-xl p-5 border border-slate-800">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          {sublabel && <p className="text-slate-500 text-xs mt-1">{sublabel}</p>}
        </div>
        {icon && <span className="text-2xl opacity-50">{icon}</span>}
        {trend && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${trend === 'up' ? 'bg-emerald-500/10 text-emerald-300' : trend === 'down' ? 'bg-rose-500/10 text-rose-300' : 'bg-slate-800 text-slate-400'}`}>
            {trend === 'up' ? 'up' : trend === 'down' ? 'down' : 'flat'}
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
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#334155" strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-in-out' }} />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-2xl font-bold text-white">{value}</span>
        <span className="text-xs text-slate-400">/{max}</span>
      </div>
      <span className="text-xs text-slate-400 mt-2 font-medium">{label}</span>
    </div>
  );
}

export function FlowTimeline({ steps }: { steps: { label: string; status: 'done' | 'active' | 'pending' | 'blocked'; badge?: string }[] }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {steps.map((step, i) => (
        <div key={`${step.label}-${i}`} className="flex items-center">
          <div className={`flex flex-col items-center ${step.status === 'active' ? 'z-10' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
              ${step.status === 'done' ? 'bg-emerald-600 border-emerald-500 text-white' :
                step.status === 'active' ? 'bg-sky-600 border-sky-400 text-white ring-4 ring-sky-400/30' :
                step.status === 'blocked' ? 'bg-rose-950/60 border-rose-700 text-rose-300' :
                'bg-slate-900 border-slate-700 text-slate-500'}`}>
              {step.status === 'done' ? 'OK' : step.status === 'blocked' ? 'X' : i + 1}
            </div>
            <span className={`text-xs mt-1 whitespace-nowrap ${step.status === 'active' ? 'text-sky-300 font-medium' : step.status === 'done' ? 'text-emerald-300' : step.status === 'blocked' ? 'text-rose-300' : 'text-slate-500'}`}>
              {step.label}
            </span>
            {step.badge && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 mt-0.5">{step.badge}</span>}
          </div>
          {i < steps.length - 1 && <div className={`w-8 h-0.5 mx-1 ${step.status === 'done' ? 'bg-emerald-600' : 'bg-slate-800'}`} />}
        </div>
      ))}
    </div>
  );
}

export function IntegrationStatusCard({ name, status, direction, icon }: { name: string; status: string; direction: string; icon?: string }) {
  const statusColors: Record<string, string> = {
    working: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40',
    mock: 'bg-violet-500/10 text-violet-300 border-violet-500/40',
    sandbox_ready: 'bg-sky-500/10 text-sky-300 border-sky-500/40',
    planned: 'bg-slate-800 text-slate-300 border-slate-700',
    blocked: 'bg-rose-500/10 text-rose-300 border-rose-500/40',
  };
  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {icon && <span className="text-lg opacity-60">{icon}</span>}
        <div>
          <div className="text-sm font-medium text-slate-200">{name}</div>
          <div className="text-xs text-slate-500">{direction}</div>
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
    linkedin: { bg: 'from-sky-900/30 to-sky-800/20', accent: 'text-sky-300', icon: 'in' },
    instagram: { bg: 'from-pink-900/30 to-violet-800/20', accent: 'text-pink-300', icon: 'ig' },
    x: { bg: 'from-slate-800/50 to-slate-900/30', accent: 'text-slate-300', icon: 'x' },
    twitter: { bg: 'from-slate-800/50 to-slate-900/30', accent: 'text-slate-300', icon: 'x' },
  };
  const style = platformStyles[platform] || platformStyles.linkedin;

  return (
    <div className={`bg-gradient-to-br ${style.bg} border border-slate-800 rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-sm font-bold ${style.accent}`}>{style.icon}</span>
        <span className={`text-xs font-medium ${style.accent} capitalize`}>{platform}</span>
        {engagement && <span className="ml-auto text-xs text-emerald-300">{engagement}</span>}
      </div>
      <p className="text-sm text-slate-300 leading-relaxed line-clamp-4">{content}</p>
    </div>
  );
}

export function SafetyGateCard({ gates }: { gates: { label: string; status: 'blocked' | 'clear' | 'required' }[] }) {
  return (
    <div className="bg-gradient-to-br from-slate-950 to-slate-900 rounded-xl border border-slate-800 p-4">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Safety Gates</h3>
      <div className="grid grid-cols-2 gap-2">
        {gates.map((gate, i) => (
          <div key={`${gate.label}-${i}`} className="flex items-center justify-between bg-slate-900/80 rounded-lg px-3 py-2">
            <span className="text-xs text-slate-300">{gate.label}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${gate.status === 'blocked' ? 'bg-rose-500/10 text-rose-300' : gate.status === 'clear' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>
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
    <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        {icon && <span className="text-sm opacity-60">{icon}</span>}
        <span className="text-xs text-slate-400 uppercase tracking-wider">{title}</span>
      </div>
      <p className="text-sm font-medium text-slate-200">{value}</p>
      {confidence !== undefined && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-sky-500 rounded-full" style={{ width: `${confidence}%` }} />
          </div>
          <span className="text-[10px] text-slate-500">{confidence}%</span>
        </div>
      )}
    </div>
  );
}

export function Badge({ children, variant = 'default' }: { children: ReactNode; variant?: 'success' | 'warning' | 'danger' | 'info' | 'mock' | 'blocked' | 'default' }) {
  const colors: Record<string, string> = {
    success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40',
    warning: 'bg-amber-500/10 text-amber-300 border-amber-500/40',
    danger: 'bg-rose-500/10 text-rose-300 border-rose-500/40',
    info: 'bg-sky-500/10 text-sky-300 border-sky-500/40',
    mock: 'bg-violet-500/10 text-violet-300 border-violet-500/40',
    blocked: 'bg-rose-500/10 text-rose-300 border-rose-500/40',
    default: 'bg-slate-800 text-slate-300 border-slate-700',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors[variant]}`}>{children}</span>;
}

export function DemoBanner() {
  return (
    <div className="bg-gradient-to-r from-emerald-500/10 via-slate-900 to-sky-500/10 border border-slate-800 rounded-lg px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-emerald-300 text-sm font-bold">Sandbox POC</span>
        <span className="text-slate-600 text-xs">|</span>
        <span className="text-slate-400 text-xs">External Writes OFF</span>
        <span className="text-slate-600 text-xs">|</span>
        <span className="text-slate-400 text-xs">M5 Disabled</span>
        <span className="text-slate-600 text-xs">|</span>
        <span className="text-slate-400 text-xs">Postiz Sandbox Reachable</span>
      </div>
      <span className="text-[10px] text-slate-600 font-mono">Commercial/Social POC MVP</span>
    </div>
  );
}
