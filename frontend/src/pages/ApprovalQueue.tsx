import { useEffect, useState } from 'react';
import { approvalsApi, publishingPackageApi } from '../api';
import { EmptyProductState, MetricCard, Notice, PrimaryAction, ProductCard, ProductPage, ProductStatus, ReadableQueue, SecondaryAction } from '../components/ProductUI';
import { useAuth } from '../contexts/useAuth';

type RecordMap = Record<string, unknown>;

function text(value: unknown, fallback = 'Not specified'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

export default function ApprovalQueue() {
  const { token } = useAuth();
  const [approvals, setApprovals] = useState<RecordMap[]>([]);
  const [packages, setPackages] = useState<RecordMap[]>([]);
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    if (!token) return;
    const [approvalData, packageData] = await Promise.all([
      approvalsApi.list(token),
      publishingPackageApi.list(token).catch(() => []),
    ]);
    setApprovals(approvalData as RecordMap[]);
    setPackages(packageData as RecordMap[]);
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function run() {
      try {
        const [approvalData, packageData] = await Promise.all([
          approvalsApi.list(token as string),
          publishingPackageApi.list(token as string).catch(() => []),
        ]);
        if (cancelled) return;
        setApprovals(approvalData as RecordMap[]);
        setPackages(packageData as RecordMap[]);
      } catch (error) {
        if (!cancelled) setMessage(`Approval queue failed to load: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleAction(id: string, action: 'approve' | 'reject' | 'request-changes') {
    if (!token) return;
    setLoading(`${action}-${id}`);
    setMessage('');
    try {
      if (action === 'approve') await approvalsApi.approve(id, { comment: 'Approved for publishing preparation.' }, token);
      else if (action === 'reject') await approvalsApi.reject(id, { comment: 'Rejected by human reviewer.' }, token);
      else await approvalsApi.requestChanges(id, { comment: 'Please revise before publishing preparation.' }, token);
      setMessage(action === 'approve' ? 'Approved. Publishing preparation is now available.' : action === 'reject' ? 'Rejected.' : 'Changes requested.');
      await load();
    } catch (error) {
      setMessage(`Decision failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  const pendingApprovals = approvals.filter(approval => text(approval.approvalStatus, 'pending') === 'pending');
  const readyPackages = packages.slice(0, 5);

  return (
    <ProductPage
      eyebrow="Governed workflow"
      title="Approvals & Publishing"
      subtitle="Review content decisions, approve or request changes, and inspect publishing packages prepared for scheduling review."
      action={<ProductStatus tone={pendingApprovals.length ? 'warn' : 'good'}>{pendingApprovals.length ? `${pendingApprovals.length} Pending` : 'Queue Clear'}</ProductStatus>}
    >
      {message && (
        <Notice tone={message.includes('failed') || message.includes('Decision failed') ? 'danger' : 'good'}>{message}</Notice>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Pending Decisions" value={pendingApprovals.length} detail="Need approve, reject, or changes" tone={pendingApprovals.length ? 'warn' : 'good'} />
        <MetricCard label="Prepared Packages" value={packages.length} detail="Created after approval" tone={packages.length ? 'good' : 'muted'} />
        <MetricCard label="External Publishing" value="0" detail="Scheduling/publishing remains blocked" tone="danger" />
      </div>

      <ProductCard title="Who uses this page" subtitle="This is the human decision desk, not a reporting page.">
        <ReadableQueue items={[
          { title: 'Reviewer / Marketing Manager', meta: 'Approves, rejects, or requests changes on submitted social drafts.', status: 'Decision Owner', tone: 'warn' },
          { title: 'Social Media Manager', meta: 'Sees whether submitted work is approved before preparing publishing payloads.', status: 'Requester', tone: 'info' },
          { title: 'System Boundary', meta: 'Approval can unlock publishing preparation, but cannot publish or schedule externally by itself.', status: 'External Writes Blocked', tone: 'danger' },
        ]} />
      </ProductCard>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <ProductCard title="Approval Queue" subtitle="Human decisions required before publishing preparation.">
          {approvals.length ? (
            <div className="space-y-4">
              {approvals.map(approval => {
                const id = String(approval.id);
                const status = text(approval.approvalStatus, 'pending');
                const pending = status === 'pending';
                return (
                  <article key={id} className="rounded-lg border border-neutral-200 bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold text-black">{titleCase(text(approval.targetType, 'Content'))}</h2>
                          <ProductStatus tone={status === 'approved' ? 'good' : status === 'rejected' ? 'danger' : 'warn'}>{titleCase(status)}</ProductStatus>
                        </div>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                          Review the selected social draft, readiness score, and campaign intent before publishing preparation.
                        </p>
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <Mini label="Department" value={text(approval.requiredDepartment, 'Commercial')} />
                          <Mini label="Reviewer" value={text(approval.requiredRole, 'Human reviewer')} />
                          <Mini label="Risk" value={titleCase(text(approval.riskCategory, 'medium'))} />
                        </div>
                      </div>
                      {pending && (
                        <div className="flex min-w-[220px] flex-col gap-2">
                          <PrimaryAction onClick={() => handleAction(id, 'approve')} disabled={!!loading}>{loading === `approve-${id}` ? 'Approving...' : 'Approve'}</PrimaryAction>
                          <SecondaryAction onClick={() => handleAction(id, 'request-changes')} disabled={!!loading}>Request Changes</SecondaryAction>
                          <SecondaryAction onClick={() => handleAction(id, 'reject')} disabled={!!loading}>Reject</SecondaryAction>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyProductState message="No approval package is pending. Send a selected draft for review from Campaigns." />
          )}
        </ProductCard>

        <ProductCard title="Publishing Preparation" subtitle="Approved packages prepared for scheduling review.">
          <ReadableQueue items={readyPackages.length ? readyPackages.map(pkg => ({
            title: 'Publishing package',
            meta: `Status: ${titleCase(text(pkg.status || pkg.packageStatus, 'prepared'))}`,
            status: 'Package Ready',
            tone: 'good' as const,
          })) : [
            { title: 'No package ready yet', meta: 'Approve content to unlock publishing preparation.', status: 'Waiting', tone: 'default' as const },
          ]} />
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            Scheduling is visible as a payload and sandbox surface. Real scheduling remains disabled until credentials and authorization are approved.
          </div>
        </ProductCard>
      </div>
    </ProductPage>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-100 bg-neutral-50 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-neutral-800">{value}</div>
    </div>
  );
}
