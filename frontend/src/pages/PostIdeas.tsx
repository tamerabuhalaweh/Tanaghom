import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { aiProviderApi, ideasApi } from '../api';
import {
  EmptyProductState,
  Field,
  Notice,
  PlatformPill,
  PrimaryAction,
  ProductCard,
  ProductPage,
  ProductStatus,
  ProductTable,
  SecondaryAction,
  WorkflowRail,
} from '../components/ProductUI';
import { useAuth } from '../contexts/useAuth';

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

function platformLabel(platform: string): string {
  if (platform === 'twitter' || platform === 'x') return 'X / Twitter';
  return platform.charAt(0).toUpperCase() + platform.slice(1);
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
  return [
    brief.audience,
    `Target geography: ${brief.geography}`,
  ].join('\n');
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
  const [providerLabel, setProviderLabel] = useState('Requires LLM provider');

  const selectedIdea = useMemo(() => ideas.find((idea) => idea.id === selectedIdeaId) || null, [ideas, selectedIdeaId]);
  const goalPayload = buildGoalPayload(brief);
  const audiencePayload = buildAudiencePayload(brief);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function run() {
      try {
        const active = await aiProviderApi.active(token as string) as { name?: string; model?: string; apiKeyStatus?: string; _label?: string };
        if (cancelled) return;
        setProviderReady(active.apiKeyStatus === 'configured');
        setProviderLabel(`${active.name || 'LLM provider'} / ${active.model || 'model configured'}`);
      } catch (error) {
        if (cancelled) return;
        setProviderReady(false);
        setProviderLabel(error instanceof Error ? error.message : 'Configure OpenAI or Claude before generation');
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function generateIdeas() {
    if (!token || !providerReady) return;
    setLoading(true);
    setMessage('');
    setCampaign(null);
    setWorkflowDecision(null);
    try {
      const data = await ideasApi.generate({
        goal: goalPayload,
        audience: audiencePayload,
        platforms,
        count: 4,
      }, token) as GenerateResponse;
      setIdeas(data.ideas || []);
      setSelectedIdeaId(data.ideas?.[0]?.id || '');
      setWorkflowId(data.workflow.threadId);
      setProvider(data);
      setMessage(`Generated ${data.ideas?.length || 0} campaign ideas for human review.`);
    } catch (error) {
      setMessage(`Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  async function approveSelectedIdea() {
    if (!token || !workflowId || !selectedIdea) return;
    setLoading(true);
    setMessage('');
    try {
      const decision = await ideasApi.resumeWorkflow(workflowId, {
        action: 'select',
        ideaId: selectedIdea.id,
        notes: 'Selected by human operator for campaign creation.',
      }, token) as WorkflowResumeResponse;
      setWorkflowDecision(decision);
      setMessage('Human selection recorded. Campaign creation is available.');
    } catch (error) {
      setMessage(`Selection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  async function convertToCampaign() {
    if (!token || !selectedIdea || workflowDecision?.status !== 'selected') return;
    setLoading(true);
    setMessage('');
    try {
      const data = await ideasApi.convertToCampaign({
        idea: selectedIdea,
        platforms: [selectedIdea.platform],
        audience: audiencePayload,
        goal: goalPayload,
      }, token) as CampaignResponse;
      setCampaign(data);
      setMessage(`Campaign created: ${data.title}`);
    } catch (error) {
      setMessage(`Campaign creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  function updateBrief(key: keyof typeof DEFAULT_BRIEF, value: string) {
    setBrief(current => ({ ...current, [key]: value }));
  }

  function togglePlatform(platform: string) {
    setPlatforms((current) => {
      if (current.includes(platform)) return current.length === 1 ? current : current.filter((item) => item !== platform);
      return [...current, platform];
    });
  }

  return (
    <ProductPage
      eyebrow="AI Draft Studio"
      title="Create campaign ideas"
      subtitle="For social media and marketing managers: write a campaign brief, generate platform-aware directions with your configured LLM, choose one direction, then create a campaign for drafting."
      action={<ProductStatus tone={providerReady ? 'good' : 'warn'}>{provider ? `${provider.generationMode || provider.provider} / ${provider.model}` : providerReady ? 'Live Provider Active' : 'Requires Provider'}</ProductStatus>}
    >
      <WorkflowRail steps={[
        { label: 'Brief', state: 'done' },
        { label: 'Ideas', state: ideas.length ? 'done' : 'active' },
        { label: 'Selection', state: workflowDecision?.status === 'selected' ? 'done' : ideas.length ? 'active' : 'waiting' },
        { label: 'Campaign', state: campaign ? 'done' : workflowDecision?.status === 'selected' ? 'active' : 'waiting' },
        { label: 'Drafts', state: campaign ? 'active' : 'waiting' },
        { label: 'Approval', state: 'waiting' },
        { label: 'Package', state: 'waiting' },
        { label: 'Leads', state: 'waiting' },
      ]} />

      {message && (
        <Notice tone={message.includes('failed') ? 'danger' : 'good'}>{message}</Notice>
      )}

      {!providerReady && (
        <Notice tone="warn">
          Real AI generation is blocked until this user configures OpenAI or Claude. {providerLabel}{' '}
          <Link to="/ai-settings" className="font-semibold underline">Open AI Provider Settings</Link>
        </Notice>
      )}

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <ProductCard title="Campaign Brief" subtitle="These inputs guide generation and later approval review.">
          <div className="space-y-4">
            <Field label="Campaign Name">
              <input value={brief.campaignName} onChange={(event) => updateBrief('campaignName', event.target.value)} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950" />
            </Field>
            <Field label="Business Objective">
              <textarea value={brief.objective} onChange={(event) => updateBrief('objective', event.target.value)} className="min-h-24 w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm leading-6 text-neutral-950" />
            </Field>
            <Field label="Target Audience">
              <textarea value={brief.audience} onChange={(event) => updateBrief('audience', event.target.value)} className="min-h-20 w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm leading-6 text-neutral-950" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Geography">
                <input value={brief.geography} onChange={(event) => updateBrief('geography', event.target.value)} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950" />
              </Field>
              <Field label="Tone">
                <input value={brief.tone} onChange={(event) => updateBrief('tone', event.target.value)} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950" />
              </Field>
              <Field label="CTA">
                <input value={brief.cta} onChange={(event) => updateBrief('cta', event.target.value)} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950" />
              </Field>
              <Field label="Offer">
                <input value={brief.offer} onChange={(event) => updateBrief('offer', event.target.value)} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950" />
              </Field>
              <Field label="Posting Window">
                <input value={brief.postingWindow} onChange={(event) => updateBrief('postingWindow', event.target.value)} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950" />
              </Field>
              <Field label="Content Category">
                <input value={brief.pillar} onChange={(event) => updateBrief('pillar', event.target.value)} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950" />
              </Field>
            </div>
            <Field label="Platforms">
              <div className="flex flex-wrap gap-2">
                {PLATFORM_OPTIONS.map(platform => (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => togglePlatform(platform.id)}
                    className="focus:outline-none"
                  >
                    <PlatformPill active={platforms.includes(platform.id)}>{platform.label}</PlatformPill>
                  </button>
                ))}
              </div>
            </Field>
            <PrimaryAction onClick={generateIdeas} disabled={!providerReady || loading || brief.objective.trim().length < 6 || brief.audience.trim().length < 3}>
              {loading ? 'Working...' : 'Generate Ideas'}
            </PrimaryAction>
          </div>
        </ProductCard>

        <div className="space-y-6">
          <ProductCard title="Generated Ideas" subtitle="Choose one AI-generated direction before creating the campaign.">
            {ideas.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {ideas.map((idea) => {
                  const active = selectedIdeaId === idea.id;
                  return (
                    <button
                      key={idea.id}
                      type="button"
                      onClick={() => setSelectedIdeaId(idea.id)}
                      className={`rounded-lg border p-5 text-left transition ${active ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white hover:bg-neutral-50'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className={active ? 'text-sm font-medium text-white/60' : 'text-sm font-medium text-neutral-500'}>{platformLabel(idea.platform)} / {idea.format.replaceAll('_', ' ')}</div>
                          <h2 className="mt-3 text-lg font-semibold leading-snug">{idea.title}</h2>
                        </div>
                        <ProductStatus tone={active ? 'muted' : 'info'}>{active ? 'Selected' : 'Review'}</ProductStatus>
                      </div>
                      <p className={`mt-4 text-sm leading-6 ${active ? 'text-white/75' : 'text-neutral-600'}`}>{idea.hook}</p>
                      <p className={`mt-3 text-sm leading-6 ${active ? 'text-white/50' : 'text-neutral-500'}`}>{idea.rationale}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {idea.hashtags.map((tag) => (
                          <span key={tag} className={`rounded-md border px-2 py-1 text-xs ${active ? 'border-white/15 bg-white/10 text-white/75' : 'border-neutral-200 bg-neutral-50 text-neutral-600'}`}>{tag}</span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyProductState
                title="Ready for AI preparation"
                message="Complete or adjust the campaign brief, choose platforms, and generate campaign directions for human review."
              />
            )}
          </ProductCard>

          <ProductCard title="Campaign Decision" subtitle="The campaign is created only after a human chooses the direction.">
            <div className="flex flex-wrap items-center gap-3">
              <PrimaryAction onClick={approveSelectedIdea} disabled={loading || !selectedIdea || workflowDecision?.status === 'selected'}>
                Select This Idea
              </PrimaryAction>
              <SecondaryAction onClick={convertToCampaign} disabled={loading || workflowDecision?.status !== 'selected' || Boolean(campaign)}>
                Create Campaign From Selected Idea
              </SecondaryAction>
              {campaign && (
                <Link to="/campaigns" className="inline-flex min-h-10 items-center justify-center rounded-md bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
                  Open Campaigns
                </Link>
              )}
            </div>
          </ProductCard>

          <ProductCard title="Prepared Context" subtitle="Readable summary used by the AI provider.">
            <ProductTable
              columns={['Input', 'Value']}
              rows={[
                ['Objective', brief.objective],
                ['Audience', brief.audience],
                ['CTA', brief.cta],
                ['Platforms', platforms.map(platformLabel).join(', ')],
                ['Safety', 'Human approval required before publishing preparation'],
              ]}
            />
          </ProductCard>
        </div>
      </div>
    </ProductPage>
  );
}
