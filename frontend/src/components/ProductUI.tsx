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

function toneDot(tone: Tone): string {
  if (tone === 'good') return 'bg-emerald-400';
  if (tone === 'warn') return 'bg-amber-400';
  if (tone === 'danger') return 'bg-rose-400';
  if (tone === 'info') return 'bg-cyan-400';
  return 'bg-white/30';
}

function toneStroke(tone: Tone): string {
  if (tone === 'good') return '#34d399';
  if (tone === 'warn') return '#fbbf24';
  if (tone === 'danger') return '#fb7185';
  if (tone === 'info') return '#22d3ee';
  return '#c4b5fd';
}

function normalizeSeries(series: number[]): string {
  if (!series.length) return '';
  const max = Math.max(1, ...series);
  const width = 180;
  const height = 56;
  const lastIndex = Math.max(1, series.length - 1);
  return series
    .map((value, index) => {
      const x = Math.round((index / lastIndex) * width);
      const y = Math.round(height - (Math.max(0, value) / max) * (height - 8) - 4);
      return `${x},${y}`;
    })
    .join(' ');
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
    <div className="relative overflow-hidden rounded-[2rem] bg-[#080813] text-white shadow-[0_28px_90px_rgba(8,8,19,0.22)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-12 h-72 w-72 rounded-full bg-[#ff5268]/18 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-[#00dcae]/14 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-80 w-80 rounded-full bg-[#8a7cff]/12 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_38%)]" />
      </div>

      <header className="relative flex flex-col gap-4 border-b border-white/10 px-5 py-6 sm:px-7 lg:px-8 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
              <span className="h-2 w-2 rounded-full bg-[#00dcae] shadow-[0_0_18px_rgba(0,220,174,0.9)]" />
              {eyebrow}
            </div>
          )}
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-[1.04] tracking-tight text-white sm:text-5xl">
            {title}
          </h1>
          {subtitle && <p className="mt-4 max-w-3xl text-sm leading-7 text-white/58 sm:text-base">{subtitle}</p>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
      </header>

      <div className="relative space-y-6 px-5 py-6 sm:px-7 lg:px-8">
        {children}
      </div>
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
    <section className={cx('rounded-[1.35rem] border border-white/10 bg-white text-neutral-950 shadow-[0_18px_56px_rgba(8,8,19,0.16)]', className)}>
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
    <span className={cx('inline-flex max-w-full items-center rounded-full border px-3 py-1.5 text-xs font-semibold leading-5', statusClasses[tone])}>
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
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-neutral-800 hover:shadow-md disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-45"
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
      className="inline-flex min-h-11 items-center justify-center rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-neutral-50 hover:shadow-md disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-45"
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
    <div className="min-w-0 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
        <span className={cx('h-2 w-2 rounded-full', tone === 'good' ? 'bg-emerald-500' : tone === 'warn' ? 'bg-amber-500' : tone === 'danger' ? 'bg-red-500' : tone === 'info' ? 'bg-blue-500' : 'bg-neutral-300')} />
      </div>
      <div className={cx('mt-3 break-words [overflow-wrap:anywhere] font-semibold tracking-tight text-neutral-950', compact ? 'text-xl leading-snug' : 'text-3xl')}>
        {value}
      </div>
      {detail && <div className="mt-2 line-clamp-3 break-words text-sm leading-5 text-neutral-500">{detail}</div>}
    </div>
  );
}

