import { useEffect, useState } from 'react';
import { approvalsApi } from '../api';
import { Badge } from '../components/ExecutiveUI';
import { useAuth } from '../contexts/useAuth';

type Approval = Record<string, unknown>;

function text(value: unknown, fallback = 'Not specified'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

export default function ApprovalQueue() {
  const { token } = useAuth();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState('');

  async function loadApprovals() {
    if (!token) return;
    const data = await approvalsApi.list(token);
    setApprovals(data as Approval[]);
  }

  useEffect(() => {
    if (!token) return;
    approvalsApi.list(token).then(data => setApprovals(data as Approval[])).catch(() => undefined);
  }, [token]);

  async function handleAction(id: string, action: 'approve' | 'reject' | 'request-changes') {
    if (!token) return;
    setLoading(`${action}-${id}`);
    try {
      if (action === 'approve') await approvalsApi.approve(id, { comment: 'Approved for preparation only. No live scheduling.' }, token);
      else if (action === 'reject') await approvalsApi.reject(id, { comment: 'Rejected by human reviewer.' }, token);
      else await approvalsApi.requestChanges(id, { comment: 'Please revise before publishing preparation.' }, token);
      const actionLabel = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'changes requested';
      setMessage(`Approval ${actionLabel} - audit recorded`);
      await loadApprovals();
    } catch (error) {
      setMessage(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Approval Queue</h1>
          <p className="mt-0.5 text-sm text-slate-500">Human governance - all decisions are recorded before publishing preparation.</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="info">Human Approval Required</Badge>
          <Badge variant="blocked">Auto Publishing Blocked</Badge>
        </div>
      </div>

      {message && (
        <div className={`rounded-lg border px-4 py-2 text-sm ${message.includes('Failed') ? 'border-rose-800 bg-rose-950/30 text-rose-300' : 'border-emerald-800 bg-emerald-950/30 text-emerald-300'}`}>
          {message}
        </div>
      )}

      {approvals.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-8 text-center text-sm text-slate-500">
          No approval package is currently pending. Submit one from the Commercial/Social Command Center.
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map(approval => {
            const id = String(approval.id);
            const status = text(approval.approvalStatus);
            const pending = status === 'pending';
            return (
              <div key={id} className="rounded-xl border border-slate-800 bg-slate-950/75 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-bold text-white">{titleCase(text(approval.targetType))}</h3>
                      <Badge variant={status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'warning'}>{titleCase(status)}</Badge>
                      <Badge variant={approval.riskCategory === 'high' ? 'danger' : approval.riskCategory === 'medium' ? 'warning' : 'success'}>
                        {text(approval.riskCategory, 'medium')} risk
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                      <Info label="Target" value={text(approval.targetId)} />
                      <Info label="Department" value={text(approval.requiredDepartment, 'Commercial/Social')} />
                      <Info label="Role" value={text(approval.requiredRole, 'Human reviewer')} />
                    </div>
                  </div>

                  {pending && (
                    <div className="flex min-w-[330px] flex-col gap-2">
                      <button onClick={() => handleAction(id, 'approve')} disabled={!!loading} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40">
                        {loading === `approve-${id}` ? 'Approving...' : 'Approve'}
                      </button>
                      <button onClick={() => handleAction(id, 'request-changes')} disabled={!!loading} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-40">
                        {loading === `request-changes-${id}` ? 'Recording...' : 'Request Changes'}
                      </button>
                      <button onClick={() => handleAction(id, 'reject')} disabled={!!loading} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-40">
                        {loading === `reject-${id}` ? 'Rejecting...' : 'Reject'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-800 pt-3">
                  <Badge variant="info">Audit recorded by backend</Badge>
                  <Badge variant="default">SPINE evidence available</Badge>
                  <Badge variant="blocked">External execution blocked</Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm text-slate-300">{value}</div>
    </div>
  );
}
