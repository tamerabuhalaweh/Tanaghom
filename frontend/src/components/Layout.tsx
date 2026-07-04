import { useEffect, useMemo, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bot,
  Brain,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleHelp,
  ClipboardCheck,
  FileClock,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Network,
  PhoneCall,
  ServerCog,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
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

const ADMIN_ROLES = ['admin', 'cco'];
const CONNECTOR_SETUP_ROLES = ['admin', 'cco', 'department_head', 'marketing_manager'];

const NAV_ITEMS: NavItem[] = [
  {
    path: '/command-center',
    label: 'Dashboard',
    description: 'Events, leads, spend and sales',
    icon: LayoutDashboard,
    group: 'Product',
    roles: PRODUCT_ROLES,
  },
  {
    path: '/growth',
    label: 'Growth Engine',
    description: 'Course sales and lead growth',
    icon: TrendingUp,
    group: 'Product',
    roles: PRODUCT_ROLES,
  },
  {
    path: '/events',
    label: 'Events',
    description: 'Plan and operate each event',
    icon: CalendarDays,
    group: 'Product',
    roles: ['admin', 'cco', 'department_head', 'marketing_manager', 'social_media_manager', 'sales_manager', 'lead_qualification_manager', 'viewer'],
  },
  {
    path: '/integration-credentials',
    label: 'Connector Setup',
    description: 'Data sources and imports',
    icon: KeyRound,
    group: 'Product',
    roles: CONNECTOR_SETUP_ROLES,
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
    path: '/smartlabs-voice',
    label: 'SmartLabs Voice',
    description: 'Voice agent connector',
    icon: PhoneCall,
    group: 'Admin',
    roles: CONNECTOR_SETUP_ROLES,
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
const GUIDE_STORAGE_KEY = 'tanaghum-setup-guide-dismissed';

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
  if (!role || role === 'unknown') return item.group !== 'Admin';
  return item.roles.includes(role);
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminExpanded, setAdminExpanded] = useState(false);
  const [guideOpen, setGuideOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(GUIDE_STORAGE_KEY) !== 'true';
  });

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
    if (path === '/events' && location.pathname.startsWith('/events') && location.pathname !== '/events/master') return true;
    return false;
  };
  const adminNavVisible = adminExpanded || currentItem?.group === 'Admin';

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
              {group === 'Admin' ? (
                <button
                  type="button"
                  onClick={() => setAdminExpanded(current => !current)}
                  className="mb-2 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  aria-expanded={adminNavVisible}
                >
                  <span>Admin & Settings</span>
                  <span aria-hidden="true">{adminNavVisible ? '-' : '+'}</span>
                </button>
              ) : (
                <div className="px-2 pb-2 text-xs font-medium text-neutral-500">Content Studio</div>
              )}
              <div className={`space-y-1 ${group === 'Admin' && !adminNavVisible ? 'hidden' : ''}`}>
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
            >
              <CircleHelp className="h-4 w-4" />
              <span className="hidden sm:inline">Setup Guide</span>
            </button>
            <span className="hidden sm:inline-flex">
              <ProductStatus tone="warn">Publishing Controlled</ProductStatus>
            </span>
            <span className="hidden sm:inline-flex">
              <ProductStatus tone="info">Review Required</ProductStatus>
            </span>
          </div>
        </header>

        <main id="main-content" className="min-h-0 flex-1 overflow-y-auto">
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
      <SetupGuide
        open={guideOpen}
        navItems={visibleNav}
        onClose={(dismiss = false) => {
          if (dismiss && typeof window !== 'undefined') {
            window.localStorage.setItem(GUIDE_STORAGE_KEY, 'true');
          }
          setGuideOpen(false);
        }}
      />
    </div>
  );
}

function SetupGuide({
  open,
  navItems,
  onClose,
}: {
  open: boolean;
  navItems: NavItem[];
  onClose: (dismiss?: boolean) => void;
}) {
  if (!open) return null;

  const canOpen = (path: string) => navItems.some(item => item.path === path);
  const steps = [
    {
      number: '1',
      title: 'Confirm your profile',
      body: 'Start with My Profile. Confirm your role, AgentRep, display currency, and the permissions attached to your account.',
      path: '/my-agent-rep',
      action: 'Open Profile',
    },
    {
      number: '2',
      title: 'Connect an AI model',
      body: 'Open AI Settings. Use the platform Gemma connection when available, or add your own provider key. Keys are encrypted and never shown again.',
      path: '/ai-settings',
      action: 'Open AI Settings',
    },
    {
      number: '3',
      title: 'Plan the event',
      body: 'Open Events. Select or create the event, then add the offer, audience, budget, channels, email, WhatsApp, upsell, and sales tasks.',
      path: '/events',
      action: 'Open Events',
    },
    {
      number: '4',
      title: 'Connect data sources',
      body: 'Use Connector Setup to add customer-owned credentials and validate imports. Normal users may need an admin or manager to do this step.',
      path: '/integration-credentials',
      action: 'Open Connectors',
    },
    {
      number: '5',
      title: 'Create campaign content',
      body: 'Use Content Creator to generate ideas, then Campaigns to produce platform-specific drafts for review.',
      path: '/ideas',
      action: 'Create Content',
    },
    {
      number: '6',
      title: 'Review, schedule, and measure',
      body: 'Use Review & Approve before Scheduling. Performance then shows leads, spend, forms, meetings, purchases, and lessons learned.',
      path: '/analytics',
      action: 'View Performance',
    },
  ];

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/45 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-6 py-5">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Getting Started</div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950">How to use Tanaghum</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
              Follow this path to set up your account, run an event workflow, generate content, approve safely, and read performance.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onClose(false)}
            className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
            aria-label="Close setup guide"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
          {steps.map(step => {
            const available = canOpen(step.path);
            return (
              <div key={step.number} className="flex min-h-[220px] flex-col rounded-lg border border-neutral-200 bg-neutral-50 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-950 text-sm font-semibold text-white">
                    {step.number}
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${available ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {available ? 'Available' : 'Ask manager'}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-neutral-950">{step.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-neutral-600">{step.body}</p>
                {available ? (
                  <Link
                    to={step.path}
                    onClick={() => onClose(false)}
                    className="mt-5 inline-flex min-h-10 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                  >
                    {step.action}
                  </Link>
                ) : (
                  <div className="mt-5 rounded-md border border-amber-200 bg-white px-3 py-2 text-sm text-amber-900">
                    This page is controlled by your role.
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 border-t border-neutral-100 bg-neutral-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-neutral-600">
            You can reopen this guide anytime from the top bar.
          </p>
          <button
            type="button"
            onClick={() => onClose(true)}
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100"
          >
            Got it, hide next time
          </button>
        </div>
      </div>
    </div>
  );
}