export function ExecutiveKpiCard({
  label,
  value,
  detail,
  tone = 'info',
  series = [],
  secondary,
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: Tone;
  series?: number[];
  secondary?: string;
}) {
  const points = normalizeSeries(series);
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#17152a] p-5 text-white shadow-[0_16px_44px_rgba(15,15,22,0.22)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white/75">{label}</div>
          <div className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{value}</div>
          {detail && <div className="mt-2 text-sm leading-5 text-white/62">{detail}</div>}
        </div>
        <span className={cx('mt-1 h-3 w-3 shrink-0 rounded-full shadow-[0_0_20px_currentColor]', toneDot(tone))} />
      </div>
      <div className="mt-5 h-16">
        {points ? (
          <svg viewBox="0 0 180 60" role="img" aria-label={`${label} trend`} className="h-full w-full">
            <path d="M0 56H180" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
            <path d="M0 32H180" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <polyline
              points={points}
              fill="none"
              stroke={toneStroke(tone)}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
            />
          </svg>
        ) : (
          <div className="flex h-full items-center rounded-lg border border-dashed border-white/12 px-3 text-xs text-white/42">
            No trend signal yet
          </div>
        )}
      </div>
      {secondary && <div className="mt-2 text-xs font-medium uppercase tracking-wide text-white/42">{secondary}</div>}
    </div>
  );
}

export function ExecutiveGauge({
  value,
  label,
  detail,
}: {
  value: number;
  label: string;
  detail?: string;
}) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeValue / 100) * circumference;
  const stroke = safeValue >= 75 ? '#34d399' : safeValue >= 50 ? '#fbbf24' : '#fb7185';

  return (
    <div className="rounded-xl border border-white/10 bg-[#17152a] p-5 text-white shadow-[0_16px_44px_rgba(15,15,22,0.22)]">
      <div className="text-sm font-semibold text-white/75">{label}</div>
      <div className="mt-4 flex items-center gap-5">
        <div className="relative h-36 w-36 shrink-0">
          <svg viewBox="0 0 150 150" className="-rotate-90">
            <circle cx="75" cy="75" r={radius} fill="none" stroke="rgba(255,255,255,0.11)" strokeWidth="14" />
            <circle
              cx="75"
              cy="75"
              r={radius}
              fill="none"
              stroke={stroke}
              strokeLinecap="round"
              strokeWidth="14"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-semibold tracking-tight">{safeValue}%</span>
          </div>
        </div>
        <p className="text-sm leading-6 text-white/62">{detail || 'Calculated from real workflow and connector statuses.'}</p>
      </div>
    </div>
  );
}

export function ExecutiveStatusGrid({
  items,
}: {
  items: { label: string; value: string; tone?: Tone; detail?: string }[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(item => (
        <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.06] p-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">{item.label}</div>
            <span className={cx('h-2.5 w-2.5 rounded-full', toneDot(item.tone || 'muted'))} />
          </div>
          <div className="mt-2 text-sm text-white/65">{item.value}</div>
          {item.detail && <div className="mt-2 text-xs leading-5 text-white/42">{item.detail}</div>}
        </div>
      ))}
    </div>
  );
}

