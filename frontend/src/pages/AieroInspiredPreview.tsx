import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  DatabaseZap,
  Gauge,
  KeyRound,
  LineChart,
  LockKeyhole,
  Megaphone,
  MousePointerClick,
  PhoneCall,
  PlayCircle,
  Route,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UsersRound,
  WandSparkles,
} from 'lucide-react';

type PreviewPage = 'home' | 'events' | 'integrations';

type Stat = {
  label: string;
  value: string;
  detail: string;
  accent?: 'rose' | 'teal' | 'violet' | 'amber';
};

const accentClasses: Record<NonNullable<Stat['accent']>, string> = {
  rose: 'from-[#ff5268] to-[#ff9a7a]',
  teal: 'from-[#00dcae] to-[#70f5df]',
  violet: 'from-[#8a7cff] to-[#f2a7ff]',
  amber: 'from-[#ffd166] to-[#ff8a4c]',
};

const previewNav = [
  { to: '/ux/aiero-preview', label: 'Home' },
  { to: '/ux/aiero-preview/events', label: 'Event Workspace' },
  { to: '/ux/aiero-preview/integrations', label: 'Integrations' },
];

const journeySteps = [
  'Plan event',
  'Generate content',
  'Approve',
  'Schedule',
  'Track leads',
  'Learn',
];

const kpis: Stat[] = [
  { label: 'Lead pipeline', value: '1,248', detail: 'New and returning interest', accent: 'teal' },
  { label: 'Sales readiness', value: '78%', detail: 'Budget, content, CRM and follow-up', accent: 'rose' },
  { label: 'Cost efficiency', value: '2.9x', detail: 'Revenue signal against spend', accent: 'violet' },
  { label: 'Next actions', value: '12', detail: 'Tasks needing team attention', accent: 'amber' },
];

const channelRows = [
  { name: 'Instagram', status: 'Ready for content', signal: 82 },
  { name: 'Meta Ads', status: 'Needs customer account', signal: 48 },
  { name: 'GoHighLevel', status: 'Mapping ready', signal: 69 },
  { name: 'WhatsApp', status: 'Through CRM workflow', signal: 57 },
];

const eventTabs = [
  { label: 'Overview', detail: 'Today status', active: true },
  { label: 'Plan', detail: 'Offer, budget, channels' },
  { label: 'Content', detail: 'Posts and assets' },
  { label: 'Leads', detail: 'CRM and sales flow' },
  { label: 'Results', detail: 'Spend, sales, learning' },
];

const integrations = [
  {
    title: 'GoHighLevel CRM',
    status: 'Customer credential required',
    detail: 'Pull contacts, tags, opportunities, meetings and purchases into Tanaghum dashboards.',
    icon: DatabaseZap,
    tone: 'rose',
  },
  {
    title: 'Postiz Scheduling',
    status: 'Channel selection ready',
    detail: 'Prepare approved content for scheduling after the customer connects eligible social channels.',
    icon: CalendarDays,
    tone: 'teal',
  },
  {
    title: 'Meta and Instagram',
    status: 'Provider setup required',
    detail: 'Read campaign performance and audience signals once customer-owned business access is granted.',
    icon: Megaphone,
    tone: 'violet',
  },
  {
    title: 'SmartLabs Voice',
    status: 'Tenant key required',
    detail: 'Send qualified lead context to customer-authorized voice and chat workflows.',
    icon: PhoneCall,
    tone: 'amber',
  },
];

const eventFocusCards = [
  { title: 'Content due', body: 'Create event hook, carousel, story and WhatsApp sequence.', icon: Sparkles },
  { title: 'Sales follow-up', body: 'Review booked meetings, no-shows and buyer handoff.', icon: UsersRound },
  { title: 'Learning loop', body: 'Capture why reach, forms and sales moved this week.', icon: LineChart },
];

