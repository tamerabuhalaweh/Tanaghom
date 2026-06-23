import { Outlet, Link, useLocation } from 'react-router-dom'
import { DemoBanner } from './ExecutiveUI'

const NAV_ITEMS = [
  { path: '/command-center', label: 'Command Center', icon: 'CC' },
  { path: '/', label: 'Dashboard', icon: 'DB' },
  { path: '/campaigns', label: 'Campaigns', icon: 'CP' },
  { path: '/approvals', label: 'Approvals', icon: 'AP' },
  { path: '/analytics', label: 'Analytics', icon: 'AN' },
  { path: '/mcp-engine', label: 'MCP Engine', icon: 'MC' },
  { path: '/agent-skills', label: 'Agent Skills', icon: 'SK' },
  { path: '/ghl-readiness', label: 'GoHighLevel', icon: 'GH' },
  { path: '/ai-settings', label: 'AI Provider', icon: 'AI' },
  { path: '/safety', label: 'Safety', icon: 'SF' },
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
        <div className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                location.pathname === item.path
                  ? 'bg-sky-500/15 text-sky-300 font-medium border border-sky-500/30'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <span className="w-5 rounded bg-slate-900 px-1 py-0.5 text-center text-[9px] font-semibold text-slate-500">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
        <div className="p-3 border-t border-slate-800">
          <div className="text-[10px] text-slate-600 text-center">STITCH v1.0 | SAIF v1.2</div>
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
