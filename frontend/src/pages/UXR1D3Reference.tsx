import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileCheck2,
  Home,
  Library,
  MessageSquareText,
  MoreHorizontal,
  PenLine,
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import './UXR1D3Reference.css';

type ReferencePage = 'content' | 'review' | 'scheduling';
type ContentStep = 'brief' | 'ideas' | 'draft';

type QueueItem = {
  id: string;
  title: string;
  campaign: string;
  platform: string;
  meta: string;
  status: string;
};

const journey = ['Brief', 'Ideas', 'Draft', 'Review', 'Schedule', 'Results'];

const reviewItems: QueueItem[] = [
  {
    id: 'leadership-carousel',
    title: 'Leadership begins before confidence arrives',
    campaign: 'Leadership Course Launch',
    platform: 'Instagram carousel',
    meta: 'Submitted 28 minutes ago',
    status: 'Ready for decision',
  },
  {
    id: 'buyer-email',
    title: 'A private invitation for previous buyers',
    campaign: 'Leadership Course Launch',
    platform: 'Email',
    meta: 'Submitted 1 hour ago',
    status: 'Ready for decision',
  },
  {
    id: 'event-story',
    title: 'Three signs you are ready to lead differently',
    campaign: 'Business Leadership Event',
    platform: 'Instagram story',
    meta: 'Changes received today',
    status: 'Revised',
  },
];

const scheduleItems: QueueItem[] = [
  {
    id: 'approved-carousel',
    title: 'Leadership begins before confidence arrives',
    campaign: 'Leadership Course Launch',
    platform: 'Instagram carousel',
    meta: 'Approved by Content Approver',
    status: 'Ready to schedule',
  },
  {
    id: 'approved-email',
    title: 'A private invitation for previous buyers',
    campaign: 'Leadership Course Launch',
    platform: 'Email',
    meta: 'Approved 42 minutes ago',
    status: 'Ready to schedule',
  },
];

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function ProductMark() {
  return (
    <span className="r1d3-product-mark" aria-hidden="true">
      <Sparkles size={20} />
    </span>
  );
}

