import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  CircleAlert,
  ChevronDown,
  ChevronRight,
  FileCheck2,
  FilePenLine,
  Save,
  MessageSquareText,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import { aiGenerationApi, aiProviderApi, algoApi, approvalsApi, campaignsApi, ideasApi } from '../api';
import { OpsEmpty, OpsNotice, OpsPage, OpsPageHeader, OpsSection, OpsSkeleton, OpsStatus } from '../components/OperationalUI';
import { useAuth } from '../contexts/useAuth';
import './PostIdeas.css';

interface PostIdea {
  id: string;
  title: string;
  hook: string;
  platform: string;
  format: string;
  hashtags: string[];
  estimatedReach: 'low' | 'medium' | 'high';
  rationale: string;
}

interface GenerateResponse {
  workflow: { threadId: string; status: string };
  ideas: PostIdea[];
  provider: string;
  model: string;
  apiKeyStatus: string;
  generationMode?: string;
}

interface WorkflowResumeResponse {
  threadId: string;
  status: 'selected' | 'rejected';
  selectedIdeaId?: string;
}

interface CampaignResponse {
  campaignId: string;
  title: string;
  status: string;
}

type RecordMap = Record<string, unknown>;

const PLATFORM_OPTIONS = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'x', label: 'X / Twitter' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'tiktok', label: 'TikTok' },
];

const DEFAULT_BRIEF = {
  campaignName: '',
  objective: '',
  audience: '',
  geography: '',
  tone: 'professional',
  cta: '',
  offer: '',
  postingWindow: '',
  pillar: '',
  riskLevel: 'medium',
};

