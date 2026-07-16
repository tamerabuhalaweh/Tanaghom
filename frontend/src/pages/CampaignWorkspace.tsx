import { useEffect, useMemo, useState } from 'react';
import { aiGenerationApi, aiProviderApi, algoApi, approvalsApi, campaignsApi, postizApi, publishingPackageApi, socialGrowthApi, usersApi } from '../api';
import { useAuth } from '../contexts/useAuth';
import {
  EmptyProductState,
  Field,
  Notice,
  PlatformPill,
  PrimaryAction,
  ProductCard,
  ProductPage,
  ProductStatus,
  ProgressBar,
  ReadableQueue,
  SecondaryAction,
  WorkflowRail,
} from '../components/ProductUI';

type RecordMap = Record<string, unknown>;
type StageKey = 'brief' | 'drafts' | 'optimize' | 'approval' | 'publishing' | 'scheduling' | 'leads' | 'evidence';

const STAGES: { key: StageKey; label: string; detail: string }[] = [
  { key: 'brief', label: 'Brief', detail: 'Choose the offer, audience, platforms, and call to action.' },
  { key: 'drafts', label: 'Drafts', detail: 'Generate and edit LinkedIn, Instagram, and X copy.' },
  { key: 'optimize', label: 'Quality', detail: 'Review the selected draft before it goes to approval.' },
  { key: 'approval', label: 'Approval', detail: 'A human reviewer approves, rejects, or requests changes.' },
  { key: 'publishing', label: 'Package', detail: 'Prepare the approved content for controlled scheduling.' },
  { key: 'scheduling', label: 'Scheduling', detail: 'Preview the scheduling-service payload without unsafe publishing.' },
  { key: 'leads', label: 'Leads', detail: 'Prepare CRM and voice/chat handoff from captured interest.' },
  { key: 'evidence', label: 'Evidence', detail: 'Keep a readable record of decisions and prepared outputs.' },
];