function ReferenceShell({ page, children }: { page: ReferencePage; children: ReactNode }) {
  const navigation = [
    { label: 'Today', icon: Home, to: '/ux/r1d3/content' },
    { label: 'Plans & Events', icon: CalendarDays, to: '/ux/r1d3/content' },
    { label: 'Content', icon: PenLine, to: '/ux/r1d3/content', active: page === 'content' },
    { label: 'Review', icon: FileCheck2, to: '/ux/r1d3/review', active: page === 'review' },
    { label: 'Scheduling', icon: Send, to: '/ux/r1d3/scheduling', active: page === 'scheduling' },
    { label: 'Sales & Leads', icon: UsersRound, to: '/ux/r1d3/content' },
    { label: 'Performance', icon: BarChart3, to: '/ux/r1d3/content' },
  ];

  return (
    <div className="r1d3-reference">
      <aside className="r1d3-sidebar">
        <Link className="r1d3-brand" to="/ux/r1d3/content">
          <ProductMark />
          <span><strong>Tanaghum</strong><small>Commercial workspace</small></span>
        </Link>
        <span className="r1d3-nav-label">Workspace</span>
        <nav aria-label="Reference product navigation">
          {navigation.map(item => {
            const Icon = item.icon;
            return (
              <Link key={`${item.label}-${item.to}`} className={item.active ? 'is-active' : ''} to={item.to}>
                <Icon size={18} aria-hidden="true" /><span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="r1d3-sidebar-footer">
          <Link to="/ux/r1d3/content"><Settings size={18} aria-hidden="true" />Settings</Link>
          <div className="r1d3-user"><span>M</span><div><strong>Marketing Manager</strong><small>Commercial team</small></div><ChevronRight size={17} aria-hidden="true" /></div>
        </div>
      </aside>

      <div className="r1d3-app">
        <header className="r1d3-topbar">
          <div className="r1d3-mobile-brand"><ProductMark /><strong>Tanaghum</strong></div>
          <div className="r1d3-breadcrumb"><span>Commercial workspace</span><ChevronRight size={14} aria-hidden="true" /><strong>{page === 'content' ? 'Content' : page === 'review' ? 'Review' : 'Scheduling'}</strong></div>
          <div className="r1d3-top-actions"><span className="r1d3-reference-label">Local UX reference</span><button type="button"><Sparkles size={17} aria-hidden="true" />Ask Stitchi</button><button className="r1d3-icon-button" type="button" aria-label="More options"><MoreHorizontal size={20} /></button></div>
        </header>
        <main>{children}</main>
      </div>

      <nav className="r1d3-mobile-nav" aria-label="Reference mobile navigation">
        <Link className={page === 'content' ? 'is-active' : ''} to="/ux/r1d3/content"><PenLine size={19} /><span>Content</span></Link>
        <Link className={page === 'review' ? 'is-active' : ''} to="/ux/r1d3/review"><FileCheck2 size={19} /><span>Review</span></Link>
        <Link className={page === 'scheduling' ? 'is-active' : ''} to="/ux/r1d3/scheduling"><Send size={19} /><span>Schedule</span></Link>
      </nav>
    </div>
  );
}

function PageHeading({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children?: ReactNode }) {
  return (
    <header className="r1d3-page-heading">
      <div><span className="r1d3-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>
      {children ? <div className="r1d3-heading-actions">{children}</div> : null}
    </header>
  );
}

function Journey({ active }: { active: number }) {
  return (
    <nav className="r1d3-journey" aria-label="Content journey">
      {journey.map((step, index) => (
        <Link
          key={step}
          className={cx(index === active && 'is-active', index < active && 'is-complete')}
          to={index <= 2 ? '/ux/r1d3/content' : index === 3 ? '/ux/r1d3/review' : index === 4 ? '/ux/r1d3/scheduling' : '/ux/r1d3/content'}
          aria-current={index === active ? 'step' : undefined}
        >
          <span>{index < active ? <Check size={14} aria-hidden="true" /> : index + 1}</span><strong>{step}</strong>
        </Link>
      ))}
    </nav>
  );
}

function Status({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'info' }) {
  return <span className={`r1d3-status is-${tone}`}>{children}</span>;
}

function StitchiCard({ mode }: { mode: 'content' | 'review' | 'scheduling' }) {
  const copy = {
    content: {
      title: 'Improve this draft with Stitchi',
      body: 'Ask for a stronger opening, a clearer call to action, or a platform-specific rewrite.',
      prompt: 'Make the opening more direct for entrepreneurs, while keeping the promise realistic.',
      action: 'Improve draft',
    },
    review: {
      title: 'Ask Stitchi for a review summary',
      body: 'Stitchi can summarize the audience fit, claim risk, and requested decision. The human approver still decides.',
      prompt: 'Summarize what I should check before approving this content.',
      action: 'Summarize review',
    },
    scheduling: {
      title: 'Let Stitchi check the timing',
      body: 'Stitchi can compare the campaign window and selected audience before suggesting a time. It cannot publish without approval.',
      prompt: 'Suggest a suitable time for this approved Instagram carousel.',
      action: 'Suggest timing',
    },
  }[mode];

  return (
    <aside className="r1d3-stitchi-card">
      <span className="r1d3-stitchi-icon"><Sparkles size={18} aria-hidden="true" /></span>
      <span className="r1d3-eyebrow">Stitchi assistant</span>
      <h2>{copy.title}</h2>
      <p>{copy.body}</p>
      <div className="r1d3-prompt"><MessageSquareText size={17} aria-hidden="true" /><span>“{copy.prompt}”</span></div>
      <button className="r1d3-button is-secondary" type="button"><Sparkles size={16} aria-hidden="true" />{copy.action}</button>
      <small>Stitchi prepares work. You approve what moves forward.</small>
    </aside>
  );
}

function BriefSurface({ onNext }: { onNext: () => void }) {
  return (
    <section className="r1d3-surface r1d3-task-surface">
      <header><div><span className="r1d3-eyebrow">Step 1 of 6</span><h2>Campaign brief</h2><p>Give the team enough context to create useful, on-brand work.</p></div><Status tone="good">Ready to generate</Status></header>
      <div className="r1d3-form-grid">
        <label className="is-wide"><span>Objective <em>Required</em></span><textarea defaultValue="Turn warm followers and previous buyers into qualified registrations for the leadership course." rows={3} /></label>
        <label className="is-wide"><span>Audience <em>Required</em></span><textarea defaultValue="Entrepreneurs and previous buyers in the GCC who want practical leadership growth." rows={3} /></label>
        <label><span>Primary platform</span><select defaultValue="instagram"><option value="instagram">Instagram</option><option value="linkedin">LinkedIn</option><option value="email">Email</option></select></label>
        <label><span>Content format</span><select defaultValue="carousel"><option value="carousel">Carousel</option><option value="reel">Reel</option><option value="story">Story</option></select></label>
        <label className="is-wide"><span>Call to action</span><input defaultValue="Reserve your place for the leadership course" /></label>
      </div>
      <footer><button className="r1d3-button is-secondary" type="button">Save brief</button><button className="r1d3-button is-primary" type="button" onClick={onNext}><Sparkles size={17} />Generate directions</button></footer>
    </section>
  );
}

function IdeasSurface({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const [selected, setSelected] = useState(0);
  const directions = [
    { title: 'Lead before you feel ready', hook: 'Confidence often follows the first courageous decision.', format: 'Instagram carousel' },
    { title: 'The cost of waiting for certainty', hook: 'A practical leadership lesson for entrepreneurs under pressure.', format: 'Instagram reel' },
    { title: 'What previous buyers learned next', hook: 'Use customer progress to invite the next serious step.', format: 'Email story' },
  ];
  return (
    <section className="r1d3-surface r1d3-task-surface">
      <header><div><span className="r1d3-eyebrow">Step 2 of 6</span><h2>Choose a direction</h2><p>Compare the message before investing time in the full draft.</p></div><Status tone="info">3 AI directions</Status></header>
      <div className="r1d3-direction-grid">
        {directions.map((direction, index) => (
          <button key={direction.title} className={selected === index ? 'is-selected' : ''} type="button" onClick={() => setSelected(index)} aria-pressed={selected === index}>
            <span><small>{direction.format}</small>{selected === index ? <CheckCircle2 size={18} aria-label="Selected" /> : null}</span>
            <strong>{direction.title}</strong><p>{direction.hook}</p>
          </button>
        ))}
      </div>
      <footer><button className="r1d3-button is-secondary" type="button" onClick={onBack}><ArrowLeft size={17} />Back to brief</button><button className="r1d3-button is-primary" type="button" onClick={onNext}>Use selected direction<ArrowRight size={17} /></button></footer>
    </section>
  );
}

function DraftSurface({ onBack }: { onBack: () => void }) {
  return (
    <section className="r1d3-surface r1d3-task-surface">
      <header><div><span className="r1d3-eyebrow">Step 3 of 6</span><h2>Prepare the draft</h2><p>Edit the selected direction and check the final decision context.</p></div><Status tone="warn">Draft 2</Status></header>
      <div className="r1d3-editor-layout">
        <div className="r1d3-editor-fields">
          <label><span>Opening</span><textarea rows={3} defaultValue="Leadership does not begin when confidence arrives. It begins when you choose the next right action while the outcome is still uncertain." /></label>
          <label><span>Message</span><textarea rows={7} defaultValue={'Every entrepreneur reaches a moment when growth asks for a stronger version of their leadership.\n\nThis course turns pressure into practical decisions: clearer priorities, stronger conversations, and the courage to move before every answer is available.'} /></label>
          <label><span>Call to action</span><input defaultValue="Reserve your place and begin the next stage of your leadership journey." /></label>
        </div>
        <aside className="r1d3-readiness">
          <div><span>Platform</span><strong><PenLine size={17} />Instagram carousel</strong></div>
          <div><span>Audience fit</span><strong>Strong</strong><small>Warm followers and previous buyers</small></div>
          <div><span>Claim review</span><strong>Low risk</strong><small>No unsupported outcome promise detected</small></div>
          <div><span>Next step</span><strong>Human review</strong><small>A content approver makes the final decision</small></div>
        </aside>
      </div>
      <footer><button className="r1d3-button is-secondary" type="button" onClick={onBack}><ArrowLeft size={17} />Back to directions</button><Link className="r1d3-button is-primary" to="/ux/r1d3/review"><FileCheck2 size={17} />Send for review</Link></footer>
    </section>
  );
}

function ContentReference() {
  const [step, setStep] = useState<ContentStep>('draft');
  const stepIndex = step === 'brief' ? 0 : step === 'ideas' ? 1 : 2;
  return (
    <ReferenceShell page="content">
      <PageHeading eyebrow="Content workspace" title="Create campaign content" subtitle="Move from a focused brief to one review-ready draft without leaving the workflow.">
        <button className="r1d3-button is-secondary" type="button"><Sparkles size={17} />Create with Stitchi</button>
        <button className="r1d3-button is-primary" type="button" onClick={() => setStep('brief')}><Plus size={17} />New content</button>
      </PageHeading>
      <Journey active={stepIndex} />
      <div className="r1d3-content-layout">
        {step === 'brief' ? <BriefSurface onNext={() => setStep('ideas')} /> : step === 'ideas' ? <IdeasSurface onBack={() => setStep('brief')} onNext={() => setStep('draft')} /> : <DraftSurface onBack={() => setStep('ideas')} />}
        <StitchiCard mode="content" />
      </div>
      <section className="r1d3-surface r1d3-recent-content">
        <header><div><h2>Recent content</h2><p>Continue saved work without opening the full library.</p></div><button className="r1d3-button is-secondary" type="button"><Library size={17} />View library</button></header>
        <div className="r1d3-content-rows">
          <article><div><strong>Leadership launch carousel</strong><small>Leadership Course Launch</small></div><span>Instagram</span><Status tone="warn">In review</Status><Link aria-label="Open Leadership launch carousel" to="/ux/r1d3/review"><ChevronRight size={18} /></Link></article>
          <article><div><strong>Founder story: choosing the difficult path</strong><small>Business Leadership Event</small></div><span>LinkedIn</span><Status tone="info">Draft</Status><button aria-label="Open Founder story" type="button"><ChevronRight size={18} /></button></article>
          <article><div><strong>Registration reminder</strong><small>Leadership Course Launch</small></div><span>Instagram story</span><Status tone="good">Scheduled</Status><Link aria-label="Open Registration reminder" to="/ux/r1d3/scheduling"><ChevronRight size={18} /></Link></article>
        </div>
      </section>
    </ReferenceShell>
  );
}

function QueueList({ title, subtitle, items, selectedId, onSelect }: { title: string; subtitle: string; items: QueueItem[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <section className="r1d3-queue">
      <header><div><h2>{title}</h2><p>{subtitle}</p></div><Status tone="warn">{items.length} open</Status></header>
      <label className="r1d3-search"><Search size={17} aria-hidden="true" /><input aria-label={`Search ${title.toLowerCase()}`} placeholder="Search by campaign or content" /></label>
      <div className="r1d3-queue-items">
        {items.map(item => (
          <button key={item.id} className={item.id === selectedId ? 'is-selected' : ''} type="button" onClick={() => onSelect(item.id)}>
            <span><strong>{item.title}</strong><ChevronRight size={17} aria-hidden="true" /></span>
            <small>{item.campaign}</small>
            <span className="r1d3-item-meta"><span>{item.platform}</span><Status tone={item.status.includes('Ready') ? 'good' : 'info'}>{item.status}</Status></span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ReviewDetail({ item, onBack }: { item: QueueItem; onBack: () => void }) {
  const [decision, setDecision] = useState('');
  return (
    <section className="r1d3-detail r1d3-review-detail">
      <button className="r1d3-mobile-back" type="button" onClick={onBack}><ArrowLeft size={17} />Back to review queue</button>
      <header><div><span className="r1d3-eyebrow">{item.platform}</span><h2>{item.title}</h2><p>{item.campaign} · {item.meta}</p></div><Status tone="warn">Decision required</Status></header>
      <div className="r1d3-draft-preview">
        <div><span className="r1d3-avatar">T</span><span><strong>Content draft</strong><small>Version 2 · Full draft</small></span></div>
        <p><strong>Leadership does not begin when confidence arrives.</strong></p>
        <p>It begins when you choose the next right action while the outcome is still uncertain. Every entrepreneur reaches a moment when growth asks for clearer priorities, stronger conversations, and the courage to move.</p>
        <p>Reserve your place and begin the next stage of your leadership journey.</p>
      </div>
      <div className="r1d3-review-signals">
        <div><span>Quality</span><strong>86<small>/100</small></strong><p>Clear message, audience, and call to action.</p></div>
        <div><span>Risk</span><strong><CircleAlert size={17} />Low</strong><p>No unsupported outcome promise detected.</p></div>
        <div><span>After approval</span><strong>Scheduling</strong><p>A social account and publish time will be selected next.</p></div>
      </div>
      <div className="r1d3-context-strip"><div><span>Audience</span><strong>Entrepreneurs and previous buyers</strong></div><div><span>Call to action</span><strong>Reserve your place</strong></div><div><span>Required approver</span><strong>Content Approver</strong></div></div>
      <label className="r1d3-comment"><span>Decision comment <small>Required for changes or rejection</small></span><textarea rows={3} value={decision} onChange={event => setDecision(event.target.value)} placeholder="Add a clear note for the content owner" /></label>
      <footer><button className="r1d3-button is-danger" type="button">Reject</button><button className="r1d3-button is-secondary" type="button">Request changes</button><Link className="r1d3-button is-primary" to="/ux/r1d3/scheduling"><Check size={17} />Approve content</Link></footer>
    </section>
  );
}

function ReviewReference() {
  const [selectedId, setSelectedId] = useState(reviewItems[0].id);
  const [mobileDetail, setMobileDetail] = useState(false);
  const selected = reviewItems.find(item => item.id === selectedId) ?? reviewItems[0];
  return (
    <ReferenceShell page="review">
      <PageHeading eyebrow="Content decisions" title="Review content" subtitle="Make one informed decision with the draft, quality, risk, and publishing impact together.">
        <button className="r1d3-button is-secondary" type="button"><Sparkles size={17} />Ask Stitchi</button><Status tone="warn">3 awaiting review</Status>
      </PageHeading>
      <Journey active={3} />
      <div className={cx('r1d3-split-workspace', mobileDetail && 'show-detail')}>
        <QueueList title="Review queue" subtitle="Oldest decision first." items={reviewItems} selectedId={selectedId} onSelect={id => { setSelectedId(id); setMobileDetail(true); }} />
        <ReviewDetail item={selected} onBack={() => setMobileDetail(false)} />
      </div>
      <div className="r1d3-inline-stitchi"><Sparkles size={18} /><div><strong>Need a faster first pass?</strong><span>Ask Stitchi to summarize audience fit and claim risk. The human approver still makes the decision.</span></div><button className="r1d3-button is-secondary" type="button">Summarize selected draft</button></div>
    </ReferenceShell>
  );
}

function SchedulingDetail({ item, onBack }: { item: QueueItem; onBack: () => void }) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <section className="r1d3-detail r1d3-schedule-detail">
      <button className="r1d3-mobile-back" type="button" onClick={onBack}><ArrowLeft size={17} />Back to approved content</button>
      <header><div><span className="r1d3-eyebrow">Approved content</span><h2>{item.title}</h2><p>{item.campaign} · {item.platform}</p></div><Status tone="good">Approved</Status></header>
      {confirmed ? <div className="r1d3-success"><CheckCircle2 size={20} /><div><strong>Schedule recorded</strong><span>Friday, July 17 at 7:30 PM · Instagram Business</span></div><Link to="/ux/r1d3/content">View results when available<ArrowRight size={16} /></Link></div> : null}
      <div className="r1d3-schedule-layout">
        <div className="r1d3-schedule-form">
          <label><span>Social account</span><select defaultValue="instagram-business"><option value="instagram-business">Instagram Business · @leadership</option><option value="connect">Connect another account</option></select></label>
          <div><label><span>Publish date</span><input type="date" defaultValue="2026-07-17" /></label><label><span>Publish time</span><input type="time" defaultValue="19:30" /></label></div>
          <label><span>Timezone</span><select defaultValue="asia-dubai"><option value="asia-dubai">Gulf Standard Time (UTC+4)</option><option value="asia-amman">Amman (UTC+3)</option></select></label>
          <div className="r1d3-readiness-list"><div><CheckCircle2 size={18} /><span><strong>Content approved</strong><small>Approved by Content Approver</small></span></div><div><CheckCircle2 size={18} /><span><strong>Social account ready</strong><small>Instagram Business is connected</small></span></div><div><CheckCircle2 size={18} /><span><strong>Publishing controls satisfied</strong><small>This action will be recorded for your team</small></span></div></div>
        </div>
        <aside className="r1d3-social-preview">
          <div><span className="r1d3-avatar">T</span><span><strong>Leadership Course</strong><small>Sponsored content preview</small></span><MoreHorizontal size={18} /></div>
          <div className="r1d3-preview-media"><Sparkles size={24} /><strong>Lead before<br />you feel ready.</strong></div>
          <p><strong>Leadership Course</strong> Leadership does not begin when confidence arrives. It begins when you choose the next right action.</p>
          <span>Preview only · Final platform rendering may vary</span>
        </aside>
      </div>
      <footer><Link className="r1d3-button is-secondary" to="/ux/r1d3/review"><ArrowLeft size={17} />Back to review</Link><button className="r1d3-button is-secondary" type="button"><Clock3 size={17} />Save schedule</button><button className="r1d3-button is-primary" type="button" onClick={() => setConfirmed(true)}><CalendarDays size={17} />Confirm schedule</button></footer>
    </section>
  );
}

function SchedulingReference() {
  const [selectedId, setSelectedId] = useState(scheduleItems[0].id);
  const [mobileDetail, setMobileDetail] = useState(false);
  const selected = scheduleItems.find(item => item.id === selectedId) ?? scheduleItems[0];
  return (
    <ReferenceShell page="scheduling">
      <PageHeading eyebrow="Publishing workspace" title="Schedule approved content" subtitle="Choose the social account and time for one approved item. Tanaghum keeps the approval trail attached.">
        <button className="r1d3-button is-secondary" type="button"><Settings size={17} />Manage social accounts</button><Status tone="good">1 account ready</Status>
      </PageHeading>
      <Journey active={4} />
      <div className={cx('r1d3-split-workspace r1d3-scheduling-workspace', mobileDetail && 'show-detail')}>
        <QueueList title="Approved content" subtitle="Ready for a publish time." items={scheduleItems} selectedId={selectedId} onSelect={id => { setSelectedId(id); setMobileDetail(true); }} />
        <SchedulingDetail item={selected} onBack={() => setMobileDetail(false)} />
      </div>
      <div className="r1d3-inline-stitchi"><Sparkles size={18} /><div><strong>Not sure when to publish?</strong><span>Stitchi can suggest a time using the campaign window and audience context. You confirm before anything is scheduled.</span></div><button className="r1d3-button is-secondary" type="button">Suggest a time</button></div>
    </ReferenceShell>
  );
}

export default function UXR1D3Reference({ page }: { page: ReferencePage }) {
  if (page === 'review') return <ReviewReference />;
  if (page === 'scheduling') return <SchedulingReference />;
  return <ContentReference />;
}
