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
  Send,
  ServerCog,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { StitchiFloatingAssistant } from './StitchiAssistant';

type NavGroup = 'Product' | 'Setup' | 'Admin';
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
    label: 'Home',
    description: 'Today, events, leads and sales',
    icon: LayoutDashboard,
    group: 'Product',
    roles: PRODUCT_ROLES,
  },
  {
    path: '/stitchi',
    label: 'Stitchi',
    description: 'Ask AI to prepare work',
    icon: Bot,
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
    path: '/ideas',
    label: 'Content',
    description: 'Ideas, posts and campaign content',
    icon: Sparkles,
    group: 'Product',
    roles: PRODUCT_ROLES.filter(role => role !== 'viewer'),
  },
  {
    path: '/approvals',
    label: 'Review',
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
    description: 'Leads, spend, sales and results',
    icon: BarChart3,
    group: 'Product',
    roles: PRODUCT_ROLES,
  },
  {
    path: '/integration-credentials',
    label: 'Integrations',
    description: 'Connect customer data sources',
    icon: KeyRound,
    group: 'Setup',
    roles: CONNECTOR_SETUP_ROLES,
  },
  {
    path: '/campaigns',
    label: 'Campaigns',
    description: 'Manage campaign drafts',
    icon: Megaphone,
    group: 'Product',
    roles: PRODUCT_ROLES.filter(role => role !== 'viewer'),
  },
  {
    path: '/my-agent-rep',
    label: 'My Profile',
    description: 'Your role, profile and currency',
    icon: UserRound,
    group: 'Setup',
    roles: PRODUCT_ROLES,
  },
  {
    path: '/account-security',
    label: 'Account Security',
    description: 'MFA and recovery codes',
    icon: ShieldCheck,
    group: 'Setup',
    roles: PRODUCT_ROLES,
  },
  {
    path: '/ai-settings',
    label: 'AI Settings',
    description: 'Connect your AI model',
    icon: Brain,
    group: 'Setup',
    roles: PRODUCT_ROLES,
  },
  {
    path: '/smartlabs-voice',
    label: 'SmartLabs Voice',
    description: 'Voice agent connector',
    icon: PhoneCall,
    group: 'Setup',
    roles: CONNECTOR_SETUP_ROLES,
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
    path: '/runtime-infrastructure',
    label: 'Runtime Evidence',
    description: 'Internal runtime status',
    icon: Network,
    group: 'Admin',
    roles: ADMIN_ROLES,
  },
  {
    path: '/mcp-engine',
    label: 'Connector Registry',
    description: 'Technical connector records',
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
    description: 'Activity records',
    icon: FileClock,
    group: 'Admin',
    roles: ADMIN_ROLES,
  },
];

const GUIDE_STORAGE_KEY = 'tanaghum-setup-guide-dismissed';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

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

