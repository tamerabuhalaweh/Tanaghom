export type WorkflowStageId =
  | 'brief'
  | 'draft'
  | 'optimize'
  | 'approval'
  | 'package'
  | 'postiz'
  | 'analytics'
  | 'leads'
  | 'evidence';

export type WorkflowStageState = 'done' | 'active' | 'waiting' | 'blocked';

export interface WorkflowCampaignFact {
  id: string;
  title: string;
  objective: string;
  status: string;
  riskCategory: string;
  platforms: string[];
}

export interface WorkflowProviderFact {
  ready: boolean;
  label: string;
  provider: string;
  credentialStatus: 'configured' | 'missing' | 'disabled';
}

export interface WorkflowPostizFact {
  serverReachable: boolean;
  credentialStatus: 'configured' | 'missing';
  integrationIdStatus: 'configured' | 'missing';
  connectedChannelCount: number;
}

export interface WorkflowSafetyFact {
  externalExecutionEnabled: boolean;
  m5WriteExecutionEnabled: boolean;
  demoMode: boolean;
}

export interface WorkflowCountsFact {
  activeCampaigns: number;
  generatedDrafts: number;
  scoredDrafts: number;
  pendingApprovals: number;
  approvedApprovals: number;
  publishingPackages: number;
  analyticsReports: number;
  capturedLeads: number;
  qualifiedLeads: number;
}

export interface WorkflowCurrentFact {
  draftCount: number;
  scoredDraftCount: number;
  latestApprovalStatus: string | null;
  packageReady: boolean;
  analyticsReports: number;
  leadCount: number;
}

export interface CommercialWorkflowFacts {
  generatedAt: string;
  campaign: WorkflowCampaignFact | null;
  provider: WorkflowProviderFact;
  postiz: WorkflowPostizFact;
  safety: WorkflowSafetyFact;
  counts: WorkflowCountsFact;
  current: WorkflowCurrentFact;
}

export interface CommercialWorkflowStage {
  id: WorkflowStageId;
  label: string;
  state: WorkflowStageState;
  summary: string;
  blockingReason?: string;
  evidenceCount: number;
}

export interface CommercialWorkflowState {
  sourceOfTruth: 'STITCH';
  generatedAt: string;
  mode: 'derived_from_backend_records';
  activeCampaign: WorkflowCampaignFact | null;
  counts: WorkflowCountsFact;
  readiness: {
    score: number;
    blockers: string[];
  };
  nextAction: {
    label: string;
    href: string;
    reason: string;
  };
  stages: CommercialWorkflowStage[];
  provider: WorkflowProviderFact;
  postiz: WorkflowPostizFact & {
    label: 'Sandbox Connected' | 'Sandbox Ready' | 'Requires Credentials' | 'Requires Channel';
  };
  safety: WorkflowSafetyFact & {
    externalWritesBlocked: boolean;
    m5Disabled: boolean;
  };
}

