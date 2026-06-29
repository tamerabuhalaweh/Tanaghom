import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socialGrowthApi } from '../api';
import {
  BarList,
  DetailGrid,
  EmptyProductState,
  ExecutiveGauge,
  ExecutiveKpiCard,
  FunnelChart,
  MetricCard,
  Notice,
  PrimaryAction,
  ProductCard,
  ProductPage,
  ProductStatus,
  ProductTable,
  ReadableQueue,
  SecondaryAction,
} from '../components/ProductUI';
import { useAuth } from '../contexts/useAuth';

type RecordMap = Record<string, unknown>;

function text(value: unknown, fallback = 'Not available'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function list(value: unknown): RecordMap[] {
  return Array.isArray(value) ? value as RecordMap[] : [];
}

function numberValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function titleCase(value: string): string {
  if (value === 'x') return 'X / Twitter';
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function integrationTone(value: unknown): 'good' | 'warn' | 'info' {
  const normalized = text(value, '').toLowerCase();
  if (normalized.includes('configured') || normalized.includes('available')) return 'good';
  if (normalized.includes('requires')) return 'warn';
  return 'info';
}

export default function SocialGrowthIntelligence() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<RecordMap | null>(null);
  const [templates, setTemplates] = useState<RecordMap[]>([]);
  const [algorithmPack, setAlgorithmPack] = useState<RecordMap | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    if (!token) return;
    const [summaryData, templateData, algorithmData] = await Promise.all([
      socialGrowthApi.summary(token),
      socialGrowthApi.templates(token),
      socialGrowthApi.algorithmPack(token),
    ]);
    const templateList = list((templateData as RecordMap).templates);
    setSummary(summaryData as RecordMap);
    setTemplates(templateList);
    setSelectedTemplateId(current => current || String(templateList[0]?.id || ''));
    setAlgorithmPack(algorithmData as RecordMap);
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function run() {
      try {
        await load();
      } catch (error) {
        if (!cancelled) setMessage(`Growth intelligence failed to load: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function createTemplateCampaign(templateId: string) {
    if (!token) return;
    setLoading(templateId);
    setMessage('');
    try {
      const created = await socialGrowthApi.createCampaignFromTemplate(templateId, {}, token) as RecordMap;
      setMessage(`${text((created.template as RecordMap | undefined)?.name, 'Campaign')} created. Opening Campaigns...`);
      await load();
      navigate('/campaigns');
    } catch (error) {
      setMessage(`Campaign creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  const kpis = (summary?.kpis || {}) as RecordMap;
  const integrations = (summary?.integrations || {}) as RecordMap;
  const profile = (summary?.profile || {}) as RecordMap;
  const funnel = list(summary?.funnel);
  const actions = list(summary?.recommendedNextActions);
  const sources = list(algorithmPack?.sources);
  const guidanceRules = list(algorithmPack?.guidanceRules);
  const storedRules = list(algorithmPack?.storedPlatformRules);
  const selectedTemplate = templates.find(template => String(template.id) === selectedTemplateId) || templates[0];

  return (
    <ProductPage
      eyebrow="Growth Intelligence"
      title="Course Sales Command Center"
      subtitle="Use AI to create better social content, turn follower attention into qualified leads, and prepare CRM/voice handoff for course sales."
      action={<ProductStatus tone="info">Customer-Owned Integrations</ProductStatus>}
    >
      {message && (
        <Notice tone={message.toLowerCase().includes('failed') ? 'danger' : 'good'}>{message}</Notice>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ExecutiveKpiCard
          label="Campaigns"
          value={numberValue(kpis.activeCampaigns)}
          detail="Active course-sales campaigns"
          tone={numberValue(kpis.activeCampaigns) ? 'info' : 'warn'}
          series={[numberValue(kpis.activeCampaigns), numberValue(kpis.postsPrepared), numberValue(kpis.approvedContent), numberValue(kpis.schedulingPackages)]}
        />
        <ExecutiveKpiCard
          label="Posts Prepared"
          value={numberValue(kpis.postsPrepared)}
          detail="Platform-specific drafts saved"
          tone={numberValue(kpis.postsPrepared) ? 'good' : 'warn'}
          series={[0, numberValue(kpis.postsPrepared), numberValue(kpis.approvedContent), numberValue(kpis.schedulingPackages)]}
        />
        <ExecutiveKpiCard
          label="Qualified Leads"
          value={numberValue(kpis.qualifiedLeads)}
          detail={`${numberValue(kpis.capturedLeads)} captured leads`}
          tone={numberValue(kpis.qualifiedLeads) ? 'good' : 'info'}
          series={[numberValue(kpis.capturedLeads), numberValue(kpis.qualifiedLeads), numberValue(kpis.nurturingLeads)]}
        />
        <ExecutiveGauge
          value={numberValue(kpis.growthReadinessScore)}
          label="Growth Readiness"
          detail="Computed from real workflow state, AI setup, scheduling readiness, analytics, lead capture, CRM, and voice readiness."
        />
      </div>

      <ProductCard title="What this system improves for the customer" subtitle={text(profile.promise, 'AI-assisted growth workflow.')}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <ReadableQueue
            items={[
              {
                title: 'Shorten content production time',
                meta: 'Create campaign briefs and generate platform-aware posts from one guided flow.',
                status: numberValue(kpis.postsPrepared) ? 'Working' : 'Needs AI model',
                tone: numberValue(kpis.postsPrepared) ? 'good' : 'warn',
              },
              {
                title: 'Improve post quality and reach readiness',
                meta: 'Apply platform guidance, hook strength, CTA clarity, format fit, and risk checks before approval.',
                status: 'Scored',
                tone: 'info',
              },
              {
                title: 'Convert attention into course leads',
                meta: 'Capture customer interest, qualify leads, and prepare GHL/SmartLabs handoff packages.',
                status: numberValue(kpis.capturedLeads) ? 'Leads Available' : 'Waiting for leads',
                tone: numberValue(kpis.capturedLeads) ? 'good' : 'info',
              },
            ]}
          />
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-sm font-semibold text-neutral-950">Integration readiness</div>
            <div className="mt-4 grid gap-2">
              {[
                ['AI model', integrations.aiModel],
                ['Postiz scheduling', integrations.postiz],
                ['Official analytics', integrations.officialSocialAnalytics],
                ['GoHighLevel CRM', integrations.goHighLevel],
                ['SmartLabs voice/chat', integrations.smartLabsVoice],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2">
                  <span className="text-sm text-neutral-700">{String(label)}</span>
                  <ProductStatus tone={integrationTone(value)}>{titleCase(text(value))}</ProductStatus>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ProductCard>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <ProductCard title="Course Sales Funnel" subtitle="Real tenant records only. Empty stages mean the workflow has not produced that record yet.">
          <FunnelChart
            stages={funnel.map(stage => ({
              label: text(stage.label),
              value: numberValue(stage.value),
              tone: numberValue(stage.value) ? 'info' : 'default',
            }))}
          />
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <MetricCard label="CTA Clicks" value={numberValue(kpis.courseCtaClicks)} detail="From connected analytics snapshots" tone={numberValue(kpis.courseCtaClicks) ? 'good' : 'default'} />
            <MetricCard label="Engagement Rate" value={`${numberValue(kpis.engagementRate)}%`} detail="Computed when impressions and engagement exist" tone={numberValue(kpis.engagementRate) ? 'good' : 'default'} />
            <MetricCard label="Lead Quality" value={`${numberValue(kpis.leadQualificationRate)}%`} detail="Qualified / captured leads" tone={numberValue(kpis.leadQualificationRate) ? 'good' : 'default'} />
          </div>
        </ProductCard>

        <ProductCard title="Next Best Actions" subtitle="What the team should do next to move toward course-sales output.">
          {actions.length ? (
            <ReadableQueue
              items={actions.map(action => ({
                title: text(action.title),
                meta: text(action.detail),
                status: titleCase(text(action.priority)),
                tone: text(action.priority) === 'high' ? 'warn' : 'info',
              }))}
            />
          ) : (
            <EmptyProductState message="No blockers detected. Keep publishing approved content and reviewing results." />
          )}
        </ProductCard>
      </div>

      <ProductCard
        title="Course Campaign Templates"
        subtitle="Start from proven course-sales motions instead of a blank campaign brief."
        action={selectedTemplate ? <PrimaryAction onClick={() => createTemplateCampaign(String(selectedTemplate.id))} disabled={loading === selectedTemplate.id}>{loading === selectedTemplate.id ? 'Creating...' : 'Create Selected Campaign'}</PrimaryAction> : null}
      >
        {templates.length ? (
          <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-3">
              {templates.map(template => {
                const active = String(template.id) === selectedTemplateId;
                return (
                  <button
                    key={String(template.id)}
                    type="button"
                    onClick={() => setSelectedTemplateId(String(template.id))}
                    className={`w-full rounded-lg border p-4 text-left ${active ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white hover:bg-neutral-50'}`}
                  >
                    <div className="font-semibold">{text(template.name)}</div>
                    <div className={`mt-2 text-sm leading-5 ${active ? 'text-white/65' : 'text-neutral-500'}`}>{text(template.useCase)}</div>
                  </button>
                );
              })}
            </div>
            {selectedTemplate && (
              <div className="space-y-4">
                <DetailGrid
                  items={[
                    { label: 'Recommended For', value: text(selectedTemplate.recommendedFor) },
                    { label: 'Audience', value: text(selectedTemplate.audience) },
                    { label: 'CTA', value: text(selectedTemplate.cta) },
                    { label: 'Expected Outcome', value: text(selectedTemplate.expectedOutcome) },
                  ]}
                />
                <ProductTable
                  columns={['Step', 'Funnel Motion']}
                  rows={list(selectedTemplate.recommendedFunnel).map((step, index) => [
                    `Step ${index + 1}`,
                    text(step),
                  ])}
                />
              </div>
            )}
          </div>
        ) : (
          <EmptyProductState message="Course campaign templates could not be loaded." />
        )}
      </ProductCard>

      <ProductCard
        title="Social Algorithm Knowledge Pack"
        subtitle="Approved guidance that helps the AI write stronger posts. This is not a private algorithm import."
        action={<SecondaryAction onClick={() => navigate('/mcp-engine')}>Open MCP Connectors</SecondaryAction>}
      >
        <Notice tone="info">
          Tanaghum uses official/public guidance, customer-owned analytics, and approved rules. It does not scrape platforms, fake engagement, or claim access to private ranking systems.
        </Notice>
        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <ProductCard title="Guidance Applied to Content" subtitle="Signals the scoring and drafting workflow can use.">
            <ReadableQueue
              items={guidanceRules.map(rule => ({
                title: `${titleCase(text(rule.platform))}: ${text(rule.signal)}`,
                meta: `${text(rule.recommendation)} ${text(rule.businessImpact, '')}`,
                status: text(rule.confidence, 'medium'),
                tone: text(rule.confidence) === 'high' ? 'good' : 'info',
              }))}
            />
          </ProductCard>
          <ProductCard title="Sources and Freshness" subtitle="Each source needs review before becoming active policy.">
            <BarList
              items={[
                { label: 'Sources', value: sources.length, detail: `${sources.length} sources`, tone: sources.length ? 'info' : 'default' },
                { label: 'Stored Rules', value: storedRules.length, detail: `${storedRules.length} operator rules`, tone: storedRules.length ? 'good' : 'warn' },
                { label: 'Customer Analytics', value: text(integrations.officialSocialAnalytics) === 'data_available' ? 1 : 0, detail: text(integrations.officialSocialAnalytics), tone: text(integrations.officialSocialAnalytics) === 'data_available' ? 'good' : 'warn' },
              ]}
            />
          </ProductCard>
        </div>
      </ProductCard>
    </ProductPage>
  );
}
