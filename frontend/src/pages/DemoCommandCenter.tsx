import { useEffect, useMemo, useState } from 'react';
import {
  aiGenerationApi,
  aiProviderApi,
  algoApi,
  analyticsApi,
  approvalsApi,
  campaignsApi,
  demoApi,
  publishingPackageApi,
} from '../api';
import { Badge, FlowTimeline, ReadinessGauge, RecommendationCard, SafetyGateCard } from '../components/ExecutiveUI';
import { useAuth } from '../contexts/useAuth';

type RecordMap = Record<string, unknown>;
type Step = 'campaign' | 'drafts' | 'score' | 'approval' | 'package' | 'intelligence' | 'evidence';

const PLATFORMS = ['linkedin', 'instagram', 'x'];

const FALLBACK_LEADS = [
  { name: 'Lead A', source: 'LinkedIn demo campaign', intent: 'Product interest', score: 82, status: 'qualified package' },
  { name: 'Lead B', source: 'Instagram demo campaign', intent: 'Follow-up request', score: 74, status: 'nurture package' },
];

function text(value: unknown, fallback = 'Not specified'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function list(value: unknown): RecordMap[] {
  return Array.isArray(value) ? (value as RecordMap[]) : [];
}

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function scoreComponent(score: RecordMap | null, component: string): RecordMap | undefined {
  return list(score?.components).find(item => item.component === component);
}

function statusForStep(step: Step, current: Step, completed: Set<Step>): 'done' | 'active' | 'pending' | 'blocked' {
  if (current === step) return 'active';
  if (completed.has(step)) return 'done';
  return 'pending';
}

export default function DemoCommandCenter() {
  const { token } = useAuth();
  const [campaigns, setCampaigns] = useState<RecordMap[]>([]);
  const [selected, setSelected] = useState<RecordMap | null>(null);
  const [drafts, setDrafts] = useState<RecordMap[]>([]);
  const [draftTextById, setDraftTextById] = useState<Record<string, string>>({});
  const [selectedDraftId, setSelectedDraftId] = useState<string>('');
  const [score, setScore] = useState<RecordMap | null>(null);
  const [approval, setApproval] = useState<RecordMap | null>(null);
  const [packageResult, setPackageResult] = useState<RecordMap | null>(null);
  const [handoffPackage, setHandoffPackage] = useState<RecordMap | null>(null);
  const [analytics, setAnalytics] = useState<RecordMap | null>(null);
  const [demoStatus, setDemoStatus] = useState<RecordMap | null>(null);
  const [aiProvider, setAiProvider] = useState<RecordMap | null>(null);
  const [loading, setLoading] = useState('');
  const [notice, setNotice] = useState('');
  const [step, setStep] = useState<Step>('campaign');

  const selectedDraft = useMemo(
    () => drafts.find(draft => String(draft.contentItemId) === selectedDraftId) || drafts[0] || null,
    [drafts, selectedDraftId],
  );

  const completed = useMemo(() => new Set<Step>([
    ...(selected ? ['campaign' as Step] : []),
    ...(drafts.length ? ['drafts' as Step] : []),
    ...(score ? ['score' as Step] : []),
    ...(approval ? ['approval' as Step] : []),
    ...(packageResult ? ['package' as Step] : []),
    ...(analytics ? ['intelligence' as Step] : []),
  ]), [analytics, approval, drafts.length, packageResult, score, selected]);

  useEffect(() => {
    if (!token) return;
    void refreshOverview();
    campaignsApi.list(token)
      .then(data => {
        const campaignList = data as RecordMap[];
        setCampaigns(campaignList);
        setSelected(current => current || campaignList[0] || null);
      })
      .catch(error => setNotice(`Campaign load failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
    analyticsApi.demo(token).then(data => setAnalytics(data as RecordMap)).catch(() => undefined);
    aiProviderApi.active(token).then(data => setAiProvider(data as RecordMap)).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function refreshOverview() {
    if (!token) return;
    try {
      const status = await demoApi.status(token);
      setDemoStatus(status as RecordMap);
    } catch {
      setDemoStatus(null);
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
    setHandoffPackage(null);
    setNotice('Campaign selected. Ready for AI preparation.');
    setStep('drafts');
  }

  async function generateDrafts() {
    if (!token || !selected) return;
    setLoading('drafts');
    setNotice('');
    try {
      const result = await aiGenerationApi.generate({
        campaignRequestId: selected.id,
        platforms: PLATFORMS,
        tone: 'professional',
      }, token);
      const generated = Array.isArray(result) ? (result as RecordMap[]) : [result as RecordMap];
      const draftTextMap = Object.fromEntries(generated.map(draft => [String(draft.contentItemId), text(draft.draftText, '')]));
      setDrafts(generated);
      setDraftTextById(draftTextMap);
      setSelectedDraftId(String(generated[0]?.contentItemId || ''));
      setScore(null);
      setApproval(null);
      setPackageResult(null);
      setHandoffPackage(null);
      setStep('score');
      setNotice('Drafts generated through the STITCH backend LLM adapter for LinkedIn, Instagram, and X.');
      void refreshOverview();
    } catch (error) {
      setNotice(`Draft generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function scoreDraft() {
    if (!token || !selected || !selectedDraft) return;
    setLoading('score');
    setNotice('');
    try {
      const metadata = (selectedDraft.metadata || {}) as RecordMap;
      const cta = text(metadata.cta || selected.cta, '');
      const activeDraftText = draftTextById[String(selectedDraft.contentItemId)] || text(selectedDraft.draftText);
      const result = await algoApi.score({
        contentItemId: selectedDraft.contentItemId,
        platform: selectedDraft.platform,
        draftText: activeDraftText,
        objective: selected.objective,
        audience: selected.audience,
        ...(cta ? { cta } : {}),
        hashtags: metadata.hashtags || [],
        contentType: selectedDraft.contentType,
        riskCategory: selected.riskCategory,
      }, token);
      setScore(result as RecordMap);
      setStep('approval');
      setNotice('The selected draft was scored using deterministic reach/readiness intelligence.');
      void refreshOverview();
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
        requiredDepartment: 'Brand & Market Intelligence',
        requiredRole: 'department_head',
        comment: 'CEO demo: human approval required before any publishing preparation.',
      }, token);
      setApproval(result as RecordMap);
      setNotice('Submitted to human approval. External execution remains blocked.');
      void refreshOverview();
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
        ? 'Approved for publishing package preparation only. No live scheduling.'
        : action === 'reject'
          ? 'Rejected in demo review.'
          : 'Request changes before package preparation.';
      const result = action === 'approve'
        ? await approvalsApi.approve(approvalId, { comment }, token)
        : action === 'reject'
          ? await approvalsApi.reject(approvalId, { comment }, token)
          : await approvalsApi.requestChanges(approvalId, { comment }, token);
      setApproval(result as RecordMap);
      setStep(action === 'approve' ? 'package' : 'approval');
      setNotice(action === 'approve' ? 'Human approval recorded. Publishing package can now be prepared.' : 'Human decision recorded in audit evidence.');
      void refreshOverview();
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
        platforms: PLATFORMS,
        scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, token);
      const pkg = result as RecordMap;
      setPackageResult(pkg);
      const handoff = await demoApi.handoffPackage({
        campaignId: selected.id,
        campaignTopic: selected.topic,
        platform: selectedDraft?.platform,
        publishingPackageId: pkg.id,
        qualificationScore: 82,
        consentStatus: 'pending',
      }, token);
      setHandoffPackage(handoff as RecordMap);
      setStep('intelligence');
      setNotice('Publishing package prepared. Postiz sandbox status checked. Scheduling and publishing are blocked.');
      void refreshOverview();
    } catch (error) {
      setNotice(`Publishing package failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  const totalScore = numberValue(score?.totalScore);
  const components = {
    hook: scoreComponent(score, 'hookStrength'),
    cta: scoreComponent(score, 'ctaClarity'),
    hashtag: scoreComponent(score, 'hashtagHygiene'),
    risk: scoreComponent(score, 'complianceRisk'),
    format: scoreComponent(score, 'formatFit'),
  };
  const postiz = ((demoStatus?.integrations as RecordMap | undefined)?.postiz || packageResult?.postizSandbox || {}) as RecordMap;
  const providerType = text(aiProvider?.type, 'mock');
  const providerName = text(aiProvider?.name, providerType === 'mock' ? 'Mock LLM' : 'Live AI Provider');
  const providerLabel = providerType === 'mock' ? 'Mock Provider Active' : 'Live AI Provider Active';
  const providerBadge = providerType === 'mock' ? 'mock' : 'success';
  const packagePlatforms = list(packageResult?.platforms);
  const auditTrail = list(demoStatus?.auditTrail).slice(0, 5);
  const events = list(demoStatus?.observability).slice(0, 5);
  const leads = list(demoStatus?.leadCaptures);
  const ghl = (handoffPackage?.goHighLevel || {}) as RecordMap;
  const voiceChat = (handoffPackage?.voiceChat || {}) as RecordMap;
  const leadQualification = (handoffPackage?.leadQualification || {}) as RecordMap;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-sky-500/20 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.25),transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge variant="success">Working Commercial/Social model</Badge>
              <Badge variant="info">Human Approval Required</Badge>
              <Badge variant="blocked">External Execution Blocked</Badge>
              <Badge variant="blocked">M5 Disabled</Badge>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">AI prepares. Human approves. System records.</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              This customer demo shows the marketing operating flow: content generation, platform adaptation, readiness scoring,
              approval, Postiz package preparation, analytics intelligence, lead handoff preparation, and readable evidence.
            </p>
          </div>
          <div className="grid min-w-[360px] grid-cols-2 gap-2">
            <StatusPill label="Postiz" value={postiz.reachable ? 'Sandbox Ready' : 'Preparation Ready'} variant={postiz.reachable ? 'info' : 'warning'} />
            <StatusPill label="AI Provider" value={providerLabel} variant={providerBadge} />
            <StatusPill label="GHL" value="Package Only" variant="default" />
            <StatusPill label="Publishing" value="Blocked" variant="blocked" />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <FlowTimeline steps={[
          { label: 'Campaign', status: statusForStep('campaign', step, completed) },
          { label: 'Drafts', status: statusForStep('drafts', step, completed), badge: '3 platforms' },
          { label: 'Score', status: statusForStep('score', step, completed), badge: 'actual draft' },
          { label: 'Approve', status: statusForStep('approval', step, completed), badge: 'human' },
          { label: 'Package', status: statusForStep('package', step, completed), badge: 'Postiz prep' },
          { label: 'Intelligence', status: statusForStep('intelligence', step, completed) },
          { label: 'Evidence', status: statusForStep('evidence', step, completed) },
          { label: 'External Action', status: 'blocked', badge: 'blocked' },
        ]} />
      </section>

      {notice && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${notice.includes('failed') ? 'border-rose-800 bg-rose-950/40 text-rose-300' : 'border-emerald-800 bg-emerald-950/30 text-emerald-300'}`}>
          {notice}
        </div>
      )}

      <div className="grid grid-cols-[340px_1fr] gap-5">
        <section className="space-y-3">
          <Panel title="1. Select Campaign" badge="Working">
            <div className="space-y-3">
              {campaigns.map(campaign => (
                <button
                  key={String(campaign.id)}
                  onClick={() => chooseCampaign(campaign)}
                  className={`w-full rounded-xl border p-4 text-left transition ${selected?.id === campaign.id ? 'border-sky-400 bg-sky-500/15' : 'border-slate-800 bg-slate-900/70 hover:border-slate-600'}`}
                >
                  <div className="text-sm font-semibold text-white">{text(campaign.topic)}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant={campaign.status === 'approved' ? 'success' : 'warning'}>{text(campaign.status, 'idea')}</Badge>
                    <Badge variant={campaign.riskCategory === 'high' ? 'danger' : campaign.riskCategory === 'medium' ? 'warning' : 'success'}>
                      {text(campaign.riskCategory, 'medium')} risk
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </Panel>

          <SafetyGateCard gates={[
            { label: 'Live publishing', status: 'blocked' },
            { label: 'Postiz scheduling', status: 'blocked' },
            { label: 'CRM writes', status: 'blocked' },
            { label: 'WhatsApp / voice trigger', status: 'blocked' },
            { label: 'Human approval', status: approval?.approvalStatus === 'approved' ? 'clear' : 'required' },
            { label: 'M5 write execution', status: 'blocked' },
          ]} />
        </section>

        <section className="space-y-5">
          <Panel title="Campaign Brief" badge={selected ? 'Backend Data' : 'Required'}>
            {selected ? (
              <div className="grid grid-cols-4 gap-3">
                <Info label="Objective" value={text(selected.objective)} />
                <Info label="Audience" value={text(selected.audience)} />
                <Info label="CTA" value={text(selected.cta, 'CTA prepared during draft generation')} />
                <Info label="Target Platforms" value={(selected.targetPlatforms as string[] | undefined)?.join(', ') || PLATFORMS.join(', ')} />
              </div>
            ) : (
              <EmptyState text="Select a campaign to begin the demo flow." />
            )}
          </Panel>

          <Panel
            title="2. AI Social Drafts"
            badge={drafts.length ? 'Working' : 'Action Required'}
            action={<ActionButton onClick={generateDrafts} disabled={!selected || loading === 'drafts'}>{loading === 'drafts' ? 'Generating...' : 'Generate AI Drafts'}</ActionButton>}
          >
            {drafts.length ? (
              <div className="grid grid-cols-3 gap-4">
                {drafts.map(draft => (
                  <div
                    key={String(draft.contentItemId)}
                    onClick={() => setSelectedDraftId(String(draft.contentItemId))}
                    className={`rounded-xl border bg-slate-900/70 p-4 text-left transition ${selectedDraft?.contentItemId === draft.contentItemId ? 'border-sky-400 ring-2 ring-sky-400/40' : 'border-slate-800'}`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <Badge variant="info">{titleCase(text(draft.platform))}</Badge>
                      <Badge variant={providerBadge}>{providerName}</Badge>
                    </div>
                    <textarea
                      value={draftTextById[String(draft.contentItemId)] || text(draft.draftText)}
                      onChange={event => setDraftTextById(current => ({ ...current, [String(draft.contentItemId)]: event.target.value }))}
                      className="min-h-[132px] w-full resize-y rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm leading-6 text-slate-200 outline-none focus:border-sky-500"
                    />
                    <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs leading-5 text-slate-400">
                      {text((draft.metadata as RecordMap | undefined)?.rationale, 'Adapted to platform rules and campaign audience.')}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="Generate platform-adapted drafts for LinkedIn, Instagram, and X/Twitter." />
            )}
          </Panel>

          <Panel
            title="3. Reach Readiness Intelligence"
            badge={score ? 'Working' : 'Action Required'}
            action={<ActionButton onClick={scoreDraft} disabled={!selectedDraft || loading === 'score'}>{loading === 'score' ? 'Scoring...' : 'Score Selected Draft'}</ActionButton>}
          >
            {score ? (
              <div className="grid grid-cols-[160px_1fr] gap-6">
                <ReadinessGauge value={totalScore} label={text(score.bandLabel, 'Readiness')} size={132} />
                <div className="grid grid-cols-3 gap-3">
                  <RecommendationCard title="Best Platform" value={titleCase(text(selectedDraft?.platform, 'linkedin'))} confidence={85} />
                  <RecommendationCard title="Best Posting Time" value={text(analytics?.bestTime, 'Tuesday 10:00 AM')} confidence={78} />
                  <RecommendationCard title="Best Format" value={text(selectedDraft?.contentType, 'post')} confidence={numberValue(components.format?.score, 80)} />
                  <RecommendationCard title="Hook Quality" value={text(components.hook?.explanation, 'Standard hook')} confidence={numberValue(components.hook?.score, 70)} />
                  <RecommendationCard title="CTA Strength" value={text(components.cta?.explanation, 'CTA clarity checked')} confidence={numberValue(components.cta?.score, 70)} />
                  <RecommendationCard title="Hashtag Hygiene" value={text(components.hashtag?.explanation, 'Hashtag count checked')} confidence={numberValue(components.hashtag?.score, 70)} />
                </div>
                <div className="col-span-2 grid grid-cols-2 gap-3">
                  <ReadableList title="Risk / Spam / Compliance Notes" items={[
                    text(components.risk?.explanation, 'Compliance risk checked'),
                    ...list(score.spamFlags).map(flag => `${text(flag.tactic)}: ${text(flag.suggestion)}`),
                    ...list(score.blockReasons).map(reason => `Block reason: ${text(reason)}`),
                  ]} />
                  <ReadableList title="Optimization Suggestions" items={list(score.optimizationSuggestions).slice(0, 4).map(item => text(item.suggestion))} />
                </div>
              </div>
            ) : (
              <EmptyState text="Score the actual selected draft to unlock readiness recommendations." />
            )}
          </Panel>

          <Panel
            title="4. Human Approval"
            badge={approval ? titleCase(text(approval.approvalStatus)) : 'Human Approval Required'}
            action={<ActionButton onClick={submitApproval} disabled={!selectedDraft || !!approval || loading === 'approval'}>{approval ? 'Approval Package Recorded' : loading === 'approval' ? 'Submitting...' : 'Submit for Approval'}</ActionButton>}
          >
            <div className="grid grid-cols-[1fr_auto] gap-4">
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                <div className="text-sm font-semibold text-white">Approval package</div>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  The approver reviews the selected draft, readiness score, risk notes, and intended platforms.
                  Publishing cannot proceed without this human decision.
                </p>
                {approval && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant={approval.approvalStatus === 'approved' ? 'success' : approval.approvalStatus === 'rejected' ? 'danger' : 'warning'}>
                      {titleCase(text(approval.approvalStatus))}
                    </Badge>
                    <Badge variant="info">Audit recorded by backend</Badge>
                  </div>
                )}
              </div>
              <div className="flex min-w-[330px] flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                <ActionButton onClick={() => decideApproval('approve')} disabled={!approval || approval.approvalStatus !== 'pending' || !!loading}>Approve</ActionButton>
                <button onClick={() => decideApproval('requestChanges')} disabled={!approval || approval.approvalStatus !== 'pending' || !!loading} className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-40">
                  Request Changes
                </button>
                <button onClick={() => decideApproval('reject')} disabled={!approval || approval.approvalStatus !== 'pending' || !!loading} className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-40">
                  Reject
                </button>
              </div>
            </div>
          </Panel>

          <Panel
            title="5. Publishing Preparation Package"
            badge={packageResult ? 'Sandbox Ready' : 'Blocked Until Approval'}
            action={<ActionButton onClick={createPackage} disabled={approval?.approvalStatus !== 'approved' || !!packageResult || loading === 'package'}>{packageResult ? 'Package Prepared' : loading === 'package' ? 'Preparing...' : 'Create Publishing Package'}</ActionButton>}
          >
            {packageResult ? (
              <div className="grid grid-cols-[1fr_320px] gap-4">
                <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                  <div className="text-sm font-semibold text-white">Prepared platform payloads</div>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {packagePlatforms.map(item => (
                      <div key={text(item.platform)} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                        <div className="text-xs font-semibold uppercase tracking-wider text-sky-300">{text(item.platform)}</div>
                        <p className="mt-2 line-clamp-4 text-xs leading-5 text-slate-400">{text(item.content)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <ReadableList
                      title="Prepared Postiz Payload"
                      items={list(packageResult.postizPreview).slice(0, 3).map(item => `${titleCase(text(item.platform))}: ${text(item.action, 'prepare_only')} for ${text(item.scheduledAt, 'sandbox review')}`)}
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-white">Postiz Sandbox</div>
                    <Badge variant={postiz.reachable ? 'info' : 'warning'}>{postiz.reachable ? 'Reachable' : 'Prep Only'}</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-300">{text((packageResult.postizSandbox as RecordMap | undefined)?.message, 'Package prepared for Postiz review. No scheduling is executed.')}</p>
                  <a href={text((packageResult.postizSandbox as RecordMap | undefined)?.url, 'https://postiz.163-123-180-104.sslip.io')} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500">
                    Open Postiz Sandbox
                  </a>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="blocked">No scheduling</Badge>
                    <Badge variant="blocked">No publishing</Badge>
                    <Badge variant="blocked">M5 disabled</Badge>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState text="Approve the draft, then create a publishing preparation package. Real scheduling remains blocked." />
            )}
          </Panel>

          <Panel title="6. Analytics, Learning, Leads, and Handoffs" badge="Demo Intelligence">
            <div className="grid grid-cols-4 gap-3">
              <Metric label="Reach" value={text(analytics?.reach, '8,900')} />
              <Metric label="Impressions" value={text(analytics?.impressions, '12,500')} />
              <Metric label="Engagement" value={text(analytics?.engagementRate, '3.56%')} />
              <Metric label="Best Time" value={text(analytics?.bestTime, 'Tuesday 10:00 AM')} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <ReadableList title="Learning Signal" items={[
                `${text(analytics?.topContent, 'Educational posts with images')} performed above baseline in demo intelligence.`,
                'Recommendation: keep educational format, strengthen CTA before approval.',
                'Learning evidence is review-only; it cannot auto-change strategy.',
              ]} />
              <ReadableList title="Lead Capture / Qualification" items={handoffPackage ? [
                `Lead reference: ${text(leadQualification.leadReference, 'sandbox-lead-reference')}`,
                `Intent: ${text(leadQualification.intent, 'Product interest')}`,
                `Qualification score: ${text(leadQualification.qualificationScore, '82')}`,
                `Consent status: ${text(leadQualification.consentStatus, 'pending')}`,
              ] : (leads.length ? leads : FALLBACK_LEADS).map(lead => {
                const item = lead as RecordMap;
                return `${text(item.name, 'Lead')}: ${text(item.intent, text(item.source))} - score ${text(item.score || item.qualificationScore, 'prepared')}`;
              })} />
              <ReadableList title="GHL + Voice/Chat Handoff" items={[
                `GHL status: ${text(ghl.status, 'Requires Credentials')} / ${text(ghl.executionState, 'Blocked')}`,
                `GHL contact payload: source=${text((ghl.contactPayload as RecordMap | undefined)?.source, titleCase(text(selectedDraft?.platform, 'social')))}, campaign=${text(((ghl.contactPayload as RecordMap | undefined)?.customFields as RecordMap | undefined)?.campaignTopic, text(selected?.topic, 'selected campaign'))}, qualificationScore=${text(((ghl.contactPayload as RecordMap | undefined)?.customFields as RecordMap | undefined)?.qualificationScore, '82')}.`,
                `GHL opportunity payload: pipeline=${text((ghl.opportunityPayload as RecordMap | undefined)?.pipeline, 'Commercial/Social POC')}, stage=${text((ghl.opportunityPayload as RecordMap | undefined)?.stage, 'Qualified Lead')}.`,
                `Voice/chat status: ${text(voiceChat.status, 'Requires Credentials')} / ${text(voiceChat.executionState, 'Blocked')}`,
                `Voice/chat handoff payload: ${text((voiceChat.payload as RecordMap | undefined)?.suggestedIntent, 'lead context and suggested script prepared')}.`,
                'WhatsApp package: template/context prepared only, no message sent.',
              ]} />
            </div>
          </Panel>

          <Panel title="7. Audit / SPINE / Observability Evidence" badge="Readable Evidence">
            <div className="grid grid-cols-2 gap-4">
              <ReadableList title="Recent Audit Records" items={(auditTrail.length ? auditTrail : [
                { action: 'draft_generated', result: 'success' },
                { action: 'approval_decided', result: 'success' },
                { action: 'publishing_package_created', result: 'success' },
              ]).map(item => `${text(item.action)} - ${text(item.result, 'recorded')}`)} />
              <ReadableList title="System Events" items={(events.length ? events : [
                { eventType: 'ai_generation', message: 'Draft generation recorded' },
                { eventType: 'algorithm_intelligence', message: 'Readiness score recorded' },
                { eventType: 'approval', message: 'Human decision required' },
              ]).map(item => `${text(item.eventType)} - ${text(item.message, 'evidence recorded')}`)} />
            </div>
          </Panel>
        </section>
      </div>
    </div>
  );
}

function Panel({ title, badge, action, children }: { title: string; badge?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/75 p-4 shadow-2xl shadow-slate-950/20">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">{title}</h2>
          {badge && <Badge variant={badge.includes('Blocked') ? 'blocked' : badge.includes('Required') ? 'warning' : badge.includes('Mock') ? 'mock' : 'info'}>{badge}</Badge>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ActionButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} className="rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40">
      {children}
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-200">{value}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
      <Badge variant="mock">Demo Data</Badge>
    </div>
  );
}

function StatusPill({ label, value, variant }: { label: string; value: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'mock' | 'blocked' | 'default' }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-2"><Badge variant={variant}>{value}</Badge></div>
    </div>
  );
}

function ReadableList({ title, items }: { title: string; items: string[] }) {
  const safeItems = items.filter(Boolean);
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</div>
      <div className="mt-3 space-y-2">
        {(safeItems.length ? safeItems : ['No evidence yet. Run the workflow to create it.']).map((item, index) => (
          <div key={`${item}-${index}`} className="flex gap-2 text-sm leading-5 text-slate-300">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ text: value }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-500">
      {value}
    </div>
  );
}
