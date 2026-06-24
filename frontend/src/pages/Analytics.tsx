import { useEffect, useState } from 'react';
import { analyticsApi, demoApi } from '../api';
import { DetailGrid, EmptyProductState, MetricCard, Notice, ProductCard, ProductPage, ProductStatus, ReadableQueue, SecondaryAction } from '../components/ProductUI';
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

function list(value: unknown): RecordMap[] {
  return Array.isArray(value) ? value as RecordMap[] : [];
}

function text(value: unknown, fallback = 'Not available'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

export default function Analytics() {
  const { token } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsSnapshot | null>(null);
  const [status, setStatus] = useState<RecordMap | null>(null);
  const [selectedLeadIndex, setSelectedLeadIndex] = useState(0);
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
  const selectedLead = leadCaptures[selectedLeadIndex] || leadCaptures[0] || null;
  const liveLeadCount = leadCaptures.length;

  return (
    <ProductPage
      eyebrow="Performance intelligence"
      title="Analytics & Leads"
      subtitle="Review campaign performance signals, learning recommendations, qualified leads, and gated CRM or voice follow-up packages."
      action={<ProductStatus tone="info">Read-only intelligence</ProductStatus>}
    >
      {message && <Notice tone="danger">{message}</Notice>}

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
            <div className="rounded-lg border border-neutral-200 bg-neutral-950 p-6 text-white">
              <div className="text-sm text-white/60">Learning signal</div>
              <h2 className="mt-3 text-2xl font-semibold leading-tight">{analytics?.topContent || 'Educational posts with image formats are performing above baseline'}</h2>
              <p className="mt-4 text-sm leading-6 text-white/65">
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
          {leadCaptures.length ? (
            <div className="space-y-3">
              {leadCaptures.map((lead, index) => {
                const active = selectedLeadIndex === index;
                const title = `${titleCase(text(lead.source, 'Social'))} lead`;
                return (
                  <button
                    key={`${title}-${index}`}
                    type="button"
                    onClick={() => setSelectedLeadIndex(index)}
                    className={`w-full rounded-lg border p-4 text-left transition ${active ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white hover:bg-neutral-50'}`}
                  >
                    <div className="font-semibold">{title}</div>
                    <div className={`mt-2 text-sm ${active ? 'text-white/60' : 'text-neutral-500'}`}>
                      {titleCase(text(lead.status, 'Qualification in progress'))}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyProductState
              title="No captured leads yet"
              message="When approved posts generate qualified responses, leads will appear here for review, CRM handoff, and voice/chat follow-up preparation."
            />
          )}
        </ProductCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <ProductCard title="Selected Lead" subtitle="Business context for the handoff decision.">
          {selectedLead ? (
            <DetailGrid items={[
              { label: 'Platform', value: titleCase(text(selectedLead.source, 'Social')) },
              { label: 'Campaign', value: 'Current Commercial/Social campaign' },
              { label: 'Intent', value: 'Captured response requires qualification' },
              { label: 'Owner', value: 'Marketing manager' },
              { label: 'Stage', value: titleCase(text(selectedLead.status, 'Qualification in progress')) },
              { label: 'Next Action', value: 'Review consent and prepare CRM handoff package' },
            ]} />
          ) : (
            <EmptyProductState message="Select a captured lead when one is available." />
          )}
        </ProductCard>

        <ProductCard title="CRM & Voice Follow-up Packages" subtitle="Prepared payloads are visible; execution remains authorization-gated.">
          <div className="grid gap-4 lg:grid-cols-2">
            <ReadableQueue items={[
              { title: 'GHL contact payload', meta: selectedLead ? `${titleCase(text(selectedLead.source, 'Social'))} source / qualification package prepared` : 'Waiting for captured lead', status: selectedLead ? 'CRM Handoff Ready' : 'Waiting', tone: selectedLead ? 'good' : 'default' },
              { title: 'GHL opportunity payload', meta: selectedLead ? `Pipeline: Commercial/Social / Stage: ${titleCase(text(selectedLead.status, 'Review'))}` : 'Available after lead selection', status: 'Requires Authorization', tone: 'warn' },
              { title: 'Write to CRM', meta: 'Requires customer credentials and sandbox authorization.', status: 'Disabled', tone: 'default' },
            ]} />
            <ReadableQueue items={[
              { title: 'Voice follow-up package', meta: 'Suggested script and lead context prepared.', status: 'Voice Follow-up Ready', tone: 'info' },
              { title: 'Consent state', meta: selectedLead ? 'Needs human confirmation before any outreach' : 'Waiting for captured lead', status: selectedLead ? 'Pending' : 'Waiting', tone: selectedLead ? 'warn' : 'default' },
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