function activeForPath(currentPath: string, itemPath: string): boolean {
  if (currentPath === itemPath) return true;
  if (currentPath === '/' && itemPath === '/command-center') return true;
  if (itemPath === '/events' && currentPath.startsWith('/events') && currentPath !== '/events/master') return true;
  return false;
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMobileOpen(false);
      setSetupOpen(false);
      setAdminOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const email = getStringField(user, ['email', 'name'], 'User');
  const displayName = getStringField(user, ['name', 'email'], email);
  const role = normalizeRole(getStringField(user, ['role'], 'unknown'));

  const visibleNav = useMemo(
    () => NAV_ITEMS.filter(item => isVisibleForRole(item, role)),
    [role],
  );
  const productNav = visibleNav.filter(item => item.group === 'Product' && item.path !== '/campaigns');
  const setupNav = visibleNav.filter(item => item.group === 'Setup');
  const adminNav = visibleNav.filter(item => item.group === 'Admin');
  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#f4f4f8] text-neutral-950">
      <a href="#main-content" className="skip-to-content">Skip to content</a>

      <header className="sticky top-0 z-50 border-b border-black/5 bg-[#f4f4f8]/88 backdrop-blur-xl">
        <div className="mx-auto flex min-h-20 max-w-[1560px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/command-center" className="flex shrink-0 items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#080813] text-white shadow-[0_16px_40px_rgba(8,8,19,0.22)]">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="hidden min-w-[132px] sm:block">
              <span className="block text-sm font-semibold tracking-tight">Tanaghum</span>
              <span className="block text-xs text-neutral-500">Commercial workspace</span>
            </span>
          </Link>

          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-2 2xl:flex" aria-label="Primary workspace navigation">
            {productNav.map(item => (
              <NavPill key={item.path} item={item} active={activeForPath(location.pathname, item.path)} />
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-black/10 bg-white p-0 text-sm font-semibold text-neutral-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              aria-label="Open product guide"
            >
              <CircleHelp className="h-4 w-4" />
            </button>

            {setupNav.length > 0 && (
              <MenuButton
                label="Settings"
                open={setupOpen}
                setOpen={(next) => {
                  setSetupOpen(next);
                  if (next) setAdminOpen(false);
                }}
                items={setupNav}
                currentPath={location.pathname}
              />
            )}

            {adminNav.length > 0 && (
              <MenuButton
                label="Admin"
                open={adminOpen}
                setOpen={(next) => {
                  setAdminOpen(next);
                  if (next) setSetupOpen(false);
                }}
                items={adminNav}
                currentPath={location.pathname}
              />
            )}

            <UserMenu displayName={displayName} role={role} onLogout={handleLogout} />

            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 text-sm font-semibold text-neutral-900 shadow-sm 2xl:hidden"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
            >
              <Menu className="h-5 w-5" />
              <span className="hidden sm:inline">Menu</span>
            </button>
          </div>
        </div>
      </header>

      <MobileNavigation
        open={mobileOpen}
        items={visibleNav}
        currentPath={location.pathname}
        displayName={displayName}
        role={role}
        onClose={() => setMobileOpen(false)}
        onLogout={handleLogout}
      />

      <main id="main-content" className="mx-auto max-w-[1560px] px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      <StitchiFloatingAssistant />

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

function NavPill({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition',
        active
          ? 'border-[#080813] bg-[#080813] text-white shadow-[0_18px_40px_rgba(8,8,19,0.22)]'
          : 'border-black/8 bg-white text-neutral-700 hover:-translate-y-0.5 hover:border-black/15 hover:text-neutral-950 hover:shadow-md',
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{item.label}</span>
    </Link>
  );
}

function MenuButton({
  label,
  open,
  setOpen,
  items,
  currentPath,
}: {
  label: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  items: NavItem[];
  currentPath: string;
}) {
  return (
    <div className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cx(
          'inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
          open ? 'border-[#080813] bg-[#080813] text-white' : 'border-black/10 bg-white text-neutral-900',
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {label}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-3 w-80 overflow-hidden rounded-[1.35rem] border border-black/10 bg-white p-2 shadow-[0_24px_80px_rgba(8,8,19,0.22)]">
          {items.map(item => {
            const Icon = item.icon;
            const active = activeForPath(currentPath, item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setOpen(false)}
                className={cx(
                  'flex items-start gap-3 rounded-2xl px-3 py-3 text-sm transition hover:bg-neutral-50',
                  active && 'bg-neutral-950 text-white hover:bg-neutral-950',
                )}
              >
                <Icon className={cx('mt-0.5 h-4 w-4 shrink-0', active ? 'text-white' : 'text-neutral-500')} />
                <span className="min-w-0">
                  <span className="block font-semibold">{item.label}</span>
                  <span className={cx('mt-0.5 block text-xs leading-5', active ? 'text-white/60' : 'text-neutral-500')}>
                    {item.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UserMenu({ displayName, role, onLogout }: { displayName: string; role: string; onLogout: () => void }) {
  return (
    <div className="hidden items-center gap-3 rounded-full border border-black/10 bg-white py-1.5 pl-2 pr-3 shadow-sm lg:flex">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#080813] text-sm font-semibold text-white">
        {displayName.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0">
        <div className="max-w-36 truncate text-sm font-semibold leading-4 text-neutral-950">My Account</div>
        <div className="max-w-36 truncate text-xs text-neutral-500">{role === 'unknown' ? 'workspace user' : role.replaceAll('_', ' ')}</div>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="rounded-full p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950"
        aria-label="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

function MobileNavigation({
  open,
  items,
  currentPath,
  displayName,
  role,
  onClose,
  onLogout,
}: {
  open: boolean;
  items: NavItem[];
  currentPath: string;
  displayName: string;
  role: string;
  onClose: () => void;
  onLogout: () => void;
}) {
  if (!open) return null;

  const groups: NavGroup[] = ['Product', 'Setup', 'Admin'];
  const labels: Record<NavGroup, string> = {
    Product: 'Daily work',
    Setup: 'Account setup',
    Admin: 'Admin',
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/45 p-3 backdrop-blur-sm 2xl:hidden">
      <div className="flex max-h-full flex-col overflow-hidden rounded-[1.5rem] bg-[#080813] text-white shadow-[0_28px_90px_rgba(8,8,19,0.4)]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#080813]">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <div className="text-sm font-semibold">Tanaghum</div>
              <div className="text-xs text-white/45">Workspace menu</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-white/10 p-2 text-white/70" aria-label="Close navigation">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {groups.map(group => {
            const groupItems = items.filter(item => item.group === group);
            if (!groupItems.length) return null;
            return (
              <div key={group}>
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/35">{labels[group]}</div>
                <div className="grid gap-2">
                  {groupItems.map(item => {
                    const active = activeForPath(currentPath, item.path);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={onClose}
                        className={cx(
                          'flex items-start gap-3 rounded-2xl border px-4 py-3',
                          active ? 'border-white bg-white text-[#080813]' : 'border-white/10 bg-white/[0.04] text-white',
                        )}
                      >
                        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                          <span className="block text-sm font-semibold">{item.label}</span>
                          <span className={cx('mt-0.5 block text-xs leading-5', active ? 'text-neutral-500' : 'text-white/45')}>{item.description}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-semibold text-[#080813]">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{displayName}</div>
              <div className="truncate text-xs text-white/45">{role === 'unknown' ? 'workspace user' : role.replaceAll('_', ' ')}</div>
            </div>
            <button type="button" onClick={onLogout} className="rounded-full border border-white/10 p-2 text-white/70" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
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
      body: 'Start with My Profile. Confirm your role, display currency, and account permissions.',
      path: '/my-agent-rep',
      action: 'Open Profile',
    },
    {
      number: '2',
      title: 'Connect an AI model',
      body: 'Use AI Settings to connect the platform Gemma model or your own provider key. Keys are encrypted and hidden after save.',
      path: '/ai-settings',
      action: 'Open AI Settings',
    },
    {
      number: '3',
      title: 'Plan the event',
      body: 'Open Events. Choose or create the event, then confirm offer, audience, budget, channels, content, email, WhatsApp, upsell, and sales tasks.',
      path: '/events',
      action: 'Open Events',
    },
    {
      number: '4',
      title: 'Connect data sources',
      body: 'Use Integrations for GoHighLevel, Meta/Instagram, Postiz, Formaloo, YouTube, and SmartLabs. Only customer-owned credentials should be entered.',
      path: '/integration-credentials',
      action: 'Open Integrations',
    },
    {
      number: '5',
      title: 'Create content',
      body: 'Use Content to generate ideas and convert the best direction into campaign work.',
      path: '/ideas',
      action: 'Create Content',
    },
    {
      number: '6',
      title: 'Review and learn',
      body: 'Use Review before Scheduling. Performance then shows leads, spend, meetings, purchases, and lessons learned.',
      path: '/analytics',
      action: 'View Performance',
    },
  ];

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/55 px-4 py-6 backdrop-blur-sm">
      <div className="relative w-full max-w-6xl overflow-hidden rounded-[2rem] bg-[#080813] text-white shadow-[0_28px_90px_rgba(8,8,19,0.45)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-[#ff5268]/18 blur-3xl" />
          <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-[#00dcae]/14 blur-3xl" />
        </div>

        <div className="relative flex items-start justify-between gap-4 border-b border-white/10 px-6 py-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
              <span className="h-2 w-2 rounded-full bg-[#00dcae]" />
              Getting started
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">How to use Tanaghum</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/55">
              Follow this path to set up your account, run an event workflow, generate content, approve safely, and read performance.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onClose(false)}
            className="rounded-full border border-white/10 p-2 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Close setup guide"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
          {steps.map(step => {
            const available = canOpen(step.path);
            return (
              <div key={step.number} className="flex min-h-[230px] flex-col rounded-[1.35rem] border border-white/10 bg-white/[0.06] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-semibold text-[#080813]">
                    {step.number}
                  </div>
                  <span className={cx(
                    'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold',
                    available ? 'border-[#00dcae]/25 bg-[#00dcae]/10 text-[#70f5df]' : 'border-[#ffd166]/25 bg-[#ffd166]/10 text-[#ffd166]',
                  )}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {available ? 'Available' : 'Ask manager'}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-7 text-white/52">{step.body}</p>
                {available ? (
                  <Link
                    to={step.path}
                    onClick={() => onClose(false)}
                    className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#080813]"
                  >
                    {step.action}
                  </Link>
                ) : (
                  <div className="mt-5 rounded-2xl border border-[#ffd166]/20 bg-[#ffd166]/10 px-3 py-2 text-sm text-[#ffd166]">
                    This page is controlled by your role.
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="relative flex flex-col gap-3 border-t border-white/10 bg-white/[0.04] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-white/52">
            You can reopen this guide anytime from the top bar.
          </p>
          <button
            type="button"
            onClick={() => onClose(true)}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] px-5 py-2 text-sm font-semibold text-white hover:bg-white/[0.1]"
          >
            Got it, hide next time
          </button>
        </div>
      </div>
    </div>
  );
}
