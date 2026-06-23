import { useState, useEffect } from 'react';
import { approvalsApi } from '../api';
import { useAuth } from '../contexts/useAuth';
import { StatusBadge, Card, Alert, DemoLabel, EmptyState } from '../components/UI';

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
      if (action === 'approve') await approvalsApi.approve(id, { comment: 'Approved for demo' }, token!);
      else if (action === 'reject') await approvalsApi.reject(id, { comment: 'Rejected for demo' }, token!);
      else await approvalsApi.requestChanges(id, { comment: 'Please revise' }, token!);
      setMessage(`Approval ${action === 'request-changes' ? 'changes requested' : action + 'd'} successfully`);
      approvalsApi.list(token!).then(d => setApprovals(d as Record<string, unknown>[])).catch(console.error);
    } catch (err) {
      setMessage(`Action failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    setLoading('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Approval Queue</h1>
        <div className="flex items-center gap-2">
          <DemoLabel>Working Locally</DemoLabel>
          <span className="text-xs text-gray-500">All decisions audited</span>
        </div>
      </div>

      <Alert type="info">
        <strong>Human Approval Required</strong> — FunctionalAgent cannot approve. All decisions are recorded with actor, timestamp, and rationale.
      </Alert>

      {message && <Alert type={message.includes('failed') ? 'error' : 'success'}>{message}</Alert>}

      {approvals.length === 0 ? (
        <Card><EmptyState message="No approvals in queue. Submit a campaign for approval first." /></Card>
      ) : (
        <div className="space-y-4">
          {approvals.map(a => (
            <Card key={a.id as string}>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">{a.targetType as string}: {a.targetId as string}</h3>
                    <StatusBadge label={a.approvalStatus as string} variant={a.approvalStatus === 'pending' ? 'warning' : a.approvalStatus === 'approved' ? 'success' : 'danger'} />
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>Risk: <StatusBadge label={a.riskCategory as string} variant={a.riskCategory === 'high' ? 'danger' : a.riskCategory === 'medium' ? 'warning' : 'success'} /></span>
                    {a.requiredDepartment ? <span>Dept: {String(a.requiredDepartment)}</span> : null}
                    {a.requiredRole ? <span>Role: {String(a.requiredRole)}</span> : null}
                  </div>
                </div>

                {a.approvalStatus === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => handleAction(a.id as string, 'approve')} disabled={!!loading} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-sm">
                      {loading === `approve-${a.id}` ? '...' : 'Approve'}
                    </button>
                    <button onClick={() => handleAction(a.id as string, 'reject')} disabled={!!loading} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium text-sm">
                      {loading === `reject-${a.id}` ? '...' : 'Reject'}
                    </button>
                    <button onClick={() => handleAction(a.id as string, 'request-changes')} disabled={!!loading} className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 font-medium text-sm">
                      {loading === `request-changes-${a.id}` ? '...' : 'Request Changes'}
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
