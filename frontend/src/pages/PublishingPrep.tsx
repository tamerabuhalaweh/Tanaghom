import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  MoreHorizontal,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react';
import { campaignsApi, commercialWorkflowApi, eventsApi, postizApi, postizChannelApi, publishingPackageApi } from '../api';
import { OpsEmpty, OpsNotice, OpsPage, OpsPageHeader, OpsSkeleton, OpsStatus } from '../components/OperationalUI';
import { useAuth } from '../contexts/useAuth';
import './PublishingPrep.css';

type RecordMap = Record<string, unknown>;

function asRecord(value: unknown): RecordMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordMap : {};
}

function asList(value: unknown): RecordMap[] {
  return Array.isArray(value) ? value.filter((item): item is RecordMap => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : [];
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function text(value: unknown, fallback = 'Not available'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function titleCase(value: unknown): string {
  return text(value, 'not_available').replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

const internalCustomerTextPattern = /\b(sprint\s*\d+|acceptance|smoke)\b/i;

function safeEventName(event: RecordMap | null | undefined): string {
  if (!event) return 'Choose an event';
  const rawName = text(event.name, '');
  if (rawName && !internalCustomerTextPattern.test(rawName)) return rawName;
  const eventDate = text(event.eventDate, '');
  if (!eventDate) return 'Customer event';
  const date = new Date(eventDate);
  return Number.isNaN(date.getTime()) ? 'Customer event' : `Customer event - ${date.toLocaleDateString()}`;
}

function safeCampaignName(campaign: RecordMap | null | undefined): string {
  const rawName = text(campaign?.topic || campaign?.title || campaign?.name, '');
  return rawName && !internalCustomerTextPattern.test(rawName) ? rawName : 'Approved Campaign Content';
}

function defaultScheduleInput(): string {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function localScheduleToIso(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : date.toISOString();
}

async function fetchPublishingReadiness(token: string) {
  const [packageData, statusData, channelData, evidenceData, eventData, connectorData, campaignData] = await Promise.all([
    publishingPackageApi.list(token),
    postizApi.status(token),
    postizApi.channels(token).catch((error) => ({ status: 'requires_channel', channels: [], _label: error instanceof Error ? error.message : 'Social account status unavailable' })),
    commercialWorkflowApi.evidence(token).catch(() => null),
    eventsApi.list(token).catch(() => []),
    postizApi.connectors(token).catch(() => []),
    campaignsApi.list(token).catch(() => []),
  ]);

  return {
    packages: asList(packageData),
    schedulingStatus: asRecord(statusData),
    channels: asList(asRecord(channelData).channels),
    evidence: evidenceData ? asRecord(evidenceData) : null,
    events: asList(eventData),
    connectors: asList(connectorData),
    campaigns: asList(campaignData),
  };
}

function SchedulingJourney() {
  return (
    <nav className="scheduling-journey" aria-label="Content workflow stages">
      {['Brief', 'Ideas', 'Draft', 'Review'].map(step => <Link key={step} className="is-complete" to={step === 'Review' ? '/approvals' : '/ideas'}><span><Check size={14} /></span><strong>{step}</strong></Link>)}
      <span className="is-active"><span>5</span><strong>Schedule</strong></span>
      <Link to="/growth"><span>6</span><strong>Results</strong></Link>
    </nav>
  );
}

export default function PublishingPrep() {
  const { token } = useAuth();
  const [packages, setPackages] = useState<RecordMap[]>([]);
  const [campaigns, setCampaigns] = useState<RecordMap[]>([]);
  const [channels, setChannels] = useState<RecordMap[]>([]);
  const [connectors, setConnectors] = useState<RecordMap[]>([]);
  const [events, setEvents] = useState<RecordMap[]>([]);
  const [evidence, setEvidence] = useState<RecordMap | null>(null);
  const [schedulingStatus, setSchedulingStatus] = useState<RecordMap | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [eventChannelState, setEventChannelState] = useState<RecordMap | null>(null);
  const [eventChannelMessage, setEventChannelMessage] = useState('');
  const [assigningChannel, setAssigningChannel] = useState('');
  const [scheduledAt, setScheduledAt] = useState(defaultScheduleInput);
  const [schedulePreview, setSchedulePreview] = useState<RecordMap | null>(null);
  const [scheduleResult, setScheduleResult] = useState<RecordMap | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [mobileDetail, setMobileDetail] = useState(false);

  function applyReadiness(result: Awaited<ReturnType<typeof fetchPublishingReadiness>>) {
    setPackages(result.packages);
    setCampaigns(result.campaigns);
    setChannels(result.channels);
    setConnectors(result.connectors);
    setEvents(result.events);
    setEvidence(result.evidence);
    setSchedulingStatus(result.schedulingStatus);
    setSelectedPackageId(current => current || text(result.packages[0]?.id, ''));
    setSelectedChannelId(current => current || text(result.channels[0]?.id, ''));
    setSelectedEventId(current => current || text(result.events[0]?.id, ''));
  }

  async function load() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      applyReadiness(await fetchPublishingReadiness(token));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Scheduling could not load.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void fetchPublishingReadiness(token).then(result => {
      if (!cancelled) applyReadiness(result);
    }).catch(reason => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Scheduling could not load.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [token]);

  const loadEventChannelState = useCallback(async (eventId: string) => {
    if (!token || !eventId) {
      setEventChannelState(null);
      return;
    }
    try {
      setEventChannelState(await postizChannelApi.eventChannels(eventId, token) as RecordMap);
      setEventChannelMessage('');
    } catch (reason) {
      setEventChannelState(null);
      setEventChannelMessage(reason instanceof Error ? reason.message : 'Event account readiness could not load.');
    }
  }, [token]);

  useEffect(() => {
    if (!selectedEventId) return;
    const timer = window.setTimeout(() => void loadEventChannelState(selectedEventId), 0);
    return () => window.clearTimeout(timer);
  }, [loadEventChannelState, selectedEventId]);

  const selectedPackage = packages.find(item => text(item.id, '') === selectedPackageId) || packages[0] || null;
  const selectedCampaign = campaigns.find(item => text(item.id, '') === text(selectedPackage?.campaignId, '')) || null;
  const selectedChannel = channels.find(item => text(item.id, '') === selectedChannelId) || channels[0] || null;
  const selectedEvent = events.find(item => text(item.id, '') === selectedEventId) || null;
  const activeConnector = connectors.find(item => text(item.connectorStatus, '').toLowerCase() === 'active' && item.supportsSchedule === true) || connectors.find(item => item.supportsSchedule === true) || null;
  const eventSelections = asList(eventChannelState?.selections);
  const selectedEventChannels = new Set(eventSelections.map(item => text(item.postizIntegrationChannelId, '')).filter(Boolean));
  const eventReadiness = asRecord(eventChannelState?.readiness);
  const health = asRecord(schedulingStatus?.health);
  const previewSafety = asRecord(schedulePreview?.safety);
  const previewGate = asRecord(previewSafety.schedulingGate);
  const schedulingAllowed = previewGate.allowed === true;
  const schedulingReasons = stringList(previewGate.reasons);
  const evidenceActions = asList(evidence?.actions).slice(0, 8);
  const evidenceCoverage = numberValue(asRecord(evidence?.coverage).score);
  const selectedCampaignTitle = safeCampaignName(selectedCampaign);
  const selectedChannelName = text(selectedChannel?.name || selectedChannel?.profile, 'Choose a social account');
  const scheduleSucceeded = ['sandbox_scheduled', 'scheduled', 'completed'].includes(text(scheduleResult?.status, '').toLowerCase());

  async function validateSchedule() {
    if (!token || !selectedPackage) return null;
    const preview = await postizApi.packagePayload({ publishingPackageId: selectedPackage.id, scheduledAt: localScheduleToIso(scheduledAt) }, token) as RecordMap;
    setSchedulePreview(preview);
    return preview;
  }

  async function checkReadiness() {
    if (!selectedPackage) return;
    setActionLoading('readiness');
    setMessage('');
    setError('');
    try {
      const preview = await validateSchedule();
      const allowed = asRecord(asRecord(preview?.safety).schedulingGate).allowed === true;
      setMessage(allowed ? 'Content, social account, and publishing controls are ready.' : 'The approved content is saved, but account setup or publishing authorization still needs attention.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Readiness could not be checked.');
    } finally {
      setActionLoading('');
    }
  }

  async function confirmSchedule() {
    if (!token || !selectedPackage || !selectedChannel) return;
    setActionLoading('confirm');
    setMessage('');
    setError('');
    setScheduleResult(null);
    try {
      await postizApi.selectChannel({ integrationId: text(selectedChannel.id, ''), validationMode: 'listed_channel' }, token);
      const preview = await validateSchedule();
      const allowed = asRecord(asRecord(preview?.safety).schedulingGate).allowed === true;
      if (!allowed) {
        setMessage('This approved content is saved, but scheduling needs workspace authorization or account setup before it can continue.');
        return;
      }
      const result = await postizApi.packageSandboxSchedule({ publishingPackageId: selectedPackage.id, scheduledAt: localScheduleToIso(scheduledAt) }, token) as RecordMap;
      setScheduleResult(result);
      setMessage('Schedule confirmed by the connected scheduling service.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The schedule could not be confirmed.');
    } finally {
      setActionLoading('');
    }
  }

  async function assignChannelToEvent(channel: RecordMap) {
    if (!token || !selectedEventId) return;
    const channelId = text(channel.id, '');
    const connectorId = text(activeConnector?.id, '');
    if (!channelId || !connectorId) {
      setEventChannelMessage('Connect a scheduling account before assigning it to an event.');
      return;
    }
    setAssigningChannel(channelId);
    setEventChannelMessage('');
    try {
      await postizChannelApi.selectEventChannel(selectedEventId, {
        postizConnectorId: connectorId,
        postizIntegrationChannelId: channelId,
        platform: text(channel.type || channel.providerIdentifier, 'social'),
        channelDisplayName: text(channel.name || channel.profile, 'Social account'),
      }, token);
      setEventChannelMessage('Social account assigned to the selected event.');
      await loadEventChannelState(selectedEventId);
    } catch (reason) {
      setEventChannelMessage(reason instanceof Error ? reason.message : 'The social account could not be assigned.');
    } finally {
      setAssigningChannel('');
    }
  }

  async function clearEventChannel() {
    if (!token || !selectedEventId) return;
    setAssigningChannel('clear');
    setEventChannelMessage('');
    try {
      await postizChannelApi.deselectEventChannel(selectedEventId, { reason: 'Changed from Tanaghum Scheduling' }, token);
      setEventChannelMessage('Event social account cleared.');
      await loadEventChannelState(selectedEventId);
    } catch (reason) {
      setEventChannelMessage(reason instanceof Error ? reason.message : 'The event social account could not be cleared.');
    } finally {
      setAssigningChannel('');
    }
  }

  if (loading) return <OpsPage><OpsPageHeader eyebrow="Publishing Workspace" title="Schedule Approved Content" subtitle="Loading approved content and social accounts." /><OpsSkeleton rows={7} /></OpsPage>;

  return (
    <OpsPage className="scheduling-page">
      <OpsPageHeader eyebrow="Publishing Workspace" title="Schedule Approved Content" subtitle="Choose the social account and time for one approved item. Tanaghum keeps its approval record attached." actions={<><Link className="ops-button is-secondary" to="/integration-credentials"><Settings size={17} />Manage Social Accounts</Link><button className="ops-icon-button" type="button" onClick={() => void load()} aria-label="Refresh scheduling"><RefreshCw size={18} /></button></>} />
      <SchedulingJourney />
      {error ? <OpsNotice tone="danger">{error}</OpsNotice> : null}
      {message ? <OpsNotice tone={message.includes('confirmed') || message.includes('ready') ? 'positive' : 'warning'}>{message}</OpsNotice> : null}

      {packages.length ? <div className={`scheduling-workspace${mobileDetail ? ' show-detail' : ''}`}>
        <section className="scheduling-queue" aria-label="Approved content queue">
          <header><div><h2>Approved Content</h2><p>Ready for a publish time.</p></div><OpsStatus tone="positive">{packages.length} Ready</OpsStatus></header>
          <label className="scheduling-search"><Search size={17} /><input aria-label="Search approved content" placeholder="Search approved content" /></label>
          <div className="scheduling-queue-items">{packages.map(pkg => {
            const campaign = campaigns.find(item => text(item.id, '') === text(pkg.campaignId, '')) || null;
            const active = text(pkg.id, '') === text(selectedPackage?.id, '');
            return <button key={text(pkg.id)} className={active ? 'is-active' : ''} type="button" onClick={() => { setSelectedPackageId(text(pkg.id, '')); setSchedulePreview(null); setScheduleResult(null); setMessage(''); setMobileDetail(true); }}><span><strong>{safeCampaignName(campaign)}</strong><ChevronRight size={17} /></span><small>{titleCase(text(pkg.status, 'approved'))}</small><span><span>Approved content</span><OpsStatus tone="positive">Ready To Schedule</OpsStatus></span></button>;
          })}</div>
        </section>

        <section className="scheduling-detail" aria-label="Selected scheduling task">
          <button className="scheduling-mobile-back" type="button" onClick={() => setMobileDetail(false)}><ArrowLeft size={17} />Back To Approved Content</button>
          <header><div><span className="ops-eyebrow">Approved Content</span><h2>{selectedCampaignTitle}</h2><p>{selectedChannel ? `Ready for ${selectedChannelName}` : 'Choose a social account to continue.'}</p></div><OpsStatus tone="positive">Approved</OpsStatus></header>
          {scheduleSucceeded ? <div className="scheduling-success"><CheckCircle2 size={20} /><div><strong>Schedule Recorded</strong><span>{new Date(localScheduleToIso(scheduledAt)).toLocaleString()}</span></div><Link to="/growth">View Results When Available<ChevronRight size={16} /></Link></div> : null}
          <div className="scheduling-task-layout">
            <div className="scheduling-form">
              <label><span>Social Account</span><select value={selectedChannelId} onChange={event => { setSelectedChannelId(event.target.value); setSchedulePreview(null); setScheduleResult(null); }} disabled={!channels.length}>{channels.length ? channels.map(channel => <option key={text(channel.id)} value={text(channel.id, '')}>{text(channel.name || channel.profile, 'Connected social account')}</option>) : <option value="">No social account connected</option>}</select></label>
              <label><span>Publish Date And Time</span><input type="datetime-local" value={scheduledAt} onChange={event => { setScheduledAt(event.target.value); setSchedulePreview(null); setScheduleResult(null); }} /></label>
              <label><span>Timezone</span><select defaultValue="workspace"><option value="workspace">Workspace Timezone</option><option value="amman">Amman</option><option value="dubai">Dubai</option></select></label>
              <div className="scheduling-checks"><div><CheckCircle2 size={18} /><span><strong>Content Approved</strong><small>Human decision recorded</small></span></div><div className={channels.length ? '' : 'is-missing'}>{channels.length ? <CheckCircle2 size={18} /> : <Clock3 size={18} />}<span><strong>Social Account</strong><small>{channels.length ? selectedChannelName : 'Connect an account in Integrations'}</small></span></div><div className={schedulePreview && schedulingAllowed ? '' : 'is-waiting'}>{schedulePreview && schedulingAllowed ? <CheckCircle2 size={18} /> : <Clock3 size={18} />}<span><strong>Publishing Controls</strong><small>{schedulePreview ? schedulingAllowed ? 'Ready' : 'Authorization needed' : 'Checked before confirmation'}</small></span></div></div>
            </div>
            <aside className="scheduling-preview"><div><span className="scheduling-avatar">T</span><span><strong>{selectedCampaignTitle}</strong><small>Approved content preview</small></span><MoreHorizontal size={18} /></div><div className="scheduling-preview-media"><Sparkles size={24} /><strong>{selectedCampaignTitle}</strong></div><p>{text(schedulePreview?.contentPreview, 'Tanaghum will show the approved content here after the schedule passes readiness checks.')}</p><span>Preview only. Final platform rendering may vary.</span></aside>
          </div>
          <footer><Link className="ops-button is-secondary" to="/approvals"><ArrowLeft size={17} />Back To Review</Link><button className="ops-button is-secondary" type="button" onClick={() => void checkReadiness()} disabled={actionLoading === 'readiness'}><Clock3 size={17} />{actionLoading === 'readiness' ? 'Checking...' : 'Check Readiness'}</button><button className="ops-button is-primary" type="button" onClick={() => void confirmSchedule()} disabled={!selectedChannel || actionLoading === 'confirm'}><CalendarDays size={17} />{actionLoading === 'confirm' ? 'Confirming...' : 'Confirm Schedule'}</button></footer>
        </section>
      </div> : <section className="scheduling-empty"><OpsEmpty title="No Approved Content Yet" message="Approve a content draft first. Tanaghum will then prepare it for scheduling." action={<Link className="ops-button is-primary" to="/approvals">Open Review</Link>} /></section>}

      <div className="scheduling-stitchi"><Sparkles size={18} /><div><strong>Not Sure When To Publish?</strong><span>Stitchi can suggest a time using the campaign window and audience context. You confirm before anything is scheduled.</span></div><Link className="ops-button is-secondary" to="/stitchi?mode=prepare&prompt=Suggest%20a%20publishing%20time%20for%20the%20selected%20approved%20content">Suggest A Time</Link></div>

      <details className="scheduling-details">
        <summary><span><Settings size={18} /><span><strong>Setup And Activity Details</strong><small>Social account assignment, readiness, and workflow history.</small></span></span><ChevronDown size={18} /></summary>
        <div className="scheduling-details-body">
          <section><header><div><h3>Event Social Account</h3><p>Optionally associate one connected social account with an event.</p></div><OpsStatus tone={eventSelections.length ? 'positive' : 'warning'}>{eventSelections.length ? 'Assigned' : 'Not Assigned'}</OpsStatus></header><label><span>Event</span><select value={selectedEventId} onChange={event => setSelectedEventId(event.target.value)}>{events.length ? events.map(item => <option key={text(item.id)} value={text(item.id, '')}>{safeEventName(item)}</option>) : <option value="">No events available</option>}</select></label><div className="scheduling-account-list">{channels.length ? channels.map(channel => { const channelId = text(channel.id, ''); const assigned = selectedEventChannels.has(channelId); return <div key={channelId}><span><strong>{text(channel.name || channel.profile, 'Social account')}</strong><small>{titleCase(text(channel.type || channel.providerIdentifier, 'social'))}</small></span><button className="ops-button is-secondary" type="button" disabled={!selectedEvent || !activeConnector || assigned || assigningChannel === channelId} onClick={() => void assignChannelToEvent(channel)}>{assigned ? 'Assigned' : assigningChannel === channelId ? 'Assigning...' : 'Assign To Event'}</button></div>; }) : <p>No connected social accounts are available.</p>}</div>{eventSelections.length ? <button className="ops-button is-secondary" type="button" onClick={() => void clearEventChannel()} disabled={assigningChannel === 'clear'}>{assigningChannel === 'clear' ? 'Clearing...' : 'Clear Event Account'}</button> : null}{eventChannelMessage ? <p className="scheduling-detail-message">{eventChannelMessage}</p> : null}</section>

          <section><header><div><h3>Readiness</h3><p>Status of the customer-owned scheduling connection.</p></div><OpsStatus tone={channels.length ? 'positive' : 'warning'}>{channels.length ? 'Account Visible' : 'Setup Needed'}</OpsStatus></header><dl className="scheduling-readiness-grid"><div><dt>Connection</dt><dd>{titleCase(text(schedulingStatus?.status, 'setup needed'))}</dd></div><div><dt>Credential</dt><dd>{titleCase(text(health.credentialStatus, 'missing'))}</dd></div><div><dt>Social Accounts</dt><dd>{channels.length}</dd></div><div><dt>Selected Account</dt><dd>{titleCase(text(health.integrationIdStatus, 'not selected'))}</dd></div><div><dt>Event Readiness</dt><dd>{titleCase(text(eventReadiness.state, 'not checked'))}</dd></div><div><dt>Activity Coverage</dt><dd>{evidenceCoverage}%</dd></div></dl>{schedulingReasons.length ? <p className="scheduling-detail-message">{schedulingReasons.join('; ')}</p> : null}</section>

          <section className="scheduling-activity"><header><div><h3>Activity History</h3><p>Recent governed workflow actions.</p></div><OpsStatus tone={evidenceActions.length ? 'positive' : 'neutral'}>{evidenceActions.length} Records</OpsStatus></header>{evidenceActions.length ? <div>{evidenceActions.map((action, index) => <article key={`${text(action.action, 'activity')}-${index}`}><span><strong>{titleCase(text(action.action, 'workflow action'))}</strong><small>{text(action.reason, 'Recorded')}</small></span><OpsStatus tone={text(action.result, '').includes('success') ? 'positive' : 'warning'}>{titleCase(text(action.result, 'recorded'))}</OpsStatus></article>)}</div> : <p>No workflow activity has been recorded for this workspace yet.</p>}</section>
        </div>
      </details>
    </OpsPage>
  );
}
