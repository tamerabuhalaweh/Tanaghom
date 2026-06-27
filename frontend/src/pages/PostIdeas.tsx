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
  const [pageLoading, setPageLoading] = useState(Boolean(token));

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
      } catch {
        if (cancelled) return;
        setProviderReady(false);
      } finally {
        if (!cancelled) setPageLoading(false);
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
      setMessage(`Generated ${data.ideas?.length || 0} campaign ideas for your review.`);
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
        notes: 'Selected for campaign creation.',
      }, token) as WorkflowResumeResponse;
      setWorkflowDecision(decision);
      setMessage('Idea selected. You can now create a campaign from it.');
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

  // ---- Skeleton loading ----
  if (pageLoading) {
    return (
      <ProductPage eyebrow="Content Studio" title="Content Creator" subtitle="Loading...">
        <div className="space-y-6">
          <div className="skeleton-pulse h-10 w-72 rounded-lg" />
          <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="skeleton-pulse h-96 rounded-xl" />
            <div className="skeleton-pulse h-96 rounded-xl" />
          </div>
        </div>
      </ProductPage>
    );
  }

  return (
    <ProductPage
      eyebrow="Content Studio"
      title="Content Creator"
      subtitle="Fill in your campaign brief and let AI generate creative directions for you to choose from."
      action={
        <ProductStatus tone={providerReady ? 'good' : 'warn'}>
          {providerReady
            ? (provider ? `${provider.generationMode || provider.provider} / ${provider.model}` : 'AI Connected')
            : 'Connect AI Model'}
        </ProductStatus>
      }
    >
      <WorkflowRail
        steps={[
          { label: 'Brief', state: 'active' },
          { label: 'Ideas', state: ideas.length ? 'done' : 'waiting' },
          { label: 'Campaign', state: campaign ? 'done' : workflowDecision?.status === 'selected' ? 'active' : 'waiting' },
        ]}
      />

      {message && (
        <Notice tone={message.includes('failed') ? 'danger' : 'good'}>{message}</Notice>
      )}

      {!providerReady && (
        <Notice tone="warn">
          Connect an AI model to generate campaign ideas.{' '}
          <Link to="/ai-settings" className="font-semibold underline">Go to AI Settings</Link>
        </Notice>
      )}

      {/* ---- Quick guide for first-time users ---- */}
      {!ideas.length && !campaign && (
        <ProductCard
          title="How it works"
          subtitle="Three simple steps to create your campaign."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { step: '1', title: 'Write your brief', desc: 'Tell us about your campaign goal, audience, and what action you want people to take.' },
              { step: '2', title: 'AI generates ideas', desc: 'Your connected AI model creates platform-specific campaign directions for you to review.' },
              { step: '3', title: 'You choose & create', desc: 'Pick the direction you like, and we create a campaign ready for content generation.' },
            ].map((item) => (
              <div key={item.step} className="rounded-lg border border-neutral-200 bg-neutral-50 p-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-950 text-sm font-semibold text-white">
                  {item.step}
                </div>
                <div className="mt-3 text-sm font-semibold text-neutral-950">{item.title}</div>
                <p className="mt-1 text-sm leading-6 text-neutral-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </ProductCard>
      )}

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <ProductCard
          title="Campaign Brief"
          subtitle="Fill in the details below. The AI uses this to generate creative campaign directions."
        >
          <div className="space-y-4">
            <Field label="Campaign Name">
              <input
                value={brief.campaignName}
                onChange={(event) => updateBrief('campaignName', event.target.value)}
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950"
                placeholder="e.g. Summer product launch"
              />
            </Field>
            <Field label="What's the goal?">
              <textarea
                value={brief.objective}
                onChange={(event) => updateBrief('objective', event.target.value)}
                className="min-h-24 w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm leading-6 text-neutral-950"
                placeholder="e.g. Drive awareness for our new product line and generate 500 sign-ups"
              />
            </Field>
            <Field label="Who are you talking to?">
              <textarea
                value={brief.audience}
                onChange={(event) => updateBrief('audience', event.target.value)}
                className="min-h-20 w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm leading-6 text-neutral-950"
                placeholder="e.g. Marketing managers at mid-size tech companies in North America"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Location">
                <input
                  value={brief.geography}
                  onChange={(event) => updateBrief('geography', event.target.value)}
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950"
                  placeholder="e.g. North America"
                />
              </Field>
              <Field label="Tone">
                <input
                  value={brief.tone}
                  onChange={(event) => updateBrief('tone', event.target.value)}
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950"
                  placeholder="e.g. professional, casual, inspiring"
                />
              </Field>
              <Field label="Call to Action">
                <input
                  value={brief.cta}
                  onChange={(event) => updateBrief('cta', event.target.value)}
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950"
                  placeholder="e.g. Sign up for early access"
                />
              </Field>
              <Field label="Your Offer">
                <input
                  value={brief.offer}
                  onChange={(event) => updateBrief('offer', event.target.value)}
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950"
                  placeholder="e.g. 30% off first month"
                />
              </Field>
              <Field label="When to post">
                <input
                  value={brief.postingWindow}
                  onChange={(event) => updateBrief('postingWindow', event.target.value)}
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950"
                  placeholder="e.g. Next two weeks"
                />
              </Field>
              <Field label="Content Category">
                <input
                  value={brief.pillar}
                  onChange={(event) => updateBrief('pillar', event.target.value)}
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950"
                  placeholder="e.g. Product launch, thought leadership"
                />
              </Field>
            </div>
            <Field label="Platforms">
              <div className="flex flex-wrap gap-2">
                {PLATFORM_OPTIONS.map((platform) => (
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
            <PrimaryAction
              onClick={generateIdeas}
              disabled={
                !providerReady ||
                loading ||
                brief.objective.trim().length < 6 ||
                brief.audience.trim().length < 3
              }
            >
              {loading ? 'Generating ideas...' : !providerReady ? 'Connect AI Model First' : 'Generate Campaign Ideas'}
            </PrimaryAction>
          </div>
        </ProductCard>

        <div className="space-y-6">
          <ProductCard
            title="Generated Ideas"
            subtitle="Review the AI-generated directions and pick the one you like best."
          >
            {ideas.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {ideas.map((idea) => {
                  const active = selectedIdeaId === idea.id;
                  return (
                    <button
                      key={idea.id}
                      type="button"
                      onClick={() => setSelectedIdeaId(idea.id)}
                      className={`rounded-lg border p-5 text-left transition ${
                        active
                          ? 'border-neutral-950 bg-neutral-950 text-white'
                          : 'border-neutral-200 bg-white hover:bg-neutral-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div
                            className={
                              active
                                ? 'text-sm font-medium text-white/60'
                                : 'text-sm font-medium text-neutral-500'
                            }
                          >
                            {platformLabel(idea.platform)} / {idea.format.replaceAll('_', ' ')}
                          </div>
                          <h2 className="mt-3 text-lg font-semibold leading-snug">{idea.title}</h2>
                        </div>
                        <ProductStatus tone={active ? 'muted' : 'info'}>
                          {active ? 'Selected' : 'Review'}
                        </ProductStatus>
                      </div>
                      <p
                        className={`mt-4 text-sm leading-6 ${
                          active ? 'text-white/75' : 'text-neutral-600'
                        }`}
                      >
                        {idea.hook}
                      </p>
                      <p
                        className={`mt-3 text-sm leading-6 ${
                          active ? 'text-white/50' : 'text-neutral-500'
                        }`}
                      >
                        {idea.rationale}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {idea.hashtags.map((tag) => (
                          <span
                            key={tag}
                            className={`rounded-md border px-2 py-1 text-xs ${
                              active
                                ? 'border-white/15 bg-white/10 text-white/75'
                                : 'border-neutral-200 bg-neutral-50 text-neutral-600'
                            }`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyProductState
                title="Your campaign ideas will appear here"
                message="Fill in the brief on the left and click Generate Campaign Ideas. The AI creates platform-specific directions for you to review."
              />
            )}
          </ProductCard>

          <ProductCard
            title="Make Your Choice"
            subtitle="Select your favorite idea, then create a campaign from it."
          >
            <div className="flex flex-wrap items-center gap-3">
              <PrimaryAction
                onClick={approveSelectedIdea}
                disabled={loading || !selectedIdea || workflowDecision?.status === 'selected'}
              >
                {workflowDecision?.status === 'selected' ? 'Idea Selected' : 'Choose This Idea'}
              </PrimaryAction>
              <SecondaryAction
                onClick={convertToCampaign}
                disabled={
                  loading ||
                  workflowDecision?.status !== 'selected' ||
                  Boolean(campaign)
                }
              >
                {campaign ? 'Campaign Created' : 'Create Campaign From Idea'}
              </SecondaryAction>
              {campaign && (
                <Link
                  to="/campaigns"
                  className="inline-flex min-h-10 items-center justify-center rounded-md bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  Open in Campaigns
                </Link>
              )}
            </div>
            {!selectedIdea && ideas.length > 0 && (
              <p className="mt-3 text-sm text-neutral-500">
                Click on any idea card above to select it, then choose it as your direction.
              </p>
            )}
            {workflowDecision?.status === 'selected' && !campaign && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                Idea selected - now click "Create Campaign From Idea" to turn it into a campaign.
              </div>
            )}
          </ProductCard>

          <ProductCard title="Your Brief Summary" subtitle="What the AI will work with.">
            <ProductTable
              columns={['Input', 'Value']}
              rows={[
                ['Goal', brief.objective || 'Not filled in yet'],
                ['Audience', brief.audience || 'Not filled in yet'],
                ['Call to Action', brief.cta || 'Not filled in yet'],
                ['Platforms', platforms.length ? platforms.map(platformLabel).join(', ') : 'Select platforms above'],
                ['Safety', 'Human approval required before publishing'],
              ]}
            />
          </ProductCard>
        </div>
      </div>
    </ProductPage>
  );
}
