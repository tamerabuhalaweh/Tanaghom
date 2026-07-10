import type { ReactNode } from 'react';
import { CircleAlert, Inbox } from 'lucide-react';
import './OperationalUI.css';

export function OpsPage({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`ops-page ${className}`.trim()}>{children}</div>;
}

export function OpsPageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <header className="ops-page-header">
      <div>
        {eyebrow ? <span className="ops-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actions ? <div className="ops-page-actions">{actions}</div> : null}
    </header>
  );
}

export function OpsSection({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`ops-section ${className}`.trim()}>
      {title || subtitle || action ? (
        <header className="ops-section-header">
          <div>{title ? <h2>{title}</h2> : null}{subtitle ? <p>{subtitle}</p> : null}</div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function OpsStatus({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'positive' | 'warning' | 'danger' | 'info' }) {
  return <span className={`ops-status is-${tone}`}>{children}</span>;
}

export function OpsNotice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' | 'danger' | 'positive' }) {
  return <div className={`ops-notice is-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}><CircleAlert size={18} aria-hidden="true" /><span>{children}</span></div>;
}

export function OpsEmpty({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <div className="ops-empty">
      <span><Inbox size={21} aria-hidden="true" /></span>
      <h3>{title}</h3>
      <p>{message}</p>
      {action}
    </div>
  );
}

export function OpsSkeleton({ rows = 3 }: { rows?: number }) {
  return <div className="ops-skeleton" aria-label="Loading workspace" role="status">{Array.from({ length: rows }, (_, index) => <span key={index} />)}</div>;
}
