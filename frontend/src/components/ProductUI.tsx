import type { ReactNode } from 'react';

type Tone = 'default' | 'good' | 'warn' | 'danger' | 'info' | 'muted';

const statusClasses: Record<Tone, string> = {
  default: 'border-neutral-200 bg-white text-neutral-700',
  muted: 'border-neutral-200 bg-neutral-100 text-neutral-600',
  good: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warn: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
};

const noticeClasses: Record<Exclude<Tone, 'default' | 'muted'>, string> = {
  good: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warn: 'border-amber-200 bg-amber-50 text-amber-900',
  danger: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function ProductPage({
  title,
  subtitle,
  eyebrow,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              {eyebrow}
            </div>
          )}
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
            {title}
          </h1>
          {subtitle && <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">{subtitle}</p>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </header>
      {children}
    </div>
  );
}

export function ProductCard({
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
    <section className={cx('rounded-lg border border-neutral-200 bg-white shadow-sm', className)}>
      {(title || subtitle || action) && (
        <div className="flex flex-col gap-3 border-b border-neutral-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold tracking-tight text-neutral-950">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm leading-6 text-neutral-500">{subtitle}</p>}
          </div>
          {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function ProductStatus({ children, tone = 'default' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={cx('inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium', statusClasses[tone])}>
      {children}
    </span>
  );
}

export function PrimaryAction({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-10 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  );
}

export function SecondaryAction({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-10 items-center justify-center rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: Tone;
}) {
  const valueText = String(value);
  const compact = valueText.length > 14;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
        <span className={cx('h-2 w-2 rounded-full', tone === 'good' ? 'bg-emerald-500' : tone === 'warn' ? 'bg-amber-500' : tone === 'danger' ? 'bg-red-500' : tone === 'info' ? 'bg-blue-500' : 'bg-neutral-300')} />
      </div>
      <div className={cx('mt-3 font-semibold tracking-tight text-neutral-950', compact ? 'text-xl leading-snug' : 'text-3xl')}>
        {value}
      </div>
      {detail && <div className="mt-2 line-clamp-2 text-sm leading-5 text-neutral-500">{detail}</div>}
    </div>
  );
}

export function WorkflowRail({ steps }: { steps: { label: string; state: 'done' | 'active' | 'waiting' | 'blocked' }[] }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {steps.map((step, index) => (
          <div
            key={`${step.label}-${index}`}
            className={cx(
              'rounded-md border px-3 py-3',
              step.state === 'active' && 'border-neutral-950 bg-neutral-950 text-white',
              step.state === 'done' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
              step.state === 'waiting' && 'border-neutral-200 bg-neutral-50 text-neutral-500',
              step.state === 'blocked' && 'border-red-200 bg-red-50 text-red-700',
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cx(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  step.state === 'active' ? 'bg-white text-neutral-950' : 'bg-white text-current',
                )}
              >
                {index + 1}
              </span>
              <span className="truncate text-xs font-medium">{step.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-md border border-neutral-100 bg-neutral-50 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{item.label}</div>
          <div className="mt-2 text-sm font-medium leading-6 text-neutral-800">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function ReadableQueue({ items }: { items: { title: string; meta: string; status?: string; tone?: Tone }[] }) {
  return (
    <div className="divide-y divide-neutral-100">
      {items.map((item) => (
        <div key={`${item.title}-${item.meta}`} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="font-medium text-neutral-950">{item.title}</div>
            <div className="mt-1 text-sm leading-5 text-neutral-500">{item.meta}</div>
          </div>
          {item.status && <ProductStatus tone={item.tone}>{item.status}</ProductStatus>}
        </div>
      ))}
    </div>
  );
}

export function ProductTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<Array<ReactNode>>;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse bg-white text-sm">
          <thead className="bg-neutral-50 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
            <tr>
              {columns.map(column => <th key={column} className="px-4 py-3">{column}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="text-neutral-700">
                {row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3 align-top">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  helper,
}: {
  label: string;
  children: ReactNode;
  helper?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</span>
      <div className="mt-2">{children}</div>
      {helper && <span className="mt-1 block text-xs leading-5 text-neutral-500">{helper}</span>}
    </label>
  );
}

export function Notice({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: Exclude<Tone, 'default' | 'muted'>;
}) {
  return (
    <div className={cx('rounded-lg border px-4 py-3 text-sm leading-6', noticeClasses[tone])}>
      {children}
    </div>
  );
}

export function EmptyProductState({
  title = 'Nothing to show yet',
  message,
  action,
}: {
  title?: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
      <div className="text-sm font-medium text-neutral-950">{title}</div>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-neutral-500">{message}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
      <div
        className={cx('h-full rounded-full', safeValue >= 75 ? 'bg-emerald-500' : safeValue >= 50 ? 'bg-amber-500' : 'bg-red-500')}
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}

export function PlatformPill({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <span className={cx('inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium', active ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white text-neutral-700')}>
      {children}
    </span>
  );
}
