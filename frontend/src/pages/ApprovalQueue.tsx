import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  CircleAlert,
  FileText,
  ListChecks,
  Sparkles,
} from 'lucide-react';
import { approvalsApi, publishingPackageApi } from '../api';
import { OpsEmpty, OpsNotice, OpsPage, OpsPageHeader, OpsSection, OpsSkeleton, OpsStatus } from '../components/OperationalUI';
import { useAuth } from '../contexts/useAuth';
import './ApprovalQueue.css';

type RecordMap = Record<string, unknown>;
type Decision = 'approve' | 'reject' | 'request-changes';

const PAGE_SIZE = 20;
const DECISION_ROLES = ['admin', 'cco'];

function text(value: unknown, fallback = 'Not specified'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, character => character.toUpperCase());
}

function roleLabel(value: unknown): string {
  const normalized = text(value, 'content approver').toLowerCase().replaceAll('-', '_').replaceAll(' ', '_');
  if (normalized === 'cco') return 'CCO';
  return titleCase(normalized);
}

function object(value: unknown): RecordMap {
  return value && typeof value === 'object' ? value as RecordMap : {};
}

function list(value: unknown): RecordMap[] {
  return Array.isArray(value) ? value as RecordMap[] : [];
}

function normalizeRole(user: unknown): string {
  const role = user && typeof user === 'object' ? (user as RecordMap).role : '';
  return typeof role === 'string' ? role.trim().toLowerCase().replaceAll(' ', '_').replaceAll('-', '_') : 'viewer';
}

function customerTitle(value: unknown, fallback: string): string {
  return text(value, fallback)
    .replace(/^Sprint\s*\d+\s+Acceptance\s+(Event|Lead)\s*\d*/i, '$1')
    .replace(/\bSprint\s*\d+\b/gi, '')
    .trim() || fallback;
}

