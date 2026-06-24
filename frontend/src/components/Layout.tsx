import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { DemoBanner } from './ExecutiveUI'
import { useAuth } from '../contexts/useAuth'
import {
  Bot,
  Brain,
  ClipboardCheck,
  Gauge,
  KeyRound,
  Layers3,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Network,
  PlugZap,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  X,
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

const GROUPS = ['Product', 'Admin / Settings / Technical']

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)

  useEffect(() => {
    if (!sidebarOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [sidebarOpen])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const getUserEmail = (): string => {
    if (typeof user === 'object' && user !== null) {
      const u = user as Record<string, unknown>
      return String(u.email || u.name || 'User')
    }
    return 'User'
  }

  const isActive = (itemPath: string): boolean => {
    if (location.pathname === itemPath) return true
    if (location.pathname === '/' && itemPath === '/command-center') return true
    return false
  }

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between p-5 border-b border-white/10">
        <div>
          <h1 className="text-base font-bold text-white tracking-tight">Tanaghum</h1>
          <p className="mt-1 text-[11px] font-medium text-white/45">Commercial/Social AI Operating System</p>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden text-white/60 hover:text-white p-1"
          aria-label="Close navigation menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-3" aria-label="Main navigation">
        {GROUPS.map(group => (
          <div key={group} className="mb-5">
            <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">
              {group}
            </div>
            <div className="space-y-0.5">
              {NAV_ITEMS.filter(item => item.group === group).map((item) => {
                const Icon = item.icon
                const active = isActive(item.path)
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                      active
                        ? 'border border-white/10 bg-white text-black font-medium shadow-sm'
                        : 'text-white/58 hover:bg-white/8 hover:text-white'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-black' : 'text-white/35'}`} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-white/10">
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
              {getUserEmail().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-white">{getUserEmail()}</div>
              <div className="text-[10px] text-white/40">Sandbox Workspace</div>
            </div>
            <button
              onClick={handleLogout}
              className="shrink-0 rounded-md p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-[var(--color-surface)] text-[var(--color-text-primary)]">
      <a href="#main-content" className="skip-to-content">Skip to content</a>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-[var(--color-surface-dark)] transition-transform duration-200 lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Navigation sidebar"
        aria-hidden={!sidebarOpen}
      >
        {SidebarContent}
      </aside>

      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 bg-[var(--color-surface-dark)] border-r border-black/10">
        {SidebarContent}
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-black/8 bg-white px-4 py-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-2 text-slate-950 hover:bg-gray-100"
            aria-label="Open navigation menu"
            aria-expanded={sidebarOpen}
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-slate-950">Tanaghum</span>
        </header>

        <main id="main-content" className="flex-1 overflow-y-auto bg-[var(--color-surface)]">
          <div className="p-4 sm:p-5">
            {!bannerDismissed && (
              <DemoBanner onDismiss={() => setBannerDismissed(true)} />
            )}
            <div className="mt-4 sm:mt-5">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