export function WorkflowRail({ steps }: { steps: { label: string; state: 'done' | 'active' | 'waiting' | 'blocked' }[] }) {
  return (
    <div className="rounded-[1.35rem] border border-white/10 bg-white p-3 shadow-[0_18px_56px_rgba(8,8,19,0.12)]">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {steps.map((step, index) => (
          <div
            key={`${step.label}-${index}`}
            className={cx(
              'rounded-2xl border px-3 py-3',
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
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{item.label}</div>
          <div className="mt-2 break-words text-sm font-medium leading-6 text-neutral-800">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function ReadableQueue({ items }: { items: { title: string; meta: string; status?: string; tone?: Tone }[] }) {
  return (
    <div className="divide-y divide-neutral-100">
      {items.map((item, index) => (
        <div key={`${item.title}-${item.meta}-${index}`} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
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
    <div className="overflow-hidden rounded-2xl border border-neutral-200">
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
    <div className={cx('rounded-2xl border px-4 py-3 text-sm leading-6', noticeClasses[tone])}>
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
    <div className="rounded-[1.25rem] border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
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
    <span className={cx('inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold', active ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white text-neutral-700')}>
      {children}
    </span>
  );
}

export function ScoreRing({
  value,
  label,
  detail,
}: {
  value: number;
  label: string;
  detail?: string;
}) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeValue / 100) * circumference;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-5">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 104 104" className="-rotate-90">
            <circle cx="52" cy="52" r={radius} fill="none" stroke="rgb(245 245 245)" strokeWidth="10" />
            <circle
              cx="52"
              cy="52"
              r={radius}
              fill="none"
              stroke={safeValue >= 75 ? 'rgb(16 185 129)' : safeValue >= 50 ? 'rgb(245 158 11)' : 'rgb(239 68 68)'}
              strokeLinecap="round"
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-semibold tracking-tight text-neutral-950">{safeValue}</span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-neutral-950">{label}</div>
          {detail && <p className="mt-2 text-sm leading-6 text-neutral-500">{detail}</p>}
        </div>
      </div>
    </div>
  );
}

export function BarList({
  items,
}: {
  items: { label: string; value: number; detail?: string; tone?: Tone }[];
}) {
  const max = Math.max(1, ...items.map(item => item.value));
  return (
    <div className="space-y-4">
      {items.map(item => {
        const pct = Math.max(4, Math.round((item.value / max) * 100));
        return (
          <div key={item.label}>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-neutral-800">{item.label}</span>
              <span className="font-mono text-xs text-neutral-500">{item.detail || item.value.toLocaleString()}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
              <div
                className={cx(
                  'h-full rounded-full',
                  item.tone === 'good' ? 'bg-emerald-500' : item.tone === 'warn' ? 'bg-amber-500' : item.tone === 'danger' ? 'bg-red-500' : item.tone === 'info' ? 'bg-blue-500' : 'bg-neutral-950',
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function FunnelChart({
  stages,
}: {
  stages: { label: string; value: number; tone?: Tone }[];
}) {
  const max = Math.max(1, ...stages.map(stage => stage.value));
  return (
    <div className="space-y-3">
      {stages.map((stage, index) => {
        const width = Math.max(18, Math.round((stage.value / max) * 100));
        return (
          <div key={stage.label} className="grid grid-cols-[120px_1fr_60px] items-center gap-3 text-sm">
            <div className="truncate text-neutral-500">{stage.label}</div>
            <div className="h-9 overflow-hidden rounded-md bg-neutral-100">
              <div
                className={cx(
                  'flex h-full items-center justify-end rounded-md px-3 text-xs font-semibold text-white',
                  stage.tone === 'good' ? 'bg-emerald-600' : stage.tone === 'warn' ? 'bg-amber-500' : stage.tone === 'danger' ? 'bg-red-500' : stage.tone === 'info' ? 'bg-blue-600' : 'bg-neutral-950',
                )}
                style={{ width: `${width}%`, marginLeft: `${Math.min(index * 2, 12)}%` }}
              >
                {stage.value}
              </div>
            </div>
            <div className="text-right font-mono text-xs text-neutral-500">{stage.value}</div>
          </div>
        );
      })}
    </div>
  );
}

export function StepperPanel({
  title,
  steps,
}: {
  title: string;
  steps: { label: string; detail: string; state: 'done' | 'active' | 'waiting' | 'blocked' }[];
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold tracking-tight text-neutral-950">{title}</h2>
      <div className="mt-5 space-y-4">
        {steps.map((step, index) => (
          <div key={step.label} className="grid grid-cols-[32px_1fr] gap-3">
            <div className={cx(
              'flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold',
              step.state === 'done' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
              step.state === 'active' && 'border-neutral-950 bg-neutral-950 text-white',
              step.state === 'waiting' && 'border-neutral-200 bg-neutral-50 text-neutral-400',
              step.state === 'blocked' && 'border-red-200 bg-red-50 text-red-700',
            )}>
              {index + 1}
            </div>
            <div className="min-w-0 pb-4">
              <div className="font-medium text-neutral-950">{step.label}</div>
              <div className="mt-1 text-sm leading-5 text-neutral-500">{step.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
