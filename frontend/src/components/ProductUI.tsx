import type { ReactNode } from 'react';

type Tone = 'default' | 'good' | 'warn' | 'danger' | 'info';

const toneClasses: Record<Tone, string> = {
  default: 'bg-stone-100 text-stone-700',
  good: 'bg-emerald-50 text-emerald-700',
  warn: 'bg-amber-50 text-amber-700',
  danger: 'bg-rose-50 text-rose-700',
  info: 'bg-sky-50 text-sky-700',
};

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
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          {eyebrow && <div className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40">{eyebrow}</div>}
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-black">{title}</h1>
          {subtitle && <p className="mt-2 max-w-3xl text-sm leading-6 text-black/58">{subtitle}</p>}
        </div>
        {action}
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
    <section className={`rounded-2xl border border-black/8 bg-white p-5 shadow-sm shadow-black/[0.04] ${className}`}>
      {(title || subtitle || action) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold tracking-tight text-black">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm leading-6 text-black/50">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function ProductStatus({ children, tone = 'default' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${toneClasses[tone]}`}>{children}</span>;
}

export function PrimaryAction({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black/82 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function SecondaryAction({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function MetricCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  const valueText = String(value);
  const compact = valueText.length > 12;
  return (
    <div className="min-h-[156px] rounded-2xl bg-white p-5 shadow-sm shadow-black/[0.04] ring-1 ring-black/8">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-black/38">{label}</div>
      <div className={`mt-3 font-semibold tracking-tight text-black ${compact ? 'text-2xl leading-tight' : 'text-3xl'}`}>{value}</div>
      {detail && <div className="mt-2 text-sm text-black/50">{detail}</div>}
    </div>
  );
}

export function WorkflowRail({ steps }: { steps: { label: string; state: 'done' | 'active' | 'waiting' }[] }) {
  return (
    <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
      {steps.map((step, index) => (
        <div
          key={step.label}
          className={`rounded-2xl p-3 ring-1 ${
            step.state === 'active'
              ? 'bg-black text-white ring-black'
              : step.state === 'done'
                ? 'bg-emerald-50 text-emerald-900 ring-emerald-100'
                : 'bg-white text-black/45 ring-black/8'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${step.state === 'active' ? 'bg-white text-black' : 'bg-black/6 text-current'}`}>
              {index + 1}
            </span>
            <span className="text-xs font-semibold">{step.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-stone-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-black/35">{item.label}</div>
          <div className="mt-2 text-sm font-medium leading-6 text-black/76">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function ReadableQueue({ items }: { items: { title: string; meta: string; status?: string; tone?: Tone }[] }) {
  return (
    <div className="divide-y divide-black/6">
      {items.map((item) => (
        <div key={`${item.title}-${item.meta}`} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
          <div>
            <div className="font-medium text-black">{item.title}</div>
            <div className="mt-1 text-sm text-black/48">{item.meta}</div>
          </div>
          {item.status && <ProductStatus tone={item.tone}>{item.status}</ProductStatus>}
        </div>
      ))}
    </div>
  );
}
