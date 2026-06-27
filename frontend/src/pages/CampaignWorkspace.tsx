import { useEffect, useState } from 'react';
import { aiGenerationApi, aiProviderApi, algoApi, approvalsApi, campaignsApi, postizApi, publishingPackageApi, usersApi } from '../api';
import { useAuth } from '../contexts/useAuth';
import {
  DetailGrid,
  EmptyProductState,
  Field,
  Notice,
  PlatformPill,
  ProgressBar,
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
  const { token, user } = useAuth();
  const [campaigns, setCampaigns] = useState<RecordMap[]>([]);
  const [departments, setDepartments] = useState<RecordMap[]>([]);
  const [selected, setSelected] = useState<RecordMap | null>(null);
  const [drafts, setDrafts] = useState<RecordMap[]>([]);
  const [draftTextById, setDraftTextById] = useState<Record<string, string>>({});
  const [selectedDraftId, setSelectedDraftId] = useState('');
  const [score, setScore] = useState<RecordMap | null>(null);
  const [approval, setApproval] = useState<RecordMap | null>(null);
  const [publishingPackage, setPublishingPackage] = useState<RecordMap | null>(null);
  const [postizPayload, setPostizPayload] = useState<RecordMap | null>(null);
  const [postizScheduleResult, setPostizScheduleResult] = useState<RecordMap | null>(null);
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState('');
  const [providerReady, setProviderReady] = useState(false);
  const [providerLabel, setProviderLabel] = useState('Requires LLM provider');
  const [showCreate, setShowCreate] = useState(false);
  const [campaignForm, setCampaignForm] = useState({
    topic: '',
    objective: '',
    audience: '',
    targetPlatforms: ['linkedin', 'instagram', 'x'],
    cta: '',
    mediaRequirements: '',
    ownerDepartmentId: '',
    contentType: 'campaign',
    riskCategory: 'medium',
  });

  const selectedDraft = drafts.find(draft => String(draft.contentItemId) === selectedDraftId) || drafts[0] || null;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function run() {
      try {
        const [data, departmentData] = await Promise.all([
          campaignsApi.list(token as string),
          usersApi.departments(token as string),
        ]);
        if (cancelled) return;
        const campaignList = list(data);
        const departmentList = list(departmentData);
        setCampaigns(campaignList);
        setDepartments(departmentList);
        setSelected(current => current || campaignList[0] || null);
        setCampaignForm(current => ({
          ...current,
          ownerDepartmentId: current.ownerDepartmentId || String(departmentList[0]?.id || ''),
        }));
        try {
          const active = await aiProviderApi.active(token as string) as RecordMap;
          setProviderReady(active.apiKeyStatus === 'configured');
          setProviderLabel(`${text(active.name, 'LLM provider')} / ${text(active.model, 'model configured')}`);
        } catch (providerError) {
          setProviderReady(false);
          setProviderLabel(providerError instanceof Error ? providerError.message : 'Configure DeepSeek, OpenAI, or Claude before draft generation');
        }
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
    setPostizScheduleResult(null);
    setMessage('Campaign selected.');
  }

  async function createCampaign() {
    if (!token) return;
    setLoading('create-campaign');
    setMessage('');
    try {
      const created = await campaignsApi.create({
        ...campaignForm,
        targetPlatforms: campaignForm.targetPlatforms,
      }, token) as RecordMap;
      setCampaigns(current => [created, ...current]);
      selectCampaign(created);
      setShowCreate(false);
      setMessage('Campaign created and selected. Next step: generate platform drafts.');
    } catch (error) {
      setMessage(`Campaign creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function generateDrafts() {
    if (!selected || !token || !providerReady) return;
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
      setPostizScheduleResult(null);
      setMessage('Platform drafts are ready.');
    } catch (error) {
      setMessage(`Draft generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function saveEditedDraft() {
    if (!selectedDraft || !token) return;
    const draftId = String(selectedDraft.contentItemId);
    const draftText = draftTextById[draftId] || text(selectedDraft.draftText);
    setLoading('save-edit');
    setMessage('');
    try {
      const saved = await aiGenerationApi.saveEdit({
        contentItemId: draftId,
        draftText,
        editNote: 'Saved from Campaign Workspace',
      }, token) as RecordMap;
      setDrafts(current => current.map(draft => (
        String(draft.contentItemId) === draftId ? { ...draft, ...saved } : draft
      )));
      setDraftTextById(current => ({ ...current, [draftId]: text(saved.draftText, draftText) }));
      setMessage(`Edited draft saved as version ${text(saved.versionNo, 'latest')}.`);
    } catch (error) {
      setMessage(`Draft save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        approvalId: approval?.id,
        platforms: ['linkedin', 'instagram', 'x'],
      }, token);
      setPublishingPackage(result as RecordMap);
      setPostizScheduleResult(null);
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
      setPostizScheduleResult(null);
      setMessage('Postiz payload preview is ready.');
    } catch (error) {
      setMessage(`Postiz payload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function attemptPostizSandboxSchedule() {
    if (!selectedDraft || !token) return;
    setLoading('postiz-sandbox');
    setMessage('');
    try {
      const result = await postizApi.sandboxSchedule({
        platform: text(selectedDraft.platform, 'linkedin'),
        content: draftTextById[String(selectedDraft.contentItemId)] || text(selectedDraft.draftText),
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        timezone: 'Asia/Amman',
        tags: ['commercial-social'],
      }, token);
      setPostizScheduleResult(result as RecordMap);
      setMessage('Postiz sandbox scheduling request completed.');
    } catch (error) {
      setPostizScheduleResult({
        status: 'blocked',
        reasons: [error instanceof Error ? error.message : 'Postiz sandbox scheduling is blocked'],
      });
      setMessage(`Postiz sandbox scheduling blocked: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  const scoreValue = typeof score?.totalScore === 'number' ? score.totalScore : 0;
  const packagePlatforms = list(publishingPackage?.platforms);
  const currentUserId = text((user as RecordMap | null)?.id, '');
  const currentRole = text((user as RecordMap | null)?.role, 'viewer');
  const canCreateCampaign = ['admin', 'cco', 'department_head', 'specialist'].includes(currentRole);
  const createdByCurrentUser = selected ? text(selected.requesterId, '') === currentUserId : false;
  const pendingWork = [
    !selected ? 'Create or select a campaign brief.' : '',
    selected && !providerReady ? 'Configure DeepSeek, OpenAI, or Claude before AI generation.' : '',
    selected && providerReady && !drafts.length ? 'Generate LinkedIn, Instagram, and X drafts.' : '',
    drafts.length && !score ? 'Score the selected saved draft.' : '',
    score && !approval ? 'Send the selected draft for approval.' : '',
    approval?.approvalStatus === 'pending' ? 'Reviewer decision is required.' : '',
    approval?.approvalStatus === 'approved' && !publishingPackage ? 'Prepare the publishing package.' : '',
    publishingPackage && !postizPayload ? 'Preview the Postiz-ready payload.' : '',
  ].filter(Boolean);

  return (
    <ProductPage
      eyebrow="Content Studio"
      title="Campaigns"
      subtitle="Create and manage your social media campaigns. For a guided workflow, visit the Dashboard."
      action={<ProductStatus tone={selected ? 'good' : 'warn'}>{selected ? 'Campaign Active' : 'Select Campaign'}</ProductStatus>}
    >
      <ProductCard title="What this workspace does" subtitle="Your campaign workflow from start to finish.">
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <ReadableQueue items={[
            { title: 'Create campaign brief', meta: 'Define your audience, objective, platforms, call to action, and priority.', status: selected ? 'Available' : 'Required', tone: selected ? 'good' : 'warn' },
            { title: 'Generate and edit drafts', meta: 'AI creates platform-specific copy. Your edits are saved as draft versions.', status: providerReady ? 'Ready' : 'Needs AI Model', tone: providerReady ? 'good' : 'warn' },
            { title: 'Review and approve', meta: 'Content quality review and human approval before scheduling.', status: score ? 'Reviewed' : 'Waiting', tone: score ? 'good' : 'default' },
            { title: 'Prepare content package', meta: 'Approved content becomes scheduling-ready. Scheduling remains controlled.', status: publishingPackage ? 'Package Ready' : 'Waiting', tone: publishingPackage ? 'good' : 'default' },
          ]} />
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-sm font-semibold text-neutral-950">Next required action</div>
            <div className="mt-3 space-y-2">
              {pendingWork.length ? pendingWork.slice(0, 3).map(item => (
                <div key={item} className="rounded-md bg-white px-3 py-2 text-sm text-neutral-700">{item}</div>
              )) : (
                <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">This campaign path is ready for review.</div>
              )}
            </div>
          </div>
        </div>
      </ProductCard>

      <WorkflowRail steps={[
        { label: 'Brief', state: selected ? 'done' : 'active' },
        { label: 'Drafts', state: drafts.length ? 'done' : selected ? 'active' : 'waiting' },
        { label: 'Optimize', state: score ? 'done' : drafts.length ? 'active' : 'waiting' },
        { label: 'Approval', state: approval ? 'done' : score ? 'active' : 'waiting' },
        { label: 'Publishing', state: publishingPackage ? 'done' : approval ? 'active' : 'waiting' },
            { label: 'Scheduling', state: postizPayload ? 'done' : publishingPackage ? 'active' : 'waiting' },
        { label: 'Leads', state: 'waiting' },
        { label: 'Evidence', state: approval || publishingPackage ? 'done' : 'waiting' },
      ]} />

      {message && (
        <Notice tone={message.includes('failed') ? 'danger' : 'good'}>{message}</Notice>
      )}

      {!providerReady && (
        <Notice tone="warn">
          Real draft generation is blocked until this user configures DeepSeek, OpenAI, or Claude. {providerLabel}{' '}
          <a href="/ai-settings" className="font-semibold underline">Open AI Provider Settings</a>
        </Notice>
      )}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <ProductCard
          title="Campaign Queue"
          subtitle="Campaigns created by your team. Create a campaign here or choose one to operate."
          action={<PrimaryAction onClick={() => setShowCreate(current => !current)} disabled={!canCreateCampaign}>{showCreate ? 'Close Builder' : 'New Campaign'}</PrimaryAction>}
        >
          {!canCreateCampaign && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              Your current role is {titleCase(currentRole)}. You can review campaign work, but campaign creation is limited to Admin, CCO, Department Head, and Specialist roles.
            </div>
          )}
          {showCreate && (
            <div className="mb-5 space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <Field label="Campaign Topic">
                <input value={campaignForm.topic} onChange={event => setCampaignForm(current => ({ ...current, topic: event.target.value }))} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950" placeholder="e.g. Ramadan social intelligence launch" />
              </Field>
              <Field label="Business Objective">
                <textarea value={campaignForm.objective} onChange={event => setCampaignForm(current => ({ ...current, objective: event.target.value }))} className="min-h-20 w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950" placeholder="What business outcome should this campaign create?" />
              </Field>
              <Field label="Target Audience">
                <textarea value={campaignForm.audience} onChange={event => setCampaignForm(current => ({ ...current, audience: event.target.value }))} className="min-h-16 w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950" placeholder="Who is this campaign for?" />
              </Field>
              <Field label="Call to Action">
                <input value={campaignForm.cta} onChange={event => setCampaignForm(current => ({ ...current, cta: event.target.value }))} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950" placeholder="e.g. Book a consultation" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Owner Department">
                  <select value={campaignForm.ownerDepartmentId} onChange={event => setCampaignForm(current => ({ ...current, ownerDepartmentId: event.target.value }))} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950">
                    {departments.map(department => <option key={String(department.id)} value={String(department.id)}>{text(department.name)}</option>)}
                  </select>
                </Field>
                <Field label="Risk">
                  <select value={campaignForm.riskCategory} onChange={event => setCampaignForm(current => ({ ...current, riskCategory: event.target.value }))} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </Field>
              </div>
              <Field label="Platforms">
                <div className="flex flex-wrap gap-2">
                  {['linkedin', 'instagram', 'x', 'facebook', 'tiktok'].map(platform => {
                    const active = campaignForm.targetPlatforms.includes(platform);
                    return (
                      <button key={platform} type="button" onClick={() => setCampaignForm(current => ({
                        ...current,
                        targetPlatforms: active
                          ? current.targetPlatforms.length === 1 ? current.targetPlatforms : current.targetPlatforms.filter(item => item !== platform)
                          : [...current.targetPlatforms, platform],
                      }))}>
                        <PlatformPill active={active}>{titleCase(platform)}</PlatformPill>
                      </button>
                    );
                  })}
                </div>
              </Field>
              <PrimaryAction
                onClick={createCampaign}
                disabled={loading === 'create-campaign' || !campaignForm.topic.trim() || !campaignForm.objective.trim() || !campaignForm.audience.trim() || !campaignForm.ownerDepartmentId}
              >
                {loading === 'create-campaign' ? 'Creating...' : 'Create Campaign'}
              </PrimaryAction>
            </div>
          )}
          <div className="space-y-3">
            {campaigns.map(campaign => (
              <button
                key={String(campaign.id)}
                type="button"
                onClick={() => selectCampaign(campaign)}
                className={`w-full rounded-lg border p-4 text-left transition ${selected?.id === campaign.id ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white hover:bg-neutral-50'}`}
              >
                <div className="line-clamp-3 font-semibold">{text(campaign.topic)}</div>
                <div className={`mt-2 text-sm ${selected?.id === campaign.id ? 'text-white/60' : 'text-neutral-500'}`}>
                  {titleCase(text(campaign.status, 'idea'))} / {titleCase(text(campaign.riskCategory, 'medium'))} risk
                </div>
                <div className={`mt-2 text-xs ${selected?.id === campaign.id ? 'text-white/45' : 'text-neutral-400'}`}>
                  {text(campaign.requesterId) === currentUserId ? 'Created by you' : `Created by ${text(campaign.requesterName, 'another team member')}`}
                </div>
              </button>
            ))}
            {!campaigns.length && (
              <EmptyProductState message="No campaigns exist yet. Create a campaign brief to begin the Commercial/Social workflow." />
            )}
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
                { label: 'Owner', value: createdByCurrentUser ? 'Created by you' : text(selected.requesterName, 'Team workspace') },
              ]} />
            ) : (
              <EmptyProductState message="Select a campaign to begin." />
            )}
          </ProductCard>

          <ProductCard
          title="Platform Drafts"
          subtitle="Platform-specific content. Select one, edit it, then review the quality."
          action={<PrimaryAction onClick={generateDrafts} disabled={!providerReady || !selected || loading === 'drafts'}>{loading === 'drafts' ? 'Generating...' : 'Generate Drafts'}</PrimaryAction>}
          >
            {drafts.length ? (
              <div className="grid gap-4 lg:grid-cols-3">
                {drafts.map(draft => {
                  const id = String(draft.contentItemId);
                  const active = selectedDraft?.contentItemId === draft.contentItemId;
                  return (
                    <article key={id} className={`rounded-lg border p-4 ${active ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white'}`}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="font-semibold">{titleCase(text(draft.platform))}</h3>
                        <button type="button" onClick={() => setSelectedDraftId(id)} className="focus:outline-none">
                          <PlatformPill active={active}>{active ? 'Selected' : 'Select'}</PlatformPill>
                        </button>
                      </div>
                      <textarea
                        value={draftTextById[id] || text(draft.draftText)}
                        onChange={event => setDraftTextById(current => ({ ...current, [id]: event.target.value }))}
                        className={`min-h-[180px] w-full resize-y rounded-md border p-3 text-sm leading-6 outline-none ${active ? 'border-white/15 bg-white/10 text-white placeholder:text-white/40' : 'border-neutral-200 bg-neutral-50 text-neutral-950'}`}
                      />
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyProductState message="Generate platform-specific drafts when the brief is ready." />
            )}
            {selectedDraft && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <SecondaryAction onClick={saveEditedDraft} disabled={loading === 'save-edit'}>
                  {loading === 'save-edit' ? 'Saving...' : 'Save Edited Draft Version'}
                </SecondaryAction>
                <ProductStatus tone="info">Selected draft: {titleCase(text(selectedDraft.platform))}</ProductStatus>
              </div>
            )}
          </ProductCard>

          <div className="grid gap-6 xl:grid-cols-2">
            <ProductCard title="Review Quality" subtitle="Check content quality before approval." action={<PrimaryAction onClick={scoreDraft} disabled={!selectedDraft || loading === 'score'}>{loading === 'score' ? 'Analyzing...' : 'Review Quality'}</PrimaryAction>}>
              {score ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-neutral-200 bg-neutral-950 p-5 text-white">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <div className="text-sm text-white/60">Readiness score</div>
                        <div className="mt-2 text-5xl font-semibold">{scoreValue}</div>
                      </div>
                      <ProductStatus tone="muted">{text(score.bandLabel, 'Ready for review')}</ProductStatus>
                    </div>
                    <div className="mt-5">
                      <ProgressBar value={scoreValue} />
                    </div>
                  </div>
                  <ReadableQueue items={[
                    { title: 'Best platform', meta: titleCase(text(selectedDraft?.platform, 'linkedin')), status: 'Recommended', tone: 'good' },
                    { title: 'Hook and CTA', meta: 'Checked for clarity and fit', status: 'Reviewed', tone: 'info' },
                    { title: 'Risk notes', meta: 'No production action can happen before approval', status: 'Approval Required', tone: 'warn' },
                  ]} />
                </div>
              ) : (
                <EmptyProductState message="Score the selected draft to review readiness." />
              )}
            </ProductCard>

            <ProductCard title="Review & Publishing" subtitle="Review decisions unlock content preparation." action={!approval ? <PrimaryAction onClick={submitForApproval} disabled={!selectedDraft || loading === 'approval'}>{loading === 'approval' ? 'Submitting...' : 'Send for Review'}</PrimaryAction> : null}>
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
                  <SecondaryAction onClick={attemptPostizSandboxSchedule} disabled={!postizPayload || loading === 'postiz-sandbox'}>
                    {loading === 'postiz-sandbox' ? 'Checking Gate...' : 'Attempt Sandbox Schedule'}
                  </SecondaryAction>
                </div>
                {postizPayload && (
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                    <div className="font-semibold text-black">Postiz payload preview</div>
                    <div className="mt-2 text-sm text-neutral-600">
                      Type: {text((postizPayload.payload as RecordMap | undefined)?.type, 'schedule')} / Posts: {Array.isArray((postizPayload.payload as RecordMap | undefined)?.posts) ? ((postizPayload.payload as RecordMap).posts as unknown[]).length : 1}
                    </div>
                    <div className="mt-3"><ProductStatus tone="warn">Sandbox Scheduling Disabled</ProductStatus></div>
                  </div>
                )}
                {postizScheduleResult && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                    <div className="font-semibold">Sandbox scheduling result: {text(postizScheduleResult.status, 'blocked')}</div>
                    <div className="mt-2">
                      {Array.isArray(postizScheduleResult.reasons)
                        ? (postizScheduleResult.reasons as unknown[]).map(String).join('; ')
                        : text((postizScheduleResult.safety as RecordMap | undefined)?.executionPerformed, 'No external execution performed')}
                    </div>
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
