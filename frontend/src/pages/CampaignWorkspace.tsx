import { useState, useEffect } from 'react';
import { campaignsApi, approvalsApi, algoApi, aiGenerationApi } from '../api';
import { useAuth } from '../contexts/useAuth';

export default function CampaignWorkspace() {
  const { token } = useAuth();
  const [campaigns, setCampaigns] = useState<Record<string, unknown>[]>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [score, setScore] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (token) campaignsApi.list(token).then(d => setCampaigns(d as Record<string, unknown>[])).catch(console.error);
  }, [token]);

  const selectCampaign = async (id: string) => {
    setLoading('campaign');
    try {
      const c = await campaignsApi.get(id, token!);
      setSelected(c as Record<string, unknown>);
      setDraft(null);
      setScore(null);
      setMessage('');
    } catch (err) { console.error(err); }
    setLoading('');
  };

  const generateDraft = async () => {
    if (!selected) return;
    setLoading('draft');
    setMessage('Generating AI draft using mock LLM provider...');
    try {
      const result = await aiGenerationApi.generate({
        campaignId: (selected as { id: string }).id,
        platform: 'linkedin',
        contentType: 'post',
      }, token!);
      setDraft(result as Record<string, unknown>);
      setMessage('Draft generated — Mock LLM Provider');
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Generation failed'}`);
    }
    setLoading('');
  };

  const evaluateReach = async () => {
    if (!draft) return;
    setLoading('score');
    try {
      const result = await algoApi.score({
        content: (draft as { content?: string }).content || 'Demo content',
        platform: 'linkedin',
      }, token!);
      setScore(result as Record<string, unknown>);
      setMessage('Reach score calculated — deterministic scoring');
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Scoring failed'}`);
    }
    setLoading('');
  };

  const submitForApproval = async () => {
    if (!selected) return;
    setLoading('approval');
    try {
      await approvalsApi.submit({
        targetId: (selected as { id: string }).id,
        targetType: 'campaign',
        riskCategory: 'medium',
        requiredApprovals: 2,
      }, token!);
      setMessage('Submitted for approval — human decision required');
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Submission failed'}`);
    }
    setLoading('');
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Campaign Workspace</h1>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800 flex items-center gap-2">
        <span className="px-2 py-0.5 bg-blue-200 rounded text-xs font-bold">WORKING LOCALLY</span>
        Backend API connected — actions persist in database
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="font-semibold mb-3">Campaigns</h2>
          <div className="space-y-2">
            {(campaigns as { id: string; name: string; status: string }[]).map(c => (
              <button
                key={c.id}
                onClick={() => selectCampaign(c.id)}
                className={`w-full text-left p-3 border rounded-lg hover:bg-gray-50 ${(selected as { id?: string })?.id === c.id ? 'border-blue-500 bg-blue-50' : ''}`}
              >
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-gray-500">Status: {c.status}</div>
              </button>
            ))}
            {campaigns.length === 0 && <div className="text-gray-400 text-sm">No campaigns found. Seed data may need to be loaded.</div>}
          </div>
        </div>

        <div>
          {selected ? (
            <div className="space-y-4">
              <div className="bg-white border rounded-lg p-4">
                <h3 className="font-semibold">{(selected as { name: string }).name}</h3>
                <div className="text-sm text-gray-600 mt-1">{(selected as { description?: string }).description}</div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                  <div><span className="text-gray-500">Status:</span> {(selected as { status: string }).status}</div>
                  <div><span className="text-gray-500">Risk:</span> {(selected as { risk_level?: string }).risk_level || 'medium'}</div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={generateDraft}
                  disabled={loading === 'draft'}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 text-sm"
                >
                  {loading === 'draft' ? 'Generating...' : 'Generate AI Draft'}
                </button>
                <button
                  onClick={evaluateReach}
                  disabled={!draft || loading === 'score'}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
                >
                  {loading === 'score' ? 'Scoring...' : 'Evaluate Reach'}
                </button>
                <button
                  onClick={submitForApproval}
                  disabled={loading === 'approval'}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  {loading === 'approval' ? 'Submitting...' : 'Submit for Approval'}
                </button>
              </div>

              {draft && (
                <div className="bg-white border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold">AI Draft</h4>
                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">Mock LLM Provider</span>
                  </div>
                  <pre className="text-sm whitespace-pre-wrap bg-gray-50 p-3 rounded">{JSON.stringify(draft, null, 2)}</pre>
                </div>
              )}

              {score && (
                <div className="bg-white border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold">Reach Score</h4>
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Deterministic Scoring</span>
                  </div>
                  <pre className="text-sm whitespace-pre-wrap bg-gray-50 p-3 rounded">{JSON.stringify(score, null, 2)}</pre>
                </div>
              )}

              {message && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">{message}</div>
              )}
            </div>
          ) : (
            <div className="text-gray-400 text-sm">Select a campaign to begin</div>
          )}
        </div>
      </div>
    </div>
  );
}