function text(value: unknown, fallback = 'Not specified'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function list(value: unknown): RecordMap[] {
  return Array.isArray(value) ? value as RecordMap[] : [];
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function titleCase(value: unknown): string {
  return text(value, 'not_available').replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, character => character.toUpperCase());
}

function platformLabel(platform: string): string {
  if (platform === 'twitter' || platform === 'x') return 'X / Twitter';
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

function campaignTitle(campaign: RecordMap): string {
  return text(campaign.topic || campaign.title || campaign.name, 'Untitled content');
}

function isSetupOrTestContent(campaign: RecordMap): boolean {
  const combined = `${campaignTitle(campaign)} ${text(campaign.objective || campaign.rawMessage || campaign.raw_message, '')}`;
  return [
    /^Sprint\s*\d+\s+Acceptance/i,
    /Proof-led customer story/i,
    /Premium social intelligence launch/i,
    /Product Feature Announcement/i,
    /Summer Wellness Launch/i,
    /acceptance-\d+@example\.com/i,
  ].some(pattern => pattern.test(combined));
}

function contentSummary(item: RecordMap): string {
  return text(item.objective || item.rawMessage || item.raw_message || item.summary, 'Continue this campaign in the Campaign Workspace.');
}

function contentAction(status: string): { label: string; path: string } {
  if (status.includes('approved')) return { label: 'Prepare Schedule', path: '/publishing' };
  if (status.includes('review')) return { label: 'Open Review', path: '/approvals' };
  if (status.includes('scheduled') || status.includes('published')) return { label: 'View Performance', path: '/growth' };
  return { label: 'Continue Drafting', path: '/campaigns' };
}

function buildGoalPayload(brief: typeof DEFAULT_BRIEF): string {
  return [
    `Campaign: ${brief.campaignName}`,
    `Objective: ${brief.objective}`,
    `Offer: ${brief.offer}`,
    `CTA: ${brief.cta}`,
    `Tone: ${brief.tone}`,
    `Content category: ${brief.pillar}`,
    `Desired posting window: ${brief.postingWindow}`,
    `Risk level: ${brief.riskLevel}`,
  ].join('\n');
}

function buildAudiencePayload(brief: typeof DEFAULT_BRIEF): string {
  return [brief.audience, `Target geography: ${brief.geography}`].join('\n');
}

export default function PostIdeas() {
  const { token } = useAuth();
  const [brief, setBrief] = useState(DEFAULT_BRIEF);
  const [platforms, setPlatforms] = useState<string[]>(['linkedin', 'instagram', 'x']);
  const [ideas, setIdeas] = useState<PostIdea[]>([]);
  const [selectedIdeaId, setSelectedIdeaId] = useState('');
  const [workflowId, setWorkflowId] = useState('');
  const [provider, setProvider] = useState<GenerateResponse | null>(null);
  const [workflowDecision, setWorkflowDecision] = useState<WorkflowResumeResponse | null>(null);
  const [campaign, setCampaign] = useState<CampaignResponse | null>(null);
  const [activeStage, setActiveStage] = useState<'brief' | 'ideas' | 'draft'>('brief');
  const [drafts, setDrafts] = useState<RecordMap[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState('');
  const [draftTextById, setDraftTextById] = useState<Record<string, string>>({});
  const [score, setScore] = useState<RecordMap | null>(null);
  const [approval, setApproval] = useState<RecordMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [providerReady, setProviderReady] = useState(false);
  const [pageLoading, setPageLoading] = useState(Boolean(token));
  const [contentLibrary, setContentLibrary] = useState<RecordMap[]>([]);
  const [contentSearch, setContentSearch] = useState('');
  const [contentStatus, setContentStatus] = useState('');
  const [contentPlatform, setContentPlatform] = useState('');

  const selectedIdea = useMemo(() => ideas.find(idea => idea.id === selectedIdeaId) || null, [ideas, selectedIdeaId]);
  const selectedDraft = useMemo(() => drafts.find(draft => String(draft.contentItemId) === selectedDraftId) || drafts[0] || null, [drafts, selectedDraftId]);
  const filteredContent = useMemo(() => {
    const search = contentSearch.trim().toLowerCase();
    return contentLibrary.filter(item => !isSetupOrTestContent(item)).filter(item => {
      const itemPlatforms = stringList(item.targetPlatforms || item.platforms);
      const status = text(item.status, '').toLowerCase();
      const searchable = `${campaignTitle(item)} ${text(item.objective || item.rawMessage || item.raw_message, '')}`.toLowerCase();
      if (search && !searchable.includes(search)) return false;
      if (contentStatus && status !== contentStatus) return false;
      if (contentPlatform && !itemPlatforms.includes(contentPlatform)) return false;
      return true;
    });
  }, [contentLibrary, contentPlatform, contentSearch, contentStatus]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      try {
        const active = await aiProviderApi.active(token as string) as { apiKeyStatus?: string };
        if (!cancelled) setProviderReady(active.apiKeyStatus === 'configured');
      } catch {
        if (!cancelled) setProviderReady(false);
      }
      try {
        const campaigns = await campaignsApi.list(token as string);
        if (!cancelled) setContentLibrary(list(campaigns));
      } catch {
        if (!cancelled) setContentLibrary([]);
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [token]);

  function updateBrief(key: keyof typeof DEFAULT_BRIEF, value: string) {
    setBrief(current => ({ ...current, [key]: value }));
  }

  function togglePlatform(platform: string) {
    setPlatforms(current => current.includes(platform)
      ? current.length === 1 ? current : current.filter(item => item !== platform)
      : [...current, platform]);
  }

  async function generateIdeas() {
    if (!token || !providerReady) return;
    setLoading(true);
    setMessage('');
    setCampaign(null);
    setWorkflowDecision(null);
    try {
      const data = await ideasApi.generate({
        goal: buildGoalPayload(brief),
        audience: buildAudiencePayload(brief),
        platforms,
        count: 4,
      }, token) as GenerateResponse;
      setIdeas(data.ideas || []);
      setSelectedIdeaId(data.ideas?.[0]?.id || '');
      setWorkflowId(data.workflow.threadId);
      setProvider(data);
      setActiveStage('ideas');
      setMessage(`Generated ${data.ideas?.length || 0} campaign directions for review.`);
    } catch (reason) {
      setMessage(`Generation failed: ${reason instanceof Error ? reason.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  async function selectIdea() {
    if (!token || !workflowId || !selectedIdea) return;
    setLoading(true);
    setMessage('');
    try {
      const decision = await ideasApi.resumeWorkflow(workflowId, { action: 'select', ideaId: selectedIdea.id, notes: 'Selected for campaign creation.' }, token) as WorkflowResumeResponse;
      setWorkflowDecision(decision);
      setMessage('Direction selected. Create the campaign when you are ready.');
    } catch (reason) {
      setMessage(`Selection failed: ${reason instanceof Error ? reason.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  async function createCampaign() {
    if (!token || !selectedIdea || workflowDecision?.status !== 'selected') return;
    setLoading(true);
    setMessage('');
    try {
      const data = await ideasApi.convertToCampaign({
        idea: selectedIdea,
        platforms: [selectedIdea.platform],
        audience: buildAudiencePayload(brief),
        goal: buildGoalPayload(brief),
      }, token) as CampaignResponse;
      setCampaign(data);
      setContentLibrary(current => [{
        id: data.campaignId,
        topic: data.title,
        status: data.status,
        targetPlatforms: [selectedIdea.platform],
        objective: selectedIdea.hook,
        riskCategory: selectedIdea.estimatedReach,
      }, ...current.filter(item => text(item.id, '') !== data.campaignId)]);
      setActiveStage('draft');
      setMessage(`Campaign created: ${data.title}. Preparing the first platform draft.`);
      await generateDraftsForCampaign(data.campaignId, [selectedIdea.platform]);
    } catch (reason) {
      setMessage(`Campaign creation failed: ${reason instanceof Error ? reason.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  async function generateDraftsForCampaign(campaignId: string, targetPlatforms = platforms) {
    if (!token || !providerReady || !campaignId) return;
    setLoading(true);
    setScore(null);
    setApproval(null);
    try {
      const result = await aiGenerationApi.generate({ campaignRequestId: campaignId, platforms: targetPlatforms }, token);
      const generated = Array.isArray(result) ? result as RecordMap[] : [result as RecordMap];
      setDrafts(generated);
      setDraftTextById(Object.fromEntries(generated.map(draft => [String(draft.contentItemId), text(draft.draftText, '')])));
      setSelectedDraftId(String(generated[0]?.contentItemId || ''));
      setMessage('Draft prepared. Edit it, review quality, then send it for human approval.');
    } catch (reason) {
      setDrafts([]);
      setDraftTextById({});
      setMessage(`Draft generation failed: ${reason instanceof Error ? reason.message : 'Unknown error'}. The campaign is saved and you can retry.`);
    } finally {
      setLoading(false);
    }
  }

  async function openSavedCampaign(item: RecordMap) {
    if (!token) return;
    const campaignId = text(item.id, '');
    if (!campaignId) return;
    setLoading(true);
    setMessage('');
    setScore(null);
    setApproval(null);
    try {
      const [savedCampaign, savedDrafts] = await Promise.all([
        campaignsApi.get(campaignId, token) as Promise<RecordMap>,
        aiGenerationApi.listCampaignDrafts(campaignId, token),
      ]);
      const rows = savedDrafts as RecordMap[];
      setCampaign({ campaignId, title: campaignTitle(savedCampaign), status: text(savedCampaign.status, 'idea') });
      setBrief(current => ({
        ...current,
        campaignName: campaignTitle(savedCampaign),
        objective: text(savedCampaign.objective, ''),
        audience: text(savedCampaign.audience, ''),
        cta: text(savedCampaign.cta, ''),
        riskLevel: text(savedCampaign.riskCategory || savedCampaign.risk_category, 'medium'),
      }));
      const savedPlatforms = stringList(savedCampaign.targetPlatforms || savedCampaign.target_platforms);
      if (savedPlatforms.length) setPlatforms(savedPlatforms);
      setDrafts(rows);
      setDraftTextById(Object.fromEntries(rows.map(draft => [String(draft.contentItemId), text(draft.draftText, '')])));
      setSelectedDraftId(String(rows[0]?.contentItemId || ''));
      if (rows[0]?.contentItemId) {
        const approvals = await approvalsApi.list(token, { targetId: String(rows[0].contentItemId) });
        setApproval((approvals as RecordMap[])[0] || null);
      }
      setActiveStage('draft');
      setMessage(rows.length ? 'Saved content opened.' : 'Campaign opened. Generate its first draft when you are ready.');
    } catch (reason) {
      setMessage(`Saved content could not be opened: ${reason instanceof Error ? reason.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  async function saveDraft() {
    if (!token || !selectedDraft) return;
    const contentItemId = String(selectedDraft.contentItemId);
    const draftText = draftTextById[contentItemId] || text(selectedDraft.draftText, '');
    setLoading(true);
    setMessage('');
    try {
      const saved = await aiGenerationApi.saveEdit({ contentItemId, draftText, editNote: 'Saved from Content workspace' }, token) as RecordMap;
      setDrafts(current => current.map(item => String(item.contentItemId) === contentItemId ? { ...item, ...saved } : item));
      setDraftTextById(current => ({ ...current, [contentItemId]: text(saved.draftText, draftText) }));
      setMessage(`Draft saved as version ${text(saved.versionNo, 'latest')}.`);
    } catch (reason) {
      setMessage(`Draft save failed: ${reason instanceof Error ? reason.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  async function reviewDraftQuality() {
    if (!token || !selectedDraft) return;
    const contentItemId = String(selectedDraft.contentItemId);
    setLoading(true);
    setMessage('');
    try {
      const result = await algoApi.score({
        contentItemId,
        platform: selectedDraft.platform,
        draftText: draftTextById[contentItemId] || text(selectedDraft.draftText, ''),
        objective: brief.objective,
        audience: brief.audience,
        riskCategory: brief.riskLevel,
      }, token) as RecordMap;
      setScore(result);
      setMessage('Quality review complete. Check the score and risk note before human review.');
    } catch (reason) {
      setMessage(`Quality review failed: ${reason instanceof Error ? reason.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  async function sendForReview() {
    if (!token || !selectedDraft || approval) return;
    setLoading(true);
    setMessage('');
    try {
      const result = await approvalsApi.submit({
        targetId: selectedDraft.contentItemId,
        targetType: 'content_item',
        riskCategory: brief.riskLevel || 'medium',
        approvalType: 'brand_review',
        requiredDepartment: 'Commercial',
        requiredRole: 'reviewer',
        comment: 'Review this content before scheduling.',
      }, token) as RecordMap;
      setApproval(result);
      setMessage('Sent for human review. Scheduling remains locked until an authorized approver decides.');
    } catch (reason) {
      setMessage(`Review submission failed: ${reason instanceof Error ? reason.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  const workflowStep = activeStage === 'brief' ? 0 : activeStage === 'ideas' ? 1 : 2;
  const providerLabel = provider ? `${provider.generationMode || provider.provider} / ${provider.model}` : 'AI Connected';
  const scoreValue = typeof score?.totalScore === 'number' ? score.totalScore : typeof score?.reachScore === 'number' ? score.reachScore : 0;
  const currentDraftText = selectedDraft ? draftTextById[String(selectedDraft.contentItemId)] || text(selectedDraft.draftText, '') : '';

  function resetContent() {
    setBrief(DEFAULT_BRIEF);
    setIdeas([]);
    setSelectedIdeaId('');
    setWorkflowDecision(null);
    setCampaign(null);
    setDrafts([]);
    setSelectedDraftId('');
    setDraftTextById({});
    setScore(null);
    setApproval(null);
    setMessage('');
    setActiveStage('brief');
  }

  if (pageLoading) return <OpsPage><OpsPageHeader eyebrow="Content Workspace" title="Create Campaign Content" subtitle="Loading your content workspace." /><OpsSkeleton rows={7} /></OpsPage>;

  return (
    <OpsPage className="content-workspace-page">
      <OpsPageHeader eyebrow="Content Workspace" title="Create Campaign Content" subtitle="Move from a focused brief to one review-ready draft without leaving the workflow." actions={<><Link className="ops-button is-secondary" to="/stitchi?mode=prepare&prompt=Help%20me%20create%20a%20campaign%20content%20brief"><Sparkles size={17} />Create With Stitchi</Link><button className="ops-button is-primary" type="button" onClick={resetContent}><Plus size={17} />New Content</button></>} />

      <nav className="content-journey" aria-label="Content workflow stages">
        {['Brief', 'Ideas', 'Draft'].map((step, index) => <button key={step} type="button" disabled={index === 1 && !ideas.length || index === 2 && !campaign} onClick={() => setActiveStage(index === 0 ? 'brief' : index === 1 ? 'ideas' : 'draft')} className={`${index === workflowStep ? 'is-active' : ''}${index < workflowStep ? ' is-complete' : ''}`} aria-current={index === workflowStep ? 'step' : undefined}><span>{index < workflowStep ? <Check size={14} /> : index + 1}</span><strong>{step}</strong></button>)}
        <Link to="/approvals"><span>4</span><strong>Review</strong></Link><Link to="/publishing"><span>5</span><strong>Schedule</strong></Link><Link to="/growth"><span>6</span><strong>Results</strong></Link>
      </nav>

      {message ? <OpsNotice tone={message.toLowerCase().includes('failed') || message.toLowerCase().includes('could not') ? 'danger' : 'positive'}>{message}</OpsNotice> : null}
      {!providerReady ? <OpsNotice tone="warning">Connect an AI model before generating directions. <Link className="ops-text-button" to="/ai-settings">Open AI Model Setup</Link></OpsNotice> : null}

      {activeStage === 'brief' ? <div className="content-create-layout">
        <OpsSection title="Campaign Brief" subtitle="Give the team enough context to create useful, on-brand work." action={<OpsStatus tone={providerReady ? 'positive' : 'warning'}>{providerReady ? providerLabel : 'AI Setup Required'}</OpsStatus>} className="content-brief-section">
          <form className="content-brief-form" onSubmit={event => { event.preventDefault(); void generateIdeas(); }}>
            <ContentField label="Campaign Name" htmlFor="content-campaign-name"><input id="content-campaign-name" value={brief.campaignName} onChange={event => updateBrief('campaignName', event.target.value)} placeholder="Example: Leadership course launch" /></ContentField>
            <ContentField label="Objective" htmlFor="content-objective" required wide><textarea id="content-objective" rows={3} value={brief.objective} onChange={event => updateBrief('objective', event.target.value)} placeholder="What outcome should this content create?" /></ContentField>
            <ContentField label="Audience" htmlFor="content-audience" required wide><textarea id="content-audience" rows={3} value={brief.audience} onChange={event => updateBrief('audience', event.target.value)} placeholder="Who should see this content, and why should they care?" /></ContentField>
            <fieldset className="content-platform-field"><legend>Platforms</legend><div>{PLATFORM_OPTIONS.map(platform => <button key={platform.id} type="button" className={platforms.includes(platform.id) ? 'is-active' : ''} onClick={() => togglePlatform(platform.id)} aria-pressed={platforms.includes(platform.id)}>{platform.label}</button>)}</div></fieldset>
            <details className="content-advanced-fields"><summary>Optional Brief Details <ChevronDown size={17} /></summary><div><ContentField label="Location" htmlFor="content-geography"><input id="content-geography" value={brief.geography} onChange={event => updateBrief('geography', event.target.value)} /></ContentField><ContentField label="Tone" htmlFor="content-tone"><input id="content-tone" value={brief.tone} onChange={event => updateBrief('tone', event.target.value)} /></ContentField><ContentField label="Call To Action" htmlFor="content-cta"><input id="content-cta" value={brief.cta} onChange={event => updateBrief('cta', event.target.value)} /></ContentField><ContentField label="Offer" htmlFor="content-offer"><input id="content-offer" value={brief.offer} onChange={event => updateBrief('offer', event.target.value)} /></ContentField><ContentField label="Posting Window" htmlFor="content-window"><input id="content-window" value={brief.postingWindow} onChange={event => updateBrief('postingWindow', event.target.value)} /></ContentField><ContentField label="Content Category" htmlFor="content-pillar"><input id="content-pillar" value={brief.pillar} onChange={event => updateBrief('pillar', event.target.value)} /></ContentField></div></details>
            <div className="content-form-actions"><button className="ops-button is-secondary" type="button">Save Brief</button><button className="ops-button is-primary" type="submit" disabled={!providerReady || loading || brief.objective.trim().length < 6 || brief.audience.trim().length < 3}><Sparkles size={17} />{loading ? 'Generating...' : 'Generate Directions'}</button></div>
          </form>
        </OpsSection>
        <ContentStitchiCard mode="brief" />
      </div> : null}

      {activeStage === 'ideas' ? <OpsSection title="Choose A Direction" subtitle="Compare the message before investing time in the full draft." action={<OpsStatus tone="info">{ideas.length} AI Directions</OpsStatus>} className="content-ideas-section">
        <div className="content-idea-grid">{ideas.map(idea => { const active = selectedIdeaId === idea.id; return <button key={idea.id} type="button" className={active ? 'is-active' : ''} onClick={() => { setSelectedIdeaId(idea.id); setWorkflowDecision(null); setCampaign(null); }} aria-pressed={active}><span><small>{platformLabel(idea.platform)} / {titleCase(idea.format)}</small><OpsStatus tone={active ? 'positive' : 'neutral'}>{active ? 'Selected' : 'Compare'}</OpsStatus></span><h3>{idea.title}</h3><p>{idea.hook}</p><em>{idea.rationale}</em><span className="content-hashtags">{idea.hashtags.slice(0, 4).map(tag => <span key={tag}>{tag}</span>)}</span></button>; })}</div>
        <div className="content-selection-bar"><div><strong>{selectedIdea ? selectedIdea.title : 'Choose a direction'}</strong><span>{workflowDecision?.status === 'selected' ? 'Human selection recorded. Create the draft when ready.' : 'Selection is required before draft creation.'}</span></div><div><button className="ops-button is-secondary" type="button" onClick={() => setActiveStage('brief')}><ArrowLeft size={16} />Back To Brief</button>{workflowDecision?.status !== 'selected' ? <button className="ops-button is-primary" type="button" onClick={() => void selectIdea()} disabled={loading || !selectedIdea}>Select Direction</button> : <button className="ops-button is-primary" type="button" onClick={() => void createCampaign()} disabled={loading || Boolean(campaign)}>{loading ? 'Preparing Draft...' : 'Create Draft'}<ArrowRight size={15} /></button>}</div></div>
      </OpsSection> : null}

      {activeStage === 'draft' ? <div className="content-draft-layout">
        <OpsSection title={campaign?.title || brief.campaignName || 'Prepare The Draft'} subtitle="Edit the selected platform draft, check quality, then send it for human review." action={<OpsStatus tone={approval ? 'warning' : 'info'}>{approval ? titleCase(approval.approvalStatus) : drafts.length ? `${drafts.length} Draft${drafts.length === 1 ? '' : 's'}` : 'Draft Needed'}</OpsStatus>} className="content-draft-section">
          {drafts.length ? <><div className="content-draft-tabs" role="tablist" aria-label="Platform drafts">{drafts.map(draft => <button key={String(draft.contentItemId)} type="button" role="tab" aria-selected={String(draft.contentItemId) === String(selectedDraft?.contentItemId)} className={String(draft.contentItemId) === String(selectedDraft?.contentItemId) ? 'is-active' : ''} onClick={() => { setSelectedDraftId(String(draft.contentItemId)); setScore(null); setApproval(null); }}>{platformLabel(text(draft.platform, 'content'))}</button>)}</div><div className="content-editor-layout"><div className="content-editor-fields"><label htmlFor="content-draft-text"><span>Content Draft</span><textarea id="content-draft-text" rows={13} value={currentDraftText} onChange={event => setDraftTextById(current => ({ ...current, [String(selectedDraft?.contentItemId)]: event.target.value }))} /></label><label htmlFor="content-draft-cta"><span>Call To Action</span><input id="content-draft-cta" value={brief.cta} onChange={event => updateBrief('cta', event.target.value)} placeholder="Add the next action for the audience" /></label></div><aside className="content-readiness-panel"><div><span>Platform</span><strong><FilePenLine size={16} />{platformLabel(text(selectedDraft?.platform, 'content'))}</strong></div><div><span>Quality</span><strong>{score ? `${scoreValue}/100` : 'Not Reviewed'}</strong><small>{score ? text(score.bandLabel, 'Quality review complete') : 'Run quality review before submission'}</small></div><div><span>Risk Review</span><strong><CircleAlert size={16} />{text(selectedDraft?.riskNotes, 'No risk note')}</strong></div><div><span>Next Step</span><strong>{approval ? titleCase(approval.approvalStatus) : 'Human Review'}</strong><small>{approval ? 'Decision is recorded in Review' : 'An authorized approver makes the final decision'}</small></div></aside></div><div className="content-draft-actions"><button className="ops-button is-secondary" type="button" onClick={() => setActiveStage('ideas')}><ArrowLeft size={16} />Back To Directions</button><button className="ops-button is-secondary" type="button" onClick={() => void saveDraft()} disabled={loading}><Save size={16} />Save Draft</button><button className="ops-button is-secondary" type="button" onClick={() => void reviewDraftQuality()} disabled={loading}>Review Quality</button>{approval ? <Link className="ops-button is-primary" to="/approvals"><FileCheck2 size={16} />Open Review</Link> : <button className="ops-button is-primary" type="button" onClick={() => void sendForReview()} disabled={loading || !score}><FileCheck2 size={16} />Send For Review</button>}</div></> : <OpsEmpty title="No Draft Yet" message="The campaign is saved. Generate a platform draft when the AI model is ready." action={<button className="ops-button is-primary" type="button" onClick={() => void generateDraftsForCampaign(campaign?.campaignId || '', platforms)} disabled={!providerReady || loading}><Sparkles size={16} />Generate Drafts</button>} />}
        </OpsSection>
        <ContentStitchiCard mode="draft" />
      </div> : null}

      <OpsSection title="Recent Content" subtitle="Continue saved work without opening the full library." action={<OpsStatus tone={filteredContent.length ? 'positive' : 'neutral'}>{filteredContent.length} Visible</OpsStatus>} className="content-library-section">
        <div className="content-library-filters"><label><span>Search</span><span className="content-search-control"><Search size={17} /><input value={contentSearch} onChange={event => setContentSearch(event.target.value)} placeholder="Search saved content" /></span></label><label><span>Status</span><span className="content-select-control"><select value={contentStatus} onChange={event => setContentStatus(event.target.value)}><option value="">All Statuses</option><option value="idea">Idea</option><option value="drafting">Drafting</option><option value="pending_review">Pending Review</option><option value="approved">Approved</option><option value="scheduled">Scheduled</option><option value="published">Published</option></select><ChevronDown size={17} /></span></label><label><span>Platform</span><span className="content-select-control"><select value={contentPlatform} onChange={event => setContentPlatform(event.target.value)}><option value="">All Platforms</option>{PLATFORM_OPTIONS.map(platform => <option key={platform.id} value={platform.id}>{platform.label}</option>)}</select><ChevronDown size={17} /></span></label><button className="ops-button is-secondary" type="button" onClick={() => { setContentSearch(''); setContentStatus(''); setContentPlatform(''); }}>Clear</button></div>
        {filteredContent.length ? <div className="content-library-list">{filteredContent.slice(0, 20).map(item => { const status = text(item.status, 'idea').toLowerCase(); const itemPlatforms = stringList(item.targetPlatforms || item.platforms); const action = contentAction(status); return <article key={text(item.id, campaignTitle(item))}><div><h3>{campaignTitle(item)}</h3><p>{contentSummary(item)}</p></div><span>{itemPlatforms.length ? itemPlatforms.map(platformLabel).join(', ') : 'Platform not selected'}</span><OpsStatus tone={status.includes('approved') ? 'positive' : status.includes('review') ? 'warning' : 'info'}>{titleCase(status)}</OpsStatus>{action.path === '/campaigns' ? <button className="ops-button is-secondary" type="button" onClick={() => void openSavedCampaign(item)}>Continue<ChevronRight size={16} /></button> : <Link className="ops-button is-secondary" to={action.path}>{action.label}<ChevronRight size={16} /></Link>}</article>; })}</div> : <OpsEmpty title="No Matching Content" message="Create a brief above or clear the filters to see saved campaign records." action={<button className="ops-button is-secondary" type="button" onClick={() => { setContentSearch(''); setContentStatus(''); setContentPlatform(''); }}>Clear Filters</button>} />}
      </OpsSection>
    </OpsPage>
  );
}

function ContentStitchiCard({ mode }: { mode: 'brief' | 'draft' }) {
  const draftMode = mode === 'draft';
  return <aside className="content-stitchi-card"><span><Sparkles size={20} /></span><span className="ops-eyebrow">Stitchi Assistant</span><h2>{draftMode ? 'Improve This Draft' : 'Build The Brief Through Conversation'}</h2><p>{draftMode ? 'Ask for a stronger opening, clearer call to action, or platform-specific rewrite.' : 'Stitchi can ask for missing audience, offer, channel, and timing details.'}</p><div><MessageSquareText size={17} /><span>{draftMode ? '“Make the opening more direct while keeping the promise realistic.”' : '“Create an energetic Instagram carousel for entrepreneurs.”'}</span></div><Link className="ops-button is-primary" to={`/stitchi?mode=prepare&prompt=${encodeURIComponent(draftMode ? 'Improve the selected content draft while preserving its audience, objective, and approval requirements.' : 'Help me build a complete campaign content brief.')}`}>{draftMode ? 'Improve With Stitchi' : 'Open Stitchi'}</Link><small>Stitchi prepares work. You approve what moves forward.</small></aside>;
}

function ContentField({ label, htmlFor, required = false, wide = false, children }: { label: string; htmlFor: string; required?: boolean; wide?: boolean; children: ReactNode }) {
  return <div className={`content-field${wide ? ' is-wide' : ''}`}><label htmlFor={htmlFor}>{label}{required ? <span>Required</span> : null}</label>{children}</div>;
}
