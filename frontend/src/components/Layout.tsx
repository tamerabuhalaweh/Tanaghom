import { useEffect, useMemo, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bot,
  Brain,
  Building2,
  ClipboardCheck,
  FileClock,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Network,
  ServerCog,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { ProductStatus } from './ProductUI';

type NavGroup = 'Product' | 'Admin';
type NavItem = {
  path: string;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
  group: NavGroup;
  roles?: string[];
};

const PRODUCT_ROLES = [
  'admin',
  'cco',
  'department_head',
  'social_media_manager',
  'social_media_specialist',
  'marketing_manager',
  'sales_manager',
  'lead_qualification_manager',
  'reviewer',
  'viewer',
  'specialist',
];

const ADMIN_ROLES = ['admin', 'cco', 'department_head'];

const NAV_ITEMS: NavItem[] = [
  {
    path: '/command-center',
    label: 'Dashboard',
    description: 'Your content overview',
    icon: LayoutDashboard,
    group: 'Product',
    roles: PRODUCT_ROLES,
  },
  {
    path: '/campaigns',
    label: 'Campaigns',
    description: 'Create and manage campaigns',
    icon: Megaphone,
    group: 'Product',
    roles: PRODUCT_ROLES.filter(role => role !== 'viewer'),
  },
  {
    path: '/ideas',
    label: 'Content Creator',
    description: 'Ideas and campaign creation',
    icon: Sparkles,
    group: 'Product',
    roles: PRODUCT_ROLES.filter(role => role !== 'viewer'),
  },
  {
    path: '/approvals',
    label: 'Review & Approve',
    description: 'Review and approve content',
    icon: ClipboardCheck,
    group: 'Product',
    roles: ['admin', 'cco', 'department_head', 'social_media_manager', 'marketing_manager', 'reviewer'],
  },
  {
    path: '/publishing',
    label: 'Scheduling',
    description: 'Content packages and scheduling',
    icon: Send,
    group: 'Product',
    roles: ['admin', 'cco', 'department_head', 'social_media_manager', 'marketing_manager', 'reviewer'],
  },
  {
    path: '/analytics',
    label: 'Performance',
    description: 'Results and customer interest',
    icon: BarChart3,
    group: 'Product',
    roles: PRODUCT_ROLES,
  },
  {
    path: '/my-agent-rep',
    label: 'My Profile',
    description: 'Your role and permissions',
    icon: UserRound,
    group: 'Product',
    roles: PRODUCT_ROLES,
  },
  {
    path: '/account-security',
    label: 'Account Security',
    description: 'MFA and recovery codes',
    icon: ShieldCheck,
    group: 'Product',
    roles: PRODUCT_ROLES,
  },
  {
    path: '/ai-settings',
    label: 'AI Settings',
    description: 'Connect your AI model',
    icon: Brain,
    group: 'Product',
    roles: PRODUCT_ROLES,
  },
  {
    path: '/admin-users',
    label: 'Users & Roles',
    description: 'Accounts and AgentReps',
    icon: Users,
    group: 'Admin',
    roles: ADMIN_ROLES,
  },
  {
    path: '/tenant-admin',
    label: 'Tenant Admin',
    description: 'Workspace isolation',
    icon: Building2,
    group: 'Admin',
    roles: ADMIN_ROLES,
  },
  {
    path: '/agent-skills',
    label: 'Agent Skills',
    description: 'Governed skill inventory',
    icon: Bot,
    group: 'Admin',
    roles: ADMIN_ROLES,
  },
  {
    path: '/operations',
    label: 'Operations',
    description: 'Monitoring and backups',
    icon: ServerCog,
    group: 'Admin',
    roles: ADMIN_ROLES,
  },
  {
    path: '/mcp-engine',
    label: 'Integrations',
    description: 'Connector registry',
    icon: Network,
    group: 'Admin',
    roles: ADMIN_ROLES,
  },
  {
    path: '/integration-credentials',
    label: 'Credentials',
    description: 'Secret status only',
    icon: KeyRound,
    group: 'Admin',
    roles: ADMIN_ROLES,
  },
  {
    path: '/safety',
    label: 'Security',
    description: 'Publishing controls',
    icon: ShieldCheck,
    group: 'Admin',
    roles: ADMIN_ROLES,
  },
  {
    path: '/observability',
    label: 'Activity Log',
    description: 'Your activity records',
    icon: FileClock,
    group: 'Admin',
    roles: ADMIN_ROLES,
  },
];

const GROUPS: NavGroup[] = ['Product', 'Admin'];

function getStringField(source: unknown, keys: string[], fallback = ''): string {
  if (!source || typeof source !== 'object') return fallback;
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return fallback;
}

function normalizeRole(role: string): string {
  return role.trim().toLowerCase().replaceAll(' ', '_').replaceAll('-', '_');
}

function isVisibleForRole(item: NavItem, role: string): boolean {
  if (!item.roles || item.roles.length === 0) return true;
  if (!role || role === 'unknown') return true;
  return item.roles.includes(role);
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!sidebarOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [sidebarOpen]);

  const email = getStringField(user, ['email', 'name'], 'User');
  const displayName = getStringField(user, ['name', 'email'], email);
  const role = normalizeRole(getStringField(user, ['role'], 'unknown'));

  const visibleNav = useMemo(
    () => NAV_ITEMS.filter(item => isVisibleForRole(item, role)),
    [role],
  );

  const currentItem = visibleNav.find(item => location.pathname === item.path)
    || visibleNav.find(item => location.pathname.startsWith(item.path) && item.path !== '/')
    || NAV_ITEMS.find(item => item.path === '/command-center');

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const isActive = (path: string): boolean => {
    if (location.pathname === path) return true;
    if (location.pathname === '/' && path === '/command-center') return true;
    return false;
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-neutral-200 px-4">
        <Link to="/command-center" onClick={() => setSidebarOpen(false)} className="min-w-0">
          <div className="text-sm font-semibold tracking-tight text-neutral-950">Tanaghum</div>
          <div className="text-xs text-neutral-500">Content Studio</div>
        </Link>
        <button
          onClick={() => setSidebarOpen(false)}
          className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 lg:hidden"
          aria-label="Close navigation menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        {GROUPS.map(group => {
          const groupItems = visibleNav.filter(item => item.group === group);
          if (!groupItems.length) return null;
          return (
            <div key={group} className="mb-6">
              <div className="px-2 pb-2 text-xs font-medium text-neutral-500">
                {group === 'Product' ? 'Content Studio' : 'Admin & Settings'}
              </div>
              <div className="space-y-1">
                {groupItems.map(item => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      data-active={active ? 'true' : 'false'}
                      className="nav-link flex items-start gap-3 rounded-md px-3 py-2.5 text-sm"
                    >
                      <Icon className="nav-link-icon mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block font-medium">{item.label}</span>
                        <span className="nav-link-description block truncate text-xs">{item.description}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-neutral-200 p-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-neutral-950 text-sm font-semibold text-white">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-neutral-950">{displayName}</div>
              <div className="truncate text-xs text-neutral-500">{role === 'unknown' ? 'Sandbox user' : role.replaceAll('_', ' ')}</div>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-neutral-50 text-neutral-950">
      <a href="#main-content" className="skip-to-content">Skip to content</a>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 transform border-r border-neutral-200 bg-white transition-transform duration-200 lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Navigation sidebar"
        aria-hidden={!sidebarOpen}
      >
        {sidebar}
      </aside>

      <aside className="hidden w-72 shrink-0 border-r border-neutral-200 bg-white lg:block" aria-label="Navigation sidebar">
        {sidebar}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-neutral-200 bg-white/90 px-4 backdrop-blur lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-md border border-neutral-200 p-2 text-neutral-700 hover:bg-neutral-100 lg:hidden"
              aria-label="Open navigation menu"
              aria-expanded={sidebarOpen}
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-neutral-950">{currentItem?.label || 'Content Studio'}</div>
              <div className="truncate text-xs text-neutral-500">{currentItem?.description || 'Product workspace'}</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <ProductStatus tone="warn">Publishing Controlled</ProductStatus>
            <ProductStatus tone="info">Review Required</ProductStatus>
          </div>
        </header>

        <main id="main-content" className="min-h-0 flex-1 overflow-y-auto">
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
