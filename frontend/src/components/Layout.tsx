import { Outlet, Link, useLocation } from 'react-router-dom'
import { DemoBanner } from './ExecutiveUI'

const NAV_ITEMS = [
  { path: '/command-center', label: 'Command Center', icon: '◉' },
  { path: '/', label: 'Dashboard', icon: '◈' },
  { path: '/campaigns', label: 'Campaigns', icon: '◆' },
  { path: '/approvals', label: 'Approvals', icon: '✦' },
  { path: '/analytics', label: 'Analytics', icon: '◉' },
  { path: '/mcp-engine', label: 'MCP Engine', icon: '⬡' },
  { path: '/agent-skills', label: 'Agent Skills', icon: '⎔' },
  { path: '/ghl-readiness', label: 'GoHighLevel', icon: '◇' },
  { path: '/ghl-wizard', label: 'GHL Wizard', icon: '⚙' },
  { path: '/ai-settings', label: 'AI Provider', icon: '◎' },
  { path: '/safety', label: 'Safety', icon: '△' },
]

export default function Layout() {
  const location = useLocation()

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Sidebar */}
      <nav className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-base font-bold text-white tracking-tight">Tanaghum</h1>
          <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-widest">AI Operating Platform</p>
        </div>
        <div className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                location.pathname === item.path
                  ? 'bg-blue-600/20 text-blue-400 font-medium border border-blue-500/30'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              <span className="text-xs w-4 text-center opacity-60">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
        <div className="p-3 border-t border-gray-800">
          <div className="text-[10px] text-gray-600 text-center">STITCH v1.0 • SAIF v1.2</div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
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
