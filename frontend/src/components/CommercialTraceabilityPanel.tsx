import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, CalendarDays, CircleAlert, Lightbulb, Link2, Megaphone, Target, Unlink } from 'lucide-react';
import { campaignsApi, commercialHierarchyApi } from '../api';
import { Field } from './ProductUI';
import { OpsEmpty, OpsNotice, OpsSection, OpsSkeleton, OpsStatus } from './OperationalUI';

type Data = Record<string, unknown>;

function asData(value: unknown): Data {
  return value && typeof value === 'object' ? (value as Data) : {};
}

function asList(value: unknown): Data[] {
  return Array.isArray(value) ? (value as Data[]) : [];
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

type Props = {
  token: string;
  annualPlan: Data;
  executionPlans: Data[];
  events: Data[];
  canManage: boolean;
  canApproveException: boolean;
  onChanged: () => Promise<void>;
  onMessage: (message: string) => void;
};

export function CommercialTraceabilityPanel({
  token,
  annualPlan,
  executionPlans,
  events,
  canManage,
  canApproveException,
  onChanged,
  onMessage,
}: Props) {
  const linkedPlanIds = useMemo(
    () => new Set(asList(annualPlan.items).map((item) => text(asData(item.commercialPlan).id)).filter(Boolean)),
    [annualPlan],
  );
  const linkedPlans = useMemo(
    () => executionPlans.filter((plan) => linkedPlanIds.has(text(plan.id))),
    [executionPlans, linkedPlanIds],
  );
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [hierarchy, setHierarchy] = useState<Data | null>(null);
  const [campaigns, setCampaigns] = useState<Data[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [selectedFindingId, setSelectedFindingId] = useState('');
  const [periodExceptionReason, setPeriodExceptionReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const effectivePlanId = linkedPlanIds.has(selectedPlanId)
    ? selectedPlanId
    : linkedPlans[0]
      ? text(linkedPlans[0].id)
      : '';

  const loadHierarchy = useCallback(async () => {
    if (!effectivePlanId) {
      setHierarchy(null);
      return;
    }
    setLoading(true);
    try {
      const [record, campaignRecords] = await Promise.all([
        commercialHierarchyApi.plan(effectivePlanId, token),
        campaignsApi.list(token),
      ]);
      setHierarchy(asData(record));
      setCampaigns(asList(campaignRecords));
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Traceability could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [effectivePlanId, onMessage, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadHierarchy(), 0);
    return () => window.clearTimeout(timer);
  }, [loadHierarchy]);

  const activeEvents = asList(hierarchy?.activeEventLinks);
  const activeCampaigns = asList(hierarchy?.activeCampaignLinks);
  const activeLearning = asList(hierarchy?.activeLearningInfluences);
  const parent = asData(hierarchy?.hierarchy_assignment);
  const annual = asData(parent.annual_plan);
  const month = asData(parent.monthly_item);
  const outcomes = asData(hierarchy?.outcomes);
  const availableFindings = useMemo(
    () => asList(annualPlan.learningSets).flatMap((set) => {
      const learningSet = asData(set);
      return asList(learningSet.findings).map((finding): Data => ({
        ...finding,
        learningSetId: learningSet.id,
        learningSetTitle: learningSet.title,
      }));
    }),
    [annualPlan],
  );
  const linkedFindingIds = new Set(activeLearning.map((link) => text(asData(link.finding).id)));
  const candidateFindings = availableFindings.filter((finding) => !linkedFindingIds.has(text(finding.id)));
  const linkedEventIds = new Set(activeEvents.map((link) => text(asData(link.event).id)));
  const linkedCampaignIds = new Set(activeCampaigns.map((link) => text(asData(link.campaign).id)));

  async function run(action: () => Promise<unknown>, success: string) {
    setSaving(true);
    onMessage('');
    try {
      const result = await action();
      setHierarchy(asData(result));
      setPeriodExceptionReason('');
      await onChanged();
      onMessage(success);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'The hierarchy could not be updated.');
    } finally {
      setSaving(false);
    }
  }

  async function linkEvent() {
    if (!selectedEventId) return onMessage('Choose an event to link.');
    await run(
      () => commercialHierarchyApi.linkEvent(
        effectivePlanId,
        {
          eventId: selectedEventId,
          primary: activeEvents.length === 0,
          ...(periodExceptionReason.trim() ? { periodExceptionReason: periodExceptionReason.trim() } : {}),
        },
        token,
      ),
      'Event Operations is now connected to this execution plan.',
    );
    setSelectedEventId('');
  }

  async function linkCampaign() {
    if (!selectedCampaignId) return onMessage('Choose a campaign to link.');
    await run(
      () => commercialHierarchyApi.linkCampaign(
        effectivePlanId,
        {
          campaignId: selectedCampaignId,
          ...(periodExceptionReason.trim() ? { periodExceptionReason: periodExceptionReason.trim() } : {}),
        },
        token,
      ),
      'Campaign is now connected to this execution plan.',
    );
    setSelectedCampaignId('');
  }

  async function linkLearning() {
    const finding = candidateFindings.find((candidate) => text(candidate.id) === selectedFindingId);
    if (!finding) return onMessage('Choose approved learning to use.');
    await run(
      () => commercialHierarchyApi.linkLearning(
        effectivePlanId,
        { learningSetId: text(finding.learningSetId), findingIds: [selectedFindingId] },
        token,
      ),
      'Approved learning is now recorded behind this execution plan.',
    );
    setSelectedFindingId('');
  }

  return (
    <OpsSection
      title="Strategy to results"
      subtitle="Follow one initiative from the annual strategy into execution, customer activity, and measured outcomes."
      action={linkedPlans.length > 1 ? (
        <label className="trace-plan-selector">
          <span>Execution plan</span>
          <select value={effectivePlanId} onChange={(event) => setSelectedPlanId(event.target.value)}>
            {linkedPlans.map((plan) => <option key={text(plan.id)} value={text(plan.id)}>{text(plan.title)}</option>)}
          </select>
        </label>
      ) : undefined}
    >
      {!linkedPlans.length ? (
        <OpsEmpty
          title="Connect an execution plan"
          message="Edit a monthly initiative above and choose its detailed commercial plan. Tanaghum will preserve the annual and monthly parent automatically."
        />
      ) : loading || !hierarchy ? (
        <div className="trace-loading"><OpsSkeleton /><OpsSkeleton /></div>
      ) : (
        <div className="traceability-workspace">
          <div className="trace-chain" aria-label="Commercial strategy to results path">
            <TraceStep icon={<CalendarDays size={17} />} label="Annual strategy" value={`${numberValue(annual.year)} / ${text(annual.title, 'Annual plan')}`} ready={Boolean(text(annual.id))} />
            <ArrowRight size={16} aria-hidden="true" />
            <TraceStep icon={<Target size={17} />} label="Monthly initiative" value={text(month.title, 'Not assigned')} ready={Boolean(text(month.id))} />
            <ArrowRight size={16} aria-hidden="true" />
            <TraceStep icon={<Link2 size={17} />} label="Execution plan" value={text(hierarchy.title)} ready />
            <ArrowRight size={16} aria-hidden="true" />
            <TraceStep icon={<Megaphone size={17} />} label="Operating work" value={`${activeEvents.length} event / ${activeCampaigns.length} campaign`} ready={activeEvents.length + activeCampaigns.length > 0} />
            <ArrowRight size={16} aria-hidden="true" />
            <TraceStep icon={<Lightbulb size={17} />} label="Known outcomes" value={`${numberValue(outcomes.leads)} leads / ${numberValue(outcomes.purchases)} purchases`} ready={numberValue(outcomes.leads) + numberValue(outcomes.purchases) > 0} />
          </div>

          <div className="trace-detail-grid">
            <section className="trace-detail-column" aria-labelledby="trace-learning-title">
              <header>
                <div><Lightbulb size={17} /><span><strong id="trace-learning-title">Approved learning</strong><small>Why this approach was chosen</small></span></div>
                <OpsStatus tone={activeLearning.length ? 'positive' : 'warning'}>{activeLearning.length} linked</OpsStatus>
              </header>
              <div className="trace-record-list">
                {activeLearning.map((link) => {
                  const finding = asData(link.finding);
                  return <TraceRecord key={text(link.id)} title={text(finding.title)} detail={text(finding.recommendation)} onRemove={canManage ? () => void run(() => commercialHierarchyApi.unlinkLearning(effectivePlanId, text(finding.id), { reason: 'No longer used by this plan' }, token), 'Learning link archived; evidence remains readable.') : undefined} />;
                })}
                {!activeLearning.length ? <p>No approved finding has been recorded behind this plan yet.</p> : null}
              </div>
              {canManage && candidateFindings.length ? (
                <div className="trace-add-row">
                  <Field label="Use approved learning">
                    <select value={selectedFindingId} onChange={(event) => setSelectedFindingId(event.target.value)}>
                      <option value="">Choose a finding</option>
                      {candidateFindings.map((finding) => <option key={text(finding.id)} value={text(finding.id)}>{text(finding.title)}</option>)}
                    </select>
                  </Field>
                  <button className="ops-button is-secondary" type="button" disabled={saving || !selectedFindingId} onClick={() => void linkLearning()}>Use learning</button>
                </div>
              ) : null}
            </section>

            <section className="trace-detail-column" aria-labelledby="trace-work-title">
              <header>
                <div><Megaphone size={17} /><span><strong id="trace-work-title">Operating work</strong><small>Where this plan is being executed</small></span></div>
                <OpsStatus tone={activeEvents.length + activeCampaigns.length ? 'positive' : 'warning'}>{activeEvents.length + activeCampaigns.length} linked</OpsStatus>
              </header>
              <div className="trace-record-list">
                {activeEvents.map((link) => {
                  const event = asData(link.event);
                  return <TraceRecord key={text(link.id)} title={text(event.name)} detail={`Event / ${titleCase(text(event.status))}`} onRemove={canManage ? () => void run(() => commercialHierarchyApi.unlinkEvent(effectivePlanId, text(event.id), { reason: 'Removed from current execution scope' }, token), 'Event link archived; historical evidence remains readable.') : undefined} />;
                })}
                {activeCampaigns.map((link) => {
                  const campaign = asData(link.campaign);
                  return <TraceRecord key={text(link.id)} title={text(campaign.objective, 'Campaign')} detail={`Campaign / ${titleCase(text(campaign.status))}`} onRemove={canManage ? () => void run(() => commercialHierarchyApi.unlinkCampaign(effectivePlanId, text(campaign.id), { reason: 'Removed from current execution scope' }, token), 'Campaign link archived; historical evidence remains readable.') : undefined} />;
                })}
                {!activeEvents.length && !activeCampaigns.length ? <p>Connect the event or campaign that will deliver this plan.</p> : null}
              </div>
              {canManage ? (
                <div className="trace-operating-actions">
                  <div className="trace-add-row">
                    <Field label="Event Operations">
                      <select value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)}>
                        <option value="">Choose event</option>
                        {events.filter((event) => !linkedEventIds.has(text(event.id))).map((event) => <option key={text(event.id)} value={text(event.id)}>{text(event.name)}</option>)}
                      </select>
                    </Field>
                    <button className="ops-button is-secondary" type="button" disabled={saving || !selectedEventId} onClick={() => void linkEvent()}>Connect</button>
                  </div>
                  <div className="trace-add-row">
                    <Field label="Campaign">
                      <select value={selectedCampaignId} onChange={(event) => setSelectedCampaignId(event.target.value)}>
                        <option value="">Choose campaign</option>
                        {campaigns.filter((campaign) => !linkedCampaignIds.has(text(campaign.id))).map((campaign) => <option key={text(campaign.id)} value={text(campaign.id)}>{text(campaign.objective, 'Campaign')}</option>)}
                      </select>
                    </Field>
                    <button className="ops-button is-secondary" type="button" disabled={saving || !selectedCampaignId} onClick={() => void linkCampaign()}>Connect</button>
                  </div>
                  {canApproveException ? (
                    <Field label="Approved date exception (only when work falls outside the selected month)">
                      <input value={periodExceptionReason} onChange={(event) => setPeriodExceptionReason(event.target.value)} placeholder="Reason for the intentional schedule change" />
                    </Field>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>

          {!activeEvents.length && !activeCampaigns.length ? (
            <OpsNotice tone="warning"><CircleAlert size={16} /> This plan has a valid annual parent but no operating work yet. Connect an event or campaign before execution begins.</OpsNotice>
          ) : null}
        </div>
      )}
    </OpsSection>
  );
}

function TraceStep({ icon, label, value, ready }: { icon: ReactNode; label: string; value: string; ready: boolean }) {
  return <div className={`trace-step${ready ? ' is-ready' : ''}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>;
}

function TraceRecord({ title, detail, onRemove }: { title: string; detail: string; onRemove?: () => void }) {
  return <div className="trace-record"><span><strong>{title}</strong><small>{detail}</small></span>{onRemove ? <button type="button" onClick={onRemove} title="Archive this link"><Unlink size={15} /><span className="sr-only">Archive link</span></button> : null}</div>;
}
