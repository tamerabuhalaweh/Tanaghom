import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { approvalsApi, publishingPackageApi } from '../api';
import { DetailGrid, EmptyProductState, MetricCard, Notice, PrimaryAction, ProductCard, ProductPage, ProductStatus, ReadableQueue, SecondaryAction } from '../components/ProductUI';
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
  const [decisionPackets, setDecisionPackets] = useState<Record<string, RecordMap>>({});
  const [decisionComments, setDecisionComments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    const [approvalData, packageData] = await Promise.all([
      approvalsApi.list(token),
      publishingPackageApi.list(token).catch(() => []),
    ]);
    const approvalRows = approvalData as RecordMap[];
    setApprovals(approvalRows);
    setPackages(packageData as RecordMap[]);
    const packets = await Promise.all(approvalRows.slice(0, 20).map(async approval => {
      const id = String(approval.id);
      try {
        return [id, await approvalsApi.decisionPacket(id, token)] as const;
      } catch {
        return [id, null] as const;
      }
    }));
    setDecisionPackets(Object.fromEntries(packets.filter((entry): entry is readonly [string, RecordMap] => Boolean(entry[1]))));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function run() {
      try {
        if (cancelled) return;
        await load();
      } catch (error) {
        if (!cancelled) setMessage(`Could not load reviews: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [load, token]);

  async function handleAction(id: string, action: 'approve' | 'reject' | 'request-changes') {
    if (!token) return;
    setLoading(`${action}-${id}`);
    setMessage('');
    try {
      const comment = decisionComments[id]?.trim()
        || (action === 'approve' ? 'Approved - ready for scheduling.' : action === 'reject' ? 'Rejected.' : 'Please revise and resubmit.');
      if (action === 'approve') await approvalsApi.approve(id, { comment }, token);
      else if (action === 'reject') await approvalsApi.reject(id, { comment }, token);
      else await approvalsApi.requestChanges(id, { comment }, token);
      setMessage(action === 'approve' ? 'Approved. Content moves to scheduling next.' : action === 'reject' ? 'Rejected.' : 'Changes requested.');
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
      eyebrow="Content Studio"
      title="Review & Approve"
      subtitle="Review submitted content, approve or request changes, and track what's ready for scheduling."
      action={<ProductStatus tone={pendingApprovals.length ? 'warn' : 'good'}>{pendingApprovals.length ? `${pendingApprovals.length} to Review` : 'All Clear'}</ProductStatus>}
    >
      {message && (
        <Notice tone={message.includes('failed') || message.includes('Decision failed') || message.includes('Could not') ? 'danger' : 'good'}>{message}</Notice>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="To Review" value={pendingApprovals.length} detail="Content waiting for your decision" tone={pendingApprovals.length ? 'warn' : 'good'} />
        <MetricCard label="Prepared Packages" value={packages.length} detail="Ready after approval" tone={packages.length ? 'good' : 'default'} />
        <MetricCard label="Publishing" value="Controlled" detail="Scheduling requires admin setup" tone="info" />
      </div>

      {/* ---- Quick guide for first-time users ---- */}
      <ProductCard title="How reviews work" subtitle="Here's what happens when content is submitted for review.">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { step: '1', title: 'Content is submitted', desc: 'When a draft is ready, it comes here for your review. You see the full text, campaign context, and quality score.' },
            { step: '2', title: 'You decide', desc: 'Approve to move it forward, request changes to improve it, or reject if it is not right for this campaign.' },
            { step: '3', title: 'Approved content moves on', desc: 'Once approved, the content becomes a scheduling package. Publishing remains controlled until admin setup.' },
          ].map((item) => (
            <div key={item.step} className="rounded-lg border border-neutral-200 bg-neutral-50 p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-950 text-sm font-semibold text-white">
                {item.step}
              </div>
              <div className="mt-3 text-sm font-semibold text-neutral-950">{item.title}</div>
              <p className="mt-1 text-sm leading-6 text-neutral-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </ProductCard>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <ProductCard title="Review Queue" subtitle="Content waiting for your approval decision.">
          {approvals.length ? (
            <div className="space-y-4">
              {approvals.map(approval => {
                const id = String(approval.id);
                const status = text(approval.approvalStatus, 'pending');
                const pending = status === 'pending';
                const packet = decisionPackets[id] || {};
                const campaign = (packet.campaign || {}) as RecordMap;
                const contentItem = (packet.contentItem || {}) as RecordMap;
                const latestDraft = (packet.latestDraftVersion || {}) as RecordMap;
                const packetPackages = Array.isArray(packet.publishingPackages) ? packet.publishingPackages as RecordMap[] : [];
                const draftText = text(latestDraft.text, text(contentItem.draftText, 'No draft text available.'));
                return (
                  <article key={id} className="rounded-lg border border-neutral-200 bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold text-black">{text(campaign.topic, titleCase(text(approval.targetType, 'Content')))}</h2>
                          <ProductStatus tone={status === 'approved' ? 'good' : status === 'rejected' ? 'warn' : 'info'}>
                            {titleCase(status)}
                          </ProductStatus>
                        </div>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                          {text(campaign.objective, 'Review the content below, quality score, and campaign details before deciding.')}
                        </p>
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <Mini label="Department" value={text(approval.requiredDepartment, 'Commercial')} />
                          <Mini label="Reviewer Role" value={text(approval.requiredRole, 'Reviewer')} />
                          <Mini label="Priority" value={titleCase(text(approval.riskCategory, 'medium'))} />
                        </div>
                        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <ProductStatus tone="info">{titleCase(text(contentItem.platform, 'selected platform'))}</ProductStatus>
                              <ProductStatus tone="muted">Version {text(latestDraft.versionNo, 'current')}</ProductStatus>
                            </div>
                            <div className="whitespace-pre-wrap text-sm leading-6 text-neutral-800">{draftText}</div>
                          </div>
                          <DetailGrid items={[
                            { label: 'Audience', value: text(campaign.audience, 'Not specified') },
                            { label: 'Call to Action', value: text(campaign.cta, 'Not specified') },
                            { label: 'Quality Score', value: String(contentItem.reachScore ?? 0) },
                            { label: 'Risk Notes', value: text(contentItem.riskReason, 'None recorded') },
                            { label: 'Packages', value: packetPackages.length ? `${packetPackages.length} package(s)` : 'None yet' },
                          ]} />
                        </div>
                      </div>
                      {pending && (
                        <div className="flex min-w-[220px] flex-col gap-2">
                          <textarea
                            value={decisionComments[id] || ''}
                            onChange={event => setDecisionComments(current => ({ ...current, [id]: event.target.value }))}
                            className="min-h-24 rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950"
                            placeholder="Add a comment (optional)"
                          />
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
            <EmptyProductState
              title="Nothing to review"
              message="When a draft is submitted for review from the Campaigns page, it will appear here."
              action={<Link to="/campaigns" className="inline-flex min-h-10 items-center justify-center rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800">Go to Campaigns</Link>}
            />
          )}
        </ProductCard>

        <ProductCard title="Ready for Scheduling" subtitle="Approved content prepared as scheduling packages.">
          <ReadableQueue items={readyPackages.length ? readyPackages.map(pkg => ({
            title: 'Content package',
            meta: `Status: ${titleCase(text(pkg.status || pkg.packageStatus, 'prepared'))}`,
            status: 'Ready',
            tone: 'good' as const,
          })) : [
            { title: 'No packages yet', meta: 'Approve content to create scheduling packages.', status: 'Waiting', tone: 'default' as const },
          ]} />
          <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
            Scheduling is set up in the Scheduling page. An admin configures the scheduling service and channels before content can be published.
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
