import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { commercialWorkflowApi, eventsApi, postizApi, postizChannelApi, publishingPackageApi } from '../api';
import { useAuth } from '../contexts/useAuth';
import {
  DetailGrid,
  EmptyProductState,
  Field,
  Notice,
  PrimaryAction,
  ProductCard,
  ProductPage,
  ProductStatus,
  ProductTable,
  ReadableQueue,
  SecondaryAction,
  WorkflowRail,
} from '../components/ProductUI';

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

function toneForState(value: string): 'default' | 'good' | 'warn' | 'danger' | 'info' | 'muted' {
  const normalized = value.toLowerCase();
  if (normalized.includes('ready') || normalized.includes('connected') || normalized.includes('complete') || normalized.includes('saved')) return 'good';
  if (normalized.includes('blocked') || normalized.includes('missing') || normalized.includes('requires') || normalized.includes('not')) return 'warn';
  if (normalized.includes('failed') || normalized.includes('error')) return 'danger';
  if (normalized.includes('waiting')) return 'muted';
  return 'info';
}

function titleCase(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
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
  const [packageData, statusData, channelData, evidenceData, eventData, connectorData] = await Promise.all([
    publishingPackageApi.list(token),
    postizApi.status(token),
    postizApi.channels(token).catch((err) => ({
      status: 'requires_channel',
      channels: [],
      _label: err instanceof Error ? err.message : 'Postiz channel status unavailable',
    })),
    commercialWorkflowApi.evidence(token).catch(() => null),
    eventsApi.list(token).catch(() => []),
    postizApi.connectors(token).catch(() => []),
  ]);

  return {
    packages: asList(packageData),
    postizStatus: asRecord(statusData),
    postizChannels: asList(asRecord(channelData).channels),
    evidence: evidenceData ? asRecord(evidenceData) : null,
    events: asList(eventData),
    postizConnectors: asList(connectorData),
  };
}

