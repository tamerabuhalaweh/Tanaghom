import { useEffect, useMemo, useRef, useState } from 'react';
import { analyticsApi, ghlApi, leadsApi, smartLabsApi, socialGrowthApi } from '../api';
import {
  BarList,
  DetailGrid,
  EmptyProductState,
  Field,
  FunnelChart,
  MetricCard,
  Notice,
  PrimaryAction,
  ProductCard,
  ProductPage,
  ProductStatus,
  ProductTable,
  ReadableQueue,
  ScoreRing,
  SecondaryAction,
} from '../components/ProductUI';
import { useAuth } from '../contexts/useAuth';

type RecordMap = Record<string, unknown>;

function list(value: unknown): RecordMap[] {
  return Array.isArray(value) ? (value as RecordMap[]) : [];
}

function text(value: unknown, fallback = 'Not available'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function titleCase(value: string): string {
  if (value === 'x') return 'X / Twitter';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

const internalCustomerTextPattern = /\b(sprint\s*\d+|acceptance|smoke)\b/i;

function isInternalCustomerText(value: unknown): boolean {
  return typeof value === 'string' && internalCustomerTextPattern.test(value);
}

function sourceLabel(lead: RecordMap): string {
  const source = text(
    lead.sourcePlatform || lead.channelAttribution || lead.externalSourceProvider || lead.sourceOfTruth,
    'manual',
  );
  return titleCase(source);
}

function customerLeadName(lead: RecordMap, fallbackIndex?: number): string {
  const rawName = text(lead.leadName, '');
  if (rawName && !isInternalCustomerText(rawName)) return rawName;

  const crmProvider = text(lead.sourceOfTruth || lead.externalSourceProvider, '');
  if (crmProvider && crmProvider !== 'Not available') return `${titleCase(crmProvider)} lead`;

  const source = sourceLabel(lead);
  const suffix = typeof fallbackIndex === 'number' ? ` ${fallbackIndex + 1}` : '';
  return `${source} lead${suffix}`;
}

function customerLeadContact(lead: RecordMap): string {
  const email = text(lead.leadEmail, '');
  if (email && !isInternalCustomerText(email) && !email.toLowerCase().endsWith('@example.com')) {
    return email;
  }

  const phone = text(lead.leadPhone, '');
  if (phone && !isInternalCustomerText(phone)) return phone;

  return 'Contact details pending';
}

function leadTemperatureLabel(lead: RecordMap): string {
  return titleCase(text(lead.leadTemperature || lead.temperature, 'new lead'));
}

function metricTotal(snapshots: RecordMap[], key: string): number {
  return snapshots.reduce((total, snapshot) => {
    const metrics = ((snapshot.normalizedMetrics || snapshot.metrics || {}) as RecordMap);
    return total + numberValue(metrics[key]);
  }, 0);
}

export default function Analytics() {
  const { token } = useAuth();
  const [sources, setSources] = useState<RecordMap[]>([]);
  const [snapshots, setSnapshots] = useState<RecordMap[]>([]);
  const [reports, setReports] = useState<RecordMap[]>([]);
  const [leads, setLeads] = useState<RecordMap[]>([]);
  const [leadStats, setLeadStats] = useState<RecordMap | null>(null);
  const [selectedLeadIndex, setSelectedLeadIndex] = useState(0);
  const [ghlPreview, setGhlPreview] = useState<RecordMap | null>(null);
  const [voicePreview, setVoicePreview] = useState<RecordMap | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState('');
  const [pageLoading, setPageLoading] = useState(Boolean(token));
  const [growthSummary, setGrowthSummary] = useState<RecordMap | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [leadForm, setLeadForm] = useState({
    sourcePlatform: 'linkedin',
    leadName: '',
    leadEmail: '',
    leadPhone: '',
    consentStatus: 'pending',
  });

  async function load() {
    if (!token) return;
    const [sourceData, snapshotData, reportData, leadData, statsData, growthData] = await Promise.all([
      analyticsApi.sources(token),
      analyticsApi.snapshots(token),
      analyticsApi.reports(token),
      leadsApi.list(token),
      leadsApi.stats(token),
      socialGrowthApi.summary(token).catch(() => null),
    ]);
    setSources(list(sourceData));
    setSnapshots(list(snapshotData));
    setReports(list(reportData));
    setLeads(list(leadData));
    setLeadStats(statsData as RecordMap);
    setGrowthSummary(growthData as RecordMap | null);
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function run() {
      try {
        await load();
      } catch (error) {
        if (!cancelled)
          setMessage(`Failed to load: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Auto-dismiss success messages
  useEffect(() => {
    if (!message || message.includes('failed') || message.includes('Failed')) return;
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setMessage(''), 5000);
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, [message]);

  const reach = metricTotal(snapshots, 'reach');
  const impressions = metricTotal(snapshots, 'impressions');
  const engagement = metricTotal(snapshots, 'engagement');
  const selectedLead = leads[selectedLeadIndex] || leads[0] || null;
  const selectedLeadName = selectedLead ? customerLeadName(selectedLead, selectedLeadIndex) : '';
  const qualified = numberValue(leadStats?.qualified);
  const totalLeads = numberValue(leadStats?.total);
  const hasAnalyticsData = snapshots.length > 0 || reports.length > 0;
  const growthKpis = (growthSummary?.kpis || {}) as RecordMap;
  const growthIntegrations = (growthSummary?.integrations || {}) as RecordMap;
  const growthFunnel = list(growthSummary?.funnel);

  const selectedLeadDetails = useMemo(
    () =>
      selectedLead
        ? [
            { label: 'Lead', value: selectedLeadName },
            { label: 'Source', value: sourceLabel(selectedLead) },
            { label: 'Status', value: titleCase(text(selectedLead.leadStatus, 'new_lead')) },
            {
              label: 'Contact',
              value: customerLeadContact(selectedLead),
            },
            {
              label: 'Phone',
              value: isInternalCustomerText(selectedLead.leadPhone)
                ? 'Contact details pending'
                : text(selectedLead.leadPhone, 'Not provided'),
            },
            {
              label: 'Interest Score',
              value: String(numberValue(selectedLead.qualificationScore)),
            },
            {
              label: 'Consent',
              value: titleCase(text(selectedLead.consentStatus, 'pending')),
            },
            {
              label: 'Campaign',
              value: selectedLead.campaignId ? 'Linked to campaign' : 'Not linked yet',
            },
          ]
        : [],
    [selectedLead, selectedLeadName],
  );

  async function captureLead() {
    if (!token) return;
    setLoading('capture-lead');
    setMessage('');
    try {
      await leadsApi.create(leadForm, token);
      setLeadForm({
        sourcePlatform: 'linkedin',
        leadName: '',
        leadEmail: '',
        leadPhone: '',
        consentStatus: 'pending',
      });
      setMessage('Lead captured successfully.');
      await load();
    } catch (error) {
      setMessage(
        `Could not capture lead: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setLoading('');
    }
  }

  async function qualifyLead() {
    if (!token || !selectedLead) return;
    setLoading('qualify-lead');
    setMessage('');
    try {
      await leadsApi.qualify(String(selectedLead.id), token);
      setMessage('Lead qualified.');
      await load();
    } catch (error) {
      setMessage(
        `Could not qualify lead: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setLoading('');
    }
  }

  async function previewGhlPayload() {
    if (!token || !selectedLead) return;
    setLoading('ghl-preview');
    setMessage('');
    try {
      const result = (await ghlApi.sandboxContact(
        { leadId: selectedLead.id, mode: 'preview' },
        token,
      )) as RecordMap;
      setGhlPreview(result);
      setMessage('CRM handoff preview prepared.');
    } catch (error) {
      setMessage(
        `Preview failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setLoading('');
    }
  }

  async function previewVoicePayload() {
    if (!token || !selectedLead) return;
    setLoading('voice-preview');
    setMessage('');
    try {
      const result = (await smartLabsApi.conversation(
        {
          mode: 'preview',
          message: `Prepare a follow-up conversation for ${selectedLeadName}. Source: ${titleCase(text(selectedLead.sourcePlatform, 'manual'))}. Interest score: ${numberValue(selectedLead.qualificationScore)}. Goal: answer course questions and guide the lead to the right next step.`,
          conversationHistory: [],
        },
        token,
      )) as RecordMap;
      setVoicePreview(result);
      setMessage('Voice/chat handoff preview prepared.');
    } catch (error) {
      setMessage(
        `Voice/chat preview failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setLoading('');
    }
  }

  // ---- Skeleton loading ----
  if (pageLoading) {
    return (
      <ProductPage eyebrow="Content Studio" title="Performance" subtitle="Loading your data...">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton-pulse h-28 rounded-xl" />
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)_380px]">
            <div className="skeleton-pulse h-48 rounded-xl" />
            <div className="skeleton-pulse h-48 rounded-xl" />
            <div className="skeleton-pulse h-48 rounded-xl" />
          </div>
        </div>
      </ProductPage>
    );
  }

  return (
    <ProductPage
      eyebrow="Content Studio"
      title="Performance"
      subtitle="Track your content results and customer interest in one place. Data appears as your campaigns run."
      action={
        <ProductStatus tone={hasAnalyticsData ? 'good' : 'info'}>
          {hasAnalyticsData ? 'Data Available' : 'Waiting for Data'}
        </ProductStatus>
      }
    >
      {message && (
        <Notice tone={message.toLowerCase().includes('failed') || message.toLowerCase().includes('could not') ? 'danger' : 'good'}>
          {message}
        </Notice>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Data Sources"
          value={sources.length}
          detail={sources.length ? 'Connected and active' : 'Connect a data source to see results'}
          tone={sources.length ? 'good' : 'info'}
        />
        <MetricCard
          label="Reach"
          value={reach.toLocaleString()}
          detail="People who saw your content"
          tone={reach ? 'good' : 'default'}
        />
        <MetricCard
          label="Impressions"
          value={impressions.toLocaleString()}
          detail="Times your content appeared"
          tone={impressions ? 'info' : 'default'}
        />
        <MetricCard
          label="Reports"
          value={reports.length}
          detail={reports.length ? 'Performance reports available' : 'Reports appear after campaigns run'}
          tone={reports.length ? 'good' : 'default'}
        />
        <MetricCard
          label="Customer Interest"
          value={qualified}
          detail={`${totalLeads} total captured`}
          tone={qualified ? 'good' : totalLeads ? 'info' : 'default'}
        />
      </div>

      <ProductCard
        title="Course Sales Performance"
        subtitle="How social content is converting into course interest. These values come from internal records and connected analytics only."
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <FunnelChart
            stages={growthFunnel.length ? growthFunnel.map(stage => ({
              label: text(stage.label),
              value: numberValue(stage.value),
              tone: numberValue(stage.value) ? 'info' : 'default',
            })) : [
              { label: 'Campaigns', value: numberValue(growthKpis.activeCampaigns), tone: 'info' },
              { label: 'Drafts', value: numberValue(growthKpis.postsPrepared), tone: 'info' },
              { label: 'Leads', value: totalLeads, tone: totalLeads ? 'good' : 'default' },
              { label: 'Qualified', value: qualified, tone: qualified ? 'good' : 'default' },
            ]}
          />
          <ReadableQueue
            items={[
              {
                title: 'Course CTA clicks',
                meta: 'Captured when official analytics snapshots include click metrics.',
                status: String(numberValue(growthKpis.courseCtaClicks)),
                tone: numberValue(growthKpis.courseCtaClicks) ? 'good' : 'default',
              },
              {
                title: 'GoHighLevel handoff',
                meta: 'Qualified leads can be prepared for CRM after the customer account is configured.',
                status: titleCase(text(growthIntegrations.goHighLevel, 'requires_credentials')),
                tone: text(growthIntegrations.goHighLevel) === 'configured' ? 'good' : 'warn',
              },
              {
                title: 'SmartLabs voice/chat',
                meta: 'Hot leads can be prepared for the existing voice/chat agent after tenant credentials and execution approval.',
                status: titleCase(text(growthIntegrations.smartLabsVoice, 'requires_credentials')),
                tone: text(growthIntegrations.smartLabsVoice) === 'configured' ? 'good' : 'warn',
              },
            ]}
          />
        </div>
      </ProductCard>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)_380px]">
        <ScoreRing
          value={Math.min(100, Math.round((qualified / Math.max(1, totalLeads)) * 100))}
          label="Lead Quality"
          detail="Percentage of captured leads marked as qualified."
        />
        <ProductCard title="Content Performance" subtitle="Your actual campaign results.">
          {snapshots.length ? (
            <BarList
              items={[
                {
                  label: 'Reach',
                  value: reach,
                  detail: reach.toLocaleString(),
                  tone: 'good',
                },
                {
                  label: 'Impressions',
                  value: impressions,
                  detail: impressions.toLocaleString(),
                  tone: 'info',
                },
                {
                  label: 'Engagement',
                  value: engagement,
                  detail: engagement.toLocaleString(),
                  tone: 'warn',
                },
              ]}
            />
          ) : (
            <EmptyProductState
              title="Your results will appear here"
              message="Connect your social accounts through the scheduling service to see reach, impressions, and engagement data."
            />
          )}
        </ProductCard>
        <ProductCard title="Customer Journey" subtitle="From captured interest to qualified leads.">
          <FunnelChart
            stages={[
              {
                label: 'Captured',
                value: totalLeads,
                tone: totalLeads ? 'info' : 'default',
              },
              {
                label: 'Qualified',
                value: qualified,
                tone: qualified ? 'good' : 'default',
              },
              {
                label: 'Nurturing',
                value: numberValue(leadStats?.nurturing),
                tone: numberValue(leadStats?.nurturing) ? 'warn' : 'default',
              },
              {
                label: 'CRM Ready',
                value: 0,
                tone: 'default',
              },
            ]}
          />
        </ProductCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <ProductCard
          title="Data Evidence"
          subtitle="Your connected sources, snapshots, and reports."
        >
          {hasAnalyticsData ? (
            <ProductTable
              columns={['Type', 'Record', 'Status', 'Details']}
              rows={[
                ...sources.slice(0, 4).map((source) => [
                  'Source',
                  text(source.name),
                  <ProductStatus
                    tone={text(source.status) === 'active' ? 'good' : 'warn'}
                    key={text(source.name)}
                  >
                    {titleCase(text(source.status))}
                  </ProductStatus>,
                  text(source.sourceType),
                ]),
                ...reports.slice(0, 4).map((report) => [
                  'Report',
                  text(report.summary, 'Performance report'),
                  <ProductStatus tone="info" key={text(report.summary, 'report')}>
                    {titleCase(text(report.reportStatus, 'draft'))}
                  </ProductStatus>,
                  report.campaignId ? 'Linked to campaign' : 'General report',
                ]),
              ]}
            />
          ) : (
            <EmptyProductState
              title="No data yet"
              message="Connect your social accounts through the scheduling service. Your real reach, impressions, and engagement numbers will appear here - never made-up numbers."
            />
          )}
        </ProductCard>

        <ProductCard
          title="Add a Lead"
          subtitle="Record a new customer interest. CRM handoff happens separately when you're ready."
        >
          <div className="space-y-3">
            <Field label="Source">
              <select
                value={leadForm.sourcePlatform}
                onChange={(event) =>
                  setLeadForm((current) => ({
                    ...current,
                    sourcePlatform: event.target.value,
                  }))
                }
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950"
              >
                <option value="linkedin">LinkedIn</option>
                <option value="instagram">Instagram</option>
                <option value="x">X / Twitter</option>
                <option value="manual">Manual entry</option>
              </select>
            </Field>
            <Field label="Name">
              <input
                value={leadForm.leadName}
                onChange={(event) =>
                  setLeadForm((current) => ({ ...current, leadName: event.target.value }))
                }
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950"
                placeholder="Customer name"
              />
            </Field>
            <Field label="Email">
              <input
                value={leadForm.leadEmail}
                onChange={(event) =>
                  setLeadForm((current) => ({ ...current, leadEmail: event.target.value }))
                }
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950"
                placeholder="customer@example.com"
              />
            </Field>
            <Field label="Phone">
              <input
                value={leadForm.leadPhone}
                onChange={(event) =>
                  setLeadForm((current) => ({ ...current, leadPhone: event.target.value }))
                }
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950"
                placeholder="+1 234 567 8900"
              />
            </Field>
            <Field label="Consent">
              <select
                value={leadForm.consentStatus}
                onChange={(event) =>
                  setLeadForm((current) => ({ ...current, consentStatus: event.target.value }))
                }
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950"
              >
                <option value="pending">Pending</option>
                <option value="granted">Granted</option>
                <option value="denied">Denied</option>
              </select>
            </Field>
            <PrimaryAction
              onClick={captureLead}
              disabled={loading === 'capture-lead'}
            >
              {loading === 'capture-lead' ? 'Saving...' : 'Add Lead'}
            </PrimaryAction>
            {message.includes('captured successfully') && (
              <p className="text-sm leading-6 text-neutral-500">
                Lead saved to your workspace. CRM handoff is available after setup in Integrations.
              </p>
            )}
          </div>
        </ProductCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.42fr)_minmax(0,1fr)]">
        <ProductCard
          title="Your Leads"
          subtitle="Captured customer interest, ready for review and handoff."
        >
          {leads.length ? (
            <div className="max-h-[460px] space-y-3 overflow-y-auto pr-2">
              {leads.map((lead, index) => {
                const active = selectedLeadIndex === index;
                const status = titleCase(text(lead.leadStatus, 'new_lead'));
                const source = sourceLabel(lead);
                const contact = customerLeadContact(lead);
                return (
                  <button
                    key={String(lead.id)}
                    type="button"
                    onClick={() => {
                      setSelectedLeadIndex(index);
                      setGhlPreview(null);
                      setVoicePreview(null);
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      active
                        ? 'border-neutral-950 bg-neutral-950 text-white'
                        : 'border-neutral-200 bg-white hover:bg-neutral-50'
                    }`}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="break-words text-base font-semibold leading-6">
                          {customerLeadName(lead, index)}
                        </div>
                        <div
                          className={`mt-1 break-all text-sm leading-5 ${
                            active ? 'text-white/60' : 'text-neutral-500'
                          }`}
                        >
                          {contact}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          active ? 'bg-white/12 text-white' : 'bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        {source}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          active ? 'bg-white/12 text-white' : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {status}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          active ? 'bg-white/12 text-white' : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {leadTemperatureLabel(lead)}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          active ? 'bg-white/12 text-white' : 'bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        Score {numberValue(lead.qualificationScore)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyProductState
              title="No leads yet"
              message="Add a lead above or they'll appear when your campaigns generate interest."
            />
          )}
        </ProductCard>

        <ProductCard
          title="Lead Details & Handoff"
          subtitle="Review a lead and prepare it for your CRM or outreach."
        >
          {selectedLead ? (
            <div className="space-y-5">
              <DetailGrid items={selectedLeadDetails} />
              <div className="flex flex-wrap gap-2">
                <PrimaryAction
                  onClick={qualifyLead}
                  disabled={loading === 'qualify-lead'}
                >
                  {loading === 'qualify-lead' ? 'Qualifying...' : 'Mark as Qualified'}
                </PrimaryAction>
                <SecondaryAction
                  onClick={previewGhlPayload}
                  disabled={loading === 'ghl-preview'}
                >
                  {loading === 'ghl-preview' ? 'Preparing...' : 'Preview CRM Handoff'}
                </SecondaryAction>
                <SecondaryAction
                  onClick={previewVoicePayload}
                  disabled={loading === 'voice-preview'}
                >
                  {loading === 'voice-preview' ? 'Preparing...' : 'Preview Voice/Chat Handoff'}
                </SecondaryAction>
              </div>
              <ReadableQueue
                items={[
                  {
                    title: 'CRM handoff',
                    meta: ghlPreview
                      ? 'Backend prepared the GoHighLevel payload for this selected lead.'
                      : 'Preview available. Requires sandbox credentials and admin authorization to execute.',
                    status: ghlPreview ? 'Prepared' : 'Setup Required',
                    tone: ghlPreview ? 'good' : 'info',
                  },
                  {
                    title: 'Voice/chat follow-up',
                    meta: voicePreview
                      ? 'Backend prepared the SmartLabs conversation package for this selected lead.'
                      : 'Available after consent is granted and admin sets up the SmartLabs connector.',
                    status: voicePreview ? 'Prepared' : 'Setup Required',
                    tone: voicePreview ? 'good' : 'info',
                  },
                ]}
              />
              {ghlPreview && (
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                  <div className="font-semibold text-neutral-950">CRM Handoff Preview</div>
                  <div className="mt-1 text-sm text-neutral-500">
                    Prepared by the backend. No data has been sent to an external CRM.
                  </div>
                  <div className="mt-4">
                    <DetailGrid
                      items={[
                        { label: 'Status', value: text(ghlPreview.status) },
                        {
                          label: 'Connection',
                          value: text(ghlPreview.credentialSource, 'Not configured'),
                        },
                        {
                          label: 'Route',
                          value: ghlPreview.endpoint
                            ? 'Ready'
                            : 'Needs configuration',
                        },
                        {
                          label: 'External Send',
                          value: text(
                            (ghlPreview.safety as RecordMap | undefined)?.executionPerformed,
                            'No - preview only',
                          ),
                        },
                      ]}
                    />
                  </div>
                </div>
              )}
              {voicePreview && (
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                  <div className="font-semibold text-neutral-950">Voice/Chat Handoff Preview</div>
                  <div className="mt-1 text-sm text-neutral-500">
                    Prepared by the backend for SmartLabs. No call, chat, or message was triggered.
                  </div>
                  <div className="mt-4">
                    <DetailGrid
                      items={[
                        { label: 'Status', value: titleCase(text(voicePreview.status)) },
                        {
                          label: 'Agent Setup',
                          value: Array.isArray(voicePreview.reasons) && voicePreview.reasons.length
                            ? 'Requires configuration'
                            : 'Ready for configured tenant agent',
                        },
                        {
                          label: 'External Action',
                          value: text(
                            (voicePreview.safety as RecordMap | undefined)?.externalCallPerformed,
                            'No - preview only',
                          ),
                        },
                        {
                          label: 'Secrets',
                          value: text(
                            (voicePreview.safety as RecordMap | undefined)?.rawSecretsReturned,
                            'Not returned',
                          ),
                        },
                      ]}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyProductState message="Select or add a lead to view details and prepare handoff." />
          )}
        </ProductCard>
      </div>
    </ProductPage>
  );
}
