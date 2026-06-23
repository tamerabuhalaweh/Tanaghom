import { useState, useEffect } from 'react';
import { campaignsApi, approvalsApi, algoApi, aiGenerationApi } from '../api';
import { useAuth } from '../contexts/useAuth';
import { StatusBadge, Card, MetricCard, Alert, DemoLabel, LoadingSpinner, EmptyState } from '../components/UI';

export default function CampaignWorkspace() {
  const { token } = useAuth();
  const [campaigns, setCampaigns] = useState<Record<string, unknown>[]>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [drafts, setDrafts] = useState<Record<string, unknown>[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<Record<string, unknown> | null>(null);
  const [score, setScore] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState('');
  const [step, setStep] = useState<'select' | 'generate' | 'score' | 'approve'>('select');

  useEffect(() => {
    if (token) campaignsApi.list(token).then(d => setCampaigns(d as Record<string, unknown>[])).catch(console.error);
  }, [token]);

  const selectCampaign = async (id: string) => {
    setLoading('campaign');
    try {
      const c = await campaignsApi.get(id, token!);
      setSelected(c as Record<string, unknown>);
      setDrafts([]);
      setSelectedDraft(null);
      setScore(null);
      setMessage('');
      setStep('generate');
    } catch (err) { console.error(err); }
    setLoading('');
  };

  const generateDraft = async () => {
    if (!selected) return;
    setLoading('draft');
    setMessage('');
    try {
      const result = await aiGenerationApi.generate({
        campaignRequestId: selected.id,
        platforms: ['linkedin', 'instagram'],
      }, token!);
      const draftResults = Array.isArray(result) ? result as Record<string, unknown>[] : [result as Record<string, unknown>];
      setDrafts(draftResults);
      setSelectedDraft(draftResults[0] || null);
      setMessage('Draft generated successfully');
      setStep('score');
    } catch (err) {
      setMessage(`Generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    setLoading('');
  };

  const evaluateReach = async () => {
    if (!selectedDraft) return;
    setLoading('score');
    setMessage('');
    try {
      const result = await algoApi.score({
        contentItemId: selectedDraft.contentItemId as string,
        platform: (selectedDraft.platform as string) || 'linkedin',
        draftText: (selectedDraft.draftText as string) || 'Demo content',
      }, token!);
      setScore(result as Record<string, unknown>);
      setMessage('Reach score calculated');
      setStep('approve');
    } catch (err) {
      setMessage(`Scoring failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    setLoading('');
  };

  const submitForApproval = async () => {
    if (!selected) return;
    setLoading('approval');
    try {
      await approvalsApi.submit({
        targetId: selected.id as string,
        targetType: 'campaign',
        riskCategory: 'medium',
      }, token!);
      setMessage('Submitted for approval — human decision required');
    } catch (err) {
      setMessage(`Submission failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    setLoading('');
  };

  const scoreValue = score?.totalScore as number | undefined;
  const scoreBand = scoreValue && scoreValue >= 75 ? 'approve' : scoreValue && scoreValue >= 60 ? 'optimize' : scoreValue && scoreValue >= 40 ? 'revise' : 'block';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Commercial / Social Campaign</h1>
        <DemoLabel>Working Locally — Mock LLM Provider</DemoLabel>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 text-sm">
        {[
          { key: 'select', label: '1. Select Campaign' },
          { key: 'generate', label: '2. Generate Draft' },
          { key: 'score', label: '3. Score Reach' },
          { key: 'approve', label: '4. Submit for Approval' },
        ].map((s, i) => (
          <div key={s.key} className="flex items-center">
            <div className={`px-3 py-1.5 rounded-full font-medium ${step === s.key ? 'bg-blue-600 text-white' : ['select', 'generate', 'score', 'approve'].indexOf(step) > i ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
              {s.label}
            </div>
            {i < 3 && <div className={`w-8 h-0.5 mx-1 ${['select', 'generate', 'score', 'approve'].indexOf(step) > i ? 'bg-green-300' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {message && <Alert type={message.includes('failed') ? 'error' : 'success'}>{message}</Alert>}

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Campaign List */}
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-700">Demo Campaigns</h2>
          {campaigns.length === 0 ? (
            <EmptyState message="No campaigns found. Run seed first." />
          ) : (
            campaigns.map(c => (
              <button
                key={c.id as string}
                onClick={() => selectCampaign(c.id as string)}
                disabled={loading === 'campaign'}
                className={`w-full text-left p-3 border rounded-lg transition-all ${selected?.id === c.id ? 'border-blue-500 bg-blue-50 shadow-sm' : 'hover:bg-gray-50 hover:shadow-sm'}`}
              >
                <div className="font-medium text-gray-900">{c.topic as string}</div>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge label={c.status as string} variant={c.status === 'approved' ? 'success' : c.status === 'draft' ? 'warning' : 'default'} />
                  <StatusBadge label={c.riskCategory as string} variant={c.riskCategory === 'high' ? 'danger' : c.riskCategory === 'medium' ? 'warning' : 'success'} />
                </div>
              </button>
            ))
          )}
        </div>

        {/* Right: Campaign Detail & Actions */}
        <div className="col-span-2 space-y-4">
          {!selected ? (
            <Card><EmptyState message="Select a campaign to begin the demo flow" /></Card>
          ) : (
            <>
              {/* Campaign Details */}
              <Card title={selected.topic as string}>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Objective:</span> {selected.objective as string}</div>
                  <div><span className="text-gray-500">Audience:</span> {selected.audience as string}</div>
                  <div><span className="text-gray-500">Channel:</span> {selected.channel as string}</div>
                  <div><span className="text-gray-500">Platforms:</span> {(selected.targetPlatforms as string[])?.join(', ')}</div>
                </div>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button onClick={generateDraft} disabled={loading === 'draft'} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium">
                  {loading === 'draft' ? <><LoadingSpinner /> Generating...</> : 'Generate AI Draft'}
                </button>
                <button onClick={evaluateReach} disabled={!selectedDraft || loading === 'score'} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium">
                  {loading === 'score' ? 'Scoring...' : 'Evaluate Reach'}
                </button>
                <button onClick={submitForApproval} disabled={loading === 'approval'} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                  {loading === 'approval' ? 'Submitting...' : 'Submit for Approval'}
                </button>
              </div>

              {/* Generated Draft */}
              {drafts.length > 0 && (
                <Card title={`AI Draft — ${(selectedDraft?.platform as string) || 'linkedin'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <DemoLabel>Mock LLM Provider</DemoLabel>
                    <span className="text-xs text-gray-500">Platform-specific adaptation</span>
                  </div>
                  <div className="bg-gray-50 rounded p-4 text-sm">
                    <div className="font-medium text-gray-700 mb-2">Generated Content:</div>
                    <div className="whitespace-pre-wrap">{selectedDraft?.draftText as string || 'Draft content generated by AI'}</div>
                  </div>
                  {drafts.length > 1 && (
                    <div className="mt-3 flex gap-2">
                      {drafts.map((d, i) => (
                        <button key={i} onClick={() => setSelectedDraft(d)} className={`px-3 py-1 rounded text-sm ${selectedDraft === d ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
                          {d.platform as string || `Draft ${i + 1}`}
                        </button>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {/* Reach Score */}
              {score && (
                <Card title="Reach Readiness Score">
                  <div className="flex items-center gap-2 mb-3">
                    <DemoLabel>Deterministic Scoring</DemoLabel>
                    <span className="text-xs text-gray-500">Not prediction</span>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <MetricCard label="Score" value={scoreValue || 0} sublabel="out of 100" />
                    <MetricCard label="Band" value={scoreBand} />
                    <MetricCard label="Platform" value={(selectedDraft?.platform as string) || 'linkedin'} />
                    <MetricCard label="Status" value={scoreValue && scoreValue >= 60 ? 'Ready' : 'Needs Work'} />
                  </div>
                  {score.components ? (
                    <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                      {(score.components as { component: string; score: number; weight: number; explanation: string }[]).map((c, i) => (
                        <div key={i} className="flex justify-between bg-gray-50 px-3 py-2 rounded">
                          <span className="text-gray-600 capitalize">{c.component}</span>
                          <span className="font-medium">{c.score}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
