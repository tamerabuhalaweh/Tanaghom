import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  MessageSquareText,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import { aiProviderApi, campaignsApi, ideasApi } from '../api';
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
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [providerReady, setProviderReady] = useState(false);
  const [pageLoading, setPageLoading] = useState(Boolean(token));
  const [contentLibrary, setContentLibrary] = useState<RecordMap[]>([]);
  const [contentSearch, setContentSearch] = useState('');
  const [contentStatus, setContentStatus] = useState('');
  const [contentPlatform, setContentPlatform] = useState('');

  const selectedIdea = useMemo(() => ideas.find(idea => idea.id === selectedIdeaId) || null, [ideas, selectedIdeaId]);
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
      }, ...current]);
      setMessage(`Campaign created: ${data.title}`);
    } catch (reason) {
      setMessage(`Campaign creation failed: ${reason instanceof Error ? reason.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  const workflowStep = campaign ? 3 : workflowDecision?.status === 'selected' ? 2 : ideas.length ? 1 : 0;
  const providerLabel = provider ? `${provider.generationMode || provider.provider} / ${provider.model}` : 'AI Connected';

  if (pageLoading) return <OpsPage><OpsPageHeader eyebrow="Content Workspace" title="Create Campaign Content" subtitle="Loading your content workspace." /><OpsSkeleton rows={7} /></OpsPage>;

  return (
    <OpsPage className="content-workspace-page">
      <OpsPageHeader
        eyebrow="Content Workspace"
        title="Create Campaign Content"
        subtitle="Start with a focused brief, create directions with AI, then move one selected direction into campaign production."
        actions={(
          <>
            <Link className="ops-button is-secondary" to="/stitchi?mode=prepare&prompt=Help%20me%20create%20a%20campaign%20content%20brief"><Sparkles size={17} aria-hidden="true" />Create With Stitchi</Link>
            <button className="ops-button is-primary" type="button" onClick={() => { setBrief(DEFAULT_BRIEF); setIdeas([]); setWorkflowDecision(null); setCampaign(null); }}><Plus size={17} aria-hidden="true" />New Brief</button>
          </>
        )}
      />

      <nav className="content-journey" aria-label="Content workflow stages">
        {['Brief', 'Ideas', 'Campaign', 'Review', 'Schedule', 'Results'].map((step, index) => (
          <span key={step} className={`${index === workflowStep ? 'is-active' : ''}${index < workflowStep ? ' is-complete' : ''}`}>
            <span>{index < workflowStep ? <Check size={14} aria-hidden="true" /> : index + 1}</span><strong>{step}</strong>
          </span>
        ))}
      </nav>

      {message ? <OpsNotice tone={message.toLowerCase().includes('failed') ? 'danger' : 'positive'}>{message}</OpsNotice> : null}
      {!providerReady ? <OpsNotice tone="warning">Connect an AI model before generating directions. <Link className="ops-text-button" to="/ai-settings">Open AI Model Setup</Link></OpsNotice> : null}

      <div className="content-create-layout">
        <OpsSection title="Campaign Brief" subtitle="Required information first. Add optional details only when they improve the result." action={<OpsStatus tone={providerReady ? 'positive' : 'warning'}>{providerReady ? providerLabel : 'AI Setup Required'}</OpsStatus>} className="content-brief-section">
          <form className="content-brief-form" onSubmit={event => { event.preventDefault(); void generateIdeas(); }}>
            <ContentField label="Campaign Name" htmlFor="content-campaign-name">
              <input id="content-campaign-name" name="campaignName" value={brief.campaignName} onChange={event => updateBrief('campaignName', event.target.value)} placeholder={'Example: Leadership course launch\u2026'} autoComplete="off" />
            </ContentField>
            <ContentField label="Objective" htmlFor="content-objective" required wide>
              <textarea id="content-objective" name="objective" rows={3} value={brief.objective} onChange={event => updateBrief('objective', event.target.value)} placeholder={'What outcome should this content create?\u2026'} />
            </ContentField>
            <ContentField label="Audience" htmlFor="content-audience" required wide>
              <textarea id="content-audience" name="audience" rows={3} value={brief.audience} onChange={event => updateBrief('audience', event.target.value)} placeholder={'Who should see this content, and why should they care?\u2026'} />
            </ContentField>
            <fieldset className="content-platform-field">
              <legend>Platforms</legend>
              <div>{PLATFORM_OPTIONS.map(platform => <button key={platform.id} type="button" className={platforms.includes(platform.id) ? 'is-active' : ''} onClick={() => togglePlatform(platform.id)} aria-pressed={platforms.includes(platform.id)}>{platform.label}</button>)}</div>
            </fieldset>

            <details className="content-advanced-fields">
              <summary>Optional Brief Details <ChevronDown size={17} aria-hidden="true" /></summary>
              <div>
                <ContentField label="Location" htmlFor="content-geography"><input id="content-geography" name="geography" value={brief.geography} onChange={event => updateBrief('geography', event.target.value)} placeholder={'Example: GCC\u2026'} autoComplete="off" /></ContentField>
                <ContentField label="Tone" htmlFor="content-tone"><input id="content-tone" name="tone" value={brief.tone} onChange={event => updateBrief('tone', event.target.value)} autoComplete="off" /></ContentField>
                <ContentField label="Call to Action" htmlFor="content-cta"><input id="content-cta" name="cta" value={brief.cta} onChange={event => updateBrief('cta', event.target.value)} placeholder={'Example: Reserve your place\u2026'} autoComplete="off" /></ContentField>
                <ContentField label="Offer" htmlFor="content-offer"><input id="content-offer" name="offer" value={brief.offer} onChange={event => updateBrief('offer', event.target.value)} placeholder={'What is being offered?\u2026'} autoComplete="off" /></ContentField>
                <ContentField label="Posting Window" htmlFor="content-window"><input id="content-window" name="postingWindow" value={brief.postingWindow} onChange={event => updateBrief('postingWindow', event.target.value)} placeholder={'Example: Next 2 weeks\u2026'} autoComplete="off" /></ContentField>
                <ContentField label="Content Category" htmlFor="content-pillar"><input id="content-pillar" name="pillar" value={brief.pillar} onChange={event => updateBrief('pillar', event.target.value)} placeholder={'Example: Thought leadership\u2026'} autoComplete="off" /></ContentField>
              </div>
            </details>

            <div className="content-form-actions">
              <Link className="ops-button is-secondary" to="/campaigns">Open Saved Campaigns</Link>
              <button className="ops-button is-primary" type="submit" disabled={!providerReady || loading || brief.objective.trim().length < 6 || brief.audience.trim().length < 3}><Sparkles size={17} aria-hidden="true" />{loading ? 'Generating\u2026' : 'Generate 4 Directions'}</button>
            </div>
          </form>
        </OpsSection>

        <aside className="content-stitchi-card">
          <span><Sparkles size={20} aria-hidden="true" /></span>
          <span className="ops-eyebrow">Stitchi Is Ready</span>
          <h2>Build the brief through conversation.</h2>
          <p>Stitchi can ask for missing audience, offer, channel, and timing details before preparing governed content work.</p>
          <div><MessageSquareText size={17} aria-hidden="true" /><span>"Create an energetic Instagram carousel for entrepreneurs who want to become stronger leaders."</span></div>
          <Link className="ops-button is-primary" to="/stitchi?mode=prepare&prompt=Help%20me%20build%20a%20content%20brief">Open Stitchi</Link>
          <small>Stitchi prepares work. You choose what moves forward.</small>
        </aside>
      </div>

      {ideas.length ? (
        <OpsSection title="Generated Directions" subtitle="Compare the AI-generated directions and choose one human-approved path." className="content-ideas-section">
          <div className="content-idea-grid">
            {ideas.map(idea => {
              const active = selectedIdeaId === idea.id;
              return (
                <button key={idea.id} type="button" className={active ? 'is-active' : ''} onClick={() => { setSelectedIdeaId(idea.id); setWorkflowDecision(null); setCampaign(null); }} aria-pressed={active}>
                  <span><small>{platformLabel(idea.platform)} / {titleCase(idea.format)}</small><OpsStatus tone={active ? 'positive' : 'neutral'}>{active ? 'Selected' : 'Compare'}</OpsStatus></span>
                  <h3>{idea.title}</h3><p>{idea.hook}</p><em>{idea.rationale}</em>
                  <span className="content-hashtags">{idea.hashtags.slice(0, 4).map(tag => <span key={tag}>{tag}</span>)}</span>
                </button>
              );
            })}
          </div>
          <div className="content-selection-bar">
            <div><strong>{selectedIdea ? selectedIdea.title : 'Choose a direction'}</strong><span>{workflowDecision?.status === 'selected' ? 'Human selection recorded. The campaign can now be created.' : 'Selection is required before campaign creation.'}</span></div>
            <div>
              <button className="ops-button is-secondary" type="button" onClick={() => void selectIdea()} disabled={loading || !selectedIdea || workflowDecision?.status === 'selected'}>{workflowDecision?.status === 'selected' ? 'Direction Selected' : 'Select Direction'}</button>
              <button className="ops-button is-primary" type="button" onClick={() => void createCampaign()} disabled={loading || workflowDecision?.status !== 'selected' || Boolean(campaign)}>{campaign ? 'Campaign Created' : 'Create Campaign'}</button>
              {campaign ? <Link className="ops-button is-secondary" to="/campaigns">Open Campaign <ArrowRight size={15} aria-hidden="true" /></Link> : null}
            </div>
          </div>
        </OpsSection>
      ) : null}

      <OpsSection title="Recent Content" subtitle="Continue real saved campaign records without searching through every workflow." action={<OpsStatus tone={filteredContent.length ? 'positive' : 'neutral'}>{filteredContent.length} Visible</OpsStatus>} className="content-library-section">
        <div className="content-library-filters">
          <label><span>Search</span><span className="content-search-control"><Search size={17} aria-hidden="true" /><input name="contentSearch" value={contentSearch} onChange={event => setContentSearch(event.target.value)} placeholder={'Search saved content\u2026'} autoComplete="off" /></span></label>
          <label><span>Status</span><span className="content-select-control"><select name="contentStatus" value={contentStatus} onChange={event => setContentStatus(event.target.value)}><option value="">All Statuses</option><option value="idea">Idea</option><option value="drafting">Drafting</option><option value="pending_review">Pending Review</option><option value="approved">Approved</option><option value="scheduled">Scheduled</option><option value="published">Published</option></select><ChevronDown size={17} aria-hidden="true" /></span></label>
          <label><span>Platform</span><span className="content-select-control"><select name="contentPlatform" value={contentPlatform} onChange={event => setContentPlatform(event.target.value)}><option value="">All Platforms</option>{PLATFORM_OPTIONS.map(platform => <option key={platform.id} value={platform.id}>{platform.label}</option>)}</select><ChevronDown size={17} aria-hidden="true" /></span></label>
          <button className="ops-button is-secondary" type="button" onClick={() => { setContentSearch(''); setContentStatus(''); setContentPlatform(''); }}>Clear</button>
        </div>

        {filteredContent.length ? (
          <div className="content-library-list">
            {filteredContent.slice(0, 20).map(item => {
              const status = text(item.status, 'idea').toLowerCase();
              const itemPlatforms = stringList(item.targetPlatforms || item.platforms);
              const action = contentAction(status);
              return (
                <article key={text(item.id, campaignTitle(item))}>
                  <div><h3>{campaignTitle(item)}</h3><p>{contentSummary(item)}</p></div>
                  <span>{itemPlatforms.length ? itemPlatforms.map(platformLabel).join(', ') : 'Platform not selected'}</span>
                  <OpsStatus tone={status.includes('approved') ? 'positive' : status.includes('review') ? 'warning' : 'info'}>{titleCase(status)}</OpsStatus>
                  <Link className="ops-button is-secondary" to={action.path}>{action.label}<ChevronRight size={16} aria-hidden="true" /></Link>
                </article>
              );
            })}
          </div>
        ) : <OpsEmpty title="No matching content" message="Create a brief above or clear the filters to see saved campaign records." action={<button className="ops-button is-secondary" type="button" onClick={() => { setContentSearch(''); setContentStatus(''); setContentPlatform(''); }}>Clear Filters</button>} />}
      </OpsSection>
    </OpsPage>
  );
}

function ContentField({ label, htmlFor, required = false, wide = false, children }: { label: string; htmlFor: string; required?: boolean; wide?: boolean; children: ReactNode }) {
  return <div className={`content-field${wide ? ' is-wide' : ''}`}><label htmlFor={htmlFor}>{label}{required ? <span>Required</span> : null}</label>{children}</div>;
}
