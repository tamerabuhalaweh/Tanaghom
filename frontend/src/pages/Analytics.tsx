import { useEffect, useState } from 'react';
import { analyticsApi, demoApi } from '../api';
import { DetailGrid, MetricCard, ProductCard, ProductPage, ProductStatus, ReadableQueue, SecondaryAction } from '../components/ProductUI';
import { useAuth } from '../contexts/useAuth';

type RecordMap = Record<string, unknown>;

type AnalyticsSnapshot = {
  impressions?: number;
  reach?: number;
  engagementRate?: string;
  bestPlatform?: string;
  topContent?: string;
  bestTime?: string;
};

const SANDBOX_LEADS = [
  {
    title: 'LinkedIn Lead - Enterprise Training Inquiry',
    platform: 'LinkedIn',
    campaign: 'Premium Social Intelligence Campaign',
    intent: 'Enterprise training inquiry',
    score: 82,
    owner: 'Commercial operations',
    stage: 'CRM Handoff Ready',
    nextAction: 'Review GHL contact and opportunity payload.',
  },
  {
    title: 'Instagram Lead - Course Follow-up Request',
    platform: 'Instagram',
    campaign: 'Premium Social Intelligence Campaign',
    intent: 'Course follow-up request',
    score: 74,
    owner: 'Demand generation',
    stage: 'Needs Human Review',
    nextAction: 'Confirm consent and route to nurture.',
  },
  {
    title: 'X Lead - Partnership Information Request',
    platform: 'X / Twitter',
    campaign: 'Premium Social Intelligence Campaign',
    intent: 'Partnership information request',
    score: 68,
    owner: 'Revenue operations',
    stage: 'Qualification In Progress',
    nextAction: 'Ask one qualifying question before handoff.',
  },
];

function list(value: unknown): RecordMap[] {
  return Array.isArray(value) ? value as RecordMap[] : [];
}

export default function Analytics() {
  const { token } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsSnapshot | null>(null);
  const [status, setStatus] = useState<RecordMap | null>(null);
  const [selectedLead, setSelectedLead] = useState(SANDBOX_LEADS[0]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function run() {
      try {
        const [analyticsData, statusData] = await Promise.all([
          analyticsApi.demo(token as string),
          demoApi.status(token as string),
        ]);
        if (cancelled) return;
        setAnalytics(analyticsData as AnalyticsSnapshot);
        setStatus(statusData as RecordMap);
      } catch (error) {
        if (!cancelled) setMessage(`Analytics failed to load: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const reach = analytics?.reach ?? 0;
  const impressions = analytics?.impressions ?? 0;
  const leadCaptures = list(status?.leadCaptures);
  const liveLeadCount = leadCaptures.length || SANDBOX_LEADS.length;

  return (
    <ProductPage
      eyebrow="Performance intelligence"
      title="Analytics & Leads"
      subtitle="Review campaign performance signals, learning recommendations, qualified leads, and gated CRM or voice follow-up packages."
      action={<ProductStatus tone="info">Read-only intelligence</ProductStatus>}
    >
      {message && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100">{message}</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Reach" value={reach ? reach.toLocaleString() : '8,900'} detail="Campaign audience reached" />
        <MetricCard label="Impressions" value={impressions ? impressions.toLocaleString() : '12,500'} detail="Total content views" />
        <MetricCard label="Engagement" value={analytics?.engagementRate || '3.56%'} detail="Normalized rate" />
        <MetricCard label="Best Platform" value={analytics?.bestPlatform || 'LinkedIn'} detail="Recommended focus" />
        <MetricCard label="Qualified Leads" value={liveLeadCount} detail="Handoff candidates" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <ProductCard title="Performance Intelligence" subtitle="Signals the marketing team can use for the next campaign decision.">
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="rounded-2xl bg-black p-6 text-white">
              <div className="text-sm text-white/55">Learning signal</div>
              <h2 className="mt-3 text-2xl font-semibold leading-tight">{analytics?.topContent || 'Educational posts with image formats are performing above baseline'}</h2>
              <p className="mt-4 text-sm leading-6 text-white/58">
                Keep the educational format, tighten the CTA, and prioritize the best performing platform window for the next approved package.
              </p>
            </div>
            <DetailGrid items={[
              { label: 'Best Time', value: analytics?.bestTime || 'Tuesday 10:00 AM' },
              { label: 'Best Format', value: 'Educational post with image' },
              { label: 'CTA Direction', value: 'Direct consultation request' },
              { label: 'Source', value: 'Sandbox intelligence source' },
            ]} />
          </div>
        </ProductCard>

        <ProductCard title="Lead Queue" subtitle="Qualified campaign responses ready for review.">
          <div className="space-y-3">
            {SANDBOX_LEADS.map(lead => (
              <button
                key={lead.title}
                type="button"
                onClick={() => setSelectedLead(lead)}
                className={`w-full rounded-2xl p-4 text-left transition ${selectedLead.title === lead.title ? 'bg-black text-white' : 'bg-stone-50 text-black hover:bg-stone-100'}`}
              >
                <div className="font-semibold">{lead.title}</div>
                <div className={`mt-2 text-sm ${selectedLead.title === lead.title ? 'text-white/58' : 'text-black/48'}`}>
                  {lead.intent} / Score {lead.score}
                </div>
              </button>
            ))}
          </div>
        </ProductCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <ProductCard title="Selected Lead" subtitle="Business context for the handoff decision.">
          <DetailGrid items={[
            { label: 'Platform', value: selectedLead.platform },
            { label: 'Campaign', value: selectedLead.campaign },
            { label: 'Intent', value: selectedLead.intent },
            { label: 'Owner', value: selectedLead.owner },
            { label: 'Stage', value: selectedLead.stage },
            { label: 'Next Action', value: selectedLead.nextAction },
          ]} />
        </ProductCard>

        <ProductCard title="CRM & Voice Follow-up Packages" subtitle="Prepared payloads are visible; execution remains authorization-gated.">
          <div className="grid gap-4 lg:grid-cols-2">
            <ReadableQueue items={[
              { title: 'GHL contact payload', meta: `${selectedLead.platform} source / ${selectedLead.intent}`, status: 'CRM Handoff Ready', tone: 'good' },
              { title: 'GHL opportunity payload', meta: `Pipeline: Commercial/Social / Stage: ${selectedLead.stage}`, status: 'Requires Authorization', tone: 'warn' },
              { title: 'Write to CRM', meta: 'Requires customer credentials and sandbox authorization.', status: 'Disabled', tone: 'default' },
            ]} />
            <ReadableQueue items={[
              { title: 'Voice follow-up package', meta: 'Suggested script and lead context prepared.', status: 'Voice Follow-up Ready', tone: 'info' },
              { title: 'Consent state', meta: selectedLead.score >= 80 ? 'Ready for human review' : 'Needs confirmation', status: selectedLead.score >= 80 ? 'Reviewed' : 'Pending', tone: selectedLead.score >= 80 ? 'good' : 'warn' },
              { title: 'Trigger call/chat', meta: 'Requires approved test lead and explicit authorization.', status: 'Disabled', tone: 'default' },
            ]} />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <SecondaryAction disabled>Push to CRM - Requires Authorization</SecondaryAction>
            <SecondaryAction disabled>Trigger Voice Follow-up - Requires Authorization</SecondaryAction>
          </div>
        </ProductCard>
      </div>
    </ProductPage>
  );
}