export default function PublishingPrep() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [packages, setPackages] = useState<RecordMap[]>([]);
  const [postizStatus, setPostizStatus] = useState<RecordMap | null>(null);
  const [postizChannels, setPostizChannels] = useState<RecordMap[]>([]);
  const [postizConnectors, setPostizConnectors] = useState<RecordMap[]>([]);
  const [events, setEvents] = useState<RecordMap[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [eventChannelState, setEventChannelState] = useState<RecordMap | null>(null);
  const [eventChannelMessage, setEventChannelMessage] = useState('');
  const [assigningChannel, setAssigningChannel] = useState('');
  const [evidence, setEvidence] = useState<RecordMap | null>(null);
  const [scheduledAt, setScheduledAt] = useState(defaultScheduleInput);
  const [postizPayload, setPostizPayload] = useState<RecordMap | null>(null);
  const [scheduleResult, setScheduleResult] = useState<RecordMap | null>(null);
  const [schedulingMessage, setSchedulingMessage] = useState('');
  const [schedulingLoading, setSchedulingLoading] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const result = await fetchPublishingReadiness(token);
      setPackages(result.packages);
      setPostizStatus(result.postizStatus);
      setPostizChannels(result.postizChannels);
      setPostizConnectors(result.postizConnectors);
      setEvents(result.events);
      if (!selectedEventId && result.events[0]?.id) setSelectedEventId(text(result.events[0].id, ''));
      setEvidence(result.evidence);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publishing readiness failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void fetchPublishingReadiness(token)
      .then((result) => {
        if (cancelled) return;
        setPackages(result.packages);
        setPostizStatus(result.postizStatus);
        setPostizChannels(result.postizChannels);
        setPostizConnectors(result.postizConnectors);
        setEvents(result.events);
        if (!selectedEventId && result.events[0]?.id) setSelectedEventId(text(result.events[0].id, ''));
        setEvidence(result.evidence);
        setError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Publishing readiness failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, selectedEventId]);

  async function loadEventChannelState(eventId: string) {
    if (!token || !eventId) {
      setEventChannelState(null);
      return;
    }
    try {
      const response = await postizChannelApi.eventChannels(eventId, token);
      setEventChannelState(response as RecordMap);
      setEventChannelMessage('');
    } catch (err) {
      setEventChannelState(null);
      setEventChannelMessage(err instanceof Error ? err.message : 'Event channel readiness failed to load');
    }
  }

  useEffect(() => {
    if (!selectedEventId) return;
    async function run() {
      await loadEventChannelState(selectedEventId);
    }
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId, token]);

  const selectedPackage = packages[0] || null;
  const selectedEvent = events.find(event => text(event.id, '') === selectedEventId) || null;
  const activePostizConnector = postizConnectors.find(connector =>
    text(connector.connectorStatus, '').toLowerCase() === 'active'
      && connector.supportsSchedule === true,
  ) || postizConnectors.find(connector => connector.supportsSchedule === true) || null;
  const eventChannelReadiness = asRecord(eventChannelState?.readiness);
  const eventSelections = asList(eventChannelState?.selections);
  const eventSelectedIntegrationIds = new Set(eventSelections.map(item => text(item.postizIntegrationChannelId, '')).filter(Boolean));
  const eventReadinessState = text(eventChannelReadiness.state, 'not checked');
  const eventReadinessChecks = asList(eventChannelReadiness.checks);
  const health = asRecord(postizStatus?.health);
  const credentialStatus = text(health.credentialStatus, 'missing');
  const integrationIdStatus = text(health.integrationIdStatus, 'missing');
  const postizReady = text(postizStatus?.status, 'Requires Credentials');
  const channelCount = postizChannels.length;
  const evidenceCoverage = numberValue(asRecord(evidence?.coverage).score);
  const evidenceActions = asList(evidence?.actions).slice(0, 6);
  const evidenceStages = asList(evidence?.stages);
  const missingActions = stringList(asRecord(evidence?.coverage).missingActions);
  const payloadSummary = asRecord(postizPayload?.payloadSummary);
  const payloadTarget = asRecord(postizPayload?.target);
  const payloadSafety = asRecord(postizPayload?.safety);
  const schedulingGate = asRecord(payloadSafety.schedulingGate);
  const schedulingAllowed = schedulingGate.allowed === true;
  const schedulingReasons = stringList(schedulingGate.reasons);
  const scheduleStatus = text(scheduleResult?.status, '');

  async function preparePackagePayload() {
    if (!token || !selectedPackage) return;
    setSchedulingLoading('payload');
    setSchedulingMessage('');
    setScheduleResult(null);
    try {
      const result = await postizApi.packagePayload({
        publishingPackageId: selectedPackage.id,
        scheduledAt: localScheduleToIso(scheduledAt),
      }, token) as RecordMap;
      setPostizPayload(result);
      setSchedulingMessage(text(result._label, 'Postiz package payload prepared.'));
    } catch (err) {
      setSchedulingMessage(err instanceof Error ? err.message : 'Failed to prepare Postiz package payload');
    } finally {
      setSchedulingLoading('');
    }
  }

  async function requestSandboxSchedule() {
    if (!token || !selectedPackage || !schedulingAllowed) return;
    setSchedulingLoading('schedule');
    setSchedulingMessage('');
    try {
      const result = await postizApi.packageSandboxSchedule({
        publishingPackageId: selectedPackage.id,
        scheduledAt: localScheduleToIso(scheduledAt),
      }, token) as RecordMap;
      setScheduleResult(result);
      setSchedulingMessage(text(result._label, 'Postiz sandbox scheduling request completed.'));
    } catch (err) {
      setSchedulingMessage(err instanceof Error ? err.message : 'Postiz sandbox scheduling failed');
    } finally {
      setSchedulingLoading('');
    }
  }

  async function assignChannelToEvent(channel: RecordMap) {
    if (!token || !selectedEventId) return;
    const channelId = text(channel.id, '');
    const connectorId = text(activePostizConnector?.id, '');
    if (!channelId || !connectorId) {
      setEventChannelMessage('Select a connected Postiz channel and confirm an active scheduling connector exists.');
      return;
    }
    setAssigningChannel(channelId);
    setEventChannelMessage('');
    try {
      await postizChannelApi.selectEventChannel(selectedEventId, {
        postizConnectorId: connectorId,
        postizIntegrationChannelId: channelId,
        platform: text(channel.type || channel.providerIdentifier, 'postiz'),
        channelDisplayName: text(channel.name || channel.profile, 'Postiz channel'),
      }, token);
      setEventChannelMessage('Postiz channel assigned to this event. Scheduling still requires approval and execution gates.');
      await loadEventChannelState(selectedEventId);
    } catch (err) {
      setEventChannelMessage(err instanceof Error ? err.message : 'Failed to assign channel to event');
    } finally {
      setAssigningChannel('');
    }
  }

  async function clearEventChannel() {
    if (!token || !selectedEventId) return;
    setAssigningChannel('deselect');
    setEventChannelMessage('');
    try {
      await postizChannelApi.deselectEventChannel(selectedEventId, { reason: 'Changed from Tanaghum Scheduling page' }, token);
      setEventChannelMessage('Event channel assignment cleared.');
      await loadEventChannelState(selectedEventId);
    } catch (err) {
      setEventChannelMessage(err instanceof Error ? err.message : 'Failed to clear event channel assignment');
    } finally {
      setAssigningChannel('');
    }
  }

  const railSteps = useMemo(() => {
    if (!evidenceStages.length) {
      return [
        { label: 'Package', state: selectedPackage ? 'done' as const : 'active' as const },
        { label: 'Postiz', state: channelCount ? 'done' as const : 'blocked' as const },
        { label: 'Scheduling Review', state: 'waiting' as const },
        { label: 'Evidence', state: 'waiting' as const },
      ];
    }
    return evidenceStages.map(stage => ({
      label: text(stage.label, 'Stage'),
      state: text(stage.state, 'waiting') === 'complete'
        ? 'done' as const
        : text(stage.state, 'waiting') === 'active'
          ? 'active' as const
          : text(stage.state, 'waiting') === 'blocked'
            ? 'blocked' as const
            : 'waiting' as const,
    }));
  }, [channelCount, evidenceStages, selectedPackage]);

  return (
    <ProductPage
      eyebrow="Content Studio"
      title="Scheduling & Review"
      subtitle="Check your approved content and scheduling setup before publishing. All actions are tracked and can be reviewed anytime."
      action={<SecondaryAction onClick={() => void load()} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</SecondaryAction>}
    >
      {error && <Notice tone="danger">{error}</Notice>}

      <WorkflowRail steps={railSteps} />

      <div className="grid gap-4 md:grid-cols-4">
        <ProductCard>
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Packages</div>
          <div className="mt-3 text-3xl font-semibold text-neutral-950">{packages.length}</div>
          <p className="mt-2 text-sm text-neutral-500">Prepared from approved content.</p>
        </ProductCard>
        <ProductCard>
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Scheduling Service</div>
          <div className="mt-3 text-xl font-semibold text-neutral-950">{postizReady}</div>
          <p className="mt-2 text-sm text-neutral-500">Connection status.</p>
        </ProductCard>
        <ProductCard>
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Channels</div>
          <div className="mt-3 text-3xl font-semibold text-neutral-950">{channelCount}</div>
          <p className="mt-2 text-sm text-neutral-500">Connected social accounts.</p>
        </ProductCard>
        <ProductCard>
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Evidence</div>
          <div className="mt-3 text-3xl font-semibold text-neutral-950">{evidenceCoverage}%</div>
          <p className="mt-2 text-sm text-neutral-500">Activity records available.</p>
        </ProductCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <ProductCard
          title="Your Approved Content"
          subtitle="Content that has been reviewed and is ready for the next step."
          action={<PrimaryAction onClick={() => navigate('/campaigns')}>Prepare Content</PrimaryAction>}
        >
          {packages.length ? (
            <ProductTable
              columns={['Package', 'Campaign', 'Status', 'Created']}
              rows={packages.map(pkg => [
                <span className="font-medium text-neutral-950">{text(pkg.id).slice(0, 8)}</span>,
                text(pkg.campaignId, 'Campaign linked'),
                <ProductStatus tone={toneForState(text(pkg.status, 'ready'))}>{titleCase(text(pkg.status, 'ready'))}</ProductStatus>,
                text(pkg.createdAt, 'Recorded'),
              ])}
            />
          ) : (
            <EmptyProductState
              title="No publishing package yet"
              message="Approve a generated draft, then prepare a publishing package from the Campaigns workspace."
              action={<PrimaryAction onClick={() => navigate('/campaigns')}>Open Campaigns</PrimaryAction>}
            />
          )}
        </ProductCard>

        <ProductCard title="What's Needed Before Scheduling" subtitle="These items must be in place before content can be scheduled.">
          <ReadableQueue
            items={[
              {
                title: 'Approved package',
                meta: selectedPackage ? 'A package exists and is ready for scheduling review.' : 'Create a package after human approval.',
                status: selectedPackage ? 'Ready' : 'Waiting',
                tone: selectedPackage ? 'good' : 'muted',
              },
              {
                title: 'Scheduling service',
                meta: text(health.url, 'Scheduling service URL is not configured.'),
                status: text(postizStatus?.status, 'Requires Credentials'),
                tone: toneForState(text(postizStatus?.status, 'Requires Credentials')),
              },
              {
                title: 'Postiz API key',
                meta: credentialStatus === 'configured' ? 'Tenant credential is saved securely.' : 'Save the tenant Postiz API key in Credentials.',
                status: titleCase(credentialStatus),
                tone: toneForState(credentialStatus),
              },
              {
                title: 'Social channel',
                meta: channelCount ? `${channelCount} social channel(s) are visible.` : 'Complete channel OAuth inside Postiz, then refresh Tanaghum.',
                status: channelCount ? 'Visible' : 'Requires Channel',
                tone: channelCount ? 'good' : 'warn',
              },
              {
                title: 'Selected scheduling channel',
                meta: integrationIdStatus === 'configured' ? 'A Postiz channel ID is selected.' : 'Select a visible channel for scheduling packages.',
                status: titleCase(integrationIdStatus),
                tone: toneForState(integrationIdStatus),
              },
              {
                title: 'External execution',
                meta: 'Publishing controls are active. An admin must enable scheduling for this workspace.',
                status: 'Blocked',
                tone: 'warn',
              },
            ]}
          />
          <div className="mt-5">
            <SecondaryAction onClick={() => navigate('/integration-credentials')}>Open Credentials</SecondaryAction>
          </div>
        </ProductCard>
      </div>

      <ProductCard
        title="Event Scheduling Channel"
        subtitle="Assign one connected Postiz channel to the event. This does not schedule or publish anything; it only makes the event ready for governed scheduling."
        action={<ProductStatus tone={toneForState(eventReadinessState)}>{titleCase(eventReadinessState)}</ProductStatus>}
      >
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-4">
            <Field label="Event">
              <select
                value={selectedEventId}
                onChange={(event) => setSelectedEventId(event.target.value)}
                className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950"
              >
                {events.length ? events.map(event => (
                  <option key={text(event.id)} value={text(event.id, '')}>{text(event.name, 'Untitled event')}</option>
                )) : (
                  <option value="">No events available</option>
                )}
              </select>
            </Field>
            <DetailGrid items={[
              { label: 'Selected Event', value: text(selectedEvent?.name, 'Choose an event') },
              { label: 'Postiz Connector', value: activePostizConnector ? text(activePostizConnector.connectorName, 'Active scheduling connector') : 'No active scheduling connector' },
              { label: 'Connected Channels', value: String(postizChannels.length) },
              { label: 'Assigned Channels', value: String(eventSelections.length) },
            ]} />
            {eventChannelMessage && (
              <Notice tone={eventChannelMessage.toLowerCase().includes('failed') || eventChannelMessage.toLowerCase().includes('select') ? 'warn' : 'good'}>
                {eventChannelMessage}
              </Notice>
            )}
            {eventSelections.length > 0 && (
              <SecondaryAction onClick={clearEventChannel} disabled={assigningChannel === 'deselect'}>
                {assigningChannel === 'deselect' ? 'Clearing...' : 'Clear Event Channel'}
              </SecondaryAction>
            )}
          </div>

          <div className="space-y-5">
            {postizChannels.length ? (
              <ProductTable
                columns={['Channel', 'Platform', 'State', 'Action']}
                rows={postizChannels.map(channel => {
                  const channelId = text(channel.id, '');
                  const selected = eventSelectedIntegrationIds.has(channelId);
                  const disabled = Boolean(channel.disabled);
                  const refreshNeeded = Boolean(channel.refreshNeeded);
                  return [
                    <div>
                      <div className="font-medium text-neutral-950">{text(channel.name, text(channel.profile, 'Unnamed channel'))}</div>
                      <div className="mt-1 max-w-xs truncate text-xs text-neutral-500">{channelId}</div>
                    </div>,
                    titleCase(text(channel.type || channel.providerIdentifier, 'postiz')),
                    <ProductStatus tone={selected ? 'good' : disabled || refreshNeeded ? 'warn' : 'info'}>
                      {selected ? 'Assigned To Event' : disabled ? 'Disabled' : refreshNeeded ? 'Reconnect Needed' : 'Available'}
                    </ProductStatus>,
                    <SecondaryAction
                      onClick={() => void assignChannelToEvent(channel)}
                      disabled={!selectedEventId || !activePostizConnector || disabled || selected || assigningChannel === channelId}
                    >
                      {selected ? 'Assigned' : assigningChannel === channelId ? 'Assigning...' : 'Assign To Event'}
                    </SecondaryAction>,
                  ];
                })}
              />
            ) : (
              <EmptyProductState
                title="No Postiz channels visible"
                message="Save the Postiz API key and connect a social account inside Postiz, then refresh this page."
                action={<SecondaryAction onClick={() => navigate('/integration-credentials')}>Open Connector Setup</SecondaryAction>}
              />
            )}

            {eventReadinessChecks.length > 0 && (
              <ProductTable
                columns={['Check', 'Status', 'Detail']}
                rows={eventReadinessChecks.map(check => [
                  text(check.label, 'Readiness check'),
                  <ProductStatus tone={toneForState(text(check.status, 'waiting'))}>{titleCase(text(check.status, 'waiting'))}</ProductStatus>,
                  text(check.detail, 'Recorded by backend readiness policy'),
                ])}
              />
            )}
          </div>
        </div>
      </ProductCard>

      <ProductCard title="Content Package Details" subtitle="Plain-language status for your most recent prepared content.">
        {selectedPackage ? (
          <DetailGrid
            items={[
              { label: 'Package Status', value: titleCase(text(selectedPackage.status, 'ready')) },
              { label: 'Campaign', value: text(selectedPackage.campaignId, 'Campaign linked') },
              { label: 'Scheduling Status', value: 'Scheduling is controlled. Channel selection and admin authorization are needed.' },
              { label: 'Next Action', value: channelCount ? 'Select a channel and request scheduling authorization.' : 'Connect a social channel through your scheduling service.' },
            ]}
          />
        ) : (
          <EmptyProductState message="No package is available yet. The normal path is draft generation, scoring, human approval, then package preparation." />
        )}
      </ProductCard>

      <ProductCard
        title="Scheduling Payload"
        subtitle="Prepare the exact package Tanaghum would send to the scheduling service. No external scheduling happens during payload preview."
        action={<ProductStatus tone={schedulingAllowed ? 'good' : 'warn'}>{schedulingAllowed ? 'Sandbox Scheduling Enabled' : 'Scheduling Blocked'}</ProductStatus>}
      >
        {selectedPackage ? (
          <div className="space-y-5">
            {schedulingMessage && (
              <Notice tone={schedulingMessage.toLowerCase().includes('failed') || schedulingMessage.toLowerCase().includes('blocked') ? 'warn' : 'good'}>
                {schedulingMessage}
              </Notice>
            )}
            <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="space-y-4">
                <Field label="Target Time" helper="This becomes the proposed Postiz schedule time. Change it before preparing the payload.">
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(event) => {
                      setScheduledAt(event.target.value);
                      setPostizPayload(null);
                      setScheduleResult(null);
                    }}
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <PrimaryAction onClick={preparePackagePayload} disabled={schedulingLoading === 'payload'}>
                    {schedulingLoading === 'payload' ? 'Preparing...' : 'Prepare Payload'}
                  </PrimaryAction>
                  <SecondaryAction onClick={requestSandboxSchedule} disabled={!postizPayload || !schedulingAllowed || schedulingLoading === 'schedule'}>
                    {schedulingLoading === 'schedule' ? 'Requesting...' : 'Request Sandbox Schedule'}
                  </SecondaryAction>
                </div>
                {!schedulingAllowed && postizPayload && (
                  <Notice tone="warn">
                    Scheduling is blocked until the required channel and deployment controls are configured. The payload preview is still valid.
                  </Notice>
                )}
              </div>

              {postizPayload ? (
                <div className="space-y-4">
                  <DetailGrid
                    items={[
                      { label: 'Platform', value: titleCase(text(payloadSummary.platform, text(payloadTarget.platform))) },
                      { label: 'Post Type', value: titleCase(text(payloadSummary.postType, 'schedule')) },
                      { label: 'Scheduled For', value: text(payloadTarget.proposedPublishAt) },
                      { label: 'Channel Selected', value: payloadSummary.hasIntegrationId ? 'Yes' : 'No' },
                      { label: 'Content Length', value: `${numberValue(payloadSummary.contentCharacters)} characters` },
                      { label: 'Endpoint', value: text(postizPayload.endpoint, 'Scheduling endpoint not configured') },
                    ]}
                  />
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Approved Content Preview</div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-800">{text(postizPayload.contentPreview, 'No content preview available')}</p>
                  </div>
                  <ReadableQueue
                    items={[
                      {
                        title: 'Payload generated',
                        meta: 'Derived from the approved publishing package stored in Tanaghum.',
                        status: 'Ready',
                        tone: 'good',
                      },
                      {
                        title: 'Postiz channel',
                        meta: payloadSummary.hasIntegrationId ? 'A selected scheduling channel is available.' : 'Select a connected Postiz channel before scheduling.',
                        status: payloadSummary.hasIntegrationId ? 'Selected' : 'Missing',
                        tone: payloadSummary.hasIntegrationId ? 'good' : 'warn',
                      },
                      {
                        title: 'Sandbox execution gate',
                        meta: schedulingReasons.join('; ') || 'Sandbox scheduling flags are enabled for this workspace.',
                        status: schedulingAllowed ? 'Allowed' : 'Blocked',
                        tone: schedulingAllowed ? 'good' : 'warn',
                      },
                    ]}
                  />
                  {scheduleStatus && (
                    <Notice tone={scheduleStatus === 'sandbox_scheduled' ? 'good' : 'warn'}>
                      Scheduling service response: {titleCase(scheduleStatus)}.
                    </Notice>
                  )}
                </div>
              ) : (
                <EmptyProductState
                  title="Prepare the scheduling payload"
                  message="Choose the target time, then generate the package that would be sent to Postiz after all controls are satisfied."
                />
              )}
            </div>
          </div>
        ) : (
          <EmptyProductState message="Create an approved publishing package before preparing a scheduling payload." />
        )}
      </ProductCard>

        <ProductCard title="Activity History" subtitle="Your workflow records are stored permanently. No screenshots or hidden logs needed.">
        <div className="mb-5">
          <ReadableQueue
            items={[
              {
                title: 'Evidence coverage',
                meta: evidenceCoverage ? 'Required workflow events are being persisted.' : 'Evidence appears after workflow actions are performed.',
                status: `${evidenceCoverage}%`,
                tone: evidenceCoverage >= 80 ? 'good' : evidenceCoverage > 0 ? 'warn' : 'muted',
              },
              {
                  title: 'Missing activities',
                  meta: missingActions.join(', ') || 'All expected activities are recorded.',
                status: missingActions.length ? 'Review' : 'Clear',
                tone: missingActions.length ? 'warn' : 'good',
              },
            ]}
          />
        </div>
        {evidenceActions.length ? (
          <ProductTable
            columns={['Action', 'Result', 'Source', 'Reason']}
            rows={evidenceActions.map(action => [
              titleCase(text(action.action, 'workflow action')),
              <ProductStatus tone={toneForState(text(action.result, 'success'))}>{titleCase(text(action.result, 'success'))}</ProductStatus>,
              text(action.sourceModule, 'STITCH'),
              text(action.reason, 'Recorded'),
            ])}
          />
        ) : (
          <EmptyProductState message="No persistent workflow audit records are available for the selected campaign yet." />
        )}
      </ProductCard>

      <Notice tone="warn">
        Scheduling is controlled. An admin must enable scheduling for this workspace and configure the required channels before content can be published.
      </Notice>
    </ProductPage>
  );
}
