import { Outlet, Link, useLocation } from 'react-router-dom'
import { DemoBanner } from './ExecutiveUI'

const NAV_ITEMS = [
  { path: '/command-center', label: 'Commercial Command Center', icon: 'CC', group: 'Commercial/Social Product' },
  { path: '/campaigns', label: 'Campaign Workspace', icon: 'CW', group: 'Commercial/Social Product' },
  { path: '/ideas', label: 'AI Post Ideas', icon: 'PI', group: 'Commercial/Social Product' },
  { path: '/approvals', label: 'Approval Queue', icon: 'AQ', group: 'Commercial/Social Product' },
  { path: '/analytics', label: 'Analytics Intelligence', icon: 'AI', group: 'Commercial/Social Product' },
  { path: '/crm', label: 'Lead Intelligence', icon: 'LI', group: 'Commercial/Social Product' },
  { path: '/ghl-wizard', label: 'GHL Wizard', icon: 'GH', group: 'Commercial/Social Product' },
  { path: '/observability', label: 'Evidence / Audit', icon: 'EV', group: 'Commercial/Social Product' },
  { path: '/mcp-engine', label: 'MCP / Integrations', icon: 'MC', group: 'Admin / Technical' },
  { path: '/agent-skills', label: 'Agent Skills', icon: 'SK', group: 'Admin / Technical' },
  { path: '/ghl-readiness', label: 'GoHighLevel Readiness', icon: 'GR', group: 'Admin / Technical' },
  { path: '/ai-settings', label: 'AI Provider', icon: 'AP', group: 'Admin / Technical' },
  { path: '/integration-credentials', label: 'Credentials', icon: 'CR', group: 'Admin / Technical' },
  { path: '/admin-users', label: 'Users & AgentReps', icon: 'UR', group: 'Admin / Technical' },
  { path: '/safety', label: 'Safety Gates', icon: 'SF', group: 'Admin / Technical' },
]

export default function Layout() {
  const location = useLocation()

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <nav className="w-60 bg-slate-950 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h1 className="text-base font-bold text-white tracking-tight">Tanaghum</h1>
          <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-widest">AI Operating Platform</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {['Commercial/Social Product', 'Admin / Technical'].map(group => (
            <div key={group} className="mb-4">
              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">{group}</div>
              <div className="space-y-0.5">
                {NAV_ITEMS.filter(item => item.group === group).map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all ${
                      location.pathname === item.path || (location.pathname === '/' && item.path === '/command-center')
                        ? 'border border-sky-500/30 bg-sky-500/15 font-medium text-sky-300'
                        : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                    }`}
                  >
                    <span className="w-5 rounded bg-slate-900 px-1 py-0.5 text-center text-[9px] font-semibold text-slate-500">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-slate-800">
          <div className="text-[10px] text-slate-600 text-center">Sandbox Product Environment</div>
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
