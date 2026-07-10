import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Brain,
  Building2,
  CalendarDays,
  ChevronRight,
  FileClock,
  Home,
  KeyRound,
  LogOut,
  Menu,
  MoreHorizontal,
  PenLine,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import './HybridShell.css';

type NavItem = {
  path: string;
  label: string;
  shortLabel?: string;
  description: string;
  icon: LucideIcon;
  roles?: string[];
  activePaths?: string[];
};

const PRODUCT_ROLES = [
  'admin',
  'cco',
  'department_head',
  'marketing_manager',
  'social_media_manager',
  'social_media_specialist',
  'sales_manager',
  'lead_qualification_manager',
  'specialist',
  'reviewer',
  'viewer',
];

const CONTENT_ROLES = PRODUCT_ROLES.filter(role => role !== 'viewer');
const SETUP_ROLES = ['admin', 'cco', 'department_head', 'marketing_manager'];
const ADMIN_ROLES = ['admin', 'cco'];
const EXECUTIVE_ROLES = ['admin', 'cco'];
const APPROVAL_READ_ROLES = ['admin', 'cco', 'department_head', 'reviewer'];

const PRIMARY_NAV: NavItem[] = [
  {
    path: '/command-center',
    label: 'Today',
    description: 'Priorities, plans, and commercial signals',
    icon: Home,
    roles: PRODUCT_ROLES,
    activePaths: ['/', '/command-center'],
  },
  {
    path: '/commercial-plans',
    label: 'Plans',
    shortLabel: 'Plans',
    description: 'Commercial plans, discipline work, and event handoffs',
    icon: CalendarDays,
    roles: PRODUCT_ROLES,
    activePaths: ['/commercial-plans', '/disciplines', '/events'],
  },
  {
    path: '/ideas',
    label: 'Content',
    description: 'Briefs, ideas, drafts, and campaign content',
    icon: PenLine,
    roles: CONTENT_ROLES,
    activePaths: ['/ideas', '/content', '/campaigns', '/approvals', '/publishing'],
  },
  {
    path: '/analytics',
    label: 'Sales & Leads',
    shortLabel: 'Leads',
    description: 'Leads, meetings, purchases, and follow-up',
    icon: UsersRound,
    roles: PRODUCT_ROLES,
    activePaths: ['/analytics'],
  },
  {
    path: '/growth',
    label: 'Performance',
    shortLabel: 'Results',
    description: 'Campaign and social growth performance',
    icon: BarChart3,
    roles: PRODUCT_ROLES,
    activePaths: ['/growth', '/executive'],
  },
  {
    path: '/stitchi',
    label: 'Stitchi',
    description: 'Ask AI to prepare governed work',
    icon: Sparkles,
    roles: PRODUCT_ROLES,
    activePaths: ['/stitchi'],
  },
];

const WORKFLOW_LINKS: NavItem[] = [
  {
    path: '/disciplines',
    label: 'Discipline Workspaces',
    description: 'Brand, acquisition, conversion, growth, and operations',
    icon: Building2,
    roles: PRODUCT_ROLES,
  },
  {
    path: '/events',
    label: 'Event Operations',
    description: 'Separate event planning and operating workspace',
    icon: CalendarDays,
    roles: PRODUCT_ROLES,
  },
  {
    path: '/approvals',
    label: 'Review Queue',
    description: 'Review one content decision at a time',
    icon: ShieldCheck,
    roles: APPROVAL_READ_ROLES,
  },
  {
    path: '/publishing',
    label: 'Scheduling',
    description: 'Prepare approved content for scheduling',
    icon: CalendarDays,
    roles: CONTENT_ROLES,
  },
  {
    path: '/campaigns',
    label: 'Campaign Workspace',
    description: 'Continue platform drafts and packages',
    icon: PenLine,
    roles: CONTENT_ROLES,
  },
];

const SETUP_LINKS: NavItem[] = [
  { path: '/my-agent-rep', label: 'My Profile', description: 'Role, preferences, and display currency', icon: UserRound, roles: PRODUCT_ROLES },
  { path: '/account-security', label: 'Account Security', description: 'MFA and recovery codes', icon: ShieldCheck, roles: PRODUCT_ROLES },
  { path: '/ai-settings', label: 'AI Model', description: 'Connect the AI model used by your workspace', icon: Brain, roles: PRODUCT_ROLES },
  { path: '/integration-credentials', label: 'Integrations', description: 'Connect customer-owned systems', icon: KeyRound, roles: SETUP_ROLES },
];

const ADMIN_LINKS: NavItem[] = [
  { path: '/admin-users', label: 'Users & Roles', description: 'Manage workspace access', icon: Users, roles: ADMIN_ROLES },
  { path: '/tenant-admin', label: 'Workspace Admin', description: 'Tenant, subscription, and privacy', icon: Building2, roles: ADMIN_ROLES },
  { path: '/operations', label: 'Operations', description: 'Monitoring, backups, and readiness', icon: BarChart3, roles: ADMIN_ROLES },
  { path: '/observability', label: 'Activity Log', description: 'Governed activity evidence', icon: FileClock, roles: ADMIN_ROLES },
];

