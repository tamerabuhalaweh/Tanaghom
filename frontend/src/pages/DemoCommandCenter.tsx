import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  aiGenerationApi,
  aiProviderApi,
  algoApi,
  analyticsApi,
  approvalsApi,
  campaignsApi,
  integrationStatusApi,
  leadsApi,
  postizApi,
  publishingPackageApi,
} from '../api';
import { useAuth } from '../contexts/useAuth';
import {
  DetailGrid,
  EmptyProductState,
  BarList,
  ExecutiveGauge,
  ExecutiveKpiCard,
  ExecutiveStatusGrid,
  FunnelChart,
  Notice,
  PlatformPill,
  ProgressBar,
  PrimaryAction,
  ProductCard,
  ProductPage,
  ProductStatus,
  ReadableQueue,
  ScoreRing,
  SecondaryAction,
  WorkflowRail,
} from '../components/ProductUI';

type RecordMap = Record<string, unknown>;
type Step = 'brief' | 'drafts' | 'score' | 'approval' | 'publishing' | 'handoff';

const PLATFORMS = ['linkedin', 'instagram', 'x'];

function text(value: unknown, fallback = 'Not specified'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function list(value: unknown): RecordMap[] {
  if (Array.isArray(value)) return value as RecordMap[];
  if (value && typeof value === 'object') {
    const wrapped = value as Record<string, unknown>;
    if (Array.isArray(wrapped.value)) return wrapped.value as RecordMap[];
    if (Array.isArray(wrapped.items)) return wrapped.items as RecordMap[];
    if (Array.isArray(wrapped.data)) return wrapped.data as RecordMap[];
    if (Array.isArray(wrapped.rows)) return wrapped.rows as RecordMap[];
    if (Array.isArray(wrapped.statuses)) return wrapped.statuses as RecordMap[];
  }
  return [];
}

function titleCase(value: string): string {
  if (value === 'x') return 'X / Twitter';
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function scoreComponent(score: RecordMap | null, component: string): RecordMap | undefined {
  return list(score?.components).find(item => item.component === component);
}

function stateFor(done: boolean, active: boolean): 'done' | 'active' | 'waiting' {
  if (active) return 'active';
  if (done) return 'done';
  return 'waiting';
}

function buildAnalyticsSummary(sources: RecordMap[], snapshots: RecordMap[], reports: RecordMap[]): RecordMap {
  const totals = snapshots.reduce<{ reach: number; impressions: number; engagement: number }>((acc, snapshot) => {
    const metrics = ((snapshot.normalizedMetrics || snapshot.metrics || {}) as RecordMap);
    return {
      reach: acc.reach + numberValue(metrics.reach),
      impressions: acc.impressions + numberValue(metrics.impressions),
      engagement: acc.engagement + numberValue(metrics.engagement),
    };
  }, { reach: 0, impressions: 0, engagement: 0 });

  return {
    ...totals,
    sourceCount: sources.length,
    reportCount: reports.length,
    sourceLabel: sources.length ? `${sources.length} analytics source${sources.length === 1 ? '' : 's'} configured` : '',
    reportLabel: text(reports[0]?.summary, ''),
  };
}

export default function DemoCommandCenter() {
  const { token } = useAuth();
  const [campaigns, setCampaigns] = useState<RecordMap[]>([]);
  const [selected, setSelected] = useState<RecordMap | null>(null);
  const [drafts, setDrafts] = useState<RecordMap[]>([]);
  const [draftTextById, setDraftTextById] = useState<Record<string, string>>({});
  const [selectedDraftId, setSelectedDraftId] = useState('');
  const [score, setScore] = useState<RecordMap | null>(null);
  const [approval, setApproval] = useState<RecordMap | null>(null);
  const [packageResult, setPackageResult] = useState<RecordMap | null>(null);
  const [analytics, setAnalytics] = useState<RecordMap | null>(null);
  const [leadRecords, setLeadRecords] = useState<RecordMap[]>([]);
  const [leadStats, setLeadStats] = useState<RecordMap | null>(null);
  const [postizStatus, setPostizStatus] = useState<RecordMap | null>(null);
  const [postizChannels, setPostizChannels] = useState<RecordMap[]>([]);
  const [packages, setPackages] = useState<RecordMap[]>([]);
  const [approvals, setApprovals] = useState<RecordMap[]>([]);
  const [integrationStatus, setIntegrationStatus] = useState<RecordMap | null>(null);
  const [loading, setLoading] = useState('');
  const [notice, setNotice] = useState('');
  const [step, setStep] = useState<Step>('brief');
  const [providerReady, setProviderReady] = useState(false);
  const [providerLabel, setProviderLabel] = useState('Requires LLM provider');

  const selectedDraft = useMemo(
    () => drafts.find(draft => String(draft.contentItemId) === selectedDraftId) || drafts[0] || null,
    [drafts, selectedDraftId],
  );

  const totalScore = numberValue(score?.totalScore);
  const components = {
    hook: scoreComponent(score, 'hookStrength'),
    cta: scoreComponent(score, 'ctaClarity'),
    hashtag: scoreComponent(score, 'hashtagHygiene'),
    risk: scoreComponent(score, 'complianceRisk'),
  };

  const postiz = ((packageResult?.postizSandbox || postizStatus?.health || postizStatus || {}) as RecordMap);
  const postizHealth = ((postizStatus?.health || {}) as RecordMap);
  const platformPayloads = list(packageResult?.platforms);
  const leads = leadRecords;
  const pendingApprovals = approvals.filter(item => text(item.approvalStatus || item.status, '').toLowerCase() === 'pending').length;
  const approvedApprovals = approvals.filter(item => text(item.approvalStatus || item.status, '').toLowerCase() === 'approved').length;
  const postizCredentialStatus = text((postizStatus?.health as RecordMap | undefined)?.credentialStatus, text(postiz.credentialStatus, 'missing'));
  const postizIntegrationIdStatus = text(postizHealth.integrationIdStatus, text(postiz.integrationIdStatus, 'missing'));
  const postizApiConfigured = postizCredentialStatus === 'configured';
  const connectedChannelCount = postizChannels.length;
  const publishingPackageCount = packages.length + (packageResult ? 1 : 0);
  const workflowSignals = [
    selected ? 1 : 0,
    providerReady ? 1 : 0,
    drafts.length ? 1 : 0,
    score ? 1 : 0,
    approval ? 1 : 0,
    approval?.approvalStatus === 'approved' ? 1 : 0,
    packageResult || packages.length ? 1 : 0,
    leads.length ? 1 : 0,
  ];
  const workflowReadiness = Math.round((workflowSignals.reduce((sum, value) => sum + value, 0) / workflowSignals.length) * 100);
  const executionSafety = (integrationStatus?.safety || {}) as RecordMap;
  const externalWritesEnabled = Boolean(executionSafety.externalExecutionEnabled);
  const m5Enabled = Boolean(executionSafety.m5WriteExecutionEnabled);
  const activeCampaigns = campaigns.filter(campaign => text(campaign.status, 'idea').toLowerCase() !== 'archived');
  const campaignQueue = activeCampaigns.filter((campaign, index, allCampaigns) => {
    const key = [
      text(campaign.topic, ''),
      text(campaign.objective, ''),
      text(campaign.audience, ''),
    ].join('|').toLowerCase();
    return allCampaigns.findIndex(item => [
      text(item.topic, ''),
      text(item.objective, ''),
      text(item.audience, ''),
    ].join('|').toLowerCase() === key) === index;
  });
  const visibleCampaigns = campaignQueue.slice(0, 8);
  const setupTasks = [
    {
      title: 'Connect AI model',
      meta: providerReady ? providerLabel : 'Add OpenAI or Claude so drafts are generated by a real provider.',
      status: providerReady ? 'Ready' : 'Needs setup',
      tone: providerReady ? 'good' as const : 'warn' as const,
      to: '/ai-settings',
    },
    {
      title: 'Connect publishing workspace',
      meta: postiz.reachable ? 'Postiz server is reachable from Tanaghum.' : 'Postiz server URL needs attention.',
      status: postiz.reachable ? 'Server online' : 'Needs setup',
      tone: postiz.reachable ? 'good' as const : 'warn' as const,
      to: '/integration-credentials',
    },
    {
      title: 'Connect social channel',
      meta: connectedChannelCount ? `${connectedChannelCount} Postiz channel(s) connected.` : 'Use Postiz OAuth to connect Instagram, LinkedIn, X, or another channel.',
      status: connectedChannelCount ? 'Connected' : 'Needs channel',
      tone: connectedChannelCount ? 'good' as const : 'warn' as const,
      to: '/integration-credentials',
    },
    {
      title: 'Keep production safe',
      meta: externalWritesEnabled && m5Enabled ? 'Write gates are armed. Use only with approved sandbox credentials.' : 'Scheduling, CRM writes, messages, and calls remain locked.',
      status: externalWritesEnabled && m5Enabled ? 'Armed' : 'Locked',
      tone: externalWritesEnabled && m5Enabled ? 'warn' as const : 'good' as const,
      to: '/safety',
    },
  ];

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function run() {
      try {
        const [
          campaignData,
          sourceData,
          snapshotData,
          reportData,
          leadData,
          leadStatData,
          postizData,
          packageData,
          approvalData,
          integrationData,
          postizChannelData,
        ] = await Promise.all([
          campaignsApi.list(token as string),
          analyticsApi.sources(token as string),
          analyticsApi.snapshots(token as string),
          analyticsApi.reports(token as string),
          leadsApi.list(token as string),
          leadsApi.stats(token as string),
          postizApi.status(token as string),
          publishingPackageApi.list(token as string).catch(() => []),
          approvalsApi.list(token as string).catch(() => []),
          integrationStatusApi.get(token as string).catch(() => null),
          postizApi.channels(token as string).catch(() => ({ channels: [] })),
        ]);
        if (cancelled) return;
        const campaignList = list(campaignData);
        setCampaigns(campaignList);
        setSelected(current => current || campaignList[0] || null);
        setLeadRecords(list(leadData));
        setLeadStats(leadStatData as RecordMap);
        setPostizStatus(postizData as RecordMap);
        setPackages(list(packageData));
        setApprovals(list(approvalData));
        setIntegrationStatus(integrationData as RecordMap | null);
        setPostizChannels(list((postizChannelData as RecordMap).channels));
        setAnalytics(buildAnalyticsSummary(list(sourceData), list(snapshotData), list(reportData)));
        try {
          const active = await aiProviderApi.active(token as string) as RecordMap;
          setProviderReady(active.apiKeyStatus === 'configured');
          setProviderLabel(`${text(active.name, 'LLM provider')} / ${text(active.model, 'model configured')}`);
        } catch (providerError) {
          setProviderReady(false);
          setProviderLabel(providerError instanceof Error ? providerError.message : 'Configure OpenAI or Claude before draft generation');
        }
      } catch (error) {
        if (!cancelled) setNotice(`Workspace load failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function refreshStatus() {
    if (!token) return;
    try {
      const [leadData, leadStatData, postizData, packageData, approvalData, integrationData, postizChannelData] = await Promise.all([
        leadsApi.list(token),
        leadsApi.stats(token),
        postizApi.status(token),
        publishingPackageApi.list(token).catch(() => []),
        approvalsApi.list(token).catch(() => []),
        integrationStatusApi.get(token).catch(() => null),
        postizApi.channels(token).catch(() => ({ channels: [] })),
      ]);
      setLeadRecords(list(leadData));
      setLeadStats(leadStatData as RecordMap);
      setPostizStatus(postizData as RecordMap);
      setPackages(list(packageData));
      setApprovals(list(approvalData));
      setIntegrationStatus(integrationData as RecordMap | null);
      setPostizChannels(list((postizChannelData as RecordMap).channels));
    } catch {
      setLeadRecords([]);
      setLeadStats(null);
    }
  }

  function chooseCampaign(campaign: RecordMap) {
    setSelected(campaign);
    setDrafts([]);
    setDraftTextById({});
    setSelectedDraftId('');
    setScore(null);
    setApproval(null);
    setPackageResult(null);
    setNotice('Campaign selected. Prepare platform drafts when ready.');
    setStep('drafts');
  }

  async function generateDrafts() {
    if (!token || !selected || !providerReady) return;
    setLoading('drafts');
    setNotice('');
    try {
      const result = await aiGenerationApi.generate({
        campaignRequestId: selected.id,
        platforms: PLATFORMS,
        tone: 'professional',
      }, token);
      const generated = Array.isArray(result) ? (result as RecordMap[]) : [result as RecordMap];
      setDrafts(generated);
      setDraftTextById(Object.fromEntries(generated.map(draft => [String(draft.contentItemId), text(draft.draftText, '')])));
      setSelectedDraftId(String(generated[0]?.contentItemId || ''));
      setScore(null);
      setApproval(null);
      setPackageResult(null);
      setStep('score');
      setNotice('Platform drafts are ready for review.');
      void refreshStatus();
    } catch (error) {
      setNotice(`Draft generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function scoreDraft() {
    if (!token || !selectedDraft) return;
    setLoading('score');
    setNotice('');
    try {
      const activeDraftText = draftTextById[String(selectedDraft.contentItemId)] || text(selectedDraft.draftText);
      const metadata = (selectedDraft.metadata || {}) as RecordMap;
      const result = await algoApi.score({
        contentItemId: selectedDraft.contentItemId,
        platform: selectedDraft.platform,
        draftText: activeDraftText,
        objective: selected?.objective,
        audience: selected?.audience,
        cta: metadata.cta || selected?.cta,
        hashtags: metadata.hashtags || [],
        contentType: selectedDraft.contentType,
        riskCategory: selected?.riskCategory,
      }, token);
      setScore(result as RecordMap);
      setStep('approval');
      setNotice('Readiness score and recommendations are ready.');
      void refreshStatus();
    } catch (error) {
      setNotice(`Scoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function submitApproval() {
    if (!token || !selectedDraft) return;
    setLoading('approval');
    setNotice('');
    try {
      const result = await approvalsApi.submit({
        targetId: selectedDraft.contentItemId,
        targetType: 'content_item',
        riskCategory: selected?.riskCategory || 'medium',
        approvalType: 'brand_review',
        requiredDepartment: 'Commercial',
        requiredRole: 'reviewer',
        comment: 'Human approval required before publishing preparation.',
      }, token);
      setApproval(result as RecordMap);
      setNotice('Approval package sent to the review queue.');
      void refreshStatus();
    } catch (error) {
      setNotice(`Approval submission failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function decideApproval(action: 'approve' | 'reject' | 'requestChanges') {
    if (!token || !approval) return;
    setLoading(action);
    setNotice('');
    try {
      const approvalId = String(approval.id);
      const comment = action === 'approve'
        ? 'Approved for publishing package preparation.'
        : action === 'reject'
          ? 'Rejected by reviewer.'
          : 'Please revise before publishing preparation.';
      const result = action === 'approve'
        ? await approvalsApi.approve(approvalId, { comment }, token)
        : action === 'reject'
          ? await approvalsApi.reject(approvalId, { comment }, token)
          : await approvalsApi.requestChanges(approvalId, { comment }, token);
      setApproval(result as RecordMap);
      setStep(action === 'approve' ? 'publishing' : 'approval');
      setNotice(action === 'approve' ? 'Approved. Publishing preparation is now available.' : 'Review decision recorded.');
      void refreshStatus();
    } catch (error) {
      setNotice(`Approval decision failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function createPackage() {
    if (!token || !selected) return;
    setLoading('package');
    setNotice('');
    try {
      const result = await publishingPackageApi.create({
        campaignId: selected.id,
        draftId: selectedDraft?.contentItemId,
        approvalId: approval?.id,
        platforms: PLATFORMS,
        scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, token);
      const pkg = result as RecordMap;
      setPackageResult(pkg);
      setStep('handoff');
      setNotice('Publishing package is ready. Lead handoff appears only after real lead records exist.');
      void refreshStatus();
    } catch (error) {
      setNotice(`Publishing preparation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  const nextAction = !selected
    ? 'Select a campaign'
    : !providerReady
      ? 'Configure AI provider'
    : !drafts.length
      ? 'Generate platform drafts'
      : !score
        ? 'Score the selected draft'
        : !approval
          ? 'Send for approval'
          : approval.approvalStatus !== 'approved'
            ? 'Record approval decision'
            : !packageResult
              ? 'Prepare publishing package'
              : 'Review analytics and leads';

  return (
    <ProductPage
      eyebrow="Commercial/Social"
      title="Commercial Command Center"
      subtitle="Operate the full Commercial/Social workflow from campaign brief to AI drafts, human approval, publishing package, performance intelligence, and lead handoff."
      action={<ProductStatus tone="good">Product Workspace</ProductStatus>}
    >
      <section className="rounded-2xl bg-[#0f0c1f] p-4 shadow-[0_24px_70px_rgba(15,15,22,0.30)] sm:p-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-cyan-200/70">CEO snapshot</div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">Marketing growth dashboard</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/58">
              One view of campaign progress, content approval, publishing readiness, and lead impact. Empty values mean no real record has been created yet.
            </p>
          </div>
          <ProductStatus tone={externalWritesEnabled && m5Enabled ? 'warn' : 'good'}>
            {externalWritesEnabled && m5Enabled ? 'Sandbox Writes Armed' : 'Production Writes Locked'}
          </ProductStatus>
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            <ExecutiveKpiCard
              label="Active campaigns"
              value={campaignQueue.length}
              detail={selected ? `Now focused on: ${text(selected.topic)}` : 'Create or select a campaign'}
              tone={campaignQueue.length ? 'info' : 'warn'}
              series={[campaignQueue.length, drafts.length, pendingApprovals, publishingPackageCount, leads.length]}
              secondary="growth work in motion"
            />
            <ExecutiveKpiCard
              label="Pending approvals"
              value={pendingApprovals}
              detail={`${approvedApprovals} approved decisions recorded`}
              tone={pendingApprovals ? 'warn' : 'good'}
              series={[approvals.length, pendingApprovals, approvedApprovals]}
              secondary="human review queue"
            />
            <ExecutiveKpiCard
              label="Posts ready"
              value={publishingPackageCount}
              detail={connectedChannelCount ? `${connectedChannelCount} Postiz channel(s) connected` : 'Connect a Postiz channel before scheduling'}
              tone={publishingPackageCount && connectedChannelCount ? 'good' : 'warn'}
              series={[drafts.length, approvedApprovals, publishingPackageCount, connectedChannelCount]}
              secondary="approval to schedule"
            />
            <ExecutiveKpiCard
              label="Qualified leads"
              value={numberValue(leadStats?.qualified)}
              detail={`${numberValue(leadStats?.total)} captured lead records`}
              tone={numberValue(leadStats?.qualified) ? 'good' : 'info'}
              series={[publishingPackageCount, leads.length, numberValue(leadStats?.qualified)]}
              secondary="commercial outcome"
            />
          </div>
          <ExecutiveGauge
            value={workflowReadiness}
            label="Launch readiness"
            detail={setupTasks.filter(task => task.status !== 'Ready' && task.status !== 'Server online' && task.status !== 'Connected' && task.status !== 'Locked').length
              ? 'Finish the setup checklist before this workspace is ready for a customer-facing launch.'
              : 'Core campaign workflow and safety controls are ready for the current configured scope.'}
          />
        </div>
        <div className="mt-4">
          <ExecutiveStatusGrid items={[
            {
              label: 'AI model',
              value: providerReady ? providerLabel : 'Connect OpenAI or Claude',
              tone: providerReady ? 'good' : 'warn',
              detail: 'Each user can bring their own provider key. Raw keys are never shown again.',
            },
            {
              label: 'Publishing workspace',
              value: postiz.reachable ? 'Postiz server online' : 'Postiz server needs attention',
              tone: postiz.reachable ? 'good' : 'warn',
              detail: postizApiConfigured ? 'API key saved. Connect or select a social channel next.' : 'Save Postiz API key and base URL in Credentials.',
            },
            {
              label: 'Connected channels',
              value: connectedChannelCount ? `${connectedChannelCount} channel(s) ready` : 'No channel connected',
              tone: connectedChannelCount ? 'good' : 'warn',
              detail: 'Social account login happens through Postiz OAuth, launched from Tanaghum.',
            },
          ]} />
        </div>
      </section>

      <ProductCard
        title="Setup Checklist"
        subtitle="Clear actions needed before the workspace can move from preparation to safe sandbox scheduling."
        action={<ProductStatus tone={setupTasks.some(task => task.tone === 'warn') ? 'warn' : 'good'}>{setupTasks.filter(task => task.tone === 'warn').length} open</ProductStatus>}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {setupTasks.map(task => (
            <Link key={task.title} to={task.to} className="rounded-lg border border-neutral-200 bg-white p-4 transition hover:border-neutral-950 hover:shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold text-neutral-950">{task.title}</div>
                <ProductStatus tone={task.tone}>{task.status}</ProductStatus>
              </div>
              <p className="mt-3 text-sm leading-6 text-neutral-500">{task.meta}</p>
            </Link>
          ))}
        </div>
      </ProductCard>

      <ProductCard title="Today's Next Action" subtitle="The most important action to move the active campaign forward.">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-lg bg-neutral-950 p-6 text-white">
            <div className="text-sm text-white/55">Recommended action</div>
            <div className="mt-3 text-3xl font-semibold tracking-tight">{nextAction}</div>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/65">
              {selected
                ? `Move "${text(selected.topic)}" through draft, score, approval, package, analytics, and lead handoff.`
                : 'Create or select a campaign before draft generation, approval, publishing preparation, analytics, or lead handoff can produce useful output.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {!selected && <Link to="/ideas" className="inline-flex min-h-10 items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950">Create Campaign</Link>}
              {selected && !providerReady && <Link to="/ai-settings" className="inline-flex min-h-10 items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950">Connect AI Model</Link>}
              {selected && providerReady && !drafts.length && <PrimaryAction onClick={generateDrafts} disabled={loading === 'drafts'}>{loading === 'drafts' ? 'Generating...' : 'Generate Drafts'}</PrimaryAction>}
              {drafts.length > 0 && !score && <PrimaryAction onClick={scoreDraft} disabled={loading === 'score'}>{loading === 'score' ? 'Scoring...' : 'Score Draft'}</PrimaryAction>}
              {score && !approval && <PrimaryAction onClick={submitApproval} disabled={loading === 'approval'}>{loading === 'approval' ? 'Submitting...' : 'Send For Approval'}</PrimaryAction>}
              {approval?.approvalStatus === 'approved' && !packageResult && <PrimaryAction onClick={createPackage} disabled={loading === 'package'}>{loading === 'package' ? 'Preparing...' : 'Prepare Package'}</PrimaryAction>}
            </div>
          </div>
          <ReadableQueue items={[
            { title: 'Campaign brief', meta: selected ? 'Brief selected and ready for creative work.' : 'Choose the offer, audience, channel, and CTA.', status: selected ? 'Ready' : 'Required', tone: selected ? 'good' : 'warn' },
            { title: 'AI drafting', meta: drafts.length ? `${drafts.length} platform draft(s) generated.` : providerReady ? 'Model is ready to generate drafts.' : 'Connect a model before generation.', status: drafts.length ? 'Drafted' : providerReady ? 'Ready' : 'Needs model', tone: drafts.length ? 'good' : providerReady ? 'info' : 'warn' },
            { title: 'Approval', meta: approval ? `Decision status: ${titleCase(text(approval.approvalStatus, 'pending'))}.` : 'No draft has been submitted for review yet.', status: approval ? 'Recorded' : 'Waiting', tone: approval ? 'good' : 'default' },
            { title: 'Publishing', meta: packageResult ? 'Postiz-ready package prepared.' : 'Package becomes available after approval.', status: packageResult ? 'Ready' : 'Waiting', tone: packageResult ? 'good' : 'default' },
          ]} />
        </div>
      </ProductCard>

      <ProductCard title="Campaign Journey" subtitle="One campaign moves through this path. Detailed work happens below or in the dedicated pages.">
        <WorkflowRail steps={[
          { label: 'Brief', state: stateFor(!!selected, step === 'brief') },
          { label: 'Draft', state: stateFor(!!drafts.length, step === 'drafts') },
          { label: 'Score', state: stateFor(!!score, step === 'score') },
          { label: 'Approve', state: stateFor(!!approval, step === 'approval') },
          { label: 'Package', state: stateFor(!!packageResult, step === 'publishing') },
          { label: 'Schedule', state: stateFor(!!packageResult && connectedChannelCount > 0, false) },
          { label: 'Leads', state: stateFor(leads.length > 0, step === 'handoff') },
          { label: 'Learn', state: stateFor(numberValue(analytics?.reportCount) > 0, false) },
        ]} />
      </ProductCard>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)_380px]">
        <ScoreRing
          value={score ? totalScore : workflowReadiness}
          label={score ? 'Selected draft score' : 'Launch readiness'}
          detail={score ? 'Calculated from the actual selected generated draft.' : 'Based on campaign, model, draft, approval, package, and lead readiness.'}
        />
        <ProductCard title="Business Signals" subtitle="Only real connected sources and internal records are shown.">
          <BarList items={[
            { label: 'Reach', value: numberValue(analytics?.reach), detail: numberValue(analytics?.reach).toLocaleString(), tone: 'good' },
            { label: 'Impressions', value: numberValue(analytics?.impressions), detail: numberValue(analytics?.impressions).toLocaleString(), tone: 'info' },
            { label: 'Qualified leads', value: numberValue(leadStats?.qualified), detail: `${numberValue(leadStats?.qualified)} qualified`, tone: numberValue(leadStats?.qualified) ? 'good' : 'default' },
          ]} />
        </ProductCard>
        <ProductCard title="Commercial Funnel" subtitle="From campaign work to publishing package and captured leads.">
          <FunnelChart stages={[
            { label: 'Campaigns', value: campaignQueue.length, tone: campaignQueue.length ? 'info' : 'default' },
            { label: 'Drafts', value: drafts.length || 0, tone: drafts.length ? 'good' : 'default' },
            { label: 'Approvals', value: approval ? 1 : 0, tone: approval ? 'good' : 'default' },
            { label: 'Packages', value: publishingPackageCount, tone: publishingPackageCount ? 'good' : 'default' },
            { label: 'Leads', value: leads.length || 0, tone: leads.length ? 'good' : 'default' },
          ]} />
        </ProductCard>
      </div>

      {notice && (
        <Notice tone={notice.includes('failed') ? 'danger' : 'good'}>{notice}</Notice>
      )}

      {!providerReady && (
        <Notice tone="warn">
          AI draft generation needs a real model key for this user.{' '}
          <Link to="/ai-settings" className="font-semibold underline">Connect OpenAI or Claude</Link>
        </Notice>
      )}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <ProductCard title="Active Campaigns" subtitle="Unique campaign briefs for today's operating view. Open Campaigns for the full record list.">
          <div className="mb-4">
            <Link to="/ideas" className="inline-flex min-h-10 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white">
              Create Campaign
            </Link>
          </div>
          <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
            {visibleCampaigns.map(campaign => (
              <button
                key={String(campaign.id)}
                type="button"
                onClick={() => chooseCampaign(campaign)}
                className={`w-full rounded-lg border p-4 text-left transition ${
                  selected?.id === campaign.id ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white hover:bg-neutral-50'
                }`}
              >
                <div className="line-clamp-2 font-semibold">{text(campaign.topic)}</div>
                <div className={`mt-2 text-sm ${selected?.id === campaign.id ? 'text-white/60' : 'text-neutral-500'}`}>
                  {titleCase(text(campaign.status, 'idea'))} / {titleCase(text(campaign.riskCategory, 'medium'))} risk
                </div>
              </button>
            ))}
            {!visibleCampaigns.length && <EmptyProductState message="No campaign briefs exist yet. Create the first campaign from AI Draft Studio." />}
          </div>
        </ProductCard>

        <div className="space-y-6">
          <ProductCard
            title="Campaign Brief"
            subtitle="The business inputs the AI and approval workflow use."
            action={<ProductStatus tone={selected ? 'good' : 'warn'}>{selected ? 'Active' : 'Required'}</ProductStatus>}
          >
            {selected ? (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Campaign objective</div>
                  <p className="mt-3 text-lg font-semibold leading-7 text-neutral-950">{text(selected.objective)}</p>
                  <p className="mt-4 text-sm leading-6 text-neutral-600">{text(selected.topic)}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-neutral-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Audience</div>
                    <p className="mt-2 text-sm leading-6 text-neutral-800">{text(selected.audience)}</p>
                  </div>
                  <div className="rounded-xl border border-neutral-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Call to action</div>
                    <p className="mt-2 text-sm leading-6 text-neutral-800">{text(selected.cta, 'Prepared during drafting')}</p>
                  </div>
                  <div className="rounded-xl border border-neutral-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Channels</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(((selected.targetPlatforms as string[] | undefined) || PLATFORMS)).map(platform => (
                        <PlatformPill key={platform}>{titleCase(platform)}</PlatformPill>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-neutral-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Review level</div>
                    <div className="mt-3">
                      <ProductStatus tone={text(selected.riskCategory, 'medium').toLowerCase() === 'high' ? 'warn' : 'info'}>
                        {titleCase(text(selected.riskCategory, 'medium'))} risk
                      </ProductStatus>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyProductState
                message="Select an existing campaign or create a new campaign idea from AI Draft Studio."
                action={<Link to="/ideas" className="inline-flex min-h-10 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white">Create Campaign Idea</Link>}
              />
            )}
          </ProductCard>

          <ProductCard
            title="AI Draft Studio"
            subtitle="Turn the selected campaign brief into editable LinkedIn, Instagram, and X/Twitter drafts."
            action={!selected ? (
              <Link to="/ideas" className="inline-flex min-h-10 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white">Create Campaign</Link>
            ) : !providerReady ? (
              <Link to="/ai-settings" className="inline-flex min-h-10 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white">Connect AI Model</Link>
            ) : (
              <PrimaryAction onClick={generateDrafts} disabled={loading === 'drafts'}>{loading === 'drafts' ? 'Generating...' : drafts.length ? 'Regenerate Drafts' : 'Generate Platform Drafts'}</PrimaryAction>
            )}
          >
            {drafts.length ? (
              <div className="grid gap-4 lg:grid-cols-3">
                {drafts.map(draft => {
                  const draftId = String(draft.contentItemId);
                  const selectedCard = selectedDraft?.contentItemId === draft.contentItemId;
                  return (
                    <article key={draftId} className={`rounded-lg border p-4 ${selectedCard ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white'}`}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold">{titleCase(text(draft.platform))}</div>
                        <button
                          type="button"
                          onClick={() => setSelectedDraftId(draftId)}
                          className="focus:outline-none"
                        >
                          <PlatformPill active={selectedCard}>{selectedCard ? 'Selected' : 'Select'}</PlatformPill>
                        </button>
                      </div>
                      <textarea
                        value={draftTextById[draftId] || text(draft.draftText)}
                        onChange={event => setDraftTextById(current => ({ ...current, [draftId]: event.target.value }))}
                        className={`min-h-[164px] w-full resize-y rounded-md border p-3 text-sm leading-6 outline-none ${
                          selectedCard ? 'border-white/15 bg-white/10 text-white placeholder:text-white/30' : 'border-neutral-200 bg-neutral-50 text-neutral-950'
                        }`}
                      />
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm">AI</div>
                <h3 className="mt-4 text-lg font-semibold text-neutral-950">
                  {selected ? 'Ready to create platform drafts' : 'Choose a campaign first'}
                </h3>
                <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                  {selected
                    ? providerReady
                      ? 'Generate three real drafts from this campaign brief, then edit the copy and select the version to score and send for approval.'
                      : 'Connect OpenAI or Claude for this user before generating real AI copy.'
                    : 'Create or select a campaign so the model has an offer, audience, channel, and call to action.'}
                </p>
                <div className="mt-5 flex justify-center">
                  {!selected ? (
                    <Link to="/ideas" className="inline-flex min-h-10 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white">Create Campaign</Link>
                  ) : !providerReady ? (
                    <Link to="/ai-settings" className="inline-flex min-h-10 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white">Connect AI Model</Link>
                  ) : (
                    <PrimaryAction onClick={generateDrafts} disabled={loading === 'drafts'}>{loading === 'drafts' ? 'Generating...' : 'Generate Drafts'}</PrimaryAction>
                  )}
                </div>
              </div>
            )}
          </ProductCard>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <ProductCard
              title="Readiness & Optimization"
              subtitle="Score the selected draft and review practical recommendations."
              action={<PrimaryAction onClick={scoreDraft} disabled={!selectedDraft || loading === 'score'}>{loading === 'score' ? 'Scoring...' : 'Score Selected Draft'}</PrimaryAction>}
            >
              {score ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-neutral-200 bg-neutral-950 p-5 text-white">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <div className="text-sm text-white/60">Readiness score</div>
                        <div className="mt-2 text-5xl font-semibold">{totalScore}</div>
                      </div>
                      <div className="text-right">
                        <ProductStatus tone="muted">{text(score.bandLabel, 'Ready for review')}</ProductStatus>
                        <div className="mt-2 text-xs text-white/50">{titleCase(text(selectedDraft?.platform, 'linkedin'))}</div>
                      </div>
                    </div>
                    <div className="mt-5">
                      <ProgressBar value={totalScore} />
                    </div>
                  </div>
                  <DetailGrid items={[
                    { label: 'Best Platform', value: titleCase(text(selectedDraft?.platform, 'linkedin')) },
                    { label: 'Analytics Data', value: numberValue(analytics?.sourceCount) ? 'Connected source available' : 'No source connected' },
                    { label: 'Hook Quality', value: text(components.hook?.explanation, 'Hook checked') },
                    { label: 'CTA Strength', value: text(components.cta?.explanation, 'CTA checked') },
                    { label: 'Hashtag Hygiene', value: text(components.hashtag?.explanation, 'Hashtags checked') },
                    { label: 'Risk Notes', value: text(components.risk?.explanation, 'No major issues detected') },
                  ]} />
                </div>
              ) : (
              <EmptyProductState message="Score the selected draft to unlock recommendations." />
            )}
          </ProductCard>

            <ProductCard
              title="Approval & Publishing"
              subtitle="Human approval unlocks the publishing package."
              action={!approval ? (
                <PrimaryAction onClick={submitApproval} disabled={!selectedDraft || loading === 'approval'}>{loading === 'approval' ? 'Submitting...' : 'Send for Approval'}</PrimaryAction>
              ) : null}
            >
              <div className="space-y-4">
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Reviewer packet</div>
                      <h3 className="mt-2 text-lg font-semibold text-neutral-950">
                        {selectedDraft ? `${titleCase(text(selectedDraft.platform, 'platform'))} draft` : 'No draft selected yet'}
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ProductStatus tone={score ? 'good' : 'default'}>{score ? `${totalScore}/100 score` : 'Not scored'}</ProductStatus>
                      <ProductStatus tone={text(selected?.riskCategory, 'medium').toLowerCase() === 'high' ? 'warn' : 'info'}>
                        {titleCase(text(selected?.riskCategory, 'medium'))} risk
                      </ProductStatus>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-5 text-sm leading-6 text-neutral-700">
                    {selectedDraft
                      ? draftTextById[String(selectedDraft.contentItemId)] || text(selectedDraft.draftText)
                      : 'Generate and select a draft before submitting it for approval.'}
                  </p>
                </div>
                <ReadableQueue items={[
                  {
                    title: approval ? 'Approval package created' : 'Approval package',
                    meta: approval ? 'Reviewer can approve, reject, or request changes.' : 'Send the selected draft to review.',
                    status: approval ? titleCase(text(approval.approvalStatus, 'pending')) : 'Approval Required',
                    tone: approval?.approvalStatus === 'approved' ? 'good' : 'warn',
                  },
                  {
                    title: packageResult ? 'Publishing package ready' : 'Publishing preparation',
                    meta: packageResult ? 'Platform payloads and Postiz package are available.' : 'Available after approval.',
                    status: packageResult ? 'Package Ready' : 'Waiting',
                    tone: packageResult ? 'good' : 'default',
                  },
                ]} />
                {approval?.approvalStatus === 'pending' && (
                  <div className="flex flex-wrap gap-2">
                    <PrimaryAction onClick={() => decideApproval('approve')} disabled={!!loading}>Approve</PrimaryAction>
                    <SecondaryAction onClick={() => decideApproval('requestChanges')} disabled={!!loading}>Request Changes</SecondaryAction>
                    <SecondaryAction onClick={() => decideApproval('reject')} disabled={!!loading}>Reject</SecondaryAction>
                  </div>
                )}
                <PrimaryAction onClick={createPackage} disabled={approval?.approvalStatus !== 'approved' || !!packageResult || loading === 'package'}>
                  {packageResult ? 'Package Ready' : loading === 'package' ? 'Preparing...' : 'Prepare Publishing Package'}
                </PrimaryAction>
              </div>
            </ProductCard>
          </div>

          <ProductCard title="Publishing Package, Performance & Leads" subtitle="What happens after approval: package creation, Postiz readiness, performance signals, and lead handoff preparation.">
            <div className="grid gap-5 xl:grid-cols-3">
              <div className="rounded-xl border border-neutral-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Postiz workspace</div>
                    <h3 className="mt-2 text-lg font-semibold text-neutral-950">Scheduling readiness</h3>
                  </div>
                  <ProductStatus tone={postiz.reachable && postizApiConfigured && connectedChannelCount ? 'good' : 'warn'}>
                    {postiz.reachable && postizApiConfigured && connectedChannelCount ? 'Sandbox ready' : 'Needs setup'}
                  </ProductStatus>
                </div>
                <ReadableQueue items={[
                  {
                    title: 'Server',
                    meta: postiz.reachable ? 'Tanaghum can reach the Postiz instance.' : 'Backend cannot verify the Postiz URL yet.',
                    status: postiz.reachable ? 'Online' : 'Check URL',
                    tone: postiz.reachable ? 'good' : 'warn',
                  },
                  {
                    title: 'API key',
                    meta: postizApiConfigured ? 'Tenant API key is saved in the secure credential vault.' : 'Save the tenant Postiz API key and base URL in Credentials.',
                    status: postizApiConfigured ? 'Saved' : 'Missing',
                    tone: postizApiConfigured ? 'good' : 'warn',
                  },
                  {
                    title: 'Social channel',
                    meta: connectedChannelCount ? `${connectedChannelCount} connected channel(s) returned by Postiz.` : 'Connect Instagram, LinkedIn, X, or another channel through Postiz OAuth.',
                    status: connectedChannelCount ? 'Connected' : 'Not connected',
                    tone: connectedChannelCount ? 'good' : 'warn',
                  },
                  {
                    title: 'Selected channel',
                    meta: postizIntegrationIdStatus === 'configured' ? 'A channel ID is saved for scheduling packages.' : 'Choose and save the Postiz channel ID before sandbox scheduling.',
                    status: postizIntegrationIdStatus === 'configured' ? 'Selected' : 'Not selected',
                    tone: postizIntegrationIdStatus === 'configured' ? 'good' : 'warn',
                  },
                ]} />
              </div>

              <div className="rounded-xl border border-neutral-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Approved output</div>
                    <h3 className="mt-2 text-lg font-semibold text-neutral-950">Publishing package</h3>
                  </div>
                  <ProductStatus tone={packageResult ? 'good' : 'default'}>{packageResult ? 'Ready' : 'Waiting'}</ProductStatus>
                </div>
                <p className="mt-4 text-sm leading-6 text-neutral-600">
                  {packageResult
                    ? `${platformPayloads.length || 3} platform payloads are prepared from the approved draft. The package is ready for scheduling review.`
                    : 'Approve a selected draft, then prepare the publishing package here.'}
                </p>
                <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  Real scheduling remains locked until the tenant enables a sandbox scheduling flag and uses approved test channels.
                </div>
              </div>

              <div className="rounded-xl border border-neutral-200 bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Commercial intelligence</div>
                <h3 className="mt-2 text-lg font-semibold text-neutral-950">Performance and handoff</h3>
                <ReadableQueue items={[
                  { title: 'Analytics source', meta: text(analytics?.sourceLabel, 'No analytics source connected yet'), status: numberValue(analytics?.sourceCount) ? 'Available' : 'No Data', tone: numberValue(analytics?.sourceCount) ? 'info' : 'default' },
                  { title: 'Latest report', meta: text(analytics?.reportLabel, 'No generated performance report yet'), status: numberValue(analytics?.reportCount) ? 'Available' : 'Waiting', tone: numberValue(analytics?.reportCount) ? 'good' : 'default' },
                  { title: leads.length ? 'Lead handoff package' : 'Lead handoff', meta: leads.length ? `${leads.length} captured lead record(s) are ready for CRM review.` : 'Lead packages appear after real lead capture.', status: leads.length ? 'Ready' : 'Waiting', tone: leads.length ? 'good' : 'default' },
                  { title: 'Voice follow-up', meta: leads.length ? 'Follow-up can be prepared after consent review.' : 'Requires lead capture and explicit authorization.', status: leads.length ? 'Review Required' : 'Waiting', tone: leads.length ? 'info' : 'default' },
                ]} />
              </div>
            </div>
          </ProductCard>
        </div>
      </div>
    </ProductPage>
  );
}
