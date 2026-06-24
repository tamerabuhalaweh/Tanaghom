import { useEffect, useState } from 'react';
import { aiGenerationApi, algoApi, approvalsApi, campaignsApi, postizApi, publishingPackageApi } from '../api';
import { useAuth } from '../contexts/useAuth';
import {
  DetailGrid,
  PrimaryAction,
  ProductCard,
  ProductPage,
  ProductStatus,
  ReadableQueue,
  SecondaryAction,
  WorkflowRail,
} from '../components/ProductUI';

type RecordMap = Record<string, unknown>;

function text(value: unknown, fallback = 'Not specified'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function list(value: unknown): RecordMap[] {
  return Array.isArray(value) ? value as RecordMap[] : [];
}

function titleCase(value: string): string {
  if (value === 'x') return 'X / Twitter';
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

export default function CampaignWorkspace() {
  const { token } = useAuth();
  const [campaigns, setCampaigns] = useState<RecordMap[]>([]);
  const [selected, setSelected] = useState<RecordMap | null>(null);
  const [drafts, setDrafts] = useState<RecordMap[]>([]);
  const [draftTextById, setDraftTextById] = useState<Record<string, string>>({});
  const [selectedDraftId, setSelectedDraftId] = useState('');
  const [score, setScore] = useState<RecordMap | null>(null);
  const [approval, setApproval] = useState<RecordMap | null>(null);
  const [publishingPackage, setPublishingPackage] = useState<RecordMap | null>(null);
  const [postizPayload, setPostizPayload] = useState<RecordMap | null>(null);
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState('');

  const selectedDraft = drafts.find(draft => String(draft.contentItemId) === selectedDraftId) || drafts[0] || null;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function run() {
      try {
        const data = await campaignsApi.list(token as string);
        if (cancelled) return;
        const campaignList = list(data);
        setCampaigns(campaignList);
        setSelected(current => current || campaignList[0] || null);
      } catch (error) {
        if (!cancelled) setMessage(`Campaigns failed to load: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  function selectCampaign(campaign: RecordMap) {
    setSelected(campaign);
    setDrafts([]);
    setDraftTextById({});
    setSelectedDraftId('');
    setScore(null);
    setApproval(null);
    setPublishingPackage(null);
    setPostizPayload(null);
    setMessage('Campaign selected.');
  }

  async function generateDrafts() {
    if (!selected || !token) return;
    setLoading('drafts');
    setMessage('');
    try {
      const result = await aiGenerationApi.generate({ campaignRequestId: selected.id, platforms: ['linkedin', 'instagram', 'x'] }, token);
      const generated = Array.isArray(result) ? result as RecordMap[] : [result as RecordMap];
      setDrafts(generated);
      setDraftTextById(Object.fromEntries(generated.map(draft => [String(draft.contentItemId), text(draft.draftText, '')])));
      setSelectedDraftId(String(generated[0]?.contentItemId || ''));
      setScore(null);
      setApproval(null);
      setPublishingPackage(null);
      setPostizPayload(null);
      setMessage('Platform drafts are ready.');
    } catch (error) {
      setMessage(`Draft generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function scoreDraft() {
    if (!selectedDraft || !token) return;
    setLoading('score');
    setMessage('');
    try {
      const draftId = String(selectedDraft.contentItemId);
      const result = await algoApi.score({
        contentItemId: selectedDraft.contentItemId,
        platform: selectedDraft.platform,
        draftText: draftTextById[draftId] || text(selectedDraft.draftText, 'Prepared social content'),
        objective: selected?.objective,
        audience: selected?.audience,
        riskCategory: selected?.riskCategory,
      }, token);
      setScore(result as RecordMap);
      setMessage('Readiness score is ready.');
    } catch (error) {
      setMessage(`Scoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function submitForApproval() {
    if (!selectedDraft || !token) return;
    setLoading('approval');
    setMessage('');
    try {
      const result = await approvalsApi.submit({
        targetId: selectedDraft.contentItemId,
        targetType: 'content_item',
        riskCategory: selected?.riskCategory || 'medium',
        approvalType: 'brand_review',
        requiredDepartment: 'Commercial',
        requiredRole: 'reviewer',
        comment: 'Review selected social draft before publishing preparation.',
      }, token);
      setApproval(result as RecordMap);
      setMessage('Approval package created.');
    } catch (error) {
      setMessage(`Approval submission failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function createPublishingPackage() {
    if (!selected || !token) return;
    setLoading('publishing');
    setMessage('');
    try {
      const result = await publishingPackageApi.create({
        campaignId: selected.id,
        draftId: selectedDraft?.contentItemId,
        platforms: ['linkedin', 'instagram', 'x'],
      }, token);
      setPublishingPackage(result as RecordMap);
      setMessage('Publishing package prepared.');
    } catch (error) {
      setMessage(`Publishing preparation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function preparePostizPayload() {
    if (!selectedDraft || !token) return;
    setLoading('postiz');
    setMessage('');
    try {
      const result = await postizApi.schedulePayload({
        platform: text(selectedDraft.platform, 'linkedin'),
        content: draftTextById[String(selectedDraft.contentItemId)] || text(selectedDraft.draftText),
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        timezone: 'Asia/Amman',
        tags: ['commercial-social'],
      }, token);
      setPostizPayload(result as RecordMap);
      setMessage('Postiz payload preview is ready.');
    } catch (error) {
      setMessage(`Postiz payload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  const scoreValue = typeof score?.totalScore === 'number' ? score.totalScore : 0;
  const packagePlatforms = list(publishingPackage?.platforms);

  return (
    <ProductPage
      eyebrow="Campaign operations"
      title="Campaigns"
      subtitle="Review the campaign brief, generate platform drafts, optimize the selected draft, and prepare it for approval and publishing."
      action={<ProductStatus tone={selected ? 'good' : 'warn'}>{selected ? 'Campaign Active' : 'Select Campaign'}</ProductStatus>}
    >
      <WorkflowRail steps={[
        { label: 'Brief', state: selected ? 'done' : 'active' },
        { label: 'Drafts', state: drafts.length ? 'done' : selected ? 'active' : 'waiting' },
        { label: 'Optimize', state: score ? 'done' : drafts.length ? 'active' : 'waiting' },
        { label: 'Approval', state: approval ? 'done' : score ? 'active' : 'waiting' },
        { label: 'Publishing', state: publishingPackage ? 'done' : approval ? 'active' : 'waiting' },
        { label: 'Postiz Payload', state: postizPayload ? 'done' : publishingPackage ? 'active' : 'waiting' },
        { label: 'Leads', state: 'waiting' },
        { label: 'Evidence', state: approval || publishingPackage ? 'done' : 'waiting' },
      ]} />

      {message && (
        <div className={`rounded-2xl px-4 py-3 text-sm ${message.includes('failed') ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-100' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'}`}>
          {message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <ProductCard title="Campaign Queue" subtitle="Campaigns available for social preparation.">
          <div className="space-y-3">
            {campaigns.map(campaign => (
              <button
                key={String(campaign.id)}
                type="button"
                onClick={() => selectCampaign(campaign)}
                className={`w-full rounded-2xl p-4 text-left transition ${selected?.id === campaign.id ? 'bg-black text-white' : 'bg-stone-50 text-black hover:bg-stone-100'}`}
              >
                <div className="font-semibold">{text(campaign.topic)}</div>
                <div className={`mt-2 text-sm ${selected?.id === campaign.id ? 'text-white/58' : 'text-black/50'}`}>
                  {titleCase(text(campaign.status, 'idea'))} / {titleCase(text(campaign.riskCategory, 'medium'))} risk
                </div>
              </button>
            ))}
          </div>
        </ProductCard>

        <div className="space-y-6">
          <ProductCard title="Campaign Brief" subtitle="The customer-facing campaign inputs.">
            {selected ? (
              <DetailGrid items={[
                { label: 'Objective', value: text(selected.objective) },
                { label: 'Audience', value: text(selected.audience) },
                { label: 'Platforms', value: ((selected.targetPlatforms as string[] | undefined) || ['linkedin', 'instagram', 'x']).map(titleCase).join(', ') },
                { label: 'CTA', value: text(selected.cta, 'Prepared during drafting') },
              ]} />
            ) : (
              <Empty message="Select a campaign to begin." />
            )}
          </ProductCard>

          <ProductCard
            title="Platform Drafts"
            subtitle="Generate editable drafts for each platform."
            action={<PrimaryAction onClick={generateDrafts} disabled={!selected || loading === 'drafts'}>{loading === 'drafts' ? 'Generating...' : 'Generate Platform Drafts'}</PrimaryAction>}
          >
            {drafts.length ? (
              <div className="grid gap-4 lg:grid-cols-3">
                {drafts.map(draft => {
                  const id = String(draft.contentItemId);
                  const active = selectedDraft?.contentItemId === draft.contentItemId;
                  return (
                    <article key={id} className={`rounded-2xl p-4 ring-1 ${active ? 'bg-black text-white ring-black' : 'bg-stone-50 text-black ring-black/6'}`}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="font-semibold">{titleCase(text(draft.platform))}</h3>
                        <button type="button" onClick={() => setSelectedDraftId(id)} className={`rounded-full px-3 py-1 text-xs font-semibold ${active ? 'bg-white text-black' : 'bg-white text-black shadow-sm'}`}>
                          {active ? 'Selected' : 'Select'}
                        </button>
                      </div>
                      <textarea
                        value={draftTextById[id] || text(draft.draftText)}
                        onChange={event => setDraftTextById(current => ({ ...current, [id]: event.target.value }))}
                        className={`min-h-[180px] w-full resize-y rounded-xl border p-3 text-sm leading-6 outline-none ${active ? 'border-white/15 bg-white/8 text-white' : 'border-black/8 bg-white text-black'}`}
                      />
                    </article>
                  );
                })}
              </div>
            ) : (
              <Empty message="Generate platform-specific drafts when the brief is ready." />
            )}
          </ProductCard>

          <div className="grid gap-6 xl:grid-cols-2">
            <ProductCard title="Optimize Selected Draft" subtitle="Score the selected draft before approval." action={<PrimaryAction onClick={scoreDraft} disabled={!selectedDraft || loading === 'score'}>{loading === 'score' ? 'Scoring...' : 'Score Draft'}</PrimaryAction>}>
              {score ? (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-black p-5 text-white">
                    <div className="text-sm text-white/55">Readiness score</div>
                    <div className="mt-2 text-5xl font-semibold">{scoreValue}</div>
                    <div className="mt-2 text-sm text-white/65">{text(score.bandLabel, 'Ready for review')}</div>
                  </div>
                  <ReadableQueue items={[
                    { title: 'Best platform', meta: titleCase(text(selectedDraft?.platform, 'linkedin')), status: 'Recommended', tone: 'good' },
                    { title: 'Hook and CTA', meta: 'Checked for clarity and fit', status: 'Reviewed', tone: 'info' },
                    { title: 'Risk notes', meta: 'No production action can happen before approval', status: 'Approval Required', tone: 'warn' },
                  ]} />
                </div>
              ) : (
                <Empty message="Score the selected draft to review readiness." />
              )}
            </ProductCard>

            <ProductCard title="Approval & Publishing Preparation" subtitle="Approval unlocks publishing preparation." action={!approval ? <PrimaryAction onClick={submitForApproval} disabled={!selectedDraft || loading === 'approval'}>{loading === 'approval' ? 'Submitting...' : 'Send for Approval'}</PrimaryAction> : null}>
              <div className="space-y-4">
                <ReadableQueue items={[
                  { title: 'Approval package', meta: approval ? 'Reviewer decision available in approval queue.' : 'Waiting for selected draft submission.', status: approval ? titleCase(text(approval.approvalStatus, 'pending')) : 'Approval Required', tone: approval?.approvalStatus === 'approved' ? 'good' : 'warn' },
                  { title: 'Publishing package', meta: publishingPackage ? `${packagePlatforms.length || 3} platform payloads prepared.` : 'Available after approval.', status: publishingPackage ? 'Package Ready' : 'Waiting', tone: publishingPackage ? 'good' : 'default' },
                ]} />
                {approval?.approvalStatus === 'pending' && (
                  <div className="flex flex-wrap gap-2">
                    <PrimaryAction onClick={async () => {
                      if (!token || !approval) return;
                      setLoading('approve');
                      const result = await approvalsApi.approve(String(approval.id), { comment: 'Approved for publishing preparation.' }, token);
                      setApproval(result as RecordMap);
                      setMessage('Approved. Publishing preparation is available.');
                      setLoading('');
                    }} disabled={!!loading}>Approve</PrimaryAction>
                    <SecondaryAction onClick={async () => {
                      if (!token || !approval) return;
                      setLoading('changes');
                      const result = await approvalsApi.requestChanges(String(approval.id), { comment: 'Please revise before publishing preparation.' }, token);
                      setApproval(result as RecordMap);
                      setMessage('Changes requested.');
                      setLoading('');
                    }} disabled={!!loading}>Request Changes</SecondaryAction>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <PrimaryAction onClick={createPublishingPackage} disabled={approval?.approvalStatus !== 'approved' || !!publishingPackage || loading === 'publishing'}>
                    {publishingPackage ? 'Package Ready' : loading === 'publishing' ? 'Preparing...' : 'Prepare Package'}
                  </PrimaryAction>
                  <SecondaryAction onClick={preparePostizPayload} disabled={!publishingPackage || loading === 'postiz'}>
                    {loading === 'postiz' ? 'Preparing...' : 'Preview Postiz Payload'}
                  </SecondaryAction>
                </div>
                {postizPayload && (
                  <div className="rounded-2xl bg-stone-50 p-4">
                    <div className="font-semibold text-black">Postiz payload preview</div>
                    <div className="mt-2 text-sm text-black/55">
                      Type: {text((postizPayload.payload as RecordMap | undefined)?.type, 'schedule')} / Posts: {Array.isArray((postizPayload.payload as RecordMap | undefined)?.posts) ? ((postizPayload.payload as RecordMap).posts as unknown[]).length : 1}
                    </div>
                    <div className="mt-3"><ProductStatus tone="warn">Sandbox Scheduling Disabled</ProductStatus></div>
                  </div>
                )}
              </div>
            </ProductCard>
          </div>
        </div>
      </div>
    </ProductPage>
  );
}

function Empty({ message }: { message: string }) {
  return <div className="rounded-2xl bg-stone-50 p-6 text-center text-sm text-black/48">{message}</div>;
}