export default function ApprovalQueue() {
  const { token, user } = useAuth();
  const canDecide = DECISION_ROLES.includes(normalizeRole(user));
  const [approvals, setApprovals] = useState<RecordMap[]>([]);
  const [packages, setPackages] = useState<RecordMap[]>([]);
  const [packets, setPackets] = useState<Record<string, RecordMap>>({});
  const [selectedId, setSelectedId] = useState('');
  const [comment, setComment] = useState('');
  const [page, setPage] = useState(0);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [decisionLoading, setDecisionLoading] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadPacket = useCallback(async (id: string) => {
    if (!token || !id) return;
    try {
      const packet = await approvalsApi.decisionPacket(id, token) as RecordMap;
      setPackets(current => ({ ...current, [id]: packet }));
    } catch {
      setPackets(current => ({ ...current, [id]: {} }));
    }
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [approvalData, packageData] = await Promise.all([
        approvalsApi.list(token),
        publishingPackageApi.list(token).catch(() => []),
      ]);
      const rows = approvalData as RecordMap[];
      const preferred = rows.find(row => text(row.approvalStatus, 'pending') === 'pending') ?? rows[0];
      setApprovals(rows);
      setPackages(packageData as RecordMap[]);
      if (!selectedId && preferred) setSelectedId(String(preferred.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The review queue could not load.');
    } finally {
      setLoading(false);
    }
  }, [selectedId, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(approvals.length / PAGE_SIZE));
  const visibleApprovals = useMemo(() => approvals.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [approvals, page]);
  const visibleIds = visibleApprovals.map(row => String(row.id)).join(',');

  useEffect(() => {
    if (!token || !visibleIds) return;
    const missingIds = visibleIds.split(',').filter(id => id && !packets[id]);
    if (!missingIds.length) return;
    const timer = window.setTimeout(() => {
      void Promise.all(missingIds.map(id => loadPacket(id)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPacket, packets, token, visibleIds]);

  useEffect(() => {
    if (!selectedId || packets[selectedId]) return;
    const timer = window.setTimeout(() => void loadPacket(selectedId), 0);
    return () => window.clearTimeout(timer);
  }, [loadPacket, packets, selectedId]);

  async function decide(action: Decision) {
    if (!token || !selectedId || !canDecide) return;
    if (action !== 'approve' && !comment.trim()) {
      setError('Add a specific reviewer comment before requesting changes or rejecting.');
      return;
    }
    setDecisionLoading(action);
    setMessage('');
    setError('');
    try {
      const decisionComment = comment.trim() || 'Approved and ready for the next governed step.';
      if (action === 'approve') {
        await approvalsApi.approve(selectedId, { comment: decisionComment }, token);
        let packagePrepared = selectedPackages.length > 0;
        const campaignId = text(campaign.id, '');
        const contentItemId = text(contentItem.id, '');
        if (!packagePrepared && campaignId && contentItemId) {
          try {
            const createdPackage = await publishingPackageApi.create({
              campaignId,
              draftId: contentItemId,
              approvalId: selectedId,
              platforms: [text(contentItem.platform, 'instagram')],
            }, token) as RecordMap;
            setPackages(current => [createdPackage, ...current]);
            packagePrepared = true;
          } catch (packageError) {
            setMessage(`Content approved. Scheduling package still needs attention: ${packageError instanceof Error ? packageError.message : 'Package preparation failed.'}`);
          }
        }
        if (packagePrepared) setMessage('Content approved and prepared for scheduling.');
      } else if (action === 'reject') {
        await approvalsApi.reject(selectedId, { comment: decisionComment }, token);
        setMessage('Content rejected.');
      } else {
        await approvalsApi.requestChanges(selectedId, { comment: decisionComment }, token);
        setMessage('Changes requested and returned to the content team.');
      }
      setComment('');
      setPackets(current => {
        const next = { ...current };
        delete next[selectedId];
        return next;
      });
      await load();
      await loadPacket(selectedId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The decision could not be recorded.');
    } finally {
      setDecisionLoading('');
    }
  }

  function selectApproval(id: string) {
    setSelectedId(id);
    setComment('');
    setError('');
    setMobileDetail(true);
  }

  const selectedApproval = approvals.find(row => String(row.id) === selectedId) ?? visibleApprovals[0] ?? null;
  const selectedPacket = selectedId ? object(packets[selectedId]) : {};
  const campaign = object(selectedPacket.campaign);
  const contentItem = object(selectedPacket.contentItem);
  const latestDraft = object(selectedPacket.latestDraftVersion);
  const selectedPackages = list(selectedPacket.publishingPackages);
  const selectedStatus = text(selectedApproval?.approvalStatus, 'pending');
  const draftText = text(latestDraft.text, text(contentItem.draftText, 'No draft text is available for this review.'));
  const selectedTitle = customerTitle(campaign.topic, titleCase(text(selectedApproval?.targetType, 'Content')));
  const pendingCount = approvals.filter(row => text(row.approvalStatus, 'pending') === 'pending').length;

  return (
    <OpsPage className="review-queue-page">
      <OpsPageHeader
        eyebrow="Content Decisions"
        title="Review Content"
        subtitle="Make one informed decision with the draft, quality, risk, comments, and publishing impact together."
        actions={(
          <>
            <Link className="ops-button is-secondary" to="/stitchi?prompt=Summarize%20the%20current%20content%20review%20risks"><Sparkles size={17} aria-hidden="true" />Ask Stitchi</Link>
            <OpsStatus tone={pendingCount ? 'warning' : 'positive'}>{pendingCount ? `${pendingCount} Awaiting Review` : 'All Clear'}</OpsStatus>
          </>
        )}
      />

      <nav className="review-journey" aria-label="Content workflow stages">
        {['Brief', 'Ideas', 'Draft'].map(step => <Link key={step} className="is-complete" to="/ideas"><span><Check size={14} /></span><strong>{step}</strong></Link>)}
        <span className="is-active"><span>4</span><strong>Review</strong></span>
        <Link to="/publishing"><span>5</span><strong>Schedule</strong></Link>
        <Link to="/growth"><span>6</span><strong>Results</strong></Link>
      </nav>

      {message ? <OpsNotice tone="positive">{message}</OpsNotice> : null}
      {error ? <OpsNotice tone="danger">{error}</OpsNotice> : null}

      {loading ? <OpsSkeleton rows={6} /> : approvals.length ? (
        <div className={`review-workspace${mobileDetail ? ' show-detail' : ''}`}>
          <section className="review-list-panel" aria-label="Review queue">
            <header className="review-list-header">
              <div><h2>Awaiting Decision</h2><p>{approvals.length} total review record{approvals.length === 1 ? '' : 's'}</p></div>
              <span><ListChecks size={18} aria-hidden="true" /></span>
            </header>
            <div className="review-list">
              {visibleApprovals.map(approval => {
                const id = String(approval.id);
                const packet = object(packets[id]);
                const rowCampaign = object(packet.campaign);
                const rowContent = object(packet.contentItem);
                const status = text(approval.approvalStatus, 'pending');
                return (
                  <button className={`review-list-item${id === selectedId ? ' is-active' : ''}`} key={id} type="button" onClick={() => selectApproval(id)} aria-current={id === selectedId ? 'true' : undefined}>
                    <span><strong>{customerTitle(rowCampaign.topic, titleCase(text(approval.targetType, 'Content')))}</strong><ChevronRight size={17} aria-hidden="true" /></span>
                    <small>{text(rowCampaign.objective, 'Content submitted for a human decision.')}</small>
                    <span className="review-list-meta"><span>{titleCase(text(rowContent.platform, 'Content'))}</span><OpsStatus tone={status === 'approved' ? 'positive' : status === 'rejected' ? 'danger' : status === 'changes_requested' ? 'warning' : 'info'}>{titleCase(status)}</OpsStatus></span>
                  </button>
                );
              })}
            </div>
            <footer className="review-pagination">
              <button type="button" onClick={() => setPage(current => Math.max(0, current - 1))} disabled={page === 0} aria-label="Previous review page"><ArrowLeft size={16} aria-hidden="true" /></button>
              <span>Page {page + 1} of {totalPages}</span>
              <button type="button" onClick={() => setPage(current => Math.min(totalPages - 1, current + 1))} disabled={page >= totalPages - 1} aria-label="Next review page"><ArrowRight size={16} aria-hidden="true" /></button>
            </footer>
          </section>

          <section className="review-detail-panel" aria-label="Selected review decision">
            <button className="review-mobile-back" type="button" onClick={() => setMobileDetail(false)}><ArrowLeft size={17} aria-hidden="true" />Back to Queue</button>
            <header className="review-detail-header">
              <div><span className="ops-eyebrow">{titleCase(text(contentItem.platform, 'Content'))}</span><h2>{selectedTitle}</h2><p>{text(campaign.objective, 'Review the complete decision context below.')}</p></div>
            </header>

            <div className="review-detail-body">
              <article className="review-content-preview">
                <div><span className="review-avatar">T</span><span><strong>Content Draft</strong><small>Version {text(latestDraft.versionNo, 'current')}</small></span></div>
                <p>{draftText}</p>
                <span className="review-draft-label"><FileText size={15} aria-hidden="true" />Full Draft Shown Above</span>
              </article>

              <div className="review-insights">
                <section><span>Quality Score</span><strong>{String(contentItem.reachScore ?? 0)}<small>/100</small></strong><p>Use the score as supporting context. The human reviewer makes the final decision.</p></section>
                <section><span>Risk Review</span><strong className="review-risk"><CircleAlert size={18} aria-hidden="true" />{titleCase(text(selectedApproval?.riskCategory, 'medium'))} Risk</strong><p>{text(contentItem.riskReason, 'No specific risk note is recorded.')}</p></section>
              </div>

              <section className="review-context-grid">
                <div><span>Audience</span><strong>{text(campaign.audience)}</strong></div>
                <div><span>Call to Action</span><strong>{text(campaign.cta)}</strong></div>
                <div><span>Publishing Package</span><strong>{selectedPackages.length ? `${selectedPackages.length} prepared` : 'Available after approval'}</strong></div>
                <div><span>Reviewer Role</span><strong>{roleLabel(selectedApproval?.requiredRole)}</strong></div>
              </section>

              {selectedStatus === 'pending' ? (
                <section className="review-comment">
                  <div><h3>Reviewer Comment</h3><p>Required when requesting changes or rejecting.</p></div>
                  <label htmlFor="review-decision-comment">Decision Comment</label>
                  <textarea id="review-decision-comment" name="reviewComment" rows={3} value={comment} onChange={event => setComment(event.target.value)} placeholder={'Add a specific decision note\u2026'} disabled={!canDecide} />
                  {!canDecide ? <p className="review-read-only">Your role can read this decision context. Final approval actions require the CCO or admin role.</p> : null}
                </section>
              ) : <OpsNotice tone="info">This review is {titleCase(selectedStatus)}. Its recorded decision remains available as evidence.</OpsNotice>}
            </div>

            {selectedStatus === 'pending' && canDecide ? (
              <footer className="review-decision-actions">
                <button className="ops-button is-danger" type="button" onClick={() => void decide('reject')} disabled={Boolean(decisionLoading)}>Reject</button>
                <button className="ops-button is-secondary" type="button" onClick={() => void decide('request-changes')} disabled={Boolean(decisionLoading)}>Request Changes</button>
                <button className="ops-button is-primary" type="button" onClick={() => void decide('approve')} disabled={Boolean(decisionLoading)}><Check size={17} aria-hidden="true" />{decisionLoading === 'approve' ? 'Approving\u2026' : 'Approve Content'}</button>
              </footer>
            ) : null}
          </section>
        </div>
      ) : (
        <OpsSection><OpsEmpty title="Nothing to review" message="When campaign content is submitted for review, it will appear here." action={<Link className="ops-button is-primary" to="/campaigns">Open Campaign Workspace</Link>} /></OpsSection>
      )}

      {!loading && packages.length > 0 ? <p className="review-package-summary">{packages.length} publishing package{packages.length === 1 ? '' : 's'} are currently recorded. Open Scheduling to review package readiness.</p> : null}
    </OpsPage>
  );
}
