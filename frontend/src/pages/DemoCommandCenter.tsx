import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { aiGenerationApi, aiProviderApi, algoApi, approvalsApi, analyticsApi, campaignsApi, commercialWorkflowApi, integrationStatusApi, leadsApi, postizApi, publishingPackageApi } from '../api';
import { useAuth } from '../contexts/useAuth';
import {
  BarList,
  DetailGrid,
  EmptyProductState,
  ExecutiveGauge,
  ExecutiveKpiCard,
  ExecutiveStatusGrid,
  FunnelChart,
  Notice,
  PlatformPill,
  PrimaryAction,
  ProductCard,
  ProductPage,
  ProductStatus,
  ProgressBar,
  ReadableQueue,
  ScoreRing,
  SecondaryAction,
} from '../components/ProductUI';

type RecordMap = Record<string, unknown>;

const PLATFORMS = ['linkedin', 'instagram', 'x'];

function text(value: unknown, fallback = 'Not specified'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function list(value: unknown): RecordMap[] {
  return Array.isArray(value) ? (value as RecordMap[]) : [];
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
  if (!value) return '';
  if (value === 'x') return 'X / Twitter';
  return value
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function campaignName(campaign: RecordMap): string {
  const match = `${text(campaign.objective)}\n${text(campaign.rawMessage)}`.match(/Campaign:\s*([^\n]+)/i);
  if (match?.[1]) return match[1].trim();
  return text(campaign.rawMessage).split('\n')[0]?.trim() || text(campaign.objective, 'Unnamed campaign');
}

function campaignObjective(campaign: RecordMap): string {
  const match = `${text(campaign.objective)}\n${text(campaign.rawMessage)}`.match(/Objective:\s*([^\n]+)/i);
  if (match?.[1]) return match[1].trim();
  return text(campaign.objective).split('\n')[0]?.trim() || text(campaign.rawMessage, 'Campaign objective pending');
}

function scoreComponent(score: RecordMap | null, component: string): RecordMap {
  const components = list(score?.components);
  return components.find(item => text(item.component, '') === component) || {};
}

function friendlyNextAction(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized === 'optimize') return 'Review content quality';
  if (normalized === 'draft') return 'Generate social content';
  if (normalized === 'approval') return 'Send content for review';
  if (normalized === 'package') return 'Prepare scheduling package';
  if (normalized === 'postiz') return 'Connect scheduling channel';
  if (normalized === 'analytics') return 'Review performance';
  if (normalized === 'leads') return 'Review customer interest';
  return value;
}

type WorkflowStep = 'brief' | 'drafts' | 'score' | 'approval' | 'publishing' | 'handoff';

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
  const [loading, setLoading] = useState('');
  const [notice, setNotice] = useState('');
  const [providerReady, setProviderReady] = useState(false);
  const [providerLabel, setProviderLabel] = useState('Connect an AI model');
  const [, setStep] = useState<WorkflowStep>('brief');
  const [leads, setLeads] = useState<RecordMap[]>([]);
  const [leadStats, setLeadStats] = useState<RecordMap | null>(null);
  const [postizStatus, setPostizStatus] = useState<RecordMap>({});
  const [packages, setPackages] = useState<RecordMap[]>([]);
  const [approvals, setApprovals] = useState<RecordMap[]>([]);
  const [integrationStatus, setIntegrationStatus] = useState<RecordMap | null>(null);
  const [workflowState, setWorkflowState] = useState<RecordMap | null>(null);
  const [postizChannels, setPostizChannels] = useState<RecordMap[]>([]);
  const [analytics, setAnalytics] = useState<RecordMap>({});
  const [showDetails, setShowDetails] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const selectedDraft =
    drafts.find((draft) => String(draft.contentItemId) === selectedDraftId) || drafts[0] || null;

  const workflowCounts = (workflowState?.counts || {}) as RecordMap;
  const workflowReadiness = numberValue((workflowState?.readiness as RecordMap)?.score);
  const workflowStages = list(workflowState?.stages);
  const workflowNextAction = (workflowState?.nextAction || {}) as RecordMap;

  const postiz = (workflowState?.postiz || {}) as RecordMap;
  const postizServerReachable =
    Boolean(postiz.serverReachable)
    || Boolean(postiz.reachable)
    || ['sandbox connected', 'sandbox ready'].includes(text(postizStatus.status, '').toLowerCase());
  const connectedChannelCount = Math.max(numberValue(postiz.connectedChannelCount), postizChannels.length);
  const postizHealth = (postizStatus.health || {}) as RecordMap;
  const postizApiConfigured = text(postiz.credentialStatus || postizHealth.credentialStatus, 'missing') === 'configured';
  const postizIntegrationIdStatus = text(postiz.integrationIdStatus || postizHealth.integrationIdStatus, 'missing');
  const integrationConnectorCount = list(integrationStatus?.connectors).length;

  const externalWritesEnabled = text((workflowState?.safety as RecordMap)?.externalWritesEnabled) === 'true';
  const m5Enabled = text((workflowState?.safety as RecordMap)?.m5WriteExecutionEnabled) === 'true';

  const pendingApprovals = approvals.filter(
    (a) => text(a.approvalStatus) === 'pending' || text(a.approvalStatus) === 'submitted',
  ).length;
  const approvedApprovals = approvals.filter((a) => text(a.approvalStatus) === 'approved').length;
  const publishingPackageCount = packages.length;

  const displayCampaignCount = numberValue(workflowCounts.activeCampaigns) || campaigns.length;
  const displayPendingApprovals = numberValue(workflowCounts.pendingApprovals) || pendingApprovals;
  const displayApprovedApprovals = numberValue(workflowCounts.approvedApprovals) || approvedApprovals;
  const displayPackageCount = numberValue(workflowCounts.publishingPackages) || publishingPackageCount;
  const displayQualifiedLeads = numberValue(workflowCounts.qualifiedLeads) || numberValue(leadStats?.qualified);
  const displayCapturedLeads = numberValue(workflowCounts.capturedLeads) || numberValue(leadStats?.total);

  const selectedScore = (score || {}) as RecordMap;
  const totalScore = numberValue(selectedScore.totalScore);
  const components = {
    hook: scoreComponent(score, 'hookStrength'),
    cta: scoreComponent(score, 'ctaClarity'),
    hashtag: scoreComponent(score, 'hashtagHygiene'),
    risk: scoreComponent(score, 'complianceRisk'),
  };

  const platformPayloads = list(packageResult?.platformPayloads).length
    ? list(packageResult?.platformPayloads)
    : list(packageResult?.platforms);

  const campaignQueue = campaigns.filter((item, index, arr) => {
    const key = [text(item.title), text(item.objective), text(item.rawMessage), text(item.audience), '']
      .join('|')
      .toLowerCase();
    return arr.findIndex((other) => {
      const otherKey = [text(other.title), text(other.objective), text(other.rawMessage), text(other.audience), '']
        .join('|')
        .toLowerCase();
      return otherKey === key;
    }) === index;
  });
  const visibleCampaigns = campaignQueue.slice(0, 8);

  // ---- computed workflow stage ----
  const workflowStage: WorkflowStep = !selected
    ? 'brief'
    : !drafts.length
      ? 'drafts'
      : !score
        ? 'score'
        : !approval
          ? 'approval'
          : text(approval.approvalStatus) !== 'approved'
            ? 'approval'
            : !packageResult
              ? 'publishing'
              : 'handoff';

  const stageNumber =
    workflowStage === 'brief'
      ? 1
      : workflowStage === 'drafts'
        ? 2
        : workflowStage === 'score'
          ? 3
          : workflowStage === 'approval'
            ? 4
            : workflowStage === 'publishing'
              ? 5
              : 6;

  function buildAnalyticsSummary(
    sources: RecordMap[],
    snapshots: RecordMap[],
    reports: RecordMap[],
  ): RecordMap {
    const sourceCount = sources.length;
    const reportCount = reports.length;
    const totals = snapshots.reduce<{ reach: number; impressions: number; engagement: number }>((acc, snapshot) => {
      const metrics = (snapshot.normalizedMetrics || snapshot.metrics || {}) as RecordMap;
      return {
        reach: acc.reach + numberValue(metrics.reach),
        impressions: acc.impressions + numberValue(metrics.impressions),
        engagement: acc.engagement + numberValue(metrics.engagement),
      };
    }, { reach: 0, impressions: 0, engagement: 0 });
    return {
      sourceCount,
      reportCount,
      sourceLabel: sourceCount ? `${sourceCount} data source(s) connected` : null,
      reportLabel: reportCount ? text(reports[0]?.summary, 'Latest report available') : null,
      reach: totals.reach,
      impressions: totals.impressions,
      engagement: totals.engagement,
    };
  }

  // ---- data loading ----
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
          workflowData,
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
          commercialWorkflowApi.state(token as string).catch(() => null),
        ]);
        if (cancelled) return;
        const campaignList = list(campaignData);
        setCampaigns(campaignList);
        setSelected((current) => current || campaignList[0] || null);
        setLeads(list(leadData));
        setLeadStats(leadStatData as RecordMap);
        setPostizStatus(postizData as RecordMap);
        setPackages(list(packageData));
        setApprovals(list(approvalData));
        setIntegrationStatus(integrationData as RecordMap | null);
        setWorkflowState(workflowData as RecordMap | null);
        setPostizChannels(list(((postizChannelData as RecordMap)?.channels || []) as unknown));
        setAnalytics(buildAnalyticsSummary(list(sourceData), list(snapshotData), list(reportData)));
        try {
          const status = (await aiProviderApi.status(token as string)) as RecordMap;
          const providers = list(status.providers);
          const activeProvider = text(status.activeProvider, 'mock');
          const active = providers.find(
            (provider) => provider.type === activeProvider && provider.type !== 'mock',
          );
          setProviderReady(active?.apiKeyStatus === 'configured');
          setProviderLabel(
            active
              ? `${text(active.name, 'AI model')} / ${text(active.model, 'configured')}`
              : 'Connect an AI model',
          );
        } catch {
          setProviderReady(false);
          setProviderLabel('Connect an AI model before generating content');
        }
      } catch (error) {
        if (!cancelled)
          setNotice(`Workspace failed to load: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        if (!cancelled) setPageLoading(false);
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
      const [leadData, leadStatData, postizData, packageData, approvalData, integrationData, postizChannelData, workflowData] =
        await Promise.all([
          leadsApi.list(token),
          leadsApi.stats(token),
          postizApi.status(token),
          publishingPackageApi.list(token).catch(() => []),
          approvalsApi.list(token).catch(() => []),
          integrationStatusApi.get(token).catch(() => null),
          postizApi.channels(token).catch(() => ({ channels: [] })),
          commercialWorkflowApi.state(token, selected?.id ? String(selected.id) : undefined).catch(() => null),
        ]);
      setLeads(list(leadData));
      setLeadStats(leadStatData as RecordMap);
      setPostizStatus(postizData as RecordMap);
      setPackages(list(packageData));
      setApprovals(list(approvalData));
      setIntegrationStatus(integrationData as RecordMap | null);
      setPostizChannels(list(((postizChannelData as RecordMap)?.channels || []) as unknown));
      setWorkflowState(workflowData as RecordMap | null);
    } catch {
      setLeads([]);
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
    setNotice('');
    setStep('drafts');
  }

  async function generateDrafts() {
    if (!token || !selected || !providerReady) return;
    setLoading('drafts');
    setNotice('');
    try {
      const result = await aiGenerationApi.generate(
        {
          campaignRequestId: selected.id,
          platforms: PLATFORMS,
          tone: 'professional',
        },
        token,
      );
      const generated = Array.isArray(result) ? (result as RecordMap[]) : [result as RecordMap];
      setDrafts(generated);
      setDraftTextById(
        Object.fromEntries(
          generated.map((draft) => [String(draft.contentItemId), text(draft.draftText, '')]),
        ),
      );
      setSelectedDraftId(String(generated[0]?.contentItemId || ''));
      setScore(null);
      setApproval(null);
      setPackageResult(null);
      setStep('score');
      setNotice('');
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
      const activeDraftText =
        draftTextById[String(selectedDraft.contentItemId)] || text(selectedDraft.draftText);
      const metadata = (selectedDraft.metadata || {}) as RecordMap;
      const result = await algoApi.score(
        {
          contentItemId: selectedDraft.contentItemId,
          platform: selectedDraft.platform,
          draftText: activeDraftText,
          objective: selected?.objective,
          audience: selected?.audience,
          cta: metadata.cta || selected?.cta,
          hashtags: metadata.hashtags || [],
          contentType: selectedDraft.contentType,
          riskCategory: selected?.riskCategory,
        },
        token,
      );
      setScore(result as RecordMap);
      setStep('approval');
      setNotice('');
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
      const result = await approvalsApi.submit(
        {
          targetId: selectedDraft.contentItemId,
          targetType: 'content_item',
          riskCategory: selected?.riskCategory || 'medium',
          approvalType: 'brand_review',
          requiredDepartment: 'Commercial',
          requiredRole: 'reviewer',
          comment: 'Please review this content before publishing.',
        },
        token,
      );
      setApproval(result as RecordMap);
      setNotice('');
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
      const comment =
        action === 'approve'
          ? 'Approved for publishing.'
          : action === 'reject'
            ? 'Rejected.'
            : 'Please revise and resubmit.';
      const result =
        action === 'approve'
          ? await approvalsApi.approve(approvalId, { comment }, token)
          : action === 'reject'
            ? await approvalsApi.reject(approvalId, { comment }, token)
            : await approvalsApi.requestChanges(approvalId, { comment }, token);
      setApproval(result as RecordMap);
      setStep(action === 'approve' ? 'publishing' : 'approval');
      setNotice('');
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
      const result = await publishingPackageApi.create(
        {
          campaignId: selected.id,
          draftId: selectedDraft?.contentItemId,
          approvalId: approval?.id,
          platforms: PLATFORMS,
          scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        token,
      );
      const pkg = result as RecordMap;
      setPackageResult(pkg);
      setStep('handoff');
      setNotice('');
      void refreshStatus();
    } catch (error) {
      setNotice(`Package preparation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  const computedNextAction = !selected
    ? 'Select a campaign'
    : !providerReady
      ? 'Connect your AI model'
      : !drafts.length
        ? 'Generate content for your campaign'
        : !score
          ? 'Review content quality'
          : !approval
            ? 'Send content for review'
            : text(approval.approvalStatus) !== 'approved'
              ? 'Complete the review decision'
              : !packageResult
                ? 'Prepare for scheduling'
                : 'Review your results';
  const nextAction = friendlyNextAction(
    text(
      workflowNextAction.label || workflowNextAction.title || workflowNextAction.message || workflowNextAction.description,
      computedNextAction,
    ),
  );

  // ---- loading skeleton ----
  if (pageLoading) {
    return (
      <ProductPage title="Dashboard" subtitle="Loading your workspace...">
        <div className="space-y-6">
          <div className="skeleton-pulse h-48 rounded-2xl" />
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton-pulse h-28 rounded-xl" />
            ))}
          </div>
          <div className="skeleton-pulse h-64 rounded-xl" />
        </div>
      </ProductPage>
    );
  }

  return (
    <ProductPage
      eyebrow="Content Studio"
      title="Dashboard"
      subtitle={`Create, review, and schedule your social media content. Next action: ${nextAction}.`}
      action={<ProductStatus tone="good">Workspace Active</ProductStatus>}
    >
      {/* ---- CEO Snapshot ---- */}
      <section className="rounded-2xl bg-[#0f0c1f] p-4 shadow-[0_24px_70px_rgba(15,15,22,0.30)] sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
              Content Overview
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-white/58">
              Campaign progress, content review status, and scheduling readiness at a glance.
            </p>
          </div>
          <ProductStatus tone={externalWritesEnabled && m5Enabled ? 'warn' : 'good'}>
            {externalWritesEnabled && m5Enabled ? 'Publishing Armed' : 'Publishing Controlled'}
          </ProductStatus>
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ExecutiveKpiCard
              label="Campaigns"
              value={displayCampaignCount}
              detail={selected ? `Active: ${campaignName(selected)}` : 'Create or select a campaign'}
              tone={displayCampaignCount ? 'info' : 'warn'}
              series={[displayCampaignCount, drafts.length, displayPendingApprovals, displayPackageCount, leads.length]}
              secondary="in progress"
            />
            <ExecutiveKpiCard
              label="Awaiting review"
              value={displayPendingApprovals}
              detail={`${displayApprovedApprovals} approved`}
              tone={displayPendingApprovals ? 'warn' : 'good'}
              series={[approvals.length, displayPendingApprovals, displayApprovedApprovals]}
              secondary="pending decisions"
            />
            <ExecutiveKpiCard
              label="Content packages"
              value={displayPackageCount}
              detail={
                connectedChannelCount
                  ? `${connectedChannelCount} channel(s) connected`
                  : 'Connect a scheduling channel'
              }
              tone={displayPackageCount && connectedChannelCount ? 'good' : 'warn'}
              series={[drafts.length, displayApprovedApprovals, displayPackageCount, connectedChannelCount]}
              secondary="after review"
            />
            <ExecutiveKpiCard
              label="Customer interest"
              value={displayQualifiedLeads}
              detail={`${displayCapturedLeads} captured`}
              tone={displayQualifiedLeads ? 'good' : 'info'}
              series={[displayPackageCount, leads.length, displayQualifiedLeads]}
              secondary="qualified leads"
            />
          </div>
          <ExecutiveGauge
            value={workflowReadiness}
            label="Readiness"
            detail={
              !selected
                ? 'Choose a campaign.'
                : !providerReady
                  ? 'Connect AI model.'
                  : !drafts.length
                    ? 'Generate content.'
                    : !approval
                      ? 'Review and approve.'
                      : !packageResult
                        ? 'Prepare package.'
                        : 'Ready for next step.'
            }
          />
        </div>
        <div className="mt-4">
          <ExecutiveStatusGrid
            items={[
              {
                label: 'System',
                value: workflowState ? 'Ready' : 'Connecting...',
                tone: workflowState ? 'good' : 'warn',
                detail: workflowState
                  ? `${workflowStages.length || 6} workflow checks loaded${integrationConnectorCount ? `, ${integrationConnectorCount} integration checks active` : ''}.`
                  : 'Loading your workspace. This page will update automatically.',
              },
              {
                label: 'AI model',
                value: providerReady ? 'Connected' : 'Needs setup',
                tone: providerReady ? 'good' : 'warn',
                detail: providerReady
                  ? `${providerLabel}`
                  : 'Connect your AI model to generate content. Your key is stored securely.',
              },
              {
                label: 'Scheduling service',
                value: postizServerReachable ? 'Connected' : 'Not reachable',
                tone: postizServerReachable ? 'good' : 'warn',
                detail: postizApiConfigured
                  ? postizIntegrationIdStatus === 'configured'
                    ? 'Service is connected and a scheduling channel is selected.'
                    : 'Service is connected. Link a social channel next.'
                  : 'Add your scheduling service credentials to connect.',
              },
              {
                label: 'Social channels',
                value: connectedChannelCount ? `${connectedChannelCount} channel(s)` : 'None',
                tone: connectedChannelCount ? 'good' : 'warn',
                detail: 'Connect social accounts through your scheduling service.',
              },
            ]}
          />
        </div>
      </section>

      {/* ---- Quick Setup (only if needed) ---- */}
      {(!providerReady || !postizServerReachable || !connectedChannelCount) && (
        <ProductCard
          title="Quick Setup"
          subtitle="Complete these steps to unlock your full content workflow."
          action={
            <ProductStatus
              tone={
                !providerReady || !postizServerReachable || !connectedChannelCount
                  ? 'warn'
                  : 'good'
              }
            >
              {(!providerReady ? 1 : 0) +
                (!postizServerReachable ? 1 : 0) +
                (!connectedChannelCount ? 1 : 0)}{' '}
              remaining
            </ProductStatus>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {([
              {
                title: 'Connect your AI model' as string,
                meta: (providerReady
                  ? `${providerLabel}`
                  : 'Add your AI model key to enable content generation.') as string,
                status: (providerReady ? 'Connected' : 'Needs setup') as string,
                tone: (providerReady ? 'good' : 'warn') as 'good' | 'warn',
                to: '/ai-settings' as string,
              },
              {
                title: 'Link scheduling service' as string,
                meta: (postizServerReachable
                  ? 'Scheduling service is reachable.'
                  : 'Connect your scheduling service account.') as string,
                status: (postizServerReachable ? 'Connected' : 'Needs setup') as string,
                tone: (postizServerReachable ? 'good' : 'warn') as 'good' | 'warn',
                to: '/integration-credentials' as string,
              },
              {
                title: 'Connect a social channel' as string,
                meta: (connectedChannelCount
                  ? `${connectedChannelCount} channel(s) found.`
                  : 'Link your social accounts to schedule posts.') as string,
                status: (connectedChannelCount ? 'Connected' : 'Needs setup') as string,
                tone: (connectedChannelCount ? 'good' : 'warn') as 'good' | 'warn',
                to: '/integration-credentials' as string,
              },
              {
                title: 'Security controls' as string,
                meta: 'Publishing is protected. An admin controls when scheduling is enabled.' as string,
                status: 'Active' as string,
                tone: 'good' as 'good' | 'warn',
                to: '/safety' as string,
              },
            ] as const).map((task) => (
              <Link
                key={task.title}
                to={task.to}
                className="rounded-lg border border-neutral-200 bg-white p-4 transition hover:border-neutral-950 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold text-neutral-950">{task.title}</div>
                  <ProductStatus tone={task.tone}>{task.status}</ProductStatus>
                </div>
                <p className="mt-3 text-sm leading-6 text-neutral-500">{task.meta}</p>
              </Link>
            ))}
          </div>
        </ProductCard>
      )}

      {/* ---- Main Workflow Section ---- */}
      <ProductCard
        title={`Step ${stageNumber} of 6: Your Content Workflow`}
        subtitle={
          workflowStage === 'brief'
            ? 'Start by choosing an existing campaign or creating a new one.'
            : workflowStage === 'drafts'
              ? 'Generate platform-specific content from your campaign brief.'
              : workflowStage === 'score'
                ? 'Review content quality scores and recommendations.'
                : workflowStage === 'approval'
                  ? 'Send your reviewed content for approval, or make approval decisions.'
                  : workflowStage === 'publishing'
                    ? 'Prepare your approved content for scheduling.'
                    : 'Your content is ready. Review performance and next steps.'
        }
      >
        {/* ---- Campaign Selection (Stage 1) ---- */}
        {workflowStage === 'brief' && (
          <div className="animate-slide-up space-y-4">
            {!selected && (
              <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
                  Brief
                </div>
                <h3 className="mt-4 text-lg font-semibold text-neutral-950">
                  {campaigns.length ? 'Choose a campaign to continue' : 'Create your first campaign'}
                </h3>
                <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                  {campaigns.length
                    ? 'Select one of your existing campaigns below, or create a new one to get started.'
                    : 'Your campaign brief tells the AI what to write about: topic, audience, channels, and call to action.'}
                </p>
                <div className="mt-5 flex justify-center gap-3">
                  <Link
                    to="/ideas"
                    className="inline-flex min-h-10 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white"
                  >
                    Create Campaign
                  </Link>
                  {campaigns.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (campaigns[0]) chooseCampaign(campaigns[0]);
                      }}
                      className="inline-flex min-h-10 items-center justify-center rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-950"
                    >
                      Use Most Recent
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ---- Active Campaigns list ---- */}
            <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1">
              {visibleCampaigns.map((campaign) => (
                <button
                  key={String(campaign.id)}
                  type="button"
                  onClick={() => chooseCampaign(campaign)}
                  className={`w-full rounded-lg border p-4 text-left transition ${
                    selected?.id === campaign.id
                      ? 'border-neutral-950 bg-neutral-950 text-white'
                      : 'border-neutral-200 bg-white hover:bg-neutral-50'
                  }`}
                >
                  <div className="line-clamp-2 font-semibold">{campaignName(campaign)}</div>
                  <div
                    className={`mt-2 text-sm ${selected?.id === campaign.id ? 'text-white/60' : 'text-neutral-500'}`}
                  >
                    {campaignObjective(campaign)}
                  </div>
                  <div
                    className={`mt-2 text-xs ${selected?.id === campaign.id ? 'text-white/45' : 'text-neutral-400'}`}
                  >
                    {titleCase(text(campaign.status, 'draft'))} /{' '}
                    {titleCase(text(campaign.riskCategory, 'medium'))} priority
                  </div>
                </button>
              ))}
              {!visibleCampaigns.length && (
                <EmptyProductState message="No campaigns yet. Create one from the Content Creator page." />
              )}
            </div>

            {selected && (
              <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-neutral-950">
                      Campaign Selected: {campaignName(selected)}
                    </div>
                    <p className="mt-1 text-sm text-neutral-600">{campaignObjective(selected)}</p>
                  </div>
                  <PrimaryAction
                    onClick={generateDrafts}
                    disabled={!providerReady || loading === 'drafts'}
                  >
                    {loading === 'drafts'
                      ? 'Generating...'
                      : !providerReady
                        ? 'Connect AI Model First'
                        : 'Generate Content'}
                  </PrimaryAction>
                </div>
                {!providerReady && (
                  <p className="mt-3 text-sm text-amber-700">
                    Connect your AI model before generating content.{' '}
                    <Link to="/ai-settings" className="font-semibold underline">
                      Go to AI Settings
                    </Link>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ---- Draft Generation (Stage 2) ---- */}
        {workflowStage === 'drafts' && (
          <div className="animate-slide-up space-y-4">
            <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
                ✍️
              </div>
              <h3 className="mt-4 text-lg font-semibold text-neutral-950">
                {providerReady
                  ? 'Generate content for your campaign'
                  : 'Connect your AI model first'}
              </h3>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                {providerReady
                  ? `The AI will create LinkedIn, Instagram, and X/Twitter drafts based on "${campaignName(selected!)}". You can edit any draft before reviewing.`
                  : 'You need a connected AI model to generate content. Your key is encrypted and never shared.'}
              </p>
              <div className="mt-5 flex justify-center">
                {!providerReady ? (
                  <Link
                    to="/ai-settings"
                    className="inline-flex min-h-10 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white"
                  >
                    Connect AI Model
                  </Link>
                ) : (
                  <PrimaryAction onClick={generateDrafts} disabled={loading === 'drafts'}>
                    {loading === 'drafts' ? 'Writing your content...' : 'Generate Content'}
                  </PrimaryAction>
                )}
              </div>
            </div>

            {/* Show campaign brief context */}
            {selected && (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="font-medium text-neutral-950">Campaign:</span>
                  <span className="text-neutral-700">{campaignName(selected)}</span>
                  <span className="text-neutral-300">|</span>
                  <span className="text-neutral-700">
                    Audience: {text(selected?.audience, 'General')}
                  </span>
                  <span className="text-neutral-300">|</span>
                  <span className="text-neutral-700">LinkedIn, Instagram, X/Twitter</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---- Draft Editing & Scoring (Stages 2-3 transition) ---- */}
        {drafts.length > 0 && (workflowStage === 'drafts' || workflowStage === 'score') && (
          <div className="animate-slide-up mt-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-neutral-700">
                {drafts.length} platform draft(s) generated. Edit any draft below, then review quality.
              </div>
              <SecondaryAction onClick={generateDrafts} disabled={loading === 'drafts'}>
                {loading === 'drafts' ? 'Regenerating...' : 'Regenerate'}
              </SecondaryAction>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {drafts.map((draft) => {
                const draftId = String(draft.contentItemId);
                const selectedCard = selectedDraft?.contentItemId === draft.contentItemId;
                return (
                  <article
                    key={draftId}
                    className={`rounded-lg border p-4 ${selectedCard ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white'}`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold">{titleCase(text(draft.platform))}</div>
                      <button
                        type="button"
                        onClick={() => setSelectedDraftId(draftId)}
                        className="focus:outline-none"
                      >
                        <PlatformPill active={selectedCard}>
                          {selectedCard ? 'Selected' : 'Select'}
                        </PlatformPill>
                      </button>
                    </div>
                    <textarea
                      value={draftTextById[draftId] || text(draft.draftText)}
                      onChange={(event) =>
                        setDraftTextById((current) => ({ ...current, [draftId]: event.target.value }))
                      }
                      className={`min-h-[140px] w-full resize-y rounded-md border p-3 text-sm leading-6 outline-none ${
                        selectedCard
                          ? 'border-white/15 bg-white/10 text-white placeholder:text-white/30'
                          : 'border-neutral-200 bg-neutral-50 text-neutral-950'
                      }`}
                    />
                    <div className="mt-2 text-right text-xs text-neutral-400">
                      {(draftTextById[draftId] || text(draft.draftText)).length} characters
                    </div>
                  </article>
                );
              })}
            </div>

            {workflowStage === 'score' && !score && (
              <div className="flex justify-end">
                <PrimaryAction onClick={scoreDraft} disabled={!selectedDraft || loading === 'score'}>
                  {loading === 'score' ? 'Analyzing quality...' : 'Review Content Quality'}
                </PrimaryAction>
              </div>
            )}
          </div>
        )}

        {/* ---- Score Results & Approval (Stages 3-4) ---- */}
        {score && (workflowStage === 'score' || workflowStage === 'approval') && (
          <div className="animate-slide-up mt-4 space-y-4">
            <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 p-6">
                <ScoreRing
                  value={totalScore}
                  label="Content Quality"
                  detail="Higher scores mean better readiness for publishing."
                />
              </div>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
                <div className="text-sm font-semibold text-neutral-950">Quality Breakdown</div>
                <div className="mt-4">
                  <ProgressBar value={totalScore} />
                </div>
                <div className="mt-4">
                  <DetailGrid
                    items={[
                      { label: 'Best platform', value: titleCase(text(selectedDraft?.platform, 'LinkedIn')) },
                      { label: 'Data sources', value: numberValue(analytics?.sourceCount) ? 'Connected' : 'None connected' },
                      { label: 'Opening strength', value: text((components.hook as RecordMap)?.explanation, 'Checked') },
                      { label: 'Call to action', value: text((components.cta as RecordMap)?.explanation, 'Checked') },
                      { label: 'Hashtag strategy', value: text((components.hashtag as RecordMap)?.explanation, 'Checked') },
                      { label: 'Risk notes', value: text((components.risk as RecordMap)?.explanation, 'No issues found') },
                    ]}
                  />
                </div>
              </div>
            </div>

            {!approval && (
              <div className="flex justify-end">
                <PrimaryAction onClick={submitApproval} disabled={!selectedDraft || loading === 'approval'}>
                  {loading === 'approval' ? 'Sending for review...' : 'Send for Review'}
                </PrimaryAction>
              </div>
            )}
          </div>
        )}

        {/* ---- Approval Decision (Stage 4) ---- */}
        {approval && (workflowStage === 'approval' || workflowStage === 'publishing') && (
          <div className="animate-slide-up mt-4 space-y-4">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Content for review
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-neutral-950">
                    {selectedDraft
                      ? `${titleCase(text(selectedDraft.platform, 'platform'))} draft`
                      : 'No draft selected'}
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ProductStatus tone={score ? 'good' : 'default'}>
                    {score ? `${totalScore}/100 quality` : 'Not scored'}
                  </ProductStatus>
                  <ProductStatus
                    tone={
                      text(selected?.riskCategory, 'medium').toLowerCase() === 'high' ? 'warn' : 'info'
                    }
                  >
                    {titleCase(text(selected?.riskCategory, 'medium'))} priority
                  </ProductStatus>
                </div>
              </div>
              <p className="mt-3 line-clamp-5 text-sm leading-6 text-neutral-700">
                {selectedDraft
                  ? draftTextById[String(selectedDraft.contentItemId)] || text(selectedDraft.draftText)
                  : 'Generate and select a draft before submitting for review.'}
              </p>
            </div>

            <ReadableQueue
              items={[
                {
                  title: 'Review status',
                  meta:
                    text(approval.approvalStatus) === 'approved'
                      ? 'Content has been approved and is ready for scheduling.'
                      : text(approval.approvalStatus) === 'pending'
                        ? 'Waiting for review decision.'
                        : text(approval.approvalStatus) === 'rejected'
                          ? 'Content was rejected. Revise and resubmit.'
                          : 'Changes were requested. Please update the content.',
                  status: titleCase(text(approval.approvalStatus, 'pending')),
                  tone:
                    text(approval.approvalStatus) === 'approved'
                      ? 'good'
                      : text(approval.approvalStatus) === 'pending'
                        ? 'warn'
                        : 'danger',
                },
                {
                  title: 'Publishing package',
                  meta: packageResult
                    ? 'Package is ready for scheduling.'
                    : 'Package preparation is available after approval.',
                  status: packageResult ? 'Ready' : 'Waiting',
                  tone: packageResult ? 'good' : 'default',
                },
              ]}
            />

            {text(approval.approvalStatus) === 'pending' && (
              <div className="flex flex-wrap gap-2">
                <PrimaryAction onClick={() => decideApproval('approve')} disabled={!!loading}>
                  Approve
                </PrimaryAction>
                <SecondaryAction onClick={() => decideApproval('requestChanges')} disabled={!!loading}>
                  Request Changes
                </SecondaryAction>
                <SecondaryAction onClick={() => decideApproval('reject')} disabled={!!loading}>
                  Reject
                </SecondaryAction>
              </div>
            )}

            {text(approval.approvalStatus) === 'approved' && !packageResult && (
              <div className="flex justify-end">
                <PrimaryAction
                  onClick={createPackage}
                  disabled={loading === 'package'}
                >
                  {loading === 'package' ? 'Preparing...' : 'Prepare for Scheduling'}
                </PrimaryAction>
              </div>
            )}
          </div>
        )}

        {/* ---- Publishing Package (Stage 5) ---- */}
        {packageResult && (workflowStage === 'publishing' || workflowStage === 'handoff') && (
          <div className="animate-slide-up mt-4 space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-xl">
                  Done
                </div>
                <div>
                  <div className="font-semibold text-emerald-900">Content ready for scheduling</div>
                  <p className="mt-1 text-sm text-emerald-700">
                    {platformPayloads.length || 3} platform version(s) prepared. Your content package is complete.
                  </p>
                </div>
              </div>
            </div>

            <ReadableQueue
              items={[
                {
                  title: 'Scheduling service',
                  meta: postizServerReachable
                    ? 'Connected and ready.'
                    : 'Scheduling service needs to be configured.',
                  status: postizServerReachable ? 'Connected' : 'Needs setup',
                  tone: postizServerReachable ? 'good' : 'warn',
                },
                {
                  title: 'Social channel',
                  meta: connectedChannelCount
                    ? `${connectedChannelCount} channel(s) connected.`
                    : 'Connect your social accounts through the scheduling service.',
                  status: connectedChannelCount ? 'Ready' : 'Needs setup',
                  tone: connectedChannelCount ? 'good' : 'warn',
                },
                {
                  title: 'Customer interest',
                  meta: leads.length
                    ? `${leads.length} potential lead(s) captured.`
                    : 'Lead data appears after your content is live.',
                  status: leads.length ? 'Available' : 'Waiting for data',
                  tone: leads.length ? 'info' : 'default',
                },
              ]}
            />

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              Scheduling is controlled. An admin must enable scheduling for this workspace before content can be published.
            </div>
          </div>
        )}
      </ProductCard>

      {/* ---- Campaign Timeline ---- */}
      <ProductCard
        title="Content Journey"
        subtitle="Your campaign moves through these stages. The current step is highlighted."
      >
        <div className="space-y-3">
          {[
            { step: 1, label: 'Campaign', desc: 'Choose or create a campaign brief', done: !!selected, active: workflowStage === 'brief' },
            { step: 2, label: 'Generate', desc: 'AI creates platform-specific drafts', done: drafts.length > 0, active: workflowStage === 'drafts' },
            { step: 3, label: 'Review', desc: 'Check content quality and recommendations', done: !!score, active: workflowStage === 'score' },
            { step: 4, label: 'Approve', desc: 'Review and approve the content', done: text(approval?.approvalStatus) === 'approved', active: workflowStage === 'approval' },
            { step: 5, label: 'Package', desc: 'Prepare content for scheduling', done: !!packageResult, active: workflowStage === 'publishing' },
            { step: 6, label: 'Results', desc: 'Track performance and customer interest', done: leads.length > 0 || numberValue(analytics?.reportCount) > 0, active: workflowStage === 'handoff' },
          ].map((s) => (
            <div
              key={s.step}
              className={`flex items-center gap-4 rounded-lg border p-4 transition ${
                s.active
                  ? 'border-neutral-950 bg-neutral-950 text-white'
                  : s.done
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-neutral-200 bg-white'
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  s.active
                    ? 'bg-white text-neutral-950'
                    : s.done
                      ? 'bg-emerald-500 text-white'
                      : 'bg-neutral-100 text-neutral-400'
                }`}
              >
                {s.done ? 'Done' : s.step}
              </div>
              <div className="min-w-0">
                <div className={`font-semibold ${s.active ? 'text-white' : 'text-neutral-950'}`}>
                  {s.label}
                </div>
                <div
                  className={`text-sm ${s.active ? 'text-white/65' : s.done ? 'text-emerald-700' : 'text-neutral-500'}`}
                >
                  {s.desc}
                </div>
              </div>
              {s.active && (
                <div className="ml-auto shrink-0">
                  <ProductStatus tone="muted">Current step</ProductStatus>
                </div>
              )}
            </div>
          ))}
        </div>
      </ProductCard>

      {/* ---- Detailed Analytics (Collapsible) ---- */}
      <ProductCard
        title="Performance & Results"
        subtitle="Data from your connected sources and campaign activity."
        action={
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm font-medium text-neutral-950 underline"
          >
            {showDetails ? 'Hide details' : 'Show details'}
          </button>
        }
      >
        {showDetails && (
          <div className="animate-slide-up space-y-6">
            <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)_360px]">
              <ScoreRing
                value={score ? totalScore : workflowReadiness}
                label={score ? 'Content quality' : 'Workspace readiness'}
                detail={
                  score
                    ? 'Based on your selected draft.'
                    : 'Based on campaign, model, content, review, and package status.'
                }
              />
              <ProductCard title="Performance Signals" subtitle="Only real connected sources are shown.">
                <BarList
                  items={[
                    {
                      label: 'Reach',
                      value: numberValue(analytics?.reach),
                      detail: numberValue(analytics?.reach).toLocaleString(),
                      tone: 'good',
                    },
                    {
                      label: 'Impressions',
                      value: numberValue(analytics?.impressions),
                      detail: numberValue(analytics?.impressions).toLocaleString(),
                      tone: 'info',
                    },
                    {
                      label: 'Customer interest',
                      value: numberValue(leadStats?.qualified),
                      detail: `${numberValue(leadStats?.qualified)} qualified`,
                      tone: numberValue(leadStats?.qualified) ? 'good' : 'default',
                    },
                  ]}
                />
              </ProductCard>
              <ProductCard title="Activity Funnel" subtitle="From campaign to customer interest.">
                <FunnelChart
                  stages={[
                    { label: 'Campaigns', value: displayCampaignCount, tone: displayCampaignCount ? 'info' : 'default' },
                    { label: 'Drafts', value: drafts.length || 0, tone: drafts.length ? 'good' : 'default' },
                    { label: 'Approvals', value: approval ? 1 : 0, tone: approval ? 'good' : 'default' },
                    { label: 'Packages', value: displayPackageCount, tone: displayPackageCount ? 'good' : 'default' },
                    { label: 'Leads', value: leads.length || 0, tone: leads.length ? 'good' : 'default' },
                  ]}
                />
              </ProductCard>
            </div>
          </div>
        )}
      </ProductCard>

      {/* ---- Notices ---- */}
      {notice && (
        <Notice tone={notice.includes('failed') ? 'danger' : 'good'}>{notice}</Notice>
      )}

      {!providerReady && !pageLoading && (
        <Notice tone="warn">
          Content generation needs a connected AI model.{' '}
          <Link to="/ai-settings" className="font-semibold underline">
            Connect your AI model
          </Link>
        </Notice>
      )}
    </ProductPage>
  );
}