export function buildCommercialWorkflowState(facts: CommercialWorkflowFacts): CommercialWorkflowState {
  const campaignReady = Boolean(facts.campaign);
  const draftReady = facts.current.draftCount > 0;
  const scoredReady = facts.current.scoredDraftCount > 0;
  const approvalApproved = facts.current.latestApprovalStatus === 'approved';
  const approvalPending = facts.current.latestApprovalStatus === 'pending';
  const approvalNeedsWork = facts.current.latestApprovalStatus === 'changes_requested'
    || facts.current.latestApprovalStatus === 'rejected';
  const packageReady = facts.current.packageReady;
  const postizReady = facts.postiz.serverReachable
    && facts.postiz.credentialStatus === 'configured'
    && facts.postiz.integrationIdStatus === 'configured'
    && facts.postiz.connectedChannelCount > 0;

  const stages: CommercialWorkflowStage[] = [
    stage('brief', 'Campaign brief', campaignReady ? 'done' : 'active', campaignReady
      ? 'A campaign brief is selected for today\'s workflow.'
      : 'Create or select a campaign brief before AI drafting can start.', campaignReady ? 1 : 0),
    stage('draft', 'AI drafts', draftReady ? 'done' : campaignReady && facts.provider.ready ? 'active' : campaignReady ? 'blocked' : 'waiting', draftReady
      ? `${facts.current.draftCount} platform draft(s) exist for the active campaign.`
      : facts.provider.ready
        ? 'Generate LinkedIn, Instagram, and X drafts from the campaign brief.'
        : 'Connect a real user LLM provider before production-grade drafting.', facts.current.draftCount, facts.provider.ready ? undefined : 'LLM provider is not ready.'),
    stage('optimize', 'Optimize', scoredReady ? 'done' : draftReady ? 'active' : 'waiting', scoredReady
      ? `${facts.current.scoredDraftCount} draft(s) have readiness scores.`
      : draftReady
        ? 'Score the selected generated draft for reach, CTA, hashtag, and risk readiness.'
        : 'Drafts must exist before optimization can run.', facts.current.scoredDraftCount),
    stage('approval', 'Human approval', approvalApproved ? 'done' : approvalNeedsWork ? 'blocked' : approvalPending ? 'active' : scoredReady ? 'active' : 'waiting', approvalApproved
      ? 'A human approved the selected draft.'
      : approvalPending
        ? 'The selected draft is waiting for a human decision.'
        : approvalNeedsWork
          ? 'The reviewer requested changes or rejected the draft.'
          : 'Send the scored draft to the approval queue.', approvalPending || approvalApproved || approvalNeedsWork ? 1 : 0, approvalNeedsWork ? 'Reviewer decision requires a revision before packaging.' : undefined),
    stage('package', 'Publishing package', packageReady ? 'done' : approvalApproved ? 'active' : 'waiting', packageReady
      ? 'A Postiz-ready publishing package exists for the approved draft.'
      : approvalApproved
        ? 'Create the publishing package from the approved draft.'
        : 'Human approval is required before package creation.', packageReady ? 1 : 0),
    stage('postiz', 'Postiz sandbox', postizReady ? 'done' : packageReady ? 'blocked' : 'waiting', postizReady
      ? 'Postiz has a reachable sandbox, saved API key, selected channel, and visible channel record.'
      : packageReady
        ? 'Postiz package exists, but sandbox channel setup is incomplete.'
        : 'Postiz becomes relevant after a publishing package exists.', facts.postiz.connectedChannelCount, postizReady ? undefined : postizBlockingReason(facts.postiz)),
    stage('analytics', 'Analytics', facts.current.analyticsReports > 0 ? 'done' : packageReady ? 'active' : 'waiting', facts.current.analyticsReports > 0
      ? `${facts.current.analyticsReports} performance report(s) exist.`
      : packageReady
        ? 'Connect official analytics sources or add performance evidence after scheduling.'
        : 'Analytics evidence follows package/scheduling activity.', facts.current.analyticsReports),
    stage('leads', 'Lead handoff', facts.current.leadCount > 0 ? 'done' : packageReady ? 'active' : 'waiting', facts.current.leadCount > 0
      ? `${facts.current.leadCount} lead record(s) are captured for CRM review.`
      : packageReady
        ? 'Capture or import lead records, then prepare CRM/voice handoff.'
        : 'Lead handoff follows campaign activity and package evidence.', facts.current.leadCount),
    stage('evidence', 'Evidence', evidenceCount(facts) > 0 ? 'done' : campaignReady ? 'active' : 'waiting', evidenceCount(facts) > 0
      ? 'Workflow evidence exists across drafts, approvals, packages, analytics, or leads.'
      : 'Evidence appears as the campaign moves through the workflow.', evidenceCount(facts)),
  ];

  const blockers = collectBlockers(facts, postizReady);
  return {
    sourceOfTruth: 'STITCH',
    generatedAt: facts.generatedAt,
    mode: 'derived_from_backend_records',
    activeCampaign: facts.campaign,
    counts: facts.counts,
    readiness: {
      score: readinessScore(stages),
      blockers,
    },
    nextAction: nextAction(stages, facts),
    stages,
    provider: facts.provider,
    postiz: {
      ...facts.postiz,
      label: postizLabel(facts.postiz),
    },
    safety: {
      ...facts.safety,
      externalWritesBlocked: !facts.safety.externalExecutionEnabled,
      m5Disabled: !facts.safety.m5WriteExecutionEnabled,
    },
  };
}

