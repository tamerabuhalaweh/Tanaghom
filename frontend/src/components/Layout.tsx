import { Outlet, Link, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '🏠' },
  { path: '/campaigns', label: 'Campaigns', icon: '📋' },
  { path: '/approvals', label: 'Approvals', icon: '✅' },
  { path: '/saif', label: 'SAIF Decisions', icon: '🧠' },
  { path: '/capabilities', label: 'Capabilities', icon: '⚙️' },
  { path: '/mcp', label: 'MCP Mediation', icon: '🔗' },
  { path: '/publishing', label: 'Publishing Prep', icon: '📦' },
  { path: '/spine', label: 'SPINE Timeline', icon: '📊' },
  { path: '/observability', label: 'Observability', icon: '👁️' },
  { path: '/assets', label: 'Asset Cognition', icon: '🎨' },
  { path: '/analytics', label: 'Analytics', icon: '📈' },
  { path: '/learning', label: 'Learning Signals', icon: '🧪' },
  { path: '/crm', label: 'CRM/WhatsApp', icon: '💬' },
  { path: '/production', label: 'Production', icon: '🎬' },
  { path: '/safety', label: 'Safety Status', icon: '🛡️' },
]

export default function Layout() {
  const location = useLocation()

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <nav className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-900">Tanaghum Platform</h1>
          <p className="text-xs text-gray-500 mt-1">STITCH Operating Substrate</p>
          <div className="mt-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
            Demo/Pilot Mode — M5 Blocked
          </div>
        </div>
        <div className="p-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm mb-1 ${
                location.pathname === item.path
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
