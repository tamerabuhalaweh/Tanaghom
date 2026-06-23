import { useState, useEffect } from 'react';
import { approvalsApi } from '../api';
import { useAuth } from '../contexts/useAuth';

export default function ApprovalQueue() {
  const { token } = useAuth();
  const [approvals, setApprovals] = useState<unknown[]>([]);
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;
    approvalsApi.list(token).then(setApprovals).catch(console.error);
  }, [token]);

  const handleAction = async (id: string, action: 'approve' | 'reject' | 'request-changes') => {
    setLoading(`${action}-${id}`);
    try {
      if (action === 'approve') {
        await approvalsApi.approve(id, { comment: 'Approved for demo' }, token!);
        setMessage(`Approval ${id} — approved`);
      } else if (action === 'reject') {
        await approvalsApi.reject(id, { comment: 'Rejected for demo' }, token!);
        setMessage(`Approval ${id} — rejected`);
      } else {
        await approvalsApi.requestChanges(id, { comment: 'Please revise' }, token!);
        setMessage(`Approval ${id} — changes requested`);
      }
      await approvalsApi.list(token!).then(setApprovals).catch(console.error);
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Action failed'}`);
    }
    setLoading('');
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Approval Queue</h1>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800 flex items-center gap-2">
        <span className="px-2 py-0.5 bg-blue-200 rounded text-xs font-bold">WORKING LOCALLY</span>
        Approvals persist in database — all decisions audited
      </div>

      {message && (
        <div className="bg-green-50 border border-green-200 rounded p-3 mb-4 text-sm text-green-800">{message}</div>
      )}

      <div className="space-y-3">
        {(approvals as { id: string; targetType: string; targetId: string; riskCategory: string; status: string; requiredApprovals: number }[]).map(a => (
          <div key={a.id} className="bg-white border rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium">{a.targetType}: {a.targetId}</div>
                <div className="text-sm text-gray-500 mt-1">
                  Risk: <span className={`px-1 py-0.5 rounded text-xs ${a.riskCategory === 'high' ? 'bg-red-100 text-red-700' : a.riskCategory === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{a.riskCategory}</span>
                  {' • '}Required: {a.requiredApprovals} approver(s)
                </div>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${a.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : a.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {a.status}
              </span>
            </div>

            {a.status === 'pending' && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleAction(a.id, 'approve')}
                  disabled={!!loading}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  {loading === `approve-${a.id}` ? '...' : 'Approve'}
                </button>
                <button
                  onClick={() => handleAction(a.id, 'reject')}
                  disabled={!!loading}
                  className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  {loading === `reject-${a.id}` ? '...' : 'Reject'}
                </button>
                <button
                  onClick={() => handleAction(a.id, 'request-changes')}
                  disabled={!!loading}
                  className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 disabled:opacity-50"
                >
                  {loading === `request-changes-${a.id}` ? '...' : 'Request Changes'}
                </button>
              </div>
            )}
          </div>
        ))}
        {approvals.length === 0 && (
          <div className="text-gray-400 text-sm">No approvals in queue. Submit a campaign for approval first.</div>
        )}
      </div>

      <div className="mt-6 text-xs text-gray-400">
        All approval decisions are logged with actor, timestamp, and rationale. Human approval required — FunctionalAgent cannot approve.
      </div>
    </div>
  );
}