function stage(
  id: WorkflowStageId,
  label: string,
  state: WorkflowStageState,
  summary: string,
  evidenceCount: number,
  blockingReason?: string,
): CommercialWorkflowStage {
  return { id, label, state, summary, evidenceCount, blockingReason };
}

function readinessScore(stages: CommercialWorkflowStage[]): number {
  const total = stages.length * 2;
  const value = stages.reduce((sum, item) => {
    if (item.state === 'done') return sum + 2;
    if (item.state === 'active') return sum + 1;
    return sum;
  }, 0);
  return Math.round((value / total) * 100);
}

function nextAction(stages: CommercialWorkflowStage[], facts: CommercialWorkflowFacts) {
  const blocked = stages.find(item => item.state === 'blocked');
  if (blocked) {
    return {
      label: blocked.id === 'draft' ? 'Connect AI provider' : `Resolve ${blocked.label}`,
      href: blocked.id === 'draft' ? '/ai-settings' : blocked.id === 'postiz' ? '/integration-credentials' : '/approvals',
      reason: blocked.blockingReason || blocked.summary,
    };
  }

  const active = stages.find(item => item.state === 'active');
  if (!active) {
    return {
      label: 'Review commercial results',
      href: '/analytics-leads',
      reason: 'All visible workflow stages are complete for the currently configured scope.',
    };
  }

  const hrefByStage: Record<WorkflowStageId, string> = {
    brief: '/ideas',
    draft: '/command-center',
    optimize: '/command-center',
    approval: '/approvals',
    package: '/publishing',
    postiz: '/integration-credentials',
    analytics: '/analytics',
    leads: '/analytics',
    evidence: '/observability',
  };

  return {
    label: active.id === 'brief' && !facts.campaign ? 'Create or select campaign' : active.label,
    href: hrefByStage[active.id],
    reason: active.summary,
  };
}

function collectBlockers(facts: CommercialWorkflowFacts, postizReady: boolean): string[] {
  const blockers: string[] = [];
  if (facts.campaign && !facts.provider.ready) blockers.push('Real LLM provider is not configured for this user.');
  if (facts.current.packageReady && !postizReady) blockers.push(postizBlockingReason(facts.postiz));
  if (!facts.safety.externalExecutionEnabled) blockers.push('External execution kill switch is disabled.');
  if (!facts.safety.m5WriteExecutionEnabled) blockers.push('M5 write execution is disabled.');
  return blockers;
}

function postizBlockingReason(postiz: WorkflowPostizFact): string {
  if (!postiz.serverReachable) return 'Postiz sandbox server is not reachable.';
  if (postiz.credentialStatus !== 'configured') return 'Postiz API key is missing.';
  if (postiz.connectedChannelCount === 0) return 'No Postiz social channel is visible.';
  if (postiz.integrationIdStatus !== 'configured') return 'No Postiz channel is selected for scheduling.';
  return 'Postiz sandbox scheduling is still gated by policy.';
}

function postizLabel(postiz: WorkflowPostizFact): CommercialWorkflowState['postiz']['label'] {
  if (!postiz.serverReachable) return postiz.credentialStatus === 'configured' ? 'Sandbox Ready' : 'Requires Credentials';
  if (postiz.credentialStatus !== 'configured') return 'Requires Credentials';
  if (postiz.connectedChannelCount === 0 || postiz.integrationIdStatus !== 'configured') return 'Requires Channel';
  return 'Sandbox Connected';
}

function evidenceCount(facts: CommercialWorkflowFacts): number {
  return facts.current.draftCount
    + facts.current.scoredDraftCount
    + (facts.current.latestApprovalStatus ? 1 : 0)
    + (facts.current.packageReady ? 1 : 0)
    + facts.current.analyticsReports
    + facts.current.leadCount;
}