const setupBenefits = [
  { label: 'No secrets displayed', icon: ShieldCheck },
  { label: 'Customer-owned accounts', icon: KeyRound },
  { label: 'Safe test before sync', icon: MousePointerClick },
  { label: 'Audit on every action', icon: Route },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function PreviewShell({ page, children }: { page: PreviewPage; children: React.ReactNode }) {
  return (
    <div className="relative min-h-[calc(100vh-8rem)] overflow-hidden rounded-[2rem] bg-[#080813] text-white shadow-[0_28px_90px_rgba(8,8,19,0.28)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-[#ff5268]/20 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-[#00dcae]/16 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-80 w-80 rounded-full bg-[#8a7cff]/14 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_36%)]" />
      </div>

      <div className="relative border-b border-white/10 px-5 py-5 sm:px-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Link to="/ux/aiero-preview" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#080813]">
              <Sparkles className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-tight">Tanaghum</span>
              <span className="block text-xs text-white/50">Aiero-inspired UX sample</span>
            </span>
          </Link>

          <nav className="flex flex-wrap gap-2" aria-label="Preview navigation">
            {previewNav.map(item => {
              const active = (
                (page === 'home' && item.to.endsWith('preview'))
                || (page === 'events' && item.to.endsWith('events'))
                || (page === 'integrations' && item.to.endsWith('integrations'))
              );
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cx(
                    'rounded-full border px-4 py-2 text-sm font-medium transition',
                    active
                      ? 'border-white bg-white text-[#080813]'
                      : 'border-white/10 bg-white/[0.04] text-white/68 hover:border-white/24 hover:text-white',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="relative px-5 py-8 sm:px-7 lg:px-9 lg:py-10">
        {children}
      </div>
    </div>
  );
}

function PreviewBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/58">
      <span className="h-2 w-2 rounded-full bg-[#00dcae] shadow-[0_0_18px_rgba(0,220,174,0.9)]" />
      {children}
    </span>
  );
}

function PrimaryPreviewAction({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#080813] shadow-[0_16px_40px_rgba(255,255,255,0.16)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(255,255,255,0.2)]"
    >
      {children}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function SecondaryPreviewAction({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition hover:border-white/28 hover:bg-white/[0.08]"
    >
      {children}
    </Link>
  );
}

function StatCard({ stat }: { stat: Stat }) {
  return (
    <div className="min-w-0 rounded-[1.35rem] border border-white/10 bg-white/[0.06] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-sm font-medium text-white/58">{stat.label}</div>
        <span className={cx('h-2.5 w-2.5 rounded-full bg-gradient-to-br shadow-[0_0_20px_currentColor]', accentClasses[stat.accent || 'rose'])} />
      </div>
      <div className="mt-4 break-words text-4xl font-semibold tracking-tight">{stat.value}</div>
      <p className="mt-2 text-sm leading-6 text-white/50">{stat.detail}</p>
    </div>
  );
}

function DarkPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur', className)}>
      {children}
    </section>
  );
}

function ProgressSignal({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#ff5268] via-[#ffd166] to-[#00dcae]"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function HomePreview() {
  return (
    <PreviewShell page="home">
      <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="flex min-w-0 flex-col justify-center">
          <PreviewBadge>Production UX direction</PreviewBadge>
          <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[0.98] tracking-tight text-white sm:text-6xl lg:text-7xl">
            AI event growth,
            <span className="block bg-gradient-to-r from-[#ff5268] via-[#ffd166] to-[#00dcae] bg-clip-text text-transparent">
              built for daily work.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/62">
            A cleaner product direction for planning events, generating social content, tracking spend, syncing CRM leads and making every next action obvious for the team.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <PrimaryPreviewAction to="/ux/aiero-preview/events">Open event workspace</PrimaryPreviewAction>
            <SecondaryPreviewAction to="/ux/aiero-preview/integrations">
              <PlayCircle className="h-4 w-4" />
              See setup flow
            </SecondaryPreviewAction>
          </div>
        </div>

        <DarkPanel className="min-h-[520px]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Control room</div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">Today at a glance</h2>
            </div>
            <span className="rounded-full bg-[#00dcae]/12 px-3 py-1 text-sm font-medium text-[#70f5df]">Live workspace</span>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            {kpis.map(stat => <StatCard key={stat.label} stat={stat} />)}
          </div>

          <div className="mt-7 rounded-[1.2rem] border border-white/10 bg-[#0c0c19] p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-white">Event journey</div>
                <div className="mt-1 text-sm text-white/45">One path from strategy to follow-up.</div>
              </div>
              <span className="text-sm text-white/45">4 of 6 active</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {journeySteps.map((step, index) => (
                <div key={step} className={cx('rounded-2xl border p-4', index < 4 ? 'border-[#00dcae]/20 bg-[#00dcae]/8' : 'border-white/10 bg-white/[0.03]')}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">{step}</span>
                    {index < 4 ? <CheckCircle2 className="h-4 w-4 text-[#70f5df]" /> : <Clock3 className="h-4 w-4 text-white/34" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DarkPanel>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-4">
        {channelRows.map(row => (
          <div key={row.name} className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold">{row.name}</div>
              <TrendingUp className="h-4 w-4 text-[#ff5268]" />
            </div>
            <p className="mt-2 min-h-12 text-sm leading-6 text-white/48">{row.status}</p>
            <ProgressSignal value={row.signal} />
          </div>
        ))}
      </div>
    </PreviewShell>
  );
}

function EventsPreview() {
  return (
    <PreviewShell page="events">
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <div className="space-y-5">
          <DarkPanel>
            <PreviewBadge>Event workspace</PreviewBadge>
            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight">Course launch operating room</h1>
            <p className="mt-4 text-sm leading-7 text-white/54">
              A simpler view for a marketing and sales manager: what is live, what needs action, what is blocked, and which numbers changed today.
            </p>
            <button className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-[#080813]">
              Create event plan
              <WandSparkles className="h-4 w-4" />
            </button>
          </DarkPanel>

          <DarkPanel>
            <div className="text-sm font-semibold text-white">Active events</div>
            <div className="mt-4 space-y-3">
              {['Leadership course launch', 'Business camp waitlist', 'Virtual Ramadan session'].map((eventName, index) => (
                <div key={eventName} className={cx('rounded-2xl border p-4', index === 0 ? 'border-white bg-white text-[#080813]' : 'border-white/10 bg-white/[0.04]')}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{eventName}</div>
                      <div className={cx('mt-1 text-sm', index === 0 ? 'text-neutral-500' : 'text-white/46')}>Aug 2026 - event campaign</div>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          </DarkPanel>
        </div>

        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-5">
            {eventTabs.map(tab => (
              <div key={tab.label} className={cx('rounded-[1.25rem] border p-4', tab.active ? 'border-white bg-white text-[#080813]' : 'border-white/10 bg-white/[0.05] text-white')}>
                <div className="font-semibold">{tab.label}</div>
                <div className={cx('mt-1 text-sm leading-5', tab.active ? 'text-neutral-500' : 'text-white/42')}>{tab.detail}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <DarkPanel className="bg-[#121122]">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/38">Today's execution</div>
                  <h2 className="mt-3 text-4xl font-semibold tracking-tight">Plan, publish, sell.</h2>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-white/56">
                    Keep the team focused on the next action: content due, spend movement, lead follow-up, and sales outcomes.
                  </p>
                </div>
                <span className="rounded-full bg-[#ff5268]/12 px-3 py-1 text-sm font-medium text-[#ff9a7a]">Needs KPI data</span>
              </div>

              <div className="mt-7 grid gap-4 md:grid-cols-4">
                {[
                  ['Event date', 'Aug 2, 2026'],
                  ['Location', 'Venue TBD'],
                  ['Budget', 'Set by account'],
                  ['CRM', 'Needs setup'],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-white/38">{label}</div>
                    <div className="mt-3 break-words text-xl font-semibold leading-tight">{value}</div>
                  </div>
                ))}
              </div>
            </DarkPanel>

            <DarkPanel>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold">Operating readiness</div>
                  <div className="mt-1 text-sm text-white/45">Based on event data, leads, content and integrations.</div>
                </div>
                <Gauge className="h-5 w-5 text-[#00dcae]" />
              </div>
              <div className="mt-7 flex flex-col items-center justify-center gap-5 sm:flex-row">
                <div className="relative h-40 w-40 rounded-full bg-[conic-gradient(from_180deg,#ff5268_0deg,#ffd166_86deg,#00dcae_142deg,rgba(255,255,255,0.1)_142deg)] p-4">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-[#080813] text-4xl font-semibold">39%</div>
                </div>
                <div className="space-y-3 text-sm text-white/58">
                  <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#00dcae]" /> Event plan started</div>
                  <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#ffd166]" /> KPI import pending</div>
                  <div className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-[#ff5268]" /> CRM credential needed</div>
                </div>
              </div>
            </DarkPanel>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {eventFocusCards.map(({ title, body, icon: CardIcon }) => {
              return (
                <div key={title} className="rounded-[1.35rem] border border-white/10 bg-white/[0.05] p-5">
                  <CardIcon className="h-5 w-5 text-[#ff5268]" />
                  <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/50">{body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </PreviewShell>
  );
}

function IntegrationsPreview() {
  return (
    <PreviewShell page="integrations">
      <div className="grid gap-7 xl:grid-cols-[0.92fr_1.08fr]">
        <div>
          <PreviewBadge>Setup without confusion</PreviewBadge>
          <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-tight tracking-tight">
            Connect the tools the customer already uses.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-white/58">
            A product-friendly setup flow: choose the system, paste customer-owned credentials, test readiness, map fields, then import or sync safely.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {setupBenefits.map(({ label, icon: ItemIcon }) => {
              return (
                <div key={label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                  <ItemIcon className="h-5 w-5 text-[#00dcae]" />
                  <span className="text-sm font-semibold">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <DarkPanel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/38">Data source setup</div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">Choose a connection</h2>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-[#080813]">4 sources</span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {integrations.map(item => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="group rounded-[1.25rem] border border-white/10 bg-[#0c0c19] p-5 transition hover:-translate-y-0.5 hover:border-white/24">
                  <div className="flex items-start justify-between gap-4">
                    <span className={cx('flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-[#080813]', accentClasses[item.tone as NonNullable<Stat['accent']>])}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <ArrowRight className="h-4 w-4 text-white/32 transition group-hover:translate-x-1 group-hover:text-white" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{item.title}</h3>
                  <div className="mt-2 text-sm font-medium text-[#ffd166]">{item.status}</div>
                  <p className="mt-3 min-h-20 text-sm leading-6 text-white/48">{item.detail}</p>
                </div>
              );
            })}
          </div>
        </DarkPanel>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-3">
        {[
          ['1', 'Add credential', 'Paste the customer-owned API key or OAuth details. The value is encrypted and hidden after save.'],
          ['2', 'Validate readiness', 'Run a status check. The page says exactly what is missing: account, channel, mapping or permission.'],
          ['3', 'Use in workflow', 'Use the connection from Events, Content, Scheduling and Performance without jumping between platforms.'],
        ].map(([number, title, body]) => (
          <div key={number} className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-semibold text-[#080813]">{number}</div>
            <h3 className="mt-4 text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-white/50">{body}</p>
          </div>
        ))}
      </div>
    </PreviewShell>
  );
}

export default function AieroInspiredPreview({ page = 'home' }: { page?: PreviewPage }) {
  if (page === 'events') return <EventsPreview />;
  if (page === 'integrations') return <IntegrationsPreview />;
  return <HomePreview />;
}
