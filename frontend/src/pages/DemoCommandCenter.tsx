import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  aiGenerationApi,
  aiProviderApi,
  algoApi,
  analyticsApi,
  approvalsApi,
  campaignsApi,
  integrationCredentialsApi,
  integrationStatusApi,
  leadsApi,
  postizApi,
  publishingPackageApi,
  runtimeBridgesApi,
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
  const [packages, setPackages] = useState<RecordMap[]>([]);
  const [approvals, setApprovals] = useState<RecordMap[]>([]);
  const [integrationStatus, setIntegrationStatus] = useState<RecordMap | null>(null);
  const [credentialRows, setCredentialRows] = useState<RecordMap[]>([]);
  const [runtimeStatuses, setRuntimeStatuses] = useState<RecordMap[]>([]);
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
  const platformPayloads = list(packageResult?.platforms);
  const leads = leadRecords;
  const connectors = list(integrationStatus?.connectors);
  const pendingApprovals = approvals.filter(item => text(item.approvalStatus || item.status, '').toLowerCase() === 'pending').length;
  const approvedApprovals = approvals.filter(item => text(item.approvalStatus || item.status, '').toLowerCase() === 'approved').length;
  const configuredConnectors = connectors.filter(item => text(item.credentialStatus, '').toLowerCase() === 'configured').length;
  const configuredCredentials = credentialRows.filter(item => text(item.status, '').toLowerCase() === 'configured').length;
  const reachableRuntimeBridges = runtimeStatuses.filter(item => Boolean(item.reachable) || text(item.status, '').toLowerCase().includes('connected')).length;
  const postizCredentialStatus = text((postizStatus?.health as RecordMap | undefined)?.credentialStatus, text(postiz.credentialStatus, 'missing'));
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
  const connectorGapCount = Math.max(0, credentialRows.length - configuredCredentials);
  const liveBlockers = [
    !providerReady ? 'Configure this user with OpenAI or Claude credentials.' : '',
    postizCredentialStatus !== 'configured' ? 'Add Postiz API key, base URL, and sandbox integration ID.' : '',
    !postiz.reachable ? 'Verify the Postiz sandbox URL is reachable from the backend.' : '',
    connectorGapCount ? `${connectorGapCount} tenant integration credential set(s) are still missing.` : '',
    !externalWritesEnabled ? 'External execution flag is disabled.' : '',
    !m5Enabled ? 'M5 write execution remains disabled.' : '',
    runtimeStatuses.length && !reachableRuntimeBridges ? 'OpenClaw / agentgateway / AgentScope endpoints are not reachable.' : '',
  ].filter(Boolean);

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
          credentialData,
          runtimeData,
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
          integrationCredentialsApi.matrix(token as string).catch(() => null),
          runtimeBridgesApi.status(token as string).catch(() => null),
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
        setCredentialRows(list(credentialData));
        setRuntimeStatuses(list(runtimeData));
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
      const [leadData, leadStatData, postizData, packageData, approvalData, integrationData, credentialData, runtimeData] = await Promise.all([
        leadsApi.list(token),
        leadsApi.stats(token),
        postizApi.status(token),
        publishingPackageApi.list(token).catch(() => []),
        approvalsApi.list(token).catch(() => []),
        integrationStatusApi.get(token).catch(() => null),
        integrationCredentialsApi.matrix(token).catch(() => null),
        runtimeBridgesApi.status(token).catch(() => null),
      ]);
      setLeadRecords(list(leadData));
      setLeadStats(leadStatData as RecordMap);
      setPostizStatus(postizData as RecordMap);
      setPackages(list(packageData));
      setApprovals(list(approvalData));
      setIntegrationStatus(integrationData as RecordMap | null);
      setCredentialRows(list(credentialData));
      setRuntimeStatuses(list(runtimeData));
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
            <div className="text-xs font-semibold uppercase tracking-wide text-cyan-200/70">Executive analytics</div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">Commercial/Social control room</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/58">
              These cards use live STITCH records and connector status. Empty values mean the platform has no connected source or captured record yet.
            </p>
          </div>
          <ProductStatus tone={externalWritesEnabled && m5Enabled ? 'warn' : 'danger'}>
            {externalWritesEnabled && m5Enabled ? 'External Execution Armed' : 'External Execution Blocked'}
          </ProductStatus>
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            <ExecutiveKpiCard
              label="Workflow readiness"
              value={`${workflowReadiness}%`}
              detail={selected ? text(selected.topic) : 'No campaign selected'}
              tone={workflowReadiness >= 75 ? 'good' : workflowReadiness >= 45 ? 'warn' : 'danger'}
              series={[campaigns.length, drafts.length, score ? 1 : 0, approval ? 1 : 0, packageResult || packages.length ? 1 : 0, leads.length]}
              secondary="campaign to handoff"
            />
            <ExecutiveKpiCard
              label="Approval load"
              value={pendingApprovals}
              detail={`${approvedApprovals} approved decisions recorded`}
              tone={pendingApprovals ? 'warn' : 'good'}
              series={[approvals.length, pendingApprovals, approvedApprovals]}
              secondary="human gate"
            />
            <ExecutiveKpiCard
              label="Connector readiness"
              value={`${configuredConnectors}/${connectors.length || 0}`}
              detail={`${configuredCredentials}/${credentialRows.length || 0} credential sets configured`}
              tone={configuredConnectors && configuredConnectors === connectors.length ? 'good' : 'warn'}
              series={[configuredCredentials, configuredConnectors, reachableRuntimeBridges]}
              secondary="integration vault"
            />
            <ExecutiveKpiCard
              label="Lead pipeline"
              value={numberValue(leadStats?.total)}
              detail={`${numberValue(leadStats?.qualified)} qualified leads`}
              tone={numberValue(leadStats?.qualified) ? 'good' : 'info'}
              series={[packages.length + (packageResult ? 1 : 0), leads.length, numberValue(leadStats?.qualified)]}
              secondary="captured records only"
            />
          </div>
          <ExecutiveGauge
            value={workflowReadiness}
            label="Boardroom readiness"
            detail={liveBlockers.length ? `${liveBlockers.length} blocker(s) remain before full live operation.` : 'Core workflow and integration controls are ready for the current configured scope.'}
          />
        </div>
        <div className="mt-4">
          <ExecutiveStatusGrid items={[
            {
              label: 'AI provider',
              value: providerReady ? providerLabel : 'Requires user OpenAI or Claude key',
              tone: providerReady ? 'good' : 'warn',
              detail: 'Keys are stored per user and never returned to the browser after save.',
            },
            {
              label: 'Postiz sandbox',
              value: postiz.reachable ? 'Reachable from backend' : 'Not reachable or not configured',
              tone: postiz.reachable ? 'good' : 'warn',
              detail: postizCredentialStatus === 'configured' ? 'API credential configured.' : 'API key/base URL/integration ID required.',
            },
            {
              label: 'Runtime bridges',
              value: `${reachableRuntimeBridges}/${runtimeStatuses.length || 0} reachable`,
              tone: reachableRuntimeBridges ? 'good' : 'warn',
              detail: 'OpenClaw, agentgateway, and AgentScope require live endpoints before they can execute runtime orchestration.',
            },
          ]} />
        </div>
      </section>

      <ProductCard
        title="Full Live Operation Requirements"
        subtitle="Real blockers detected from backend status. These must be resolved before production scheduling, CRM writes, messaging, voice handoff, or external orchestration."
        action={<ProductStatus tone={liveBlockers.length ? 'warn' : 'good'}>{liveBlockers.length ? `${liveBlockers.length} blocker(s)` : 'No detected blockers'}</ProductStatus>}
      >
        {liveBlockers.length ? (
          <ReadableQueue
            items={liveBlockers.map((blocker, index) => ({
              title: `Required item ${index + 1}`,
              meta: blocker,
              status: 'Required',
              tone: 'warn',
            }))}
          />
        ) : (
          <EmptyProductState title="No detected blockers" message="The currently configured backend status does not report missing provider credentials, connector credentials, runtime bridge reachability, or execution flags." />
        )}
      </ProductCard>

      <ProductCard title="Executive Operating Snapshot" subtitle="One-screen view of business progress, current blocker, and external execution safety.">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_360px_320px]">
          <div className="rounded-lg bg-neutral-950 p-6 text-white">
            <div className="text-sm text-white/55">Current decision</div>
            <div className="mt-3 text-3xl font-semibold tracking-tight">{nextAction}</div>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/65">
              {selected
                ? `Campaign: ${text(selected.topic)}. The operator should move the same campaign through draft, score, approval, package, analytics, and lead handoff.`
                : 'Select or create a campaign before AI generation, approval, publishing preparation, analytics, or lead handoff can produce useful output.'}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md bg-white/10 p-3">
                <div className="text-xs text-white/50">AI Provider</div>
                <div className="mt-1 text-sm font-semibold">{providerReady ? providerLabel : 'Requires credentials'}</div>
              </div>
              <div className="rounded-md bg-white/10 p-3">
                <div className="text-xs text-white/50">Postiz</div>
                <div className="mt-1 text-sm font-semibold">{postiz.reachable ? 'Sandbox reachable' : 'Not reachable or not configured'}</div>
              </div>
              <div className="rounded-md bg-white/10 p-3">
                <div className="text-xs text-white/50">Execution</div>
                <div className="mt-1 text-sm font-semibold">External writes blocked</div>
              </div>
            </div>
          </div>
          <ReadableQueue items={[
            { title: 'Preparation', meta: selected ? 'Campaign brief is selected.' : 'Campaign brief is required.', status: selected ? 'Ready' : 'Required', tone: selected ? 'good' : 'warn' },
            { title: 'AI Work', meta: drafts.length ? `${drafts.length} platform drafts generated.` : providerReady ? 'Ready to generate drafts.' : 'Provider credentials required.', status: drafts.length ? 'Drafted' : providerReady ? 'Ready' : 'Blocked', tone: drafts.length ? 'good' : providerReady ? 'info' : 'warn' },
            { title: 'Human Control', meta: approval ? `Approval status is ${titleCase(text(approval.approvalStatus, 'pending'))}.` : 'No approval package for current draft yet.', status: approval ? 'Recorded' : 'Waiting', tone: approval ? 'good' : 'default' },
            { title: 'Revenue Handoff', meta: leads.length ? `${leads.length} captured lead record(s).` : 'No lead records captured yet.', status: leads.length ? 'Ready' : 'Waiting', tone: leads.length ? 'good' : 'default' },
          ]} />
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-5">
            <div className="text-sm font-semibold text-neutral-950">Safety Gates</div>
            <div className="mt-4 space-y-2">
              <ProductStatus tone="danger">External Writes Off</ProductStatus>
              <ProductStatus tone="warn">Human Approval Required</ProductStatus>
              <ProductStatus tone="danger">M5 Disabled</ProductStatus>
              <ProductStatus tone={postiz.reachable ? 'info' : 'warn'}>{postiz.reachable ? 'Postiz Sandbox Reachable' : 'Postiz Needs Credentials'}</ProductStatus>
            </div>
            <p className="mt-4 text-sm leading-6 text-neutral-500">
              The workspace can prepare packages and handoff payloads. It cannot publish, schedule, write CRM records, message contacts, or trigger calls without explicit gated authorization.
            </p>
          </div>
        </div>
      </ProductCard>

      <ProductCard title="Workflow" subtitle="The same campaign moves through preparation, approval, publishing package, intelligence, and handoff.">
        <WorkflowRail steps={[
          { label: 'Brief', state: stateFor(!!selected, step === 'brief') },
          { label: 'Drafts', state: stateFor(!!drafts.length, step === 'drafts') },
          { label: 'Optimize', state: stateFor(!!score, step === 'score') },
          { label: 'Approval', state: stateFor(!!approval, step === 'approval') },
          { label: 'Publishing', state: stateFor(!!packageResult, step === 'publishing') },
          { label: 'Analytics', state: stateFor(!!analytics, false) },
          { label: 'Leads', state: stateFor(leads.length > 0, step === 'handoff') },
          { label: 'Evidence', state: stateFor(!!approval || !!packageResult, false) },
        ]} />
      </ProductCard>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)_380px]">
        <ScoreRing
          value={score ? totalScore : 0}
          label={score ? 'Selected draft readiness' : 'Workflow readiness'}
          detail={score ? 'Score is calculated from the actual selected generated draft.' : 'Generate and score a draft to calculate readiness.'}
        />
        <ProductCard title="Performance Signals" subtitle="Visualized from the analytics endpoint and current workflow records.">
          <BarList items={[
            { label: 'Reach', value: numberValue(analytics?.reach), detail: numberValue(analytics?.reach).toLocaleString(), tone: 'good' },
            { label: 'Impressions', value: numberValue(analytics?.impressions), detail: numberValue(analytics?.impressions).toLocaleString(), tone: 'info' },
            { label: 'Qualified leads', value: leads.length, detail: `${leads.length} records`, tone: leads.length ? 'good' : 'default' },
          ]} />
        </ProductCard>
        <ProductCard title="Lead Funnel" subtitle="Current journey from campaign package to qualified handoff.">
          <FunnelChart stages={[
            { label: 'Campaigns', value: campaigns.length, tone: campaigns.length ? 'info' : 'default' },
            { label: 'Drafts', value: drafts.length || 0, tone: drafts.length ? 'good' : 'default' },
            { label: 'Approvals', value: approval ? 1 : 0, tone: approval ? 'good' : 'default' },
            { label: 'Packages', value: packages.length + (packageResult ? 1 : 0), tone: (packages.length || packageResult) ? 'good' : 'default' },
            { label: 'Leads', value: leads.length || 0, tone: leads.length ? 'good' : 'default' },
          ]} />
        </ProductCard>
      </div>

      {notice && (
        <Notice tone={notice.includes('failed') ? 'danger' : 'good'}>{notice}</Notice>
      )}

      {!providerReady && (
        <Notice tone="warn">
          Real AI draft generation is blocked until this user configures OpenAI or Claude. {providerLabel}{' '}
          <Link to="/ai-settings" className="font-semibold underline">Open AI Provider Settings</Link>
        </Notice>
      )}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <ProductCard title="Campaigns" subtitle="Choose the campaign to move through today's workflow.">
          <div className="space-y-3">
            {campaigns.map(campaign => (
              <button
                key={String(campaign.id)}
                type="button"
                onClick={() => chooseCampaign(campaign)}
                className={`w-full rounded-lg border p-4 text-left transition ${
                  selected?.id === campaign.id ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white hover:bg-neutral-50'
                }`}
              >
                <div className="line-clamp-3 font-semibold">{text(campaign.topic)}</div>
                <div className={`mt-2 text-sm ${selected?.id === campaign.id ? 'text-white/60' : 'text-neutral-500'}`}>
                  {titleCase(text(campaign.status, 'idea'))} / {titleCase(text(campaign.riskCategory, 'medium'))} risk
                </div>
              </button>
            ))}
          </div>
        </ProductCard>

        <div className="space-y-6">
          <ProductCard
            title="Campaign Brief"
            subtitle="The business inputs the AI and approval workflow use."
            action={<ProductStatus tone={selected ? 'good' : 'warn'}>{selected ? 'Active' : 'Required'}</ProductStatus>}
          >
            {selected ? (
              <DetailGrid items={[
                { label: 'Objective', value: text(selected.objective) },
                { label: 'Audience', value: text(selected.audience) },
                { label: 'Platforms', value: ((selected.targetPlatforms as string[] | undefined) || PLATFORMS).map(titleCase).join(', ') },
                { label: 'CTA', value: text(selected.cta, 'CTA prepared during drafting') },
              ]} />
            ) : (
              <EmptyProductState
                message="Select an existing campaign or create a new campaign idea from AI Draft Studio."
                action={<Link to="/ideas" className="inline-flex min-h-10 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white">Create Campaign Idea</Link>}
              />
            )}
          </ProductCard>

          <ProductCard
            title="AI Draft Studio"
            subtitle="Generate, edit, and select platform-specific social drafts."
            action={<PrimaryAction onClick={generateDrafts} disabled={!providerReady || !selected || loading === 'drafts'}>{loading === 'drafts' ? 'Generating...' : 'Generate Platform Drafts'}</PrimaryAction>}
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
              <EmptyProductState message="Generate LinkedIn, Instagram, and X/Twitter drafts from the active campaign." />
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

          <ProductCard title="Publishing, Analytics & Lead Handoff" subtitle="Prepared business outputs after approval. External writes remain authorization-gated.">
            <div className="grid gap-4 xl:grid-cols-3">
              <ReadableQueue items={[
                {
                  title: 'Postiz payload',
                  meta: packageResult ? `${platformPayloads.length || 3} platform payloads prepared for scheduling review.` : 'Prepare publishing package to preview payload.',
                  status: packageResult ? 'Package Ready' : 'Waiting',
                  tone: packageResult ? 'good' : 'default',
                },
                {
                  title: 'Scheduling',
                  meta: postiz.reachable ? 'Postiz sandbox is reachable. Scheduling stays disabled until authorization.' : 'Sandbox scheduling requires connector check.',
                  status: 'Sandbox Scheduling Disabled',
                  tone: 'warn',
                },
              ]} />
              <ReadableQueue items={[
                { title: 'Analytics source', meta: text(analytics?.sourceLabel, 'No analytics source connected yet'), status: numberValue(analytics?.sourceCount) ? 'Available' : 'No Data', tone: numberValue(analytics?.sourceCount) ? 'info' : 'default' },
                { title: 'Latest report', meta: text(analytics?.reportLabel, 'No generated performance report yet'), status: numberValue(analytics?.reportCount) ? 'Available' : 'Waiting', tone: numberValue(analytics?.reportCount) ? 'good' : 'default' },
              ]} />
              <ReadableQueue items={[
                { title: leads.length ? 'Captured lead package' : 'Lead handoff package', meta: leads.length ? 'Real lead records are available for CRM review.' : 'No lead records exist yet.', status: leads.length ? 'Ready' : 'Waiting', tone: leads.length ? 'good' : 'default' },
                { title: 'Voice follow-up', meta: leads.length ? 'Prepare follow-up only after consent review.' : 'Requires lead capture and explicit authorization.', status: leads.length ? 'Review Required' : 'Waiting', tone: leads.length ? 'info' : 'default' },
              ]} />
            </div>
          </ProductCard>
        </div>
      </div>
    </ProductPage>
  );
}
