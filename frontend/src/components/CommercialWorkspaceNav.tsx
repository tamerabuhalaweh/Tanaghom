import { BriefcaseBusiness, CalendarDays, ClipboardList } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import './CommercialWorkspaceNav.css';

const ITEMS = [
  {
    path: '/commercial-plans',
    label: 'Commercial Plans',
    description: 'Targets, budgets, and execution',
    icon: ClipboardList,
  },
  {
    path: '/disciplines',
    label: 'Discipline Workspaces',
    description: 'Five commercial disciplines',
    icon: BriefcaseBusiness,
  },
  {
    path: '/events',
    label: 'Event Operations',
    description: 'Separate operating workspace',
    icon: CalendarDays,
  },
];

export function CommercialWorkspaceNav() {
  const location = useLocation();

  return (
    <nav className="commercial-workspace-nav" aria-label="Commercial planning workspace">
      {ITEMS.map(item => {
        const Icon = item.icon;
        const active = item.path === '/events'
          ? location.pathname.startsWith('/events')
          : location.pathname === item.path;
        return (
          <Link key={item.path} to={item.path} className={active ? 'is-active' : ''} aria-current={active ? 'page' : undefined}>
            <Icon size={17} aria-hidden="true" />
            <span><strong>{item.label}</strong><small>{item.description}</small></span>
          </Link>
        );
      })}
    </nav>
  );
}
