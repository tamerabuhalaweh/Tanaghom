import { Outlet, Link, useLocation } from 'react-router-dom'
import { DemoBanner } from './ExecutiveUI'
import {
  Bot,
  Brain,
  ClipboardCheck,
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
  { path: '/command-center', label: 'Command Center', icon: LayoutDashboard, group: 'Product' },
  { path: '/campaigns', label: 'Campaigns', icon: Megaphone, group: 'Product' },
  { path: '/ideas', label: 'AI Draft Studio', icon: Sparkles, group: 'Product' },
  { path: '/approvals', label: 'Approvals & Publishing', icon: ClipboardCheck, group: 'Product' },
  { path: '/analytics', label: 'Analytics & Leads', icon: Gauge, group: 'Product' },
  { path: '/ai-settings', label: 'AI Provider', icon: Brain, group: 'Admin / Settings / Technical' },
  { path: '/admin-users', label: 'Users/Roles', icon: Users, group: 'Admin / Settings / Technical' },
  { path: '/agent-skills', label: 'Agent Skills', icon: Bot, group: 'Admin / Settings / Technical' },
  { path: '/ghl-wizard', label: 'GHL Setup', icon: Network, group: 'Admin / Settings / Technical' },
  { path: '/integration-credentials', label: 'Credentials', icon: KeyRound, group: 'Admin / Settings / Technical' },
  { path: '/ghl-readiness', label: 'GHL Evidence', icon: Layers3, group: 'Admin / Settings / Technical' },
  { path: '/safety', label: 'Safety Gates', icon: ShieldCheck, group: 'Admin / Settings / Technical' },
  { path: '/mcp-engine', label: 'MCP / Integrations', icon: PlugZap, group: 'Admin / Settings / Technical' },
  { path: '/observability', label: 'Evidence / Audit', icon: Workflow, group: 'Admin / Settings / Technical' },
]

export default function Layout() {
  const location = useLocation()

  return (
    <div className="flex h-screen bg-[#f6f4ef] text-slate-950">
      <nav className="w-64 bg-[#10100f] border-r border-black/10 flex flex-col text-white">
        <div className="p-5 border-b border-white/10">
          <h1 className="text-base font-bold text-white tracking-tight">Tanaghum</h1>
          <p className="mt-1 text-[11px] font-medium text-white/45">Commercial/Social AI Operating System</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {['Product', 'Admin / Settings / Technical'].map(group => (
            <div key={group} className="mb-5">
              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">{group}</div>
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
                        ? 'border border-white/10 bg-white text-black font-medium shadow-sm'
                        : 'text-white/58 hover:bg-white/8 hover:text-white'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? 'text-black' : 'text-white/35'}`} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                )})}
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-white/10">
          <div className="rounded-lg border border-white/10 bg-white/8 px-3 py-2 text-[11px] font-medium text-white/70">
            Sandbox Workspace
          </div>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto bg-[#f6f4ef]">
        <div className="p-5">
          <DemoBanner />
          <div className="mt-5">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}
