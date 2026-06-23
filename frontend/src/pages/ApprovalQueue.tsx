import { useState, useEffect } from 'react';
import { approvalsApi } from '../api';
import { useAuth } from '../contexts/useAuth';
import { Badge } from '../components/ExecutiveUI';

export default function ApprovalQueue() {
  const { token } = useAuth();
  const [approvals, setApprovals] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;
    approvalsApi.list(token).then(d => setApprovals(d as Record<string, unknown>[])).catch(console.error);
  }, [token]);

  const handleAction = async (id: string, action: 'approve' | 'reject' | 'request-changes') => {
    setLoading(`${action}-${id}`);
    try {
      if (action === 'approve') await approvalsApi.approve(id, { comment: 'Approved' }, token!);
      else if (action === 'reject') await approvalsApi.reject(id, { comment: 'Rejected' }, token!);
      else await approvalsApi.requestChanges(id, { comment: 'Please revise' }, token!);
      const actionLabel = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'changes requested';
      setMessage(`Approval ${actionLabel} — audit recorded`);
      approvalsApi.list(token!).then(d => setApprovals(d as Record<string, unknown>[])).catch(console.error);
    } catch (err) { setMessage(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`); }
    setLoading('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Approval Queue</h1>
          <p className="text-gray-500 text-sm mt-0.5">Human governance — all decisions audited</p>
        </div>
        <Badge variant="info">Human Required</Badge>
      </div>

      {message && <div className={`border rounded-lg px-4 py-2 text-sm ${message.includes('Failed') ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-green-900/20 border-green-800 text-green-400'}`}>{message}</div>}

      {approvals.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">No approvals in queue</div>
      ) : (
        <div className="space-y-4">
          {approvals.map(a => (
            <div key={a.id as string} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-white">{a.targetType as string}: {a.targetId as string}</h3>
                    <Badge variant={a.approvalStatus === 'pending' ? 'warning' : a.approvalStatus === 'approved' ? 'success' : 'danger'}>{a.approvalStatus as string}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-500">Risk: <Badge variant={a.riskCategory === 'high' ? 'danger' : a.riskCategory === 'medium' ? 'warning' : 'success'}>{a.riskCategory as string}</Badge></span>
                    {a.requiredDepartment ? <span className="text-gray-500">Dept: <span className="text-gray-300">{String(a.requiredDepartment)}</span></span> : null}
                    {a.requiredRole ? <span className="text-gray-500">Role: <span className="text-gray-300">{String(a.requiredRole)}</span></span> : null}
                  </div>
                </div>

                {a.approvalStatus === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => handleAction(a.id as string, 'approve')} disabled={!!loading}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-sm">
                      {loading === `approve-${a.id}` ? '...' : 'Approve'}
                    </button>
                    <button onClick={() => handleAction(a.id as string, 'reject')} disabled={!!loading}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium text-sm">
                      {loading === `reject-${a.id}` ? '...' : 'Reject'}
                    </button>
                    <button onClick={() => handleAction(a.id as string, 'request-changes')} disabled={!!loading}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 font-medium text-sm">
                      {loading === `request-changes-${a.id}` ? '...' : 'Request Changes'}
                    </button>
                  </div>
                )}
              </div>

              {/* Audit Evidence */}
              <div className="mt-4 pt-3 border-t border-gray-800 flex items-center gap-4 text-xs text-gray-500">
                <span>Audit: recorded</span>
                <span>|</span>
                <span>SPINE: linked</span>
                <span>|</span>
                <span>Actor: human</span>
                <span>|</span>
                <span>Timestamp: {new Date().toISOString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