function text(value: unknown, fallback = 'Not specified'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function list(value: unknown): RecordMap[] {
  return Array.isArray(value) ? value as RecordMap[] : [];
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function titleCase(value: string): string {
  if (value === 'x') return 'X / Twitter';
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function trimTitle(value: unknown, fallback = 'Untitled campaign'): string {
  const label = text(value, fallback).replace(/\s+/g, ' ').trim();
  return label.length > 82 ? `${label.slice(0, 79)}...` : label;
}

function stageIndex(stage: StageKey): number {
  return STAGES.findIndex(item => item.key === stage);
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
  const [providerLabel, setProviderLabel] = useState('Requires AI model');
  const [showCreate, setShowCreate] = useState(false);
  const [templates, setTemplates] = useState<RecordMap[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [campaignSearch, setCampaignSearch] = useState('');
  const [campaignScope, setCampaignScope] = useState<'active' | 'mine' | 'all'>('active');
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
  const selectedTemplate = templates.find(template => String(template.id) === selectedTemplateId) || templates[0] || null;
  const currentUserId = text((user as RecordMap | null)?.id, '');
  const currentRole = text((user as RecordMap | null)?.role, 'viewer');
  const canCreateCampaign = ['admin', 'cco', 'department_head', 'specialist', 'social_media_manager', 'marketing_manager'].includes(currentRole);
  const createdByCurrentUser = selected ? text(selected.requesterId, '') === currentUserId : false;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function run() {
      try {
        const [data, departmentData, templateData] = await Promise.all([
          campaignsApi.list(token as string),
          usersApi.departments(token as string),
          socialGrowthApi.templates(token as string).catch(() => ({ templates: [] })),
        ]);
        if (cancelled) return;
        const campaignList = list(data);
        const departmentList = list(departmentData);
        const templateList = list((templateData as RecordMap).templates);
        setCampaigns(campaignList);
        setDepartments(departmentList);
        setTemplates(templateList);
        setSelectedTemplateId(current => current || String(templateList[0]?.id || ''));
        setSelected(current => current || campaignList[0] || null);
        setCampaignForm(current => ({
          ...current,
          ownerDepartmentId: current.ownerDepartmentId || String(departmentList[0]?.id || ''),
        }));
        try {
          const status = await aiProviderApi.status(token as string) as RecordMap;
          const providers = list(status.providers);
          const active = providers.find(
            (provider) => text(provider.type) === text(status.activeProvider),
          );
          const ready = Boolean(active?.configured && active?.apiKeyStatus === 'configured');
          setProviderReady(ready);
          setProviderLabel(
            ready
              ? `${text(active?.name, 'AI model')} / ${text(active?.model, 'model configured')}`
              : 'Connect an AI model before draft generation',
          );
        } catch (providerError) {
          setProviderReady(false);
          setProviderLabel(providerError instanceof Error ? providerError.message : 'Connect DeepSeek, OpenAI, or Claude before draft generation');
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
    setShowCreate(false);
    setMessage('Campaign selected. Continue with the next highlighted step.');
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
      setMessage('Campaign created. Next step: generate platform drafts.');
    } catch (error) {
      setMessage(`Campaign creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function createCampaignFromTemplate(templateId: string) {
    if (!token) return;
    setLoading(`template:${templateId}`);
    setMessage('');
    try {
      const created = await socialGrowthApi.createCampaignFromTemplate(templateId, {}, token) as RecordMap;
      setCampaigns(current => [created, ...current]);
      selectCampaign(created);
      setMessage('Course-sales campaign created from template. Next step: generate platform drafts.');
    } catch (error) {
      setMessage(`Template campaign creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      setMessage('Platform drafts are ready. Select the strongest draft, edit it, then review quality.');
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
      setMessage('Quality review is ready. Send the draft for human approval when it looks right.');
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
      setMessage('Review request created. A human decision is now required before scheduling preparation.');
    } catch (error) {
      setMessage(`Approval submission failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function approveSelectedDraft() {
    if (!token || !approval) return;
    setLoading('approve');
    try {
      const result = await approvalsApi.approve(String(approval.id), { comment: 'Approved for publishing preparation.' }, token);
      setApproval(result as RecordMap);
      setMessage('Approved. You can now prepare the scheduling package.');
    } catch (error) {
      setMessage(`Approval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function requestDraftChanges() {
    if (!token || !approval) return;
    setLoading('changes');
    try {
      const result = await approvalsApi.requestChanges(String(approval.id), { comment: 'Please revise before publishing preparation.' }, token);
      setApproval(result as RecordMap);
      setMessage('Changes requested. The content should be revised before scheduling preparation.');
    } catch (error) {
      setMessage(`Request changes failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      setMessage('Scheduling package prepared. Next step: preview the scheduling-service payload.');
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
      setMessage('Scheduling-service payload preview is ready. Live scheduling remains controlled.');
    } catch (error) {
      setMessage(`Scheduling payload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      setMessage('Sandbox scheduling request completed.');
    } catch (error) {
      setPostizScheduleResult({
        status: 'blocked',
        reasons: [error instanceof Error ? error.message : 'Sandbox scheduling is blocked'],
      });
      setMessage(`Sandbox scheduling blocked: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  const scoreValue = typeof score?.totalScore === 'number' ? score.totalScore : 0;
  const packagePlatforms = list(publishingPackage?.platforms);
  const selectedPlatforms = stringList(selected?.targetPlatforms).length ? stringList(selected?.targetPlatforms) : ['linkedin', 'instagram', 'x'];
  const selectedCampaignTitle = trimTitle(selected?.topic, 'No campaign selected');
  const activeStage: StageKey = !selected
    ? 'brief'
    : !drafts.length
      ? 'drafts'
      : !score
        ? 'optimize'
        : !approval || approval.approvalStatus !== 'approved'
          ? 'approval'
          : !publishingPackage
            ? 'publishing'
            : !postizPayload
              ? 'scheduling'
              : 'leads';
  const activeStageIndex = stageIndex(activeStage);
  const activeStageConfig = STAGES[activeStageIndex] || STAGES[0];

  const filteredCampaigns = useMemo(() => {
    const query = campaignSearch.trim().toLowerCase();
    return campaigns.filter(campaign => {
      const createdByMe = text(campaign.requesterId, '') === currentUserId;
      const status = text(campaign.status, 'idea');
      const searchable = [
        campaign.topic,
        campaign.objective,
        campaign.audience,
        campaign.cta,
        campaign.status,
        campaign.riskCategory,
      ].map(item => text(item, '')).join(' ').toLowerCase();
      if (campaignScope === 'mine' && !createdByMe) return false;
      if (campaignScope === 'active' && ['archived', 'completed', 'cancelled'].includes(status)) return false;
      return !query || searchable.includes(query);
    });
  }, [campaignSearch, campaignScope, campaigns, currentUserId]);

  const pendingWork = [
    !selected ? 'Create a new campaign or open an existing campaign.' : '',
    selected && !providerReady && !drafts.length ? 'Connect an AI model before draft generation.' : '',
    selected && providerReady && !drafts.length ? 'Generate LinkedIn, Instagram, and X drafts.' : '',
    drafts.length && !score ? 'Review quality for the selected draft.' : '',
    score && !approval ? 'Send the selected draft for human review.' : '',
    approval?.approvalStatus === 'pending' ? 'A human approval decision is required.' : '',
    approval?.approvalStatus === 'approved' && !publishingPackage ? 'Prepare the scheduling package.' : '',
    publishingPackage && !postizPayload ? 'Preview the scheduling-service payload.' : '',
  ].filter(Boolean);

  const workflowSteps = STAGES.map((stage, index) => ({
    label: stage.label,
    state: index < activeStageIndex
      ? 'done' as const
      : index === activeStageIndex
        ? 'active' as const
        : 'waiting' as const,
  }));

  function renderPrimaryAction() {
    if (!selected) {
      return <PrimaryAction onClick={() => setShowCreate(true)} disabled={!canCreateCampaign}>Create Campaign</PrimaryAction>;
    }
    if (!providerReady && !drafts.length) {
      return <a href="/ai-settings" className="inline-flex min-h-10 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800">Connect AI Model</a>;
    }
    if (activeStage === 'drafts') {
      return <PrimaryAction onClick={generateDrafts} disabled={!providerReady || loading === 'drafts'}>{loading === 'drafts' ? 'Generating...' : 'Generate Drafts'}</PrimaryAction>;
    }
    if (activeStage === 'optimize') {
      return <PrimaryAction onClick={scoreDraft} disabled={!selectedDraft || loading === 'score'}>{loading === 'score' ? 'Reviewing...' : 'Review Quality'}</PrimaryAction>;
    }
    if (activeStage === 'approval' && !approval) {
      return <PrimaryAction onClick={submitForApproval} disabled={!score || loading === 'approval'}>{loading === 'approval' ? 'Submitting...' : 'Send for Review'}</PrimaryAction>;
    }
    if (activeStage === 'publishing') {
      return <PrimaryAction onClick={createPublishingPackage} disabled={loading === 'publishing'}>{loading === 'publishing' ? 'Preparing...' : 'Prepare Package'}</PrimaryAction>;
    }
    if (activeStage === 'scheduling') {
      return <PrimaryAction onClick={preparePostizPayload} disabled={loading === 'postiz'}>{loading === 'postiz' ? 'Preparing...' : 'Preview Scheduling Payload'}</PrimaryAction>;
    }
    return <a href="/analytics" className="inline-flex min-h-10 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800">View Performance</a>;
  }

  function renderCreateCampaignBuilder() {
    return (
      <ProductCard
        title="Create a Course-Sales Campaign"
        subtitle="Choose a proven motion or write a custom brief. A campaign becomes the working object for drafts, review, scheduling, leads, and evidence."
        action={<SecondaryAction onClick={() => setShowCreate(false)}>Close</SecondaryAction>}
      >
        {!canCreateCampaign && (
          <Notice tone="warn">Your current role can review campaign work, but campaign creation is limited to marketing and admin roles.</Notice>
        )}
        <div className="mt-5 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="text-sm font-semibold text-neutral-950">Start from a course-sales template</div>
            {templates.map(template => {
              const active = String(template.id) === selectedTemplateId;
              return (
                <button
                  key={String(template.id)}
                  type="button"
                  onClick={() => setSelectedTemplateId(String(template.id))}
                  className={`w-full rounded-lg border p-4 text-left transition ${active ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white hover:bg-neutral-50'}`}
                >
                  <div className="font-semibold">{text(template.name)}</div>
                  <div className={`mt-2 text-sm leading-5 ${active ? 'text-white/65' : 'text-neutral-500'}`}>{text(template.useCase)}</div>
                </button>
              );
            })}
            {selectedTemplate && (
              <PrimaryAction
                onClick={() => createCampaignFromTemplate(String(selectedTemplate.id))}
                disabled={!canCreateCampaign || loading === `template:${String(selectedTemplate.id)}`}
              >
                {loading === `template:${String(selectedTemplate.id)}` ? 'Creating...' : 'Use Selected Template'}
              </PrimaryAction>
            )}
          </div>

          <div className="space-y-5">
            {selectedTemplate && (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-5">
                <div className="text-sm font-semibold text-neutral-950">Template preview</div>
                <dl className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Audience</dt>
                    <dd className="mt-1 text-sm leading-6 text-neutral-800">{text(selectedTemplate.audience)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Call to action</dt>
                    <dd className="mt-1 text-sm leading-6 text-neutral-800">{text(selectedTemplate.cta)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Expected outcome</dt>
                    <dd className="mt-1 text-sm leading-6 text-neutral-800">{text(selectedTemplate.expectedOutcome)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Platforms</dt>
                    <dd className="mt-2 flex flex-wrap gap-2">
                      {stringList(selectedTemplate.targetPlatforms).map(platform => <PlatformPill key={platform}>{titleCase(platform)}</PlatformPill>)}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            <div className="rounded-lg border border-neutral-200 bg-white p-5">
              <div className="text-sm font-semibold text-neutral-950">Or create a custom campaign</div>
              <div className="mt-4 grid gap-4">
                <Field label="Campaign Topic">
                  <input value={campaignForm.topic} onChange={event => setCampaignForm(current => ({ ...current, topic: event.target.value }))} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950" placeholder="e.g. Confidence coaching course launch" />
                </Field>
                <Field label="Business Objective">
                  <textarea value={campaignForm.objective} onChange={event => setCampaignForm(current => ({ ...current, objective: event.target.value }))} className="min-h-24 w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm leading-6 text-neutral-950" placeholder="What should this campaign achieve for course sales or lead generation?" />
                </Field>
                <Field label="Target Audience">
                  <textarea value={campaignForm.audience} onChange={event => setCampaignForm(current => ({ ...current, audience: event.target.value }))} className="min-h-20 w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm leading-6 text-neutral-950" placeholder="Who is this content for, and what problem are they trying to solve?" />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Call to Action">
                    <input value={campaignForm.cta} onChange={event => setCampaignForm(current => ({ ...current, cta: event.target.value }))} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950" placeholder="e.g. Join the waitlist" />
                  </Field>
                  <Field label="Owner Department">
                    <select value={campaignForm.ownerDepartmentId} onChange={event => setCampaignForm(current => ({ ...current, ownerDepartmentId: event.target.value }))} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950">
                      {departments.map(department => <option key={String(department.id)} value={String(department.id)}>{text(department.name)}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid gap-4 md:grid-cols-[1fr_220px]">
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
                  <Field label="Review Sensitivity">
                    <select value={campaignForm.riskCategory} onChange={event => setCampaignForm(current => ({ ...current, riskCategory: event.target.value }))} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </Field>
                </div>
                <PrimaryAction
                  onClick={createCampaign}
                  disabled={loading === 'create-campaign' || !canCreateCampaign || !campaignForm.topic.trim() || !campaignForm.objective.trim() || !campaignForm.audience.trim() || !campaignForm.ownerDepartmentId}
                >
                  {loading === 'create-campaign' ? 'Creating...' : 'Create Custom Campaign'}
                </PrimaryAction>
              </div>
            </div>
          </div>
        </div>
      </ProductCard>
    );
  }

  function renderBriefStep() {
    if (!selected) {
      return (
        <EmptyProductState
          title="Start with a campaign"
          message="Create a course-sales campaign or open an existing one. The system will then guide you through drafts, review, scheduling package, leads, and evidence."
          action={<PrimaryAction onClick={() => setShowCreate(true)} disabled={!canCreateCampaign}>Create Campaign</PrimaryAction>}
        />
      );
    }

    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Selected campaign</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">{selectedCampaignTitle}</h2>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-neutral-600">{text(selected.objective, 'No objective recorded yet.')}</p>
            </div>
            <ProductStatus tone="info">{titleCase(text(selected.status, 'idea'))}</ProductStatus>
          </div>
        </div>

        <dl className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Audience</dt>
            <dd className="mt-2 text-sm leading-6 text-neutral-800">{text(selected.audience)}</dd>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Call to action</dt>
            <dd className="mt-2 text-sm leading-6 text-neutral-800">{text(selected.cta, 'Prepared during drafting')}</dd>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Platforms</dt>
            <dd className="mt-3 flex flex-wrap gap-2">{selectedPlatforms.map(platform => <PlatformPill key={platform}>{titleCase(platform)}</PlatformPill>)}</dd>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Owner</dt>
            <dd className="mt-2 text-sm leading-6 text-neutral-800">{createdByCurrentUser ? 'Created by you' : text(selected.requesterName, 'Team workspace')}</dd>
          </div>
        </dl>
      </div>
    );
  }

  function renderDraftStep() {
    if (!selected) return renderBriefStep();
    if (!providerReady && !drafts.length) {
      return (
        <EmptyProductState
          title="Connect your AI model first"
          message={`Draft generation uses the configured AI model through the backend provider adapter. Current status: ${providerLabel}.`}
          action={<a href="/ai-settings" className="inline-flex min-h-10 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800">Open AI Settings</a>}
        />
      );
    }

    return (
      <div className="space-y-5">
        {!drafts.length ? (
          <EmptyProductState
            title="Drafts are not generated yet"
            message="Generate platform-specific content for LinkedIn, Instagram, and X. After generation, choose the strongest version and edit it before review."
            action={<PrimaryAction onClick={generateDrafts} disabled={loading === 'drafts'}>{loading === 'drafts' ? 'Generating...' : 'Generate Drafts'}</PrimaryAction>}
          />
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              {drafts.map(draft => {
                const id = String(draft.contentItemId);
                const active = selectedDraft?.contentItemId === draft.contentItemId;
                return (
                  <article key={id} className={`rounded-xl border p-4 ${active ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white'}`}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="font-semibold">{titleCase(text(draft.platform))}</h3>
                      <button type="button" onClick={() => setSelectedDraftId(id)} className="focus:outline-none">
                        <PlatformPill active={active}>{active ? 'Selected' : 'Select'}</PlatformPill>
                      </button>
                    </div>
                    <textarea
                      value={draftTextById[id] || text(draft.draftText)}
                      onChange={event => setDraftTextById(current => ({ ...current, [id]: event.target.value }))}
                      className={`min-h-[220px] w-full resize-y rounded-md border p-3 text-sm leading-6 outline-none ${active ? 'border-white/15 bg-white/10 text-white placeholder:text-white/40' : 'border-neutral-200 bg-neutral-50 text-neutral-950'}`}
                    />
                  </article>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SecondaryAction onClick={saveEditedDraft} disabled={loading === 'save-edit'}>
                {loading === 'save-edit' ? 'Saving...' : 'Save Edited Draft'}
              </SecondaryAction>
              <ProductStatus tone="info">Selected: {titleCase(text(selectedDraft?.platform, 'LinkedIn'))}</ProductStatus>
            </div>
          </>
        )}
      </div>
    );
  }

  function renderQualityStep() {
    if (!selectedDraft) {
      return (
        <EmptyProductState
          title="Choose a draft first"
          message="Generate drafts and select the version you want the system to review for quality, clarity, CTA strength, and scheduling readiness."
        />
      );
    }

    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Selected draft</div>
              <h3 className="mt-1 text-lg font-semibold text-neutral-950">{titleCase(text(selectedDraft.platform))}</h3>
            </div>
            <PrimaryAction onClick={scoreDraft} disabled={loading === 'score'}>{loading === 'score' ? 'Reviewing...' : 'Review Quality'}</PrimaryAction>
          </div>
          <p className="mt-4 whitespace-pre-wrap rounded-lg bg-neutral-50 p-4 text-sm leading-6 text-neutral-800">{draftTextById[String(selectedDraft.contentItemId)] || text(selectedDraft.draftText)}</p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-neutral-950 p-5 text-white">
          <div className="text-sm text-white/60">Quality score</div>
          <div className="mt-3 text-5xl font-semibold">{score ? scoreValue : '-'}</div>
          <div className="mt-5">
            <ProgressBar value={scoreValue} />
          </div>
          <div className="mt-5 text-sm leading-6 text-white/65">
            {score ? text(score.bandLabel, 'Ready for review') : 'Run the quality review to unlock approval.'}
          </div>
        </div>

        {score && (
          <div className="xl:col-span-2">
            <ReadableQueue items={[
              { title: 'Best platform', meta: titleCase(text(selectedDraft.platform, 'linkedin')), status: 'Recommended', tone: 'good' },
              { title: 'Hook and CTA', meta: 'Checked for clarity, promise, and next-step strength.', status: 'Reviewed', tone: 'info' },
              { title: 'Safety note', meta: 'No scheduling or external action happens before approval.', status: 'Human Review', tone: 'warn' },
            ]} />
          </div>
        )}
      </div>
    );
  }

  function renderApprovalStep() {
    if (!score) {
      return <EmptyProductState title="Quality review is required" message="Run the content quality review before sending this draft to a human approver." />;
    }

    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Approval packet</div>
          <h3 className="mt-2 text-xl font-semibold text-neutral-950">{selectedCampaignTitle}</h3>
          <p className="mt-3 whitespace-pre-wrap rounded-lg bg-neutral-50 p-4 text-sm leading-6 text-neutral-800">{draftTextById[String(selectedDraft?.contentItemId)] || text(selectedDraft?.draftText)}</p>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
            <div className="text-sm font-semibold text-neutral-950">Decision status</div>
            <div className="mt-3">
              <ProductStatus tone={approval?.approvalStatus === 'approved' ? 'good' : approval ? 'warn' : 'info'}>
                {approval ? titleCase(text(approval.approvalStatus, 'pending')) : 'Not submitted'}
              </ProductStatus>
            </div>
            <div className="mt-4 text-sm leading-6 text-neutral-600">
              Approval protects the brand. Scheduling preparation unlocks only after a human decision.
            </div>
          </div>
          {!approval ? (
            <PrimaryAction onClick={submitForApproval} disabled={loading === 'approval'}>{loading === 'approval' ? 'Submitting...' : 'Send for Review'}</PrimaryAction>
          ) : approval.approvalStatus === 'pending' ? (
            <div className="flex flex-col gap-2">
              <PrimaryAction onClick={approveSelectedDraft} disabled={!!loading}>{loading === 'approve' ? 'Approving...' : 'Approve'}</PrimaryAction>
              <SecondaryAction onClick={requestDraftChanges} disabled={!!loading}>{loading === 'changes' ? 'Saving...' : 'Request Changes'}</SecondaryAction>
            </div>
          ) : (
            <Notice tone={approval.approvalStatus === 'approved' ? 'good' : 'warn'}>Decision recorded. Continue with the highlighted next step.</Notice>
          )}
        </div>
      </div>
    );
  }

  function renderPublishingStep() {
    if (approval?.approvalStatus !== 'approved') {
      return <EmptyProductState title="Approval unlocks scheduling preparation" message="The system will prepare a scheduling package only after the selected draft is approved." />;
    }

    return (
      <div className="space-y-5">
        <ReadableQueue items={[
          { title: 'Human approval', meta: 'The selected draft is approved for scheduling preparation.', status: 'Approved', tone: 'good' },
          { title: 'Scheduling package', meta: publishingPackage ? `${packagePlatforms.length || 3} platform item(s) prepared.` : 'Create a package for LinkedIn, Instagram, and X.', status: publishingPackage ? 'Ready' : 'Next', tone: publishingPackage ? 'good' : 'info' },
          { title: 'External publishing', meta: 'Live scheduling remains controlled until credentials and authorization are configured.', status: 'Controlled', tone: 'warn' },
        ]} />
        <div className="flex flex-wrap gap-2">
          <PrimaryAction onClick={createPublishingPackage} disabled={!!publishingPackage || loading === 'publishing'}>
            {publishingPackage ? 'Package Ready' : loading === 'publishing' ? 'Preparing...' : 'Prepare Package'}
          </PrimaryAction>
          <SecondaryAction onClick={preparePostizPayload} disabled={!publishingPackage || loading === 'postiz'}>
            {loading === 'postiz' ? 'Preparing...' : 'Preview Scheduling Payload'}
          </SecondaryAction>
        </div>
      </div>
    );
  }

  function renderSchedulingStep() {
    if (!publishingPackage) {
      return <EmptyProductState title="Prepare the scheduling package first" message="After approval, prepare a package before previewing the scheduling-service payload." />;
    }

    return (
      <div className="space-y-5">
        {!postizPayload ? (
          <EmptyProductState
            title="Scheduling payload is not prepared yet"
            message="Preview the payload that can be sent to the scheduling service after customer-owned channels and execution gates are configured."
            action={<PrimaryAction onClick={preparePostizPayload} disabled={loading === 'postiz'}>{loading === 'postiz' ? 'Preparing...' : 'Preview Scheduling Payload'}</PrimaryAction>}
          />
        ) : (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-neutral-950">Scheduling payload preview</div>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  Type: {text((postizPayload.payload as RecordMap | undefined)?.type, 'schedule')} / Posts: {Array.isArray((postizPayload.payload as RecordMap | undefined)?.posts) ? ((postizPayload.payload as RecordMap).posts as unknown[]).length : 1}
                </p>
              </div>
              <ProductStatus tone="warn">Live Scheduling Controlled</ProductStatus>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <SecondaryAction onClick={attemptPostizSandboxSchedule} disabled={loading === 'postiz-sandbox'}>
                {loading === 'postiz-sandbox' ? 'Checking Gate...' : 'Check Sandbox Scheduling Gate'}
              </SecondaryAction>
            </div>
          </div>
        )}
        {postizScheduleResult && (
          <Notice tone={text(postizScheduleResult.status) === 'blocked' ? 'warn' : 'good'}>
            Sandbox scheduling result: {text(postizScheduleResult.status, 'blocked')}.{' '}
            {Array.isArray(postizScheduleResult.reasons)
              ? (postizScheduleResult.reasons as unknown[]).map(String).join('; ')
              : text((postizScheduleResult.safety as RecordMap | undefined)?.executionPerformed, 'No external execution performed')}
          </Notice>
        )}
      </div>
    );
  }

  function renderLeadsStep() {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <div className="text-sm font-semibold text-neutral-950">Lead capture</div>
          <p className="mt-2 text-sm leading-6 text-neutral-600">Campaign responses and captured interest appear in Performance once connected sources or internal lead records exist.</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <div className="text-sm font-semibold text-neutral-950">CRM handoff</div>
          <p className="mt-2 text-sm leading-6 text-neutral-600">GoHighLevel receives customer-owned handoff packages only after credentials and execution approval are configured.</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <div className="text-sm font-semibold text-neutral-950">Voice/chat follow-up</div>
          <p className="mt-2 text-sm leading-6 text-neutral-600">SmartLabs handoff packages can prepare conversation context for approved tenant testing or production use.</p>
        </div>
      </div>
    );
  }

  function renderActiveStage() {
    if (showCreate) return renderCreateCampaignBuilder();
    if (activeStage === 'brief') return renderBriefStep();
    if (activeStage === 'drafts') return renderDraftStep();
    if (activeStage === 'optimize') return renderQualityStep();
    if (activeStage === 'approval') return renderApprovalStep();
    if (activeStage === 'publishing') return renderPublishingStep();
    if (activeStage === 'scheduling') return renderSchedulingStep();
    return renderLeadsStep();
  }

  return (
    <ProductPage
      eyebrow="Content Studio"
      title="Campaigns"
      subtitle="Build one course-sales campaign from brief to AI drafts, quality review, approval, scheduling package, leads, and evidence."
      action={<ProductStatus tone={selected ? 'good' : 'warn'}>{selected ? 'Campaign Open' : 'Start Campaign'}</ProductStatus>}
    >
      <section className="overflow-hidden rounded-2xl border border-neutral-900 bg-neutral-950 text-white shadow-lg">
        <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wide text-white/45">Today's campaign step</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">{showCreate ? 'Create a campaign' : activeStageConfig.label}</h2>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-white/65">
              {showCreate ? 'Choose a course-sales starter or write a custom brief. The campaign becomes the workspace for the full journey.' : activeStageConfig.detail}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <ProductStatus tone="muted">{selectedCampaignTitle}</ProductStatus>
              <ProductStatus tone={providerReady ? 'good' : 'warn'}>{providerReady ? 'AI Model Ready' : 'AI Model Needed'}</ProductStatus>
              <ProductStatus tone="warn">Publishing Controlled</ProductStatus>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.06] p-5">
            <div className="text-sm font-semibold">Next action</div>
            <div className="mt-3 min-h-16 text-sm leading-6 text-white/65">
              {pendingWork[0] || 'This campaign is ready for performance review and lead handoff.'}
            </div>
            <div className="mt-5">{renderPrimaryAction()}</div>
          </div>
        </div>
      </section>

      <WorkflowRail steps={workflowSteps} />

      {message && (
        <Notice tone={message.includes('failed') ? 'danger' : message.includes('blocked') ? 'warn' : 'good'}>{message}</Notice>
      )}

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4">
          <ProductCard
            title="Campaign Queue"
            subtitle="Open one campaign at a time. Use search and filters to avoid duplicate-looking clutter."
            action={<PrimaryAction onClick={() => setShowCreate(true)} disabled={!canCreateCampaign}>New Campaign</PrimaryAction>}
          >
            <div className="space-y-4">
              <input
                value={campaignSearch}
                onChange={event => setCampaignSearch(event.target.value)}
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950"
                placeholder="Search campaigns..."
              />
              <div className="flex flex-wrap gap-2">
                {(['active', 'mine', 'all'] as const).map(scope => (
                  <button key={scope} type="button" onClick={() => setCampaignScope(scope)}>
                    <PlatformPill active={campaignScope === scope}>{scope === 'active' ? 'Active' : scope === 'mine' ? 'Mine' : 'All'}</PlatformPill>
                  </button>
                ))}
              </div>
              {!canCreateCampaign && (
                <Notice tone="warn">Your role can review campaign work, but new campaign creation is limited to marketing and admin roles.</Notice>
              )}
              <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                {filteredCampaigns.map(campaign => {
                  const active = selected?.id === campaign.id;
                  const owner = text(campaign.requesterId) === currentUserId ? 'Created by you' : text(campaign.requesterName, 'Team workspace');
                  return (
                    <button
                      key={String(campaign.id)}
                      type="button"
                      onClick={() => selectCampaign(campaign)}
                      className={`w-full rounded-lg border p-4 text-left transition ${active ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white hover:bg-neutral-50'}`}
                    >
                      <div className="font-semibold leading-5">{trimTitle(campaign.topic)}</div>
                      <div className={`mt-2 text-sm ${active ? 'text-white/60' : 'text-neutral-500'}`}>
                        {titleCase(text(campaign.status, 'idea'))} / {titleCase(text(campaign.riskCategory, 'medium'))} review
                      </div>
                      <div className={`mt-2 text-xs ${active ? 'text-white/45' : 'text-neutral-400'}`}>{owner}</div>
                    </button>
                  );
                })}
                {!filteredCampaigns.length && (
                  <EmptyProductState message="No campaigns match this view. Clear search or create a new campaign." />
                )}
              </div>
            </div>
          </ProductCard>

          <ProductCard title="Workflow Guide" subtitle="Only the current step opens in detail. Future steps unlock as the campaign progresses.">
            <ReadableQueue items={STAGES.map((stage, index) => ({
              title: stage.label,
              meta: stage.detail,
              status: index < activeStageIndex ? 'Done' : index === activeStageIndex ? 'Now' : 'Locked',
              tone: index < activeStageIndex ? 'good' : index === activeStageIndex ? 'info' : 'default',
            }))} />
          </ProductCard>
        </div>

        <div className="space-y-6">
          {renderActiveStage()}

          {!showCreate && (
            <ProductCard title="What happens next" subtitle="The system keeps unsafe actions controlled while guiding the team to the next business outcome.">
              <ReadableQueue items={[
                { title: 'Prepare stronger content', meta: 'Use the campaign brief and AI model to create platform-specific copy.', status: drafts.length ? 'Done' : 'Next', tone: drafts.length ? 'good' : 'info' },
                { title: 'Review before publishing', meta: 'Quality scoring and human approval protect the brand before scheduling.', status: approval ? titleCase(text(approval.approvalStatus, 'pending')) : 'Waiting', tone: approval?.approvalStatus === 'approved' ? 'good' : 'warn' },
                { title: 'Create scheduling package', meta: 'Approved content becomes a scheduling-ready package. Live execution remains controlled.', status: publishingPackage ? 'Ready' : 'Locked', tone: publishingPackage ? 'good' : 'default' },
                { title: 'Follow up on leads', meta: 'Lead and CRM/voice handoff paths are prepared when customer-owned integrations are connected.', status: 'Prepared Path', tone: 'info' },
              ]} />
            </ProductCard>
          )}
        </div>
      </div>
    </ProductPage>
  );
}
