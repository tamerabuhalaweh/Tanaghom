import { type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileText,
  Home,
  ListChecks,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  PenLine,
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import './HybridV3Preview.css';

type PreviewPage = 'today' | 'content' | 'review';

type NavItem = {
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  href?: string;
  match?: PreviewPage;
};

type Priority = {
  title: string;
  context: string;
  due: string;
  tone: 'critical' | 'attention' | 'standard';
  action: string;
};

type ReviewItem = {
  id: string;
  title: string;
  campaign: string;
  platform: string;
  submitted: string;
  risk: 'Low' | 'Medium';
  score: number;
  body: string;
};

const navItems: NavItem[] = [
  { label: 'Today', shortLabel: 'Today', icon: Home, href: '/ux/hybrid-v3-preview', match: 'today' },
  { label: 'Plans & Events', shortLabel: 'Plans', icon: CalendarDays },
  { label: 'Content', shortLabel: 'Content', icon: PenLine, href: '/ux/hybrid-v3-preview/content', match: 'content' },
  { label: 'Sales & Leads', shortLabel: 'Leads', icon: UsersRound },
  { label: 'Performance', shortLabel: 'Results', icon: BarChart3 },
  { label: 'Stitchi', shortLabel: 'More', icon: Sparkles },
];

const priorities: Priority[] = [
  {
    title: 'Approve the leadership launch carousel',
    context: 'Online Courses / Instagram',
    due: 'Due today',
    tone: 'critical',
    action: 'Review',
  },
  {
    title: 'Confirm the event offer and revenue target',
    context: 'Live Events / Leadership workshop',
    due: 'Due today',
    tone: 'attention',
    action: 'Open plan',
  },
  {
    title: 'Follow up with 14 warm leads',
    context: 'CRM / Previous buyers',
    due: 'Before 3:00 PM',
    tone: 'standard',
    action: 'View leads',
  },
];

const reviewItems: ReviewItem[] = [
  {
    id: 'review-01',
    title: 'Leadership is built in difficult moments',
    campaign: 'Leadership Course Launch',
    platform: 'Instagram',
    submitted: '18 min ago',
    risk: 'Low',
    score: 88,
    body: 'Success is not the absence of difficulty. It is the decision to move through it with purpose. Join our leadership course and build the clarity, discipline, and confidence to lead your next chapter.',
  },
  {
    id: 'review-02',
    title: '3 habits that separate leaders from managers',
    campaign: 'Leadership Course Launch',
    platform: 'LinkedIn',
    submitted: '42 min ago',
    risk: 'Medium',
    score: 76,
    body: 'The strongest leaders create direction before they create activity. This post introduces three practical habits entrepreneurs can apply this week.',
  },
  {
    id: 'review-03',
    title: 'Registration closes this Thursday',
    campaign: 'Business Camp',
    platform: 'Instagram Story',
    submitted: '1 hr ago',
    risk: 'Low',
    score: 91,
    body: 'The final seats for Business Camp close this Thursday. Reserve your place and join founders building the next stage of their business.',
  },
  {
    id: 'review-04',
    title: 'What changes after 2 days of focused work?',
    campaign: 'Tagyeer Wa Irtaqi',
    platform: 'Facebook',
    submitted: '2 hrs ago',
    risk: 'Low',
    score: 84,
    body: 'Two focused days can reset the way you make decisions, respond to pressure, and move toward the life you want to build.',
  },
];

const contentRows = [
  { title: 'Leadership launch carousel', campaign: 'Leadership Course Launch', platform: 'Instagram', stage: 'In review', updated: '18 min ago' },
  { title: 'Founder story: choosing the difficult path', campaign: 'Business Camp', platform: 'LinkedIn', stage: 'Draft', updated: '1 hr ago' },
  { title: 'Registration reminder', campaign: 'Tagyeer Wa Irtaqi', platform: 'Instagram Story', stage: 'Scheduled', updated: 'Yesterday' },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function BrandMark() {
  return (
    <span className="ux3-brand-mark" aria-hidden="true">
      <Sparkles size={19} strokeWidth={2} />
    </span>
  );
}

function DesktopNavigation({ page, onOpenStitchi }: { page: PreviewPage; onOpenStitchi: () => void }) {
  return (
    <aside className="ux3-sidebar">
      <div className="ux3-brand">
        <BrandMark />
        <span className="ux3-brand-copy">
          <strong>Tanaghum</strong>
          <span>Commercial workspace</span>
        </span>
      </div>

      <nav className="ux3-sidebar-nav" aria-label="Product navigation">
        <span className="ux3-nav-label">Workspace</span>
        {navItems.map(item => {
          const Icon = item.icon;
          const active = item.match === page;

          if (item.label === 'Stitchi') {
            return (
              <button key={item.label} className="ux3-nav-item" type="button" onClick={onOpenStitchi}>
                <Icon size={19} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          }

          if (!item.href) {
            return (
              <button key={item.label} className="ux3-nav-item" type="button" aria-disabled="true" title="Included after prototype approval">
                <Icon size={19} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          }

          return (
            <Link key={item.label} to={item.href} className={cx('ux3-nav-item', active && 'is-active')} aria-current={active ? 'page' : undefined}>
              <Icon size={19} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="ux3-sidebar-footer">
        <button type="button" className="ux3-nav-item" aria-disabled="true" title="Included after prototype approval">
          <Settings size={19} aria-hidden="true" />
          <span>Settings</span>
        </button>
        <div className="ux3-account-card">
          <span className="ux3-avatar">M</span>
          <span className="ux3-account-copy">
            <strong>Marketing Manager</strong>
            <span>Commercial team</span>
          </span>
          <ChevronRight size={17} aria-hidden="true" />
        </div>
      </div>
    </aside>
  );
}

function MobileNavigation({ page, onOpenStitchi }: { page: PreviewPage; onOpenStitchi: () => void }) {
  const items = navItems.slice(0, 4);
  return (
    <nav className="ux3-mobile-nav" aria-label="Mobile product navigation">
      {items.map(item => {
        const Icon = item.icon;
        const active = item.match === page;
        const shared = cx('ux3-mobile-nav-item', active && 'is-active');

        if (!item.href) {
          return (
            <button key={item.label} type="button" className={shared} aria-disabled="true" title="Included after prototype approval">
              <Icon size={20} aria-hidden="true" />
              <span>{item.shortLabel}</span>
            </button>
          );
        }

        return (
          <Link key={item.label} to={item.href} className={shared} aria-current={active ? 'page' : undefined}>
            <Icon size={20} aria-hidden="true" />
            <span>{item.shortLabel}</span>
          </Link>
        );
      })}
      <button type="button" className="ux3-mobile-nav-item" onClick={onOpenStitchi}>
        <MoreHorizontal size={20} aria-hidden="true" />
        <span>More</span>
      </button>
    </nav>
  );
}

function PrototypeTopBar({ page, onOpenStitchi }: { page: PreviewPage; onOpenStitchi: () => void }) {
  const titles: Record<PreviewPage, string> = {
    today: 'Today',
    content: 'Content',
    review: 'Review Queue',
  };

  return (
    <header className="ux3-topbar">
      <div className="ux3-mobile-brand">
        <BrandMark />
        <span>
          <strong>Tanaghum</strong>
          <small>{titles[page]}</small>
        </span>
      </div>
      <div className="ux3-topbar-context">
        <span>Commercial workspace</span>
        <ChevronRight size={15} aria-hidden="true" />
        <strong>{titles[page]}</strong>
      </div>
      <div className="ux3-topbar-actions">
        <span className="ux3-prototype-label">Local UX prototype</span>
        <button className="ux3-button ux3-button-secondary ux3-stitchi-top-action" type="button" onClick={onOpenStitchi}>
          <Sparkles size={17} aria-hidden="true" />
          Ask Stitchi
        </button>
        <button className="ux3-icon-button ux3-mobile-menu" type="button" onClick={onOpenStitchi} aria-label="Open Stitchi and more options">
          <Menu size={20} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

function StitchiPanel({ open, onClose, page }: { open: boolean; onClose: () => void; page: PreviewPage }) {
  const prompts: Record<PreviewPage, string[]> = {
    today: ['What needs my attention today?', 'Prepare the next commercial plan', "Summarize this week's performance"],
    content: ['Turn this brief into 3 content directions', 'Improve the call to action', 'Prepare a review package'],
    review: ['Summarize the decision risks', 'Suggest specific changes', 'Explain the quality score'],
  };

  if (!open) return null;

  return (
    <div className="ux3-stitchi-layer">
      <button className="ux3-stitchi-scrim" type="button" onClick={onClose} aria-label="Close Stitchi" />
      <aside className="ux3-stitchi-panel" role="dialog" aria-modal="true" aria-labelledby="ux3-stitchi-title">
        <header className="ux3-stitchi-header">
          <div className="ux3-stitchi-identity">
            <span className="ux3-stitchi-icon"><Sparkles size={18} aria-hidden="true" /></span>
            <span>
              <strong id="ux3-stitchi-title">Stitchi</strong>
              <small>Context-aware work assistant</small>
            </span>
          </div>
          <button className="ux3-icon-button" type="button" onClick={onClose} aria-label="Close Stitchi">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="ux3-stitchi-body">
          <div className="ux3-message ux3-message-assistant">
            <span>Stitchi</span>
            <p>I can use the current page context to explain the next step or prepare governed work for your approval.</p>
          </div>
          <div className="ux3-stitchi-prompts" aria-label="Suggested prompts">
            {prompts[page].map(prompt => <button key={prompt} type="button">{prompt}</button>)}
          </div>
        </div>

        <form className="ux3-stitchi-composer" onSubmit={(event: FormEvent<HTMLFormElement>) => event.preventDefault()}>
          <label htmlFor="ux3-stitchi-input">Ask Stitchi</label>
          <div className="ux3-composer-control">
            <textarea id="ux3-stitchi-input" name="stitchiPrompt" placeholder={'Describe the work you want to prepare\u2026'} rows={3} />
            <button className="ux3-icon-button ux3-send-button" type="submit" aria-label="Send message">
              <Send size={18} aria-hidden="true" />
            </button>
          </div>
          <small>Nothing is saved or sent externally without your approval.</small>
        </form>
      </aside>
    </div>
  );
}

function Metric({ label, value, change, icon: Icon, tone = 'standard' }: { label: string; value: string; change: string; icon: LucideIcon; tone?: 'standard' | 'positive' | 'warning' }) {
  return (
    <div className="ux3-metric">
      <div className="ux3-metric-top">
        <span className={cx('ux3-metric-icon', `is-${tone}`)}><Icon size={18} aria-hidden="true" /></span>
        <span className={cx('ux3-metric-change', `is-${tone}`)}>{change}</span>
      </div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function TodayPage({ onOpenStitchi }: { onOpenStitchi: () => void }) {
  const today = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

  return (
    <div className="ux3-page">
      <section className="ux3-page-header">
        <div>
          <span className="ux3-eyebrow">{today}</span>
          <h1>Today's Commercial Priorities</h1>
          <p>Decisions, follow-ups, and performance signals that need attention now.</p>
        </div>
        <div className="ux3-page-actions">
          <button className="ux3-button ux3-button-secondary" type="button" onClick={onOpenStitchi}>
            <Sparkles size={17} aria-hidden="true" />
            Plan With Stitchi
          </button>
          <button className="ux3-button ux3-button-primary" type="button">
            <Plus size={17} aria-hidden="true" />
            Create Plan
          </button>
        </div>
      </section>

      <section className="ux3-metrics" aria-label="Commercial performance summary">
        <Metric label="New Leads" value="184" change="+12% this week" icon={UsersRound} tone="positive" />
        <Metric label="Meetings Booked" value="32" change="7 today" icon={CalendarDays} tone="positive" />
        <Metric label="Purchases" value="18" change="9.8% conversion" icon={CheckCircle2} tone="positive" />
        <Metric label="Budget Used" value="61%" change="On plan" icon={Target} />
      </section>

      <div className="ux3-dashboard-grid">
        <section className="ux3-section ux3-priorities-section">
          <div className="ux3-section-header">
            <div>
              <h2>Needs Your Attention</h2>
              <p>3 actions are due today.</p>
            </div>
            <button className="ux3-text-button" type="button">View All <ArrowRight size={15} aria-hidden="true" /></button>
          </div>
          <div className="ux3-priority-list">
            {priorities.map((priority, index) => (
              <article className="ux3-priority-row" key={priority.title}>
                <span className={cx('ux3-priority-number', `is-${priority.tone}`)}>{index + 1}</span>
                <div className="ux3-priority-copy">
                  <h3>{priority.title}</h3>
                  <p>{priority.context}</p>
                </div>
                <span className="ux3-priority-due"><Clock3 size={14} aria-hidden="true" />{priority.due}</span>
                {index === 0 ? (
                  <Link className="ux3-button ux3-button-row" to="/ux/hybrid-v3-preview/review">{priority.action}</Link>
                ) : (
                  <button className="ux3-button ux3-button-row" type="button">{priority.action}</button>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="ux3-section ux3-performance-section">
          <div className="ux3-section-header">
            <div>
              <h2>Lead Movement</h2>
              <p>Last 7 days</p>
            </div>
            <span className="ux3-status ux3-status-positive"><TrendingUp size={14} aria-hidden="true" /> Improving</span>
          </div>
          <div className="ux3-chart" role="img" aria-label="Lead movement rose from 18 to 42 leads during the last 7 days">
            <div className="ux3-chart-y-axis" aria-hidden="true"><span>60</span><span>40</span><span>20</span><span>0</span></div>
            <svg viewBox="0 0 560 210" preserveAspectRatio="none" aria-hidden="true">
              <line x1="0" y1="20" x2="560" y2="20" />
              <line x1="0" y1="80" x2="560" y2="80" />
              <line x1="0" y1="140" x2="560" y2="140" />
              <line x1="0" y1="200" x2="560" y2="200" />
              <polyline points="0,164 92,151 184,158 276,112 368,128 460,74 560,54" />
              <circle cx="560" cy="54" r="5" />
            </svg>
            <div className="ux3-chart-labels" aria-hidden="true"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
          </div>
        </section>

        <section className="ux3-section ux3-plan-section">
          <div className="ux3-section-header">
            <div>
              <h2>Active Commercial Plan</h2>
              <p>Online Courses</p>
            </div>
            <span className="ux3-status ux3-status-neutral">In Progress</span>
          </div>
          <div className="ux3-plan-summary">
            <div>
              <span>Plan</span>
              <strong>Leadership Course Launch</strong>
            </div>
            <div>
              <span>Revenue Target</span>
              <strong>30,000</strong>
            </div>
            <div>
              <span>Current Revenue</span>
              <strong>18,420</strong>
            </div>
          </div>
          <div className="ux3-progress-copy"><span>61% of target</span><span>12 days remaining</span></div>
          <div className="ux3-progress" aria-label="61 percent of revenue target reached"><span style={{ width: '61%' }} /></div>
          <button className="ux3-button ux3-button-secondary ux3-full-button" type="button">Open Plan <ArrowRight size={16} aria-hidden="true" /></button>
        </section>

        <section className="ux3-section ux3-decision-section">
          <span className="ux3-decision-icon"><CircleAlert size={20} aria-hidden="true" /></span>
          <div>
            <span className="ux3-eyebrow">Decision Needed</span>
            <h2>Ad spend is ahead of lead conversion.</h2>
            <p>Form completion fell below the current plan target. Review the Meta campaign before increasing budget.</p>
          </div>
          <button className="ux3-button ux3-button-primary" type="button">Review Performance</button>
        </section>
      </div>
    </div>
  );
}

function ContentPage({ onOpenStitchi }: { onOpenStitchi: () => void }) {
  const [objective, setObjective] = useState('Promote the leadership course and turn warm followers into qualified registrations.');
  const [audience, setAudience] = useState('Entrepreneurs, previous buyers, and warm followers in the GCC.');
  const [platform, setPlatform] = useState('Instagram');

  return (
    <div className="ux3-page">
      <section className="ux3-page-header">
        <div>
          <span className="ux3-eyebrow">Content Workspace</span>
          <h1>Create Campaign Content</h1>
          <p>Start with a focused brief, create directions with AI, then move one approved version to scheduling.</p>
        </div>
        <div className="ux3-page-actions">
          <button className="ux3-button ux3-button-secondary" type="button" onClick={onOpenStitchi}>
            <Sparkles size={17} aria-hidden="true" />
            Create With Stitchi
          </button>
          <button className="ux3-button ux3-button-primary" type="button">
            <Plus size={17} aria-hidden="true" />
            New Brief
          </button>
        </div>
      </section>

      <nav className="ux3-journey" aria-label="Content workflow stages">
        {['Brief', 'Ideas', 'Draft', 'Review', 'Schedule', 'Results'].map((step, index) => (
          <button key={step} className={cx('ux3-journey-step', index === 0 && 'is-active')} type="button" aria-current={index === 0 ? 'step' : undefined}>
            <span>{index + 1}</span>
            <strong>{step}</strong>
          </button>
        ))}
      </nav>

      <div className="ux3-content-layout">
        <section className="ux3-section ux3-brief-section">
          <div className="ux3-section-header">
            <div>
              <h2>Campaign Brief</h2>
              <p>Give the team enough context to create useful, on-brand work.</p>
            </div>
            <span className="ux3-step-count">Step 1 of 6</span>
          </div>

          <form className="ux3-brief-form" onSubmit={(event: FormEvent<HTMLFormElement>) => event.preventDefault()}>
            <div className="ux3-form-field ux3-form-field-wide">
              <label htmlFor="ux3-objective">Objective <span>Required</span></label>
              <textarea id="ux3-objective" name="objective" rows={3} value={objective} onChange={event => setObjective(event.target.value)} />
            </div>
            <div className="ux3-form-field ux3-form-field-wide">
              <label htmlFor="ux3-audience">Audience <span>Required</span></label>
              <textarea id="ux3-audience" name="audience" rows={3} value={audience} onChange={event => setAudience(event.target.value)} />
            </div>
            <div className="ux3-form-field">
              <label htmlFor="ux3-platform">Primary Platform</label>
              <div className="ux3-select-wrap">
                <select id="ux3-platform" name="platform" value={platform} onChange={event => setPlatform(event.target.value)}>
                  <option>Instagram</option>
                  <option>LinkedIn</option>
                  <option>Facebook</option>
                  <option>YouTube</option>
                </select>
                <ChevronDown size={17} aria-hidden="true" />
              </div>
            </div>
            <div className="ux3-form-field">
              <label htmlFor="ux3-format">Content Format</label>
              <div className="ux3-select-wrap">
                <select id="ux3-format" name="format" defaultValue="Carousel">
                  <option>Carousel</option>
                  <option>Short video</option>
                  <option>Story</option>
                  <option>Text post</option>
                </select>
                <ChevronDown size={17} aria-hidden="true" />
              </div>
            </div>
            <div className="ux3-form-field ux3-form-field-wide">
              <label htmlFor="ux3-cta">Call to Action</label>
              <input id="ux3-cta" name="callToAction" type="text" defaultValue="Reserve your place for the leadership course" autoComplete="off" />
            </div>
            <div className="ux3-form-actions">
              <button className="ux3-button ux3-button-secondary" type="button">Save Draft</button>
              <button className="ux3-button ux3-button-primary" type="submit">
                <Sparkles size={17} aria-hidden="true" />
                Generate 3 Directions
              </button>
            </div>
          </form>
        </section>

        <aside className="ux3-section ux3-content-assistant">
          <span className="ux3-assistant-mark"><Sparkles size={20} aria-hidden="true" /></span>
          <span className="ux3-eyebrow">Stitchi Is Ready</span>
          <h2>Build the brief through conversation.</h2>
          <p>Stitchi can ask for missing budget, audience, offer, and channel details before preparing content directions.</p>
          <div className="ux3-assistant-example">
            <MessageSquareText size={17} aria-hidden="true" />
            <span>"Create an energetic Instagram carousel for entrepreneurs who want to become stronger leaders."</span>
          </div>
          <button className="ux3-button ux3-button-primary ux3-full-button" type="button" onClick={onOpenStitchi}>Open Stitchi</button>
          <small>Stitchi prepares work. You choose what moves forward.</small>
        </aside>
      </div>

      <section className="ux3-section ux3-library-section">
        <div className="ux3-section-header">
          <div>
            <h2>Recent Content</h2>
            <p>Continue saved work without searching through every campaign record.</p>
          </div>
          <div className="ux3-compact-actions">
            <button className="ux3-icon-button" type="button" aria-label="Search content"><Search size={18} aria-hidden="true" /></button>
            <button className="ux3-text-button" type="button">View Library <ArrowRight size={15} aria-hidden="true" /></button>
          </div>
        </div>
        <div className="ux3-table ux3-content-table" role="table" aria-label="Recent content">
          <div className="ux3-table-header" role="row">
            <span role="columnheader">Content</span>
            <span role="columnheader">Platform</span>
            <span role="columnheader">Stage</span>
            <span role="columnheader">Updated</span>
            <span role="columnheader">Action</span>
          </div>
          {contentRows.map((row, index) => (
            <div className="ux3-table-row" role="row" key={row.title}>
              <span className="ux3-table-primary" role="cell"><strong>{row.title}</strong><small>{row.campaign}</small></span>
              <span role="cell" data-label="Platform">{row.platform}</span>
              <span role="cell" data-label="Stage"><span className={cx('ux3-status', index === 2 ? 'ux3-status-positive' : 'ux3-status-neutral')}>{row.stage}</span></span>
              <span role="cell" data-label="Updated">{row.updated}</span>
              <span role="cell"><button className="ux3-icon-button" type="button" aria-label={`Open ${row.title}`}><ChevronRight size={18} aria-hidden="true" /></button></span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ReviewPage({ onOpenStitchi }: { onOpenStitchi: () => void }) {
  const [selectedId, setSelectedId] = useState(reviewItems[0].id);
  const [mobileDetail, setMobileDetail] = useState(false);
  const selected = reviewItems.find(item => item.id === selectedId) ?? reviewItems[0];

  function selectReview(id: string) {
    setSelectedId(id);
    setMobileDetail(true);
  }

  return (
    <div className="ux3-page ux3-review-page">
      <section className="ux3-page-header">
        <div>
          <span className="ux3-eyebrow">Content Decisions</span>
          <h1>Review Queue</h1>
          <p>Review one item at a time with the content, quality, risk, comments, and publishing context together.</p>
        </div>
        <div className="ux3-page-actions">
          <button className="ux3-button ux3-button-secondary" type="button" onClick={onOpenStitchi}>
            <Sparkles size={17} aria-hidden="true" />
            Ask Stitchi
          </button>
          <span className="ux3-queue-count">4 Awaiting Review</span>
        </div>
      </section>

      <div className={cx('ux3-review-workspace', mobileDetail && 'show-detail')}>
        <section className="ux3-review-queue" aria-label="Approval queue">
          <div className="ux3-review-queue-header">
            <div>
              <h2>Awaiting Decision</h2>
              <p>Sorted by submission time</p>
            </div>
            <button className="ux3-icon-button" type="button" aria-label="Review queue filters"><ListChecks size={18} aria-hidden="true" /></button>
          </div>
          <div className="ux3-review-list">
            {reviewItems.map(item => (
              <button
                key={item.id}
                type="button"
                className={cx('ux3-review-list-item', item.id === selected.id && 'is-active')}
                onClick={() => selectReview(item.id)}
                aria-current={item.id === selected.id ? 'true' : undefined}
              >
                <span className="ux3-review-list-top"><strong>{item.title}</strong><ChevronRight size={17} aria-hidden="true" /></span>
                <span>{item.campaign}</span>
                <span className="ux3-review-list-meta"><span>{item.platform}</span><span>{item.submitted}</span></span>
              </button>
            ))}
          </div>
          <div className="ux3-pagination" aria-label="Review queue pagination">
            <button type="button" disabled aria-label="Previous review page"><ArrowLeft size={16} aria-hidden="true" /></button>
            <span>1-4 of 4</span>
            <button type="button" disabled aria-label="Next review page"><ArrowRight size={16} aria-hidden="true" /></button>
          </div>
        </section>

        <section className="ux3-review-detail" aria-label="Selected review decision">
          <button className="ux3-review-back" type="button" onClick={() => setMobileDetail(false)}>
            <ArrowLeft size={17} aria-hidden="true" /> Back to Queue
          </button>
          <header className="ux3-review-detail-header">
            <div>
              <span className="ux3-eyebrow">{selected.platform} Content</span>
              <h2>{selected.title}</h2>
              <p>{selected.campaign} / Submitted {selected.submitted}</p>
            </div>
            <button className="ux3-icon-button" type="button" aria-label="More review actions"><MoreHorizontal size={20} aria-hidden="true" /></button>
          </header>

          <div className="ux3-review-detail-body">
            <article className="ux3-content-preview">
              <div className="ux3-content-preview-meta">
                <span className="ux3-avatar ux3-avatar-small">T</span>
                <span><strong>Tanaghum Content Team</strong><small>Draft preview</small></span>
              </div>
              <p>{selected.body}</p>
              <button className="ux3-text-button" type="button"><FileText size={15} aria-hidden="true" /> View Full Draft</button>
            </article>

            <div className="ux3-review-insights">
              <section className="ux3-insight-block">
                <span>Quality Score</span>
                <strong>{selected.score}<small>/100</small></strong>
                <div className="ux3-progress"><span style={{ width: `${selected.score}%` }} /></div>
                <p>Clear message and strong audience fit. The call to action can be more specific.</p>
              </section>
              <section className="ux3-insight-block">
                <span>Risk Review</span>
                <strong className="ux3-risk-heading"><CircleAlert size={19} aria-hidden="true" /> {selected.risk} Risk</strong>
                <p>No prohibited claims detected. Verify the registration deadline before scheduling.</p>
              </section>
            </div>

            <section className="ux3-comments-section">
              <div className="ux3-section-header">
                <div><h3>Reviewer Comment</h3><p>Required when requesting changes or rejecting.</p></div>
              </div>
              <label htmlFor="ux3-review-comment">Comment</label>
              <textarea id="ux3-review-comment" name="reviewComment" rows={3} placeholder={'Add a specific decision note\u2026'} />
            </section>

            <section className="ux3-package-context">
              <div><span>Publishing Package</span><strong>Not Prepared Yet</strong></div>
              <div><span>Scheduling</span><strong>Unlocks After Approval</strong></div>
              <div><span>Owner</span><strong>Content Team</strong></div>
            </section>
          </div>

          <footer className="ux3-review-actions">
            <button className="ux3-button ux3-button-danger" type="button">Reject</button>
            <button className="ux3-button ux3-button-secondary" type="button">Request Changes</button>
            <button className="ux3-button ux3-button-primary" type="button"><Check size={17} aria-hidden="true" /> Approve Content</button>
          </footer>
        </section>
      </div>
    </div>
  );
}

export default function HybridV3Preview({ page = 'today' }: { page?: PreviewPage }) {
  const [stitchiOpen, setStitchiOpen] = useState(false);

  useEffect(() => {
    const title = page === 'today' ? 'Today' : page === 'content' ? 'Content' : 'Review Queue';
    document.title = `${title} | Tanaghum UX v3 Preview`;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const resetTimer = window.setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, 0);

    return () => window.clearTimeout(resetTimer);
  }, [page]);

  return (
    <div className="ux3-root">
      <a className="ux3-skip-link" href="#ux3-main">Skip to Main Content</a>
      <DesktopNavigation page={page} onOpenStitchi={() => setStitchiOpen(true)} />
      <div className="ux3-workspace">
        <PrototypeTopBar page={page} onOpenStitchi={() => setStitchiOpen(true)} />
        <main className="ux3-main" id="ux3-main">
          {page === 'today' && <TodayPage onOpenStitchi={() => setStitchiOpen(true)} />}
          {page === 'content' && <ContentPage onOpenStitchi={() => setStitchiOpen(true)} />}
          {page === 'review' && <ReviewPage onOpenStitchi={() => setStitchiOpen(true)} />}
        </main>
      </div>
      <MobileNavigation page={page} onOpenStitchi={() => setStitchiOpen(true)} />
      <StitchiPanel open={stitchiOpen} onClose={() => setStitchiOpen(false)} page={page} />
    </div>
  );
}
