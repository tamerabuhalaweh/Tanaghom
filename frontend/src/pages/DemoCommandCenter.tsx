import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { useAuth } from '../contexts/useAuth';
import {
  DetailGrid,
  EmptyProductState,
  BarList,
  FunnelChart,
  MetricCard,
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
  const [handoffPackage, setHandoffPackage] = useState<RecordMap | null>(null);
  const [analytics, setAnalytics] = useState<RecordMap | null>(null);
  const [status, setStatus] = useState<RecordMap | null>(null);
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

  const postiz = ((status?.integrations as RecordMap | undefined)?.postiz || packageResult?.postizSandbox || {}) as RecordMap;
  const platformPayloads = list(packageResult?.platforms);
  const leads = list(status?.leadCaptures);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function run() {
      try {
        const [campaignData, analyticsData, statusData] = await Promise.all([
          campaignsApi.list(token as string),
          analyticsApi.demo(token as string),
          demoApi.status(token as string),
        ]);
        if (cancelled) return;
        const campaignList = list(campaignData);
        setCampaigns(campaignList);
        setSelected(current => current || campaignList[0] || null);
        setAnalytics(analyticsData as RecordMap);
        setStatus(statusData as RecordMap);
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
      const nextStatus = await demoApi.status(token);
      setStatus(nextStatus as RecordMap);
    } catch {
      setStatus(null);
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
      setHandoffPackage(null);
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
      setStep('handoff');
      setNotice('Publishing package and handoff previews are ready.');
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard tone="info" label="Active Campaign" value={selected ? '1' : '0'} detail={selected ? text(selected.topic) : 'Select a campaign'} />
        <MetricCard tone="warn" label="Next Action" value={nextAction} detail="Primary operator task" />
        <MetricCard tone={score ? 'good' : 'muted'} label="Readiness" value={score ? `${totalScore}/100` : 'Pending'} detail={score ? text(score.bandLabel, 'Ready for review') : 'Score selected draft'} />
        <MetricCard tone={packageResult ? 'good' : 'muted'} label="Publishing" value={packageResult ? 'Package Ready' : 'Waiting'} detail={postiz.reachable ? 'Postiz sandbox reachable' : 'Scheduling disabled'} />
        <MetricCard tone={handoffPackage ? 'good' : 'info'} label="Leads" value={handoffPackage ? 'Handoff Ready' : leads.length || 'Pending'} detail="CRM and voice follow-up gated" />
      </div>

      <ProductCard title="Workflow" subtitle="The same campaign moves through preparation, approval, publishing package, intelligence, and handoff.">
        <WorkflowRail steps={[
          { label: 'Brief', state: stateFor(!!selected, step === 'brief') },
          { label: 'Drafts', state: stateFor(!!drafts.length, step === 'drafts') },
          { label: 'Optimize', state: stateFor(!!score, step === 'score') },
          { label: 'Approval', state: stateFor(!!approval, step === 'approval') },
          { label: 'Publishing', state: stateFor(!!packageResult, step === 'publishing') },
          { label: 'Analytics', state: stateFor(!!analytics, false) },
          { label: 'Leads', state: stateFor(!!handoffPackage, step === 'handoff') },
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
            { label: 'Campaigns', value: campaigns.length || 1, tone: 'info' },
            { label: 'Drafts', value: drafts.length || 0, tone: drafts.length ? 'good' : 'default' },
            { label: 'Approvals', value: approval ? 1 : 0, tone: approval ? 'good' : 'default' },
            { label: 'Packages', value: packageResult ? 1 : 0, tone: packageResult ? 'good' : 'default' },
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
                    { label: 'Best Time', value: text(analytics?.bestTime, 'Tuesday 10:00 AM') },
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
                { title: 'Top content signal', meta: text(analytics?.topContent, 'Educational posts with image formats'), status: 'Learning Signal', tone: 'info' },
                { title: 'Best time', meta: text(analytics?.bestTime, 'Tuesday 10:00 AM'), status: 'Recommended', tone: 'good' },
              ]} />
              <ReadableQueue items={[
                { title: leads.length ? 'Captured lead package' : 'Lead handoff package', meta: handoffPackage ? 'Qualification context prepared for CRM review.' : 'Prepared after approved publishing package and lead capture.', status: handoffPackage ? 'Ready' : 'Waiting', tone: handoffPackage ? 'good' : 'default' },
                { title: 'Voice follow-up', meta: handoffPackage ? 'Script and intent prepared; trigger requires authorization.' : 'Prepared after lead handoff.', status: handoffPackage ? 'Voice Follow-up Ready' : 'Waiting', tone: handoffPackage ? 'info' : 'default' },
              ]} />
            </div>
          </ProductCard>
        </div>
      </div>
    </ProductPage>
  );
}
