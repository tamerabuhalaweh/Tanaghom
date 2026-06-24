import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ideasApi } from '../api';
import { ProductCard, ProductPage, ProductStatus, PrimaryAction, SecondaryAction, WorkflowRail } from '../components/ProductUI';
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
  { id: 'twitter', label: 'X / Twitter' },
];

const EXAMPLE_GOAL = 'Generate qualified leads for a premium social media intelligence service';
const EXAMPLE_AUDIENCE = 'Marketing directors and CEOs who need safer AI-assisted campaign execution';

function platformLabel(platform: string): string {
  if (platform === 'twitter' || platform === 'x') return 'X / Twitter';
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

export default function PostIdeas() {
  const { token } = useAuth();
  const [goal, setGoal] = useState(EXAMPLE_GOAL);
  const [audience, setAudience] = useState(EXAMPLE_AUDIENCE);
  const [platforms, setPlatforms] = useState<string[]>(['linkedin', 'instagram', 'twitter']);
  const [ideas, setIdeas] = useState<PostIdea[]>([]);
  const [selectedIdeaId, setSelectedIdeaId] = useState('');
  const [workflowId, setWorkflowId] = useState('');
  const [provider, setProvider] = useState<GenerateResponse | null>(null);
  const [workflowDecision, setWorkflowDecision] = useState<WorkflowResumeResponse | null>(null);
  const [campaign, setCampaign] = useState<CampaignResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const selectedIdea = useMemo(() => ideas.find((idea) => idea.id === selectedIdeaId) || null, [ideas, selectedIdeaId]);

  async function generateIdeas() {
    if (!token) return;
    setLoading(true);
    setMessage('');
    setCampaign(null);
    setWorkflowDecision(null);
    try {
      const data = await ideasApi.generate({ goal, audience, platforms, count: 4 }, token) as GenerateResponse;
      setIdeas(data.ideas || []);
      setSelectedIdeaId(data.ideas?.[0]?.id || '');
      setWorkflowId(data.workflow.threadId);
      setProvider(data);
      setMessage(`Generated ${data.ideas?.length || 0} campaign ideas.`);
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
      const data = await ideasApi.convertToCampaign({ idea: selectedIdea, platforms: [selectedIdea.platform], audience, goal }, token) as CampaignResponse;
      setCampaign(data);
      setMessage(`Campaign created: ${data.title}`);
    } catch (error) {
      setMessage(`Campaign creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  function togglePlatform(platform: string) {
    setPlatforms((current) => {
      if (current.includes(platform)) return current.length === 1 ? current : current.filter((item) => item !== platform);
      return [...current, platform];
    });
  }

  return (
    <ProductPage
      eyebrow="Campaign ideation"
      title="AI Draft Studio"
      subtitle="Turn a business goal into campaign-ready ideas, select one with human review, then create a campaign for the drafting workflow."
      action={<ProductStatus tone={provider?.apiKeyStatus === 'configured' ? 'good' : 'info'}>{provider ? `${provider.provider} / ${provider.model}` : 'Provider ready'}</ProductStatus>}
    >
      <WorkflowRail steps={[
        { label: 'Input', state: 'done' },
        { label: 'Ideas', state: ideas.length ? 'done' : 'active' },
        { label: 'Selection', state: workflowDecision?.status === 'selected' ? 'done' : ideas.length ? 'active' : 'waiting' },
        { label: 'Campaign', state: campaign ? 'done' : workflowDecision?.status === 'selected' ? 'active' : 'waiting' },
        { label: 'Drafts', state: campaign ? 'active' : 'waiting' },
        { label: 'Approval', state: 'waiting' },
        { label: 'Publishing', state: 'waiting' },
        { label: 'Leads', state: 'waiting' },
      ]} />

      {message && (
        <div className={`rounded-2xl px-4 py-3 text-sm ${message.includes('failed') ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-100' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'}`}>
          {message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <ProductCard title="Campaign Input" subtitle="Describe the business outcome and audience.">
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-black/35">Business Goal</span>
              <textarea value={goal} onChange={(event) => setGoal(event.target.value)} className="mt-2 h-28 w-full rounded-2xl border border-black/10 bg-stone-50 p-4 text-sm leading-6 text-black outline-none focus:border-black" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-black/35">Target Audience</span>
              <textarea value={audience} onChange={(event) => setAudience(event.target.value)} className="mt-2 h-24 w-full rounded-2xl border border-black/10 bg-stone-50 p-4 text-sm leading-6 text-black outline-none focus:border-black" />
            </label>
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-black/35">Platforms</span>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {PLATFORM_OPTIONS.map((platform) => (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => togglePlatform(platform.id)}
                    className={`rounded-xl px-3 py-3 text-xs font-semibold transition ${platforms.includes(platform.id) ? 'bg-black text-white' : 'bg-stone-50 text-black/55 hover:bg-stone-100'}`}
                  >
                    {platform.label}
                  </button>
                ))}
              </div>
            </div>
            <PrimaryAction onClick={generateIdeas} disabled={loading || goal.trim().length < 6 || audience.trim().length < 3}>
              {loading ? 'Working...' : 'Generate Ideas'}
            </PrimaryAction>
          </div>
        </ProductCard>

        <div className="space-y-6">
          <ProductCard title="Generated Ideas" subtitle="Select the strongest direction before creating a campaign.">
            {ideas.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {ideas.map((idea) => {
                  const active = selectedIdeaId === idea.id;
                  return (
                    <article key={idea.id} className={`rounded-2xl p-5 ring-1 ${active ? 'bg-black text-white ring-black' : 'bg-stone-50 text-black ring-black/6'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className={active ? 'text-sm font-semibold text-white/60' : 'text-sm font-semibold text-black/42'}>{platformLabel(idea.platform)} / {idea.format}</div>
                          <h2 className="mt-3 text-lg font-semibold leading-snug">{idea.title}</h2>
                        </div>
                        <input aria-label={`Select ${idea.title}`} type="radio" checked={active} onChange={() => setSelectedIdeaId(idea.id)} className="mt-1 h-5 w-5 accent-black" />
                      </div>
                      <p className={`mt-4 text-sm leading-6 ${active ? 'text-white/74' : 'text-black/62'}`}>{idea.hook}</p>
                      <p className={`mt-3 text-sm leading-6 ${active ? 'text-white/45' : 'text-black/45'}`}>{idea.rationale}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {idea.hashtags.map((tag) => (
                          <span key={tag} className={`rounded-full px-2.5 py-1 text-xs ${active ? 'bg-white/10 text-white/70' : 'bg-white text-black/55 shadow-sm'}`}>{tag}</span>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl bg-stone-50 p-10 text-center">
                <h2 className="text-xl font-semibold text-black">Ready to generate campaign directions</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-black/52">
                  Fill the campaign input and generate ideas for the selected platforms.
                </p>
              </div>
            )}
          </ProductCard>

          <ProductCard title="Human Selection" subtitle="A campaign is created only after a human selects an idea.">
            <div className="flex flex-wrap items-center gap-3">
              <PrimaryAction onClick={approveSelectedIdea} disabled={loading || !selectedIdea || workflowDecision?.status === 'selected'}>
                Record Human Selection
              </PrimaryAction>
              <SecondaryAction onClick={convertToCampaign} disabled={loading || workflowDecision?.status !== 'selected' || Boolean(campaign)}>
                Create Campaign
              </SecondaryAction>
              {campaign && (
                <Link to="/campaigns" className="inline-flex rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
                  Open Campaigns
                </Link>
              )}
            </div>
          </ProductCard>
        </div>
      </div>
    </ProductPage>
  );
}
