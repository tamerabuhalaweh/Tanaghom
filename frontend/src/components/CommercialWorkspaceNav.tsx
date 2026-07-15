import { BriefcaseBusiness, CalendarDays, ClipboardList, History } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import './CommercialWorkspaceNav.css';

const ITEMS = [
  {
    path: '/commercial-assessment',
    label: 'Assessment',
    description: 'Learn from previous results',
    icon: History,
  },
  {
    path: '/commercial-planning',
    label: 'Annual Plan',
    description: 'Yearly strategy and monthly portfolio',
    icon: ClipboardList,
  },
  {
    path: '/commercial-plans',
    label: 'Execution Plans',
    description: 'Product and event detail',
    icon: CalendarDays,
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
