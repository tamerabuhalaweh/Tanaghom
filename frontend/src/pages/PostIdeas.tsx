import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { Badge } from '../components/ExecutiveUI';
import { ideasApi } from '../api';

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
  workflow: {
    threadId: string;
    status: string;
    interrupt?: unknown;
  };
  ideas: PostIdea[];
  provider: string;
  providerType: string;
  model: string;
  apiKeyStatus: string;
  generationMode: string;
  safety: {
    externalExecution: string;
    m5: string;
    humanApproval: string;
  };
}

interface WorkflowResumeResponse {
  threadId: string;
  status: 'selected' | 'rejected';
  selectedIdeaId?: string;
  reviewerNotes?: string;
}

interface CampaignResponse {
  campaignId: string;
  title: string;
  status: string;
  nextStep: string;
}

const PLATFORM_OPTIONS = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'twitter', label: 'X / Twitter' },
];

const EXAMPLE_GOAL = 'Generate qualified leads for a premium social media intelligence service';
const EXAMPLE_AUDIENCE = 'Marketing directors and CEOs who need safer AI-assisted campaign execution';

export default function PostIdeas() {
  const { token } = useAuth();
  const [goal, setGoal] = useState(EXAMPLE_GOAL);
  const [audience, setAudience] = useState(EXAMPLE_AUDIENCE);
  const [platforms, setPlatforms] = useState<string[]>(['linkedin', 'instagram', 'twitter']);
  const [ideas, setIdeas] = useState<PostIdea[]>([]);
  const [selectedIdeaId, setSelectedIdeaId] = useState<string>('');
  const [workflowId, setWorkflowId] = useState<string>('');
  const [provider, setProvider] = useState<GenerateResponse | null>(null);
  const [workflowDecision, setWorkflowDecision] = useState<WorkflowResumeResponse | null>(null);
  const [campaign, setCampaign] = useState<CampaignResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const selectedIdea = useMemo(
    () => ideas.find((idea) => idea.id === selectedIdeaId) || null,
    [ideas, selectedIdeaId],
  );

  const generateIdeas = async () => {
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
      setMessage(`Generated ${data.ideas?.length || 0} ideas through ${data.provider} (${data.model})`);
    } catch (err) {
      setMessage(`Generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const approveSelectedIdea = async () => {
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
      setMessage('Human selection recorded by workflow. Campaign conversion is now available.');
    } catch (err) {
      setMessage(`Selection failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const convertToCampaign = async () => {
    if (!token || !selectedIdea || workflowDecision?.status !== 'selected') return;
    setLoading(true);
    setMessage('');
    try {
      const data = await ideasApi.convertToCampaign({
        idea: selectedIdea,
        platforms: [selectedIdea.platform],
        audience,
        goal,
      }, token) as CampaignResponse;
      setCampaign(data);
      setMessage(`Campaign created: ${data.title}`);
    } catch (err) {
      setMessage(`Campaign creation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const togglePlatform = (platform: string) => {
    setPlatforms((current) => {
      if (current.includes(platform)) {
        return current.length === 1 ? current : current.filter((item) => item !== platform);
      }
      return [...current, platform];
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-slate-950/40 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">Working Product Flow</Badge>
            <Badge variant="warning">Human Approval Required</Badge>
            <Badge variant="default">External Execution Blocked</Badge>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">AI Post Ideas Studio</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Turn a business objective into platform-specific commercial post ideas, pause for human selection, then create a real campaign record for the drafting and approval pipeline.
          </p>
        </div>
        <div className="grid min-w-72 grid-cols-2 gap-3 text-sm">
          <StatusTile label="Provider" value={provider?.provider || 'Not run'} tone={provider?.providerType === 'mock' ? 'amber' : 'green'} />
          <StatusTile label="Model" value={provider?.model || 'Pending'} tone="blue" />
          <StatusTile label="API Key" value={provider?.apiKeyStatus || 'Unknown'} tone={provider?.apiKeyStatus === 'configured' ? 'green' : 'amber'} />
          <StatusTile label="M5" value="Disabled" tone="red" />
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="text-lg font-semibold text-white">Campaign Input</h2>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-widest text-slate-500">Business Goal</span>
              <textarea
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                className="mt-2 h-28 w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm text-white outline-none transition focus:border-sky-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-widest text-slate-500">Target Audience</span>
              <textarea
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
                className="mt-2 h-24 w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm text-white outline-none transition focus:border-sky-500"
              />
            </label>
            <div>
              <span className="text-xs font-medium uppercase tracking-widest text-slate-500">Platforms</span>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {PLATFORM_OPTIONS.map((platform) => (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => togglePlatform(platform.id)}
                    className={`rounded-xl border px-3 py-3 text-xs font-semibold transition ${
                      platforms.includes(platform.id)
                        ? 'border-sky-500/50 bg-sky-500/15 text-sky-200'
                        : 'border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {platform.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={generateIdeas}
              disabled={loading || goal.trim().length < 6 || audience.trim().length < 3}
              className="w-full rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Working...' : 'Generate Ideas'}
            </button>
          </div>
        </section>

        <section className="space-y-4">
          {message && (
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
              {message}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-4">
            <WorkflowStep index="1" label="Generate" active={ideas.length > 0} />
            <WorkflowStep index="2" label="Human Selects" active={workflowDecision?.status === 'selected'} />
            <WorkflowStep index="3" label="Campaign Created" active={Boolean(campaign)} />
            <WorkflowStep index="4" label="Draft Pipeline" active={Boolean(campaign)} />
          </div>

          {ideas.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {ideas.map((idea) => (
                <article
                  key={idea.id}
                  className={`rounded-2xl border bg-slate-950/70 p-5 transition ${
                    selectedIdeaId === idea.id ? 'border-sky-500/60 shadow-lg shadow-sky-950/20' : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="info">{labelPlatform(idea.platform)}</Badge>
                        <Badge variant={idea.estimatedReach === 'high' ? 'success' : idea.estimatedReach === 'medium' ? 'warning' : 'default'}>
                          {idea.estimatedReach} reach
                        </Badge>
                        <Badge variant="default">{idea.format}</Badge>
                      </div>
                      <h3 className="mt-4 text-lg font-semibold leading-snug text-white">{idea.title}</h3>
                    </div>
                    <input
                      aria-label={`Select ${idea.title}`}
                      type="radio"
                      checked={selectedIdeaId === idea.id}
                      onChange={() => setSelectedIdeaId(idea.id)}
                      className="mt-1 h-5 w-5 accent-sky-500"
                    />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{idea.hook}</p>
                  <p className="mt-3 text-xs leading-5 text-slate-500">{idea.rationale}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {idea.hashtags.map((tag) => (
                      <span key={tag} className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}

          {ideas.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Human Selection Gate</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    LangGraph checkpoint is paused until the operator selects an idea. No campaign is created before this step.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={approveSelectedIdea}
                    disabled={loading || !selectedIdea || workflowDecision?.status === 'selected'}
                    className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Record Human Selection
                  </button>
                  <button
                    type="button"
                    onClick={convertToCampaign}
                    disabled={loading || workflowDecision?.status !== 'selected' || Boolean(campaign)}
                    className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Create Campaign
                  </button>
                </div>
              </div>
              {campaign && (
                <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-emerald-200">{campaign.title}</div>
                      <div className="mt-1 text-xs text-emerald-300/80">
                        Campaign ID: {campaign.campaignId} | Status: {campaign.status}
                      </div>
                    </div>
                    <Link
                      to="/campaigns"
                      className="rounded-lg border border-emerald-400/40 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/10"
                    >
                      Open Campaign Workspace
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatusTile({ label, value, tone }: { label: string; value: string; tone: 'green' | 'amber' | 'red' | 'blue' }) {
  const tones = {
    green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    red: 'border-red-500/30 bg-red-500/10 text-red-200',
    blue: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  };
  return (
    <div className={`rounded-xl border p-3 ${tones[tone]}`}>
      <div className="text-[10px] font-semibold uppercase tracking-widest opacity-70">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function WorkflowStep({ index, label, active }: { index: string; label: string; active: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${active ? 'border-sky-500/40 bg-sky-500/10' : 'border-slate-800 bg-slate-950/70'}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${active ? 'bg-sky-400 text-slate-950' : 'bg-slate-900 text-slate-500'}`}>
          {index}
        </span>
        <span className={active ? 'text-sm font-semibold text-sky-100' : 'text-sm font-semibold text-slate-500'}>{label}</span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10 text-xl font-bold text-sky-300">
        AI
      </div>
      <h2 className="mt-5 text-xl font-semibold text-white">Ready to generate product-grade social ideas</h2>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-400">
        Use the campaign inputs on the left. The backend will call the configured LLM provider when credentials exist, otherwise it will clearly fall back to the mock provider.
      </p>
    </div>
  );
}

function labelPlatform(platform: string): string {
  if (platform === 'twitter' || platform === 'x') return 'X / Twitter';
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}
