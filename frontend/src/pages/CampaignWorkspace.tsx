import { useState, useEffect } from 'react';
import { campaignsApi, approvalsApi, algoApi, aiGenerationApi, publishingPackageApi } from '../api';
import { useAuth } from '../contexts/useAuth';
import { ReadinessGauge, FlowTimeline, PlatformPreviewCard, RecommendationCard, Badge } from '../components/ExecutiveUI';

export default function CampaignWorkspace() {
  const { token } = useAuth();
  const [campaigns, setCampaigns] = useState<Record<string, unknown>[]>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [drafts, setDrafts] = useState<Record<string, unknown>[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<Record<string, unknown> | null>(null);
  const [score, setScore] = useState<Record<string, unknown> | null>(null);
  const [publishingPkg, setPublishingPkg] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState('');
  const [step, setStep] = useState<'select' | 'generate' | 'score' | 'approve' | 'publish'>('select');

  useEffect(() => {
    if (token) campaignsApi.list(token).then(d => setCampaigns(d as Record<string, unknown>[])).catch(console.error);
  }, [token]);

  const selectCampaign = async (id: string) => {
    setLoading('campaign');
    try {
      const c = await campaignsApi.get(id, token!);
      setSelected(c as Record<string, unknown>);
      setDrafts([]); setSelectedDraft(null); setScore(null); setPublishingPkg(null); setMessage(''); setStep('generate');
    } catch (err) { console.error(err); }
    setLoading('');
  };

  const generateDraft = async () => {
    if (!selected) return;
    setLoading('draft'); setMessage('');
    try {
      const result = await aiGenerationApi.generate({ campaignRequestId: selected.id, platforms: ['linkedin', 'instagram'] }, token!);
      const draftResults = Array.isArray(result) ? result as Record<string, unknown>[] : [result as Record<string, unknown>];
      setDrafts(draftResults); setSelectedDraft(draftResults[0] || null);
      setMessage('Draft generated — Mock LLM Provider'); setStep('score');
    } catch (err) { setMessage(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`); }
    setLoading('');
  };

  const evaluateReach = async () => {
    if (!selectedDraft) return;
    setLoading('score'); setMessage('');
    try {
      const result = await algoApi.score({
        contentItemId: selectedDraft.contentItemId as string,
        platform: (selectedDraft.platform as string) || 'linkedin',
        draftText: (selectedDraft.draftText as string) || 'Demo content',
      }, token!);
      setScore(result as Record<string, unknown>);
      setMessage('Score calculated — deterministic scoring'); setStep('approve');
    } catch (err) { setMessage(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`); }
    setLoading('');
  };

  const submitForApproval = async () => {
    if (!selected) return;
    setLoading('approval');
    try {
      await approvalsApi.submit({ targetId: selected.id as string, targetType: 'campaign', riskCategory: 'medium' }, token!);
      setMessage('Submitted for approval — human decision required'); setStep('publish');
    } catch (err) { setMessage(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`); }
    setLoading('');
  };

  const createPublishingPackage = async () => {
    if (!selected) return;
    setLoading('publishing');
    try {
      const result = await publishingPackageApi.create({
        campaignId: selected.id as string,
        draftId: selectedDraft?.contentItemId,
        platforms: ['linkedin', 'instagram'],
      }, token!);
      setPublishingPkg(result as Record<string, unknown>);
      setMessage('Publishing package created — no real scheduling');
    } catch (err) { setMessage(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`); }
    setLoading('');
  };

  const scoreValue = (score?.totalScore as number) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaign Workspace</h1>
          <p className="text-gray-500 text-sm mt-0.5">AI-powered social content creation</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="mock">Mock LLM</Badge>
          <Badge variant="info">Controlled Demo</Badge>
        </div>
      </div>

      <FlowTimeline steps={[
        { label: 'Select', status: step === 'select' ? 'active' : 'done' },
        { label: 'Generate', status: step === 'generate' ? 'active' : step === 'select' ? 'pending' : 'done', badge: 'Mock LLM' },
        { label: 'Score', status: step === 'score' ? 'active' : ['select', 'generate'].includes(step) ? 'pending' : 'done' },
        { label: 'Approve', status: step === 'approve' ? 'active' : step === 'publish' ? 'done' : 'pending' },
        { label: 'Publish Prep', status: step === 'publish' ? 'active' : 'pending' },
      ]} />

      {message && <div className={`border rounded-lg px-4 py-2 text-sm ${message.includes('Failed') ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-green-900/20 border-green-800 text-green-400'}`}>{message}</div>}

      <div className="grid grid-cols-3 gap-6">
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Demo Campaigns</h2>
          {campaigns.map(c => (
            <button key={c.id as string} onClick={() => selectCampaign(c.id as string)}
              className={`w-full text-left p-4 rounded-xl border transition-all ${selected?.id === c.id ? 'bg-blue-900/20 border-blue-500/50' : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}>
              <div className="font-medium text-white text-sm">{c.topic as string}</div>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={c.status === 'approved' ? 'success' : 'warning'}>{c.status as string}</Badge>
                <Badge variant={c.riskCategory === 'high' ? 'danger' : c.riskCategory === 'medium' ? 'warning' : 'success'}>{c.riskCategory as string}</Badge>
              </div>
            </button>
          ))}
        </div>

        <div className="col-span-2 space-y-4">
          {!selected ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">Select a campaign to begin</div>
          ) : (
            <>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="text-lg font-bold text-white mb-3">{selected.topic as string}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Objective:</span> <span className="text-gray-300">{selected.objective as string}</span></div>
                  <div><span className="text-gray-500">Audience:</span> <span className="text-gray-300">{selected.audience as string}</span></div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={generateDraft} disabled={loading === 'draft'} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm">
                  {loading === 'draft' ? 'Generating...' : 'Generate AI Draft'}
                </button>
                <button onClick={evaluateReach} disabled={!selectedDraft || loading === 'score'} className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium text-sm">
                  {loading === 'score' ? 'Scoring...' : 'Evaluate Reach'}
                </button>
                <button onClick={submitForApproval} disabled={loading === 'approval'} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium text-sm">
                  {loading === 'approval' ? 'Submitting...' : 'Submit for Approval'}
                </button>
                <button onClick={createPublishingPackage} disabled={loading === 'publishing'} className="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium text-sm">
                  {loading === 'publishing' ? 'Creating...' : 'Create Publishing Package'}
                </button>
              </div>

              {drafts.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">AI-Generated Drafts</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {drafts.map((d, i) => (
                      <div key={i} onClick={() => setSelectedDraft(d)} className={`cursor-pointer rounded-xl transition-all ${selectedDraft === d ? 'ring-2 ring-blue-500' : ''}`}>
                        <PlatformPreviewCard platform={(d.platform as string) || 'linkedin'} content={(d.draftText as string) || 'AI-generated content'} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {score && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Reach Readiness Score</h3>
                    <Badge variant="mock">Deterministic Scoring</Badge>
                  </div>
                  <div className="flex items-center gap-8">
                    <ReadinessGauge value={scoreValue} label="Score" />
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <RecommendationCard title="Best Platform" value={(selectedDraft?.platform as string) || 'LinkedIn'} confidence={85} />
                      <RecommendationCard title="Best Time" value="Tuesday 10:00 AM" confidence={78} />
                      <RecommendationCard title="Format" value="Educational post with image" confidence={82} />
                      <RecommendationCard title="Band" value={scoreValue >= 75 ? 'Approve' : scoreValue >= 60 ? 'Optimize' : 'Revise'} />
                    </div>
                  </div>
                </div>
              )}

              {publishingPkg && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Publishing Package</h3>
                    <Badge variant="mock">Mock Postiz</Badge>
                  </div>
                  <div className="bg-gray-800/50 rounded p-4 text-sm">
                    <div className="text-gray-400 text-xs mb-2">Package ID: {String(publishingPkg.id)}</div>
                    <div className="text-gray-400 text-xs mb-2">Status: {String(publishingPkg.status)}</div>
                    <div className="text-gray-400 text-xs mb-2">Platforms: {Array.isArray(publishingPkg.platforms) ? (publishingPkg.platforms as Record<string, unknown>[]).map(p => String(p.platform)).join(', ') : 'N/A'}</div>
                    <div className="text-yellow-400 text-xs mt-3">{String(publishingPkg._label)}</div>
                    <div className="text-yellow-400 text-xs">{String(publishingPkg._postizStatus)}</div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
