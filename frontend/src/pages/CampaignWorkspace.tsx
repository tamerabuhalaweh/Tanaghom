import { useState, useEffect } from 'react';
import { campaignsApi, approvalsApi, algoApi, aiGenerationApi, publishingPackageApi, postizApi } from '../api';
import { useAuth } from '../contexts/useAuth';
import { ReadinessGauge, FlowTimeline, PlatformPreviewCard, RecommendationCard, Badge } from '../components/ExecutiveUI';

type RecordMap = Record<string, unknown>;

function asText(value: unknown, fallback = 'Not specified'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function asArray(value: unknown): RecordMap[] {
  return Array.isArray(value) ? value as RecordMap[] : [];
}

export default function CampaignWorkspace() {
  const { token } = useAuth();
  const [campaigns, setCampaigns] = useState<RecordMap[]>([]);
  const [selected, setSelected] = useState<RecordMap | null>(null);
  const [drafts, setDrafts] = useState<RecordMap[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<RecordMap | null>(null);
  const [score, setScore] = useState<RecordMap | null>(null);
  const [publishingPkg, setPublishingPkg] = useState<RecordMap | null>(null);
  const [postizPayload, setPostizPayload] = useState<RecordMap | null>(null);
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState('');
  const [step, setStep] = useState<'select' | 'generate' | 'score' | 'approve' | 'publish'>('select');

  const selectCampaign = async (id: string) => {
    if (!token) return;
    setLoading('campaign');
    try {
      const c = await campaignsApi.get(id, token);
      setSelected(c as RecordMap);
      setDrafts([]);
      setSelectedDraft(null);
      setScore(null);
      setPublishingPkg(null);
      setPostizPayload(null);
      setMessage('');
      setStep('generate');
    } catch (err) {
      setMessage(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setLoading('');
    }
  };

  useEffect(() => {
    if (!token) return;
    campaignsApi.list(token)
      .then(d => {
        const list = d as RecordMap[];
        setCampaigns(list);
        if (list.length > 0 && !selected) void selectCampaign(String(list[0].id));
      })
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const generateDraft = async () => {
    if (!selected || !token) return;
    setLoading('draft');
    setMessage('');
    try {
      const result = await aiGenerationApi.generate({ campaignRequestId: selected.id, platforms: ['linkedin', 'instagram', 'x'] }, token);
      const draftResults = Array.isArray(result) ? result as RecordMap[] : [result as RecordMap];
      setDrafts(draftResults);
      setSelectedDraft(draftResults[0] || null);
      setMessage('Drafts generated through the backend AI provider adapter for LinkedIn, Instagram, and X.');
      setStep('score');
    } catch (err) {
      setMessage(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setLoading('');
    }
  };

  const evaluateReach = async () => {
    if (!selectedDraft || !token) return;
    setLoading('score');
    setMessage('');
    try {
      const result = await algoApi.score({
        contentItemId: selectedDraft.contentItemId as string,
        platform: asText(selectedDraft.platform, 'linkedin'),
        draftText: asText(selectedDraft.draftText, 'Prepared social content'),
      }, token);
      setScore(result as RecordMap);
      setMessage('Reach readiness calculated for the selected draft.');
      setStep('approve');
    } catch (err) {
      setMessage(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setLoading('');
    }
  };

  const submitForApproval = async () => {
    if (!selected || !token) return;
    setLoading('approval');
    try {
      await approvalsApi.submit({
        targetId: selected.id as string,
        targetType: 'campaign',
        riskCategory: 'medium',
        requiredDepartment: 'Commercial',
        requiredRole: 'reviewer',
      }, token);
      setMessage('Submitted for human approval. Audit evidence is recorded by the backend.');
      setStep('publish');
    } catch (err) {
      setMessage(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setLoading('');
    }
  };

  const createPublishingPackage = async () => {
    if (!selected || !token) return;
    setLoading('publishing');
    try {
      const result = await publishingPackageApi.create({
        campaignId: selected.id as string,
        draftId: selectedDraft?.contentItemId,
        platforms: ['linkedin', 'instagram', 'x'],
      }, token);
      setPublishingPkg(result as RecordMap);
      setMessage('Publishing package prepared. Postiz sandbox status checked; scheduling remains blocked.');
    } catch (err) {
      setMessage(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setLoading('');
    }
  };

  const preparePostizPayload = async () => {
    if (!selectedDraft || !selected || !token) return;
    setLoading('postiz-payload');
    try {
      const result = await postizApi.schedulePayload({
        platform: asText(selectedDraft.platform, 'linkedin'),
        content: asText(selectedDraft.draftText, asText(selected.rawMessage, 'Prepared social content')),
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        timezone: 'Asia/Amman',
        tags: ['tanaghum', 'commercial-social'],
      }, token);
      setPostizPayload(result as RecordMap);
      setMessage('Postiz scheduling payload prepared. No external call was performed.');
    } catch (err) {
      setMessage(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setLoading('');
    }
  };

  const attemptSandboxSchedule = async () => {
    if (!selectedDraft || !selected || !token) return;
    setLoading('postiz-schedule');
    try {
      const result = await postizApi.sandboxSchedule({
        platform: asText(selectedDraft.platform, 'linkedin'),
        content: asText(selectedDraft.draftText, asText(selected.rawMessage, 'Prepared social content')),
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        timezone: 'Asia/Amman',
        tags: ['tanaghum', 'commercial-social'],
      }, token);
      setPostizPayload(result as RecordMap);
      setMessage('Sandbox schedule request completed.');
    } catch (err) {
      setMessage(`Sandbox schedule blocked: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setLoading('');
    }
  };

  const scoreValue = (score?.totalScore as number) || 0;
  const packagePlatforms = asArray(publishingPkg?.platforms);
  const postizSandbox = publishingPkg?.postizSandbox as RecordMap | undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaign Workspace</h1>
          <p className="text-slate-500 text-sm mt-0.5">Campaign brief, platform drafts, reach optimization, approval, and publishing preparation.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info">Backend AI Provider</Badge>
          <Badge variant="info">Postiz sandbox</Badge>
          <Badge variant="blocked">Scheduling blocked</Badge>
        </div>
      </div>

      <FlowTimeline steps={[
        { label: 'Select', status: step === 'select' ? 'active' : 'done' },
        { label: 'Generate', status: step === 'generate' ? 'active' : step === 'select' ? 'pending' : 'done', badge: '3 platforms' },
        { label: 'Score', status: step === 'score' ? 'active' : ['select', 'generate'].includes(step) ? 'pending' : 'done' },
        { label: 'Approve', status: step === 'approve' ? 'active' : step === 'publish' ? 'done' : 'pending' },
        { label: 'Package', status: step === 'publish' ? 'active' : 'pending', badge: 'Postiz preview' },
        { label: 'Publish', status: 'blocked', badge: 'Blocked' },
      ]} />

      {message && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${message.includes('Failed') ? 'border-rose-800 bg-rose-950/40 text-rose-300' : 'border-emerald-800 bg-emerald-950/30 text-emerald-300'}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-[360px_1fr] gap-6">
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Campaigns from backend</h2>
          {campaigns.map(c => (
            <button key={String(c.id)} onClick={() => selectCampaign(String(c.id))}
              className={`w-full text-left p-4 rounded-xl border transition-all ${selected?.id === c.id ? 'bg-sky-500/10 border-sky-500/50' : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'}`}>
              <div className="font-medium text-white text-sm">{asText(c.topic)}</div>
              <div className="flex items-center gap-2 mt-3">
                <Badge variant={c.status === 'approved' ? 'success' : 'warning'}>{asText(c.status, 'draft')}</Badge>
                <Badge variant={c.riskCategory === 'high' ? 'danger' : c.riskCategory === 'medium' ? 'warning' : 'success'}>{asText(c.riskCategory, 'medium')}</Badge>
              </div>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {!selected ? (
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-8 text-center text-slate-500">Loading campaign workspace...</div>
          ) : (
            <>
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{asText(selected.topic)}</h3>
                    <p className="mt-2 text-sm text-slate-400">Prepare social content, optimize reach readiness, route approval, and produce a Postiz-ready scheduling package.</p>
                  </div>
                  <Badge variant="info">Selected</Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
                  <div className="rounded-lg bg-slate-900 p-3"><span className="block text-xs text-slate-500">Objective</span><span className="text-slate-200">{asText(selected.objective)}</span></div>
                  <div className="rounded-lg bg-slate-900 p-3"><span className="block text-xs text-slate-500">Audience</span><span className="text-slate-200">{asText(selected.audience)}</span></div>
                  <div className="rounded-lg bg-slate-900 p-3"><span className="block text-xs text-slate-500">Execution</span><span className="text-rose-300">External actions blocked</span></div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button onClick={generateDraft} disabled={loading === 'draft'} className="px-5 py-2.5 bg-sky-600 text-white rounded-lg hover:bg-sky-500 disabled:opacity-50 font-medium text-sm">
                  {loading === 'draft' ? 'Generating...' : 'Generate Platform Drafts'}
                </button>
                <button onClick={evaluateReach} disabled={!selectedDraft || loading === 'score'} className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 font-medium text-sm">
                  {loading === 'score' ? 'Scoring...' : 'Evaluate Reach'}
                </button>
                <button onClick={submitForApproval} disabled={loading === 'approval'} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 font-medium text-sm">
                  {loading === 'approval' ? 'Submitting...' : 'Submit for Approval'}
                </button>
                <button onClick={createPublishingPackage} disabled={loading === 'publishing'} className="px-5 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-500 disabled:opacity-50 font-medium text-sm">
                  {loading === 'publishing' ? 'Creating...' : 'Create Publishing Package'}
                </button>
              </div>

              {drafts.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI-generated platform drafts</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {drafts.map((d, i) => (
                      <div key={i} onClick={() => setSelectedDraft(d)} className={`cursor-pointer rounded-xl transition-all ${selectedDraft === d ? 'ring-2 ring-sky-500' : ''}`}>
                        <PlatformPreviewCard platform={asText(d.platform, 'linkedin')} content={asText(d.draftText, 'AI-generated content')} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {score && (
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reach readiness score</h3>
                    <Badge variant="info">Deterministic scoring</Badge>
                  </div>
                  <div className="flex items-center gap-8">
                    <ReadinessGauge value={scoreValue} label="Score" />
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <RecommendationCard title="Best Platform" value={asText(selectedDraft?.platform, 'LinkedIn')} confidence={85} />
                      <RecommendationCard title="Best Time" value="Tuesday 10:00 AM" confidence={78} />
                      <RecommendationCard title="Format" value="Educational post with image" confidence={82} />
                      <RecommendationCard title="Decision Band" value={scoreValue >= 75 ? 'Ready for approval' : scoreValue >= 60 ? 'Optimize before approval' : 'Revise'} />
                    </div>
                  </div>
                </div>
              )}

              {publishingPkg && (
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Publishing Package</h3>
                      <p className="mt-1 text-sm text-slate-500">Prepared by the backend workflow. Postiz is the sandbox scheduling surface.</p>
                    </div>
                    <Badge variant={postizSandbox?.reachable ? 'info' : 'warning'}>{asText(publishingPkg._postizStatus)}</Badge>
                  </div>
                  <div className="grid grid-cols-[1fr_320px] gap-4">
                    <div className="rounded-lg bg-slate-900 p-4 text-sm">
                      <div className="text-slate-500 text-xs mb-2">Package ID: {String(publishingPkg.id)}</div>
                      <div className="text-slate-300">Status: {asText(publishingPkg.status)}</div>
                      <div className="text-slate-300 mt-1">Platforms: {packagePlatforms.map(p => asText(p.platform)).join(', ') || 'N/A'}</div>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        {packagePlatforms.map(p => (
                          <div key={asText(p.platform)} className="rounded border border-slate-800 bg-slate-950 p-3">
                            <div className="text-xs font-semibold uppercase text-slate-500">{asText(p.platform)}</div>
                            <div className="mt-2 text-xs text-slate-300 line-clamp-3">{asText(p.content)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-4">
                      <div className="text-sm font-semibold text-white">Postiz Sandbox</div>
                      <p className="mt-2 text-xs leading-5 text-slate-300">{asText(postizSandbox?.message)}</p>
                      <a
                        href={asText(postizSandbox?.url, 'https://postiz.163-123-180-104.sslip.io')}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500"
                      >
                        Review sandbox
                      </a>
                      <div className="mt-3 grid grid-cols-1 gap-2">
                        <button onClick={preparePostizPayload} disabled={loading === 'postiz-payload'} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-white disabled:opacity-50">
                          {loading === 'postiz-payload' ? 'Preparing...' : 'Generate Postiz Payload'}
                        </button>
                        <button onClick={attemptSandboxSchedule} disabled={loading === 'postiz-schedule'} className="rounded-lg border border-rose-500/40 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/10 disabled:opacity-50">
                          {loading === 'postiz-schedule' ? 'Checking gate...' : 'Attempt Sandbox Schedule'}
                        </button>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge variant="blocked">Scheduling blocked</Badge>
                        <Badge variant="blocked">Publishing blocked</Badge>
                        <Badge variant="blocked">M5 blocked</Badge>
                      </div>
                    </div>
                  </div>
                  {postizPayload && (
                    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">Postiz API Payload</div>
                          <div className="mt-1 text-xs text-slate-500">{asText(postizPayload._label)}</div>
                        </div>
                        <Badge variant={postizPayload.status === 'blocked' ? 'blocked' : 'info'}>{asText(postizPayload.status, 'prepared')}</Badge>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-lg bg-slate-950 p-3">
                          <div className="text-xs text-slate-500">Endpoint</div>
                          <div className="mt-1 break-all text-xs text-slate-300">{asText(postizPayload.endpoint, 'Configured on server')}</div>
                        </div>
                        <div className="rounded-lg bg-slate-950 p-3">
                          <div className="text-xs text-slate-500">Execution</div>
                          <div className="mt-1 text-xs text-slate-300">{((postizPayload.safety as RecordMap | undefined)?.executionPerformed) ? 'Performed' : 'Not performed'}</div>
                        </div>
                        <div className="rounded-lg bg-slate-950 p-3">
                          <div className="text-xs text-slate-500">Publishing</div>
                          <div className="mt-1 text-xs text-rose-300">Production publishing disabled</div>
                        </div>
                      </div>
                      <div className="mt-4 rounded-lg bg-slate-950 p-3">
                        <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Readable payload summary</div>
                        <div className="mt-2 text-sm text-slate-300">
                          Type: {asText((postizPayload.payload as RecordMap | undefined)?.type, 'schedule')} |
                          Scheduled: {asText((postizPayload.payload as RecordMap | undefined)?.date)} |
                          Posts: {Array.isArray((postizPayload.payload as RecordMap | undefined)?.posts) ? ((postizPayload.payload as RecordMap).posts as unknown[]).length : 0}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
