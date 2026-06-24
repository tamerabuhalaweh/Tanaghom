import { Outlet, Link, useLocation } from 'react-router-dom'
import { DemoBanner } from './ExecutiveUI'
import {
  Activity,
  Bot,
  Brain,
  ClipboardCheck,
  FileCheck2,
  Gauge,
  KeyRound,
  Layers3,
  LayoutDashboard,
  Megaphone,
  Network,
  PlugZap,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react'

const NAV_ITEMS = [
  { path: '/command-center', label: 'Command Center', icon: LayoutDashboard, group: 'Commercial/Social' },
  { path: '/campaigns', label: 'Campaigns', icon: Megaphone, group: 'Commercial/Social' },
  { path: '/ideas', label: 'AI Draft Studio', icon: Sparkles, group: 'Commercial/Social' },
  { path: '/approvals', label: 'Approvals', icon: ClipboardCheck, group: 'Commercial/Social' },
  { path: '/publishing', label: 'Publishing', icon: FileCheck2, group: 'Commercial/Social' },
  { path: '/analytics', label: 'Analytics', icon: Gauge, group: 'Commercial/Social' },
  { path: '/crm', label: 'Leads', icon: Activity, group: 'Commercial/Social' },
  { path: '/mcp-engine', label: 'Integrations', icon: PlugZap, group: 'Commercial/Social' },
  { path: '/observability', label: 'Evidence', icon: Workflow, group: 'Commercial/Social' },
  { path: '/ai-settings', label: 'AI Provider', icon: Brain, group: 'Admin' },
  { path: '/admin-users', label: 'Users/Roles', icon: Users, group: 'Admin' },
  { path: '/agent-skills', label: 'Agent Skills', icon: Bot, group: 'Admin' },
  { path: '/ghl-wizard', label: 'GHL Setup', icon: Network, group: 'Admin' },
  { path: '/integration-credentials', label: 'Credentials', icon: KeyRound, group: 'Admin' },
  { path: '/ghl-readiness', label: 'GHL Evidence', icon: Layers3, group: 'Admin' },
  { path: '/safety', label: 'Safety Gates', icon: ShieldCheck, group: 'Admin' },
]

export default function Layout() {
  const location = useLocation()

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <nav className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col">
        <div className="p-5 border-b border-slate-800">
          <h1 className="text-base font-bold text-white tracking-tight">Tanaghum</h1>
          <p className="mt-1 text-[11px] font-medium text-slate-500">Commercial/Social AI Operating System</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {['Commercial/Social', 'Admin'].map(group => (
            <div key={group} className="mb-5">
              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">{group}</div>
              <div className="space-y-0.5">
                {NAV_ITEMS.filter(item => item.group === group).map((item) => {
                  const Icon = item.icon
                  const active = location.pathname === item.path || (location.pathname === '/' && item.path === '/command-center')
                  return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                      active
                        ? 'border border-sky-500/30 bg-sky-500/15 font-medium text-white shadow-sm shadow-sky-950/40'
                        : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? 'text-sky-300' : 'text-slate-500'}`} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                )})}
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-slate-800">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] font-medium text-emerald-300">
            Sandbox Workspace
          </div>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.08),transparent_28%),linear-gradient(180deg,#020617,#020617)]">
        <div className="p-4">
          <DemoBanner />
          <div className="mt-4">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}