const PAGE_TITLES: Array<{ match: (path: string) => boolean; title: string }> = [
  { match: path => path === '/' || path === '/command-center', title: 'Today' },
  { match: path => path === '/commercial-plans', title: 'Commercial Plans' },
  { match: path => path === '/disciplines', title: 'Discipline Workspaces' },
  { match: path => path.startsWith('/events'), title: 'Event Operations' },
  { match: path => path === '/ideas' || path === '/content', title: 'Content' },
  { match: path => path === '/campaigns', title: 'Campaign Workspace' },
  { match: path => path === '/approvals', title: 'Review Queue' },
  { match: path => path === '/publishing', title: 'Scheduling' },
  { match: path => path === '/analytics', title: 'Sales & Leads' },
  { match: path => path === '/growth', title: 'Performance' },
  { match: path => path === '/executive', title: 'Executive Dashboard' },
  { match: path => path === '/stitchi', title: 'Stitchi' },
  { match: path => path.includes('security'), title: 'Account Security' },
  { match: path => path.includes('integration'), title: 'Integrations' },
  { match: path => path.includes('ai-settings'), title: 'AI Model' },
  { match: path => path.includes('agent-rep'), title: 'My Profile' },
  { match: path => path.includes('admin'), title: 'Administration' },
];

function normalizeRole(role: string): string {
  return role.trim().toLowerCase().replaceAll(' ', '_').replaceAll('-', '_');
}

function getField(source: unknown, keys: string[], fallback: string): string {
  if (!source || typeof source !== 'object') return fallback;
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return fallback;
}

function visibleForRole(item: NavItem, role: string): boolean {
  return !item.roles || item.roles.includes(role);
}

function isActive(pathname: string, item: NavItem): boolean {
  const candidates = item.activePaths ?? [item.path];
  return candidates.some(path => pathname === path || (path !== '/' && pathname.startsWith(`${path}/`)));
}

function pageTitle(pathname: string): string {
  return PAGE_TITLES.find(item => item.match(pathname))?.title ?? 'Workspace';
}

function initials(value: string): string {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || 'U';
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const role = normalizeRole(getField(user, ['role'], 'viewer'));
  const displayName = getField(user, ['name', 'email'], 'Workspace User');
  const currentTitle = pageTitle(location.pathname);
  const primaryNav = useMemo(() => PRIMARY_NAV.filter(item => visibleForRole(item, role)).map(item => {
    if (item.path !== '/growth' || !EXECUTIVE_ROLES.includes(role)) return item;
    return {
      ...item,
      path: '/executive',
      label: 'Executive Dashboard',
      shortLabel: 'Results',
      description: 'Revenue, decisions, and executive reporting',
    };
  }), [role]);
  const workflowLinks = useMemo(() => WORKFLOW_LINKS.filter(item => visibleForRole(item, role)), [role]);
  const setupLinks = useMemo(() => SETUP_LINKS.filter(item => visibleForRole(item, role)), [role]);
  const adminLinks = useMemo(() => ADMIN_LINKS.filter(item => visibleForRole(item, role)), [role]);

  useEffect(() => {
    document.title = `${currentTitle} | Tanaghum`;
    const resetScroll = () => {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    resetScroll();
    const resetTimer = window.setTimeout(resetScroll, 0);
    return () => window.clearTimeout(resetTimer);
  }, [currentTitle, location.pathname]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMoreOpen(false);
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="hybrid-shell">
      <a className="hybrid-skip-link" href="#main-content">Skip to Main Content</a>

      <aside className="hybrid-sidebar">
        <Link className="hybrid-brand" to="/command-center" aria-label="Tanaghum Today">
          <span className="hybrid-brand-mark"><Sparkles size={19} aria-hidden="true" /></span>
          <span className="hybrid-brand-copy"><strong>Tanaghum</strong><small>Commercial workspace</small></span>
        </Link>

        <nav className="hybrid-primary-nav" aria-label="Product navigation">
          <span className="hybrid-nav-heading">Workspace</span>
          {primaryNav.map(item => <ShellNavLink key={item.path} item={item} active={isActive(location.pathname, item)} />)}
        </nav>

        <div className="hybrid-sidebar-footer">
          <button className="hybrid-nav-link" type="button" onClick={() => setMoreOpen(true)} aria-expanded={moreOpen}>
            <Settings size={19} aria-hidden="true" /><span>Setup & More</span>
          </button>
          <div className="hybrid-account-card">
            <span className="hybrid-avatar">{initials(displayName)}</span>
            <span className="hybrid-account-copy"><strong>{displayName}</strong><small>{role.replaceAll('_', ' ')}</small></span>
            <button type="button" onClick={handleLogout} aria-label="Sign out"><LogOut size={17} aria-hidden="true" /></button>
          </div>
        </div>
      </aside>

      <div className="hybrid-workspace">
        <header className="hybrid-topbar">
          <div className="hybrid-mobile-brand">
            <span className="hybrid-brand-mark"><Sparkles size={18} aria-hidden="true" /></span>
            <span><strong>Tanaghum</strong><small>{currentTitle}</small></span>
          </div>
          <div className="hybrid-route-context">
            <span>Commercial workspace</span><ChevronRight size={15} aria-hidden="true" /><strong>{currentTitle}</strong>
          </div>
          <div className="hybrid-topbar-actions">
            <Link className="hybrid-topbar-action" to={`/stitchi?returnTo=${encodeURIComponent(location.pathname)}`}>
              <Sparkles size={17} aria-hidden="true" />Ask Stitchi
            </Link>
            <button className="hybrid-icon-button" type="button" onClick={() => setMoreOpen(true)} aria-label="Open workspace menu" aria-expanded={moreOpen}>
              <Menu size={20} aria-hidden="true" />
            </button>
          </div>
        </header>

        <main className="hybrid-main" id="main-content"><Outlet /></main>
      </div>

      <nav className="hybrid-mobile-nav" aria-label="Mobile product navigation">
        {primaryNav.slice(0, 4).map(item => <MobileNavLink key={item.path} item={item} active={isActive(location.pathname, item)} />)}
        <button type="button" onClick={() => setMoreOpen(true)} className="hybrid-mobile-nav-link" aria-expanded={moreOpen}>
          <MoreHorizontal size={20} aria-hidden="true" /><span>More</span>
        </button>
      </nav>

      <MoreSheet
        open={moreOpen}
        role={role}
        displayName={displayName}
        primaryLinks={primaryNav.slice(4)}
        workflowLinks={workflowLinks}
        setupLinks={setupLinks}
        adminLinks={adminLinks}
        pathname={location.pathname}
        onClose={() => setMoreOpen(false)}
        onLogout={handleLogout}
      />
    </div>
  );
}

function ShellNavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link className={`hybrid-nav-link${active ? ' is-active' : ''}`} to={item.path} aria-current={active ? 'page' : undefined}>
      <Icon size={19} aria-hidden="true" /><span>{item.label}</span>
    </Link>
  );
}

function MobileNavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link className={`hybrid-mobile-nav-link${active ? ' is-active' : ''}`} to={item.path} aria-current={active ? 'page' : undefined}>
      <Icon size={20} aria-hidden="true" /><span>{item.shortLabel ?? item.label}</span>
    </Link>
  );
}

function MoreSheet({
  open,
  role,
  displayName,
  primaryLinks,
  workflowLinks,
  setupLinks,
  adminLinks,
  pathname,
  onClose,
  onLogout,
}: {
  open: boolean;
  role: string;
  displayName: string;
  primaryLinks: NavItem[];
  workflowLinks: NavItem[];
  setupLinks: NavItem[];
  adminLinks: NavItem[];
  pathname: string;
  onClose: () => void;
  onLogout: () => void;
}) {
  if (!open) return null;

  const groups = [
    { label: 'More Work', items: [...primaryLinks, ...workflowLinks] },
    { label: 'Setup', items: setupLinks },
    { label: 'Administration', items: adminLinks },
  ].filter(group => group.items.length > 0);

  return (
    <div className="hybrid-sheet-layer">
      <button className="hybrid-sheet-scrim" type="button" onClick={onClose} aria-label="Close workspace menu" />
      <aside className="hybrid-sheet" role="dialog" aria-modal="true" aria-labelledby="hybrid-menu-title">
        <header className="hybrid-sheet-header">
          <div><span className="hybrid-brand-mark"><Sparkles size={18} aria-hidden="true" /></span><span><strong id="hybrid-menu-title">Workspace Menu</strong><small>Daily work, setup, and account access</small></span></div>
          <button className="hybrid-icon-button" type="button" onClick={onClose} aria-label="Close workspace menu"><X size={20} aria-hidden="true" /></button>
        </header>
        <div className="hybrid-sheet-body">
          {groups.map(group => (
            <section key={group.label}>
              <h2>{group.label}</h2>
              <div className="hybrid-sheet-links">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item);
                  return (
                    <Link key={item.path} className={`hybrid-sheet-link${active ? ' is-active' : ''}`} to={item.path} onClick={onClose}>
                      <span><Icon size={18} aria-hidden="true" /></span>
                      <span><strong>{item.label}</strong><small>{item.description}</small></span>
                      <ChevronRight size={17} aria-hidden="true" />
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <footer className="hybrid-sheet-account">
          <span className="hybrid-avatar">{initials(displayName)}</span>
          <span><strong>{displayName}</strong><small>{role.replaceAll('_', ' ')}</small></span>
          <button type="button" onClick={onLogout}><LogOut size={17} aria-hidden="true" />Sign Out</button>
        </footer>
      </aside>
    </div>
  );
}
