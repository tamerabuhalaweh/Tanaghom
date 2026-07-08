import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

type Accent = 'rose' | 'teal' | 'violet' | 'amber' | 'blue';

const accentGradient: Record<Accent, string> = {
  rose: 'from-[#ff5268] to-[#ff9a7a]',
  teal: 'from-[#00dcae] to-[#70f5df]',
  violet: 'from-[#8a7cff] to-[#f2a7ff]',
  amber: 'from-[#ffd166] to-[#ff8a4c]',
  blue: 'from-[#6ddcff] to-[#7c83ff]',
};

const accentText: Record<Accent, string> = {
  rose: 'text-[#ff8da0]',
  teal: 'text-[#70f5df]',
  violet: 'text-[#c4b5fd]',
  amber: 'text-[#ffd166]',
  blue: 'text-[#8bdcff]',
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function AieroPage({
  eyebrow,
  title,
  subtitle,
  action,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
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

      <div className="relative border-b border-white/10 px-5 py-6 sm:px-7 lg:px-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            {eyebrow && (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
                <span className="h-2 w-2 rounded-full bg-[#00dcae] shadow-[0_0_18px_rgba(0,220,174,0.9)]" />
                {eyebrow}
              </div>
            )}
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-[1.04] tracking-tight sm:text-5xl">
              {title}
            </h1>
            {subtitle && <p className="mt-4 max-w-3xl text-sm leading-7 text-white/58 sm:text-base">{subtitle}</p>}
          </div>
          {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
        </div>
      </div>

      <div className="relative space-y-6 px-5 py-6 sm:px-7 lg:px-8">
        {children}
      </div>
    </div>
  );
}

export function AieroPanel({
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
    <section className={cx('rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur', className)}>
      {(title || subtitle || action) && (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title && <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm leading-6 text-white/48">{subtitle}</p>}
          </div>
          {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function AieroLightPanel({
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
    <section className={cx('rounded-[1.5rem] border border-white/10 bg-white text-neutral-950 shadow-[0_18px_56px_rgba(8,8,19,0.18)]', className)}>
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

export function AieroMetricCard({
  label,
  value,
  detail,
  accent = 'teal',
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  accent?: Accent;
}) {
  return (
    <div className="min-w-0 rounded-[1.25rem] border border-white/10 bg-white/[0.06] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-sm font-medium text-white/58">{label}</div>
        <span className={cx('h-2.5 w-2.5 rounded-full bg-gradient-to-br shadow-[0_0_20px_currentColor]', accentGradient[accent])} />
      </div>
      <div className="mt-4 break-words text-4xl font-semibold tracking-tight text-white">{value}</div>
      {detail && <p className="mt-2 text-sm leading-6 text-white/48">{detail}</p>}
    </div>
  );
}

export function AieroStatusPill({
  children,
  accent = 'teal',
}: {
  children: ReactNode;
  accent?: Accent;
}) {
  return (
    <span className={cx('inline-flex max-w-full items-center rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold', accentText[accent])}>
      {children}
    </span>
  );
}

export function AieroIconTile({
  icon: Icon,
  title,
  detail,
  accent = 'rose',
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  accent?: Accent;
}) {
  return (
    <div className="rounded-[1.25rem] border border-white/10 bg-[#0c0c19] p-5">
      <span className={cx('flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-[#080813]', accentGradient[accent])}>
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/48">{detail}</p>
    </div>
  );
}

export function AieroProgress({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#ff5268] via-[#ffd166] to-[#00dcae]"
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}

export function AieroNumberedStep({
  number,
  title,
  detail,
  accent = 'teal',
}: {
  number: string;
  title: string;
  detail: string;
  accent?: Accent;
}) {
  return (
    <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-5">
      <div className={cx('flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-[#080813]', accentGradient[accent])}>
        {number}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/50">{detail}</p>
    </div>
  );
}

export function AieroActionButton({
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
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#080813] shadow-[0_16px_40px_rgba(255,255,255,0.13)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(255,255,255,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function AieroGhostButton({
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
      className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white transition hover:border-white/28 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}
