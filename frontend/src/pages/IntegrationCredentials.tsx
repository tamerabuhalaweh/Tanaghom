import { useEffect, useMemo, useState } from 'react';
import { connectorImportsApi, connectorReadinessApi, eventsApi, ghlApi, integrationCredentialsApi, integrationStatusApi, postizApi, socialOAuthApi } from '../api';
import { useAuth } from '../contexts/useAuth';
import {
  AieroLightPanel,
  AieroMetricCard,
  AieroNumberedStep,
  AieroPage,
  AieroPanel,
  AieroStatusPill,
} from '../components/AieroUX';
import {
  DetailGrid,
  EmptyProductState,
  Field,
  MetricCard,
  Notice,
  PrimaryAction,
  ProductCard,
  ProductStatus,
  ProductTable,
  SecondaryAction,
} from '../components/ProductUI';

type RecordMap = Record<string, unknown>;

function text(value: unknown, fallback = 'Not configured'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function display(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function statusTone(value: string): 'good' | 'warn' | 'danger' | 'info' | 'default' {
  const lower = value.toLowerCase();
  if (lower.includes('configured') || lower.includes('ready') || lower.includes('connected') || lower.includes('passed')) return 'good';
  if (lower.includes('missing') || lower.includes('requires') || lower.includes('warning') || lower.includes('not_checked')) return 'warn';
  if (lower.includes('blocked') || lower.includes('disabled')) return 'danger';
  return 'info';
}

function noticeTone(value: string): 'good' | 'warn' | 'danger' | 'info' {
  const tone = statusTone(value);
  return tone === 'default' ? 'info' : tone;
}

function parseRequiredFields(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function validationProviderFor(row: RecordMap): string {
  const provider = text(row.provider, '').toLowerCase();
  const connectionKey = text(row.connectionKey, '').toLowerCase();
  if (provider === 'meta_analytics') return 'meta_analytics';
  if (provider === 'youtube_analytics' || provider === 'youtube') return 'youtube_analytics';
  if (provider === 'formaloo') return 'formaloo';
  if (provider === 'social_oauth' && connectionKey === 'meta') return 'meta_analytics';
  return '';
}

type SetupBlueprint = {
  id: string;
  label: string;
  category: string;
  businessUse: string;
  providerKeys: string[];
  importConnectorId?: string;
  oauthPlatforms?: string[];
  needsPostizChannel?: boolean;
  route: string;
  routeLabel: string;
  setupSteps: string[];
};

const SETUP_BLUEPRINTS: SetupBlueprint[] = [
  {
    id: 'gohighlevel',
    label: 'GoHighLevel CRM',
    category: 'CRM & Messaging',
    businessUse: 'Use GHL as the lead source of truth for contacts, tags, stages, opportunities, purchases, meetings, and GHL WhatsApp readiness.',
    providerKeys: ['gohighlevel', 'ghl'],
    importConnectorId: 'gohighlevel',
    route: '/ghl-wizard',
    routeLabel: 'Open GHL Setup',
    setupSteps: ['Save GHL API key and location ID', 'Map tags and pipeline stages to Tanaghum lead status', 'Use GHL WhatsApp only when the customer enabled it in GHL/LeadConnector'],
  },
  {
    id: 'meta_analytics',
    label: 'Meta / Instagram Ads',
    category: 'Ads & Analytics',
    businessUse: 'Import ad spend, reach, impressions, dark ads, form activity, and campaign performance into event dashboards.',
    providerKeys: ['social_oauth', 'meta', 'meta_analytics'],
    importConnectorId: 'meta_analytics',
    oauthPlatforms: ['meta'],
    route: '/events',
    routeLabel: 'Open Event Import',
    setupSteps: ['Save read-only Meta access token and ad account ID', 'Validate read access against Meta insights', 'Preview KPI rows before importing event data'],
  },
  {
    id: 'postiz',
    label: 'Postiz Scheduling',
    category: 'Scheduling',
    businessUse: 'Prepare approved content packages for scheduling after human approval.',
    providerKeys: ['postiz'],
    importConnectorId: 'postiz',
    needsPostizChannel: true,
    route: '/publishing',
    routeLabel: 'Open Scheduling',
    setupSteps: ['Save Postiz API key and base URL', 'Connect/select a Postiz channel', 'Keep live scheduling behind approval flags'],
  },
  {
    id: 'youtube_analytics',
    label: 'YouTube Analytics',
    category: 'Video Analytics',
    businessUse: 'Track video reach and engagement for event campaigns.',
    providerKeys: ['youtube_analytics', 'youtube'],
    importConnectorId: 'youtube_analytics',
    route: '/events',
    routeLabel: 'Open Event Import',
    setupSteps: ['Save YouTube Analytics OAuth token and channel ID', 'Validate read access against YouTube Analytics', 'Approve read-only KPI import'],
  },
  {
    id: 'formaloo',
    label: 'Formaloo Forms',
    category: 'Lead Capture',
    businessUse: 'Import form completions and campaign intake signals.',
    providerKeys: ['formaloo'],
    importConnectorId: 'formaloo',
    route: '/events',
    routeLabel: 'Open Event Import',
    setupSteps: ['Save Formaloo client key, client secret, and form ID', 'Confirm the customer Formaloo read contract', 'Map form fields to KPI records'],
  },
  {
    id: 'smartlabs_voice',
    label: 'SmartLabs Voice',
    category: 'Voice Agent',
    businessUse: 'Connect lead context to the customer-owned voice/chat agent.',
    providerKeys: ['smartlabs_voice', 'voice_chat'],
    importConnectorId: 'smartlabs_voice',
    route: '/smartlabs-voice',
    routeLabel: 'Open Voice Setup',
    setupSteps: ['Save SmartLabs API key', 'Test agents and voices with tenant credentials', 'Trigger real conversations only after authorization'],
  },
];

export default function IntegrationCredentials() {
  const { token } = useAuth();
  const [status, setStatus] = useState<RecordMap | null>(null);
  const [postiz, setPostiz] = useState<RecordMap | null>(null);
  const [ghl, setGhl] = useState<RecordMap | null>(null);
  const [matrix, setMatrix] = useState<RecordMap[]>([]);
  const [credentials, setCredentials] = useState<RecordMap[]>([]);
  const [socialConnections, setSocialConnections] = useState<RecordMap[]>([]);
  const [postizChannels, setPostizChannels] = useState<RecordMap[]>([]);
  const [postizChannelStatus, setPostizChannelStatus] = useState<RecordMap | null>(null);
  const [postizDiagnostics, setPostizDiagnostics] = useState<RecordMap | null>(null);
  const [postizAnalyticsResult, setPostizAnalyticsResult] = useState<RecordMap | null>(null);
  const [providerValidationResults, setProviderValidationResults] = useState<Record<string, RecordMap>>({});
  const [connectorImportSummary, setConnectorImportSummary] = useState<RecordMap | null>(null);
  const [connectorImportReadiness, setConnectorImportReadiness] = useState<RecordMap[]>([]);
  const [connectorImportJobs, setConnectorImportJobs] = useState<RecordMap[]>([]);
  const [events, setEvents] = useState<RecordMap[]>([]);
  const [postizAnalyticsEventId, setPostizAnalyticsEventId] = useState('');
  const [manualPostizIntegrationId, setManualPostizIntegrationId] = useState('');
  const [selected, setSelected] = useState<RecordMap | null>(null);
  const [hasAutoSelectedConnector, setHasAutoSelectedConnector] = useState(false);
  const [oauthPlatform, setOauthPlatform] = useState('meta');
  const [postizPlatform, setPostizPlatform] = useState('instagram');
  const [displayName, setDisplayName] = useState('');
  const [secretValues, setSecretValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [connectingPostiz, setConnectingPostiz] = useState(false);
  const [diagnosingPostiz, setDiagnosingPostiz] = useState(false);
  const [selectingPostizChannel, setSelectingPostizChannel] = useState('');
  const [testingPostizAnalytics, setTestingPostizAnalytics] = useState(false);
  const [validatingProvider, setValidatingProvider] = useState('');

  async function load() {
    if (!token) return;
    const [integration, postizStatus, ghlStatus, matrixResult, credentialResult, socialResult, postizChannelResult, postizDiagnosticsResult, importReadinessResult, importJobsResult, eventsResult] = await Promise.all([
      integrationStatusApi.get(token),
      postizApi.status(token),
      ghlApi.status(token),
      integrationCredentialsApi.matrix(token),
      integrationCredentialsApi.list(token),
      socialOAuthApi.connections(token),
      postizApi.channels(token).catch((err) => ({ status: 'requires_credentials', channels: [], _label: err instanceof Error ? err.message : 'Postiz channel status unavailable' })),
      postizApi.diagnostics({ platform: postizPlatform }, token).catch((err) => ({ status: 'not_available', diagnostics: null, _label: err instanceof Error ? err.message : 'Postiz diagnostics unavailable' })),
      connectorImportsApi.readiness(token).catch((err) => ({ connectors: [], totalConfigured: 0, totalMissing: 0, totalBlocked: 0, _label: err instanceof Error ? err.message : 'Connector import readiness unavailable' })),
      connectorImportsApi.jobs(token).catch(() => []),
      eventsApi.list(token).catch(() => []),
    ]);
    setStatus(integration as RecordMap);
    setPostiz(postizStatus as RecordMap);
    setGhl(ghlStatus as RecordMap);
    const matrixRows = Array.isArray((matrixResult as RecordMap).rows) ? (matrixResult as RecordMap).rows as RecordMap[] : [];
    setMatrix(matrixRows);
    if (!hasAutoSelectedConnector && !selected && matrixRows.length > 0) {
      const firstUsableConnector =
        matrixRows.find(row => ['gohighlevel', 'ghl'].includes(text(row.provider, '').toLowerCase()))
        || matrixRows.find(row => text(row.provider, '').toLowerCase() === 'postiz')
        || matrixRows.find(row => text(row.status, '').toLowerCase() !== 'configured')
        || matrixRows[0];

      if (firstUsableConnector) {
        chooseRequirement(firstUsableConnector);
        setHasAutoSelectedConnector(true);
      }
    }
    setCredentials(Array.isArray((credentialResult as RecordMap).credentials) ? (credentialResult as RecordMap).credentials as RecordMap[] : []);
    setSocialConnections(Array.isArray((socialResult as RecordMap).connections) ? (socialResult as RecordMap).connections as RecordMap[] : []);
    setPostizChannelStatus(postizChannelResult as RecordMap);
    const loadedSelectedPostizId = typeof (postizChannelResult as RecordMap).selectedIntegrationId === 'string'
      ? (postizChannelResult as RecordMap).selectedIntegrationId as string
      : '';
    if (!manualPostizIntegrationId && loadedSelectedPostizId) setManualPostizIntegrationId(loadedSelectedPostizId);
    setPostizChannels(Array.isArray((postizChannelResult as RecordMap).channels) ? (postizChannelResult as RecordMap).channels as RecordMap[] : []);
    setPostizDiagnostics(postizDiagnosticsResult as RecordMap);
    setConnectorImportSummary(importReadinessResult as RecordMap);
    setConnectorImportReadiness(Array.isArray((importReadinessResult as RecordMap).connectors) ? (importReadinessResult as RecordMap).connectors as RecordMap[] : []);
    setConnectorImportJobs(Array.isArray(importJobsResult) ? importJobsResult as RecordMap[] : Array.isArray((importJobsResult as RecordMap).jobs) ? (importJobsResult as RecordMap).jobs as RecordMap[] : []);
    const eventRows = Array.isArray(eventsResult) ? eventsResult as RecordMap[] : [];
    setEvents(eventRows);
    if (!postizAnalyticsEventId && eventRows.length > 0) setPostizAnalyticsEventId(text(eventRows[0].id, ''));
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function run() {
      try {
        await load();
      } catch (err) {
        if (!cancelled) setMessage(err instanceof Error ? err.message : 'Failed to load integration status');
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const aiProvider = status?.aiProvider as RecordMap | undefined;
  const configuredRows = matrix.filter(row => text(row.status).toLowerCase() === 'configured').length;
  const selectedFields = useMemo(() => parseRequiredFields(selected?.requiredFields), [selected]);
  const optionalFields = useMemo(() => parseRequiredFields(selected?.optionalFields), [selected]);
  const selectedValidationProvider = selected ? validationProviderFor(selected) : '';
  const selectedValidationResult = selectedValidationProvider ? providerValidationResults[selectedValidationProvider] : null;
  const selectedPostizIntegrationId = typeof postizChannelStatus?.selectedIntegrationId === 'string' ? postizChannelStatus.selectedIntegrationId : '';
  const postizGuidance = (postizChannelStatus?.guidance || {}) as RecordMap;
  const postizNextActions = Array.isArray(postizGuidance.nextActions)
    ? postizGuidance.nextActions.filter((item): item is string => typeof item === 'string')
    : [];
  const diagnosticPayload = (postizDiagnostics?.diagnostics || {}) as RecordMap;
  const postizDiagnosticChecks = Array.isArray(diagnosticPayload.checks)
    ? diagnosticPayload.checks.filter((item): item is RecordMap => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
  const postizDiagnosticActions = Array.isArray(diagnosticPayload.nextActions)
    ? diagnosticPayload.nextActions.filter((item): item is string => typeof item === 'string')
    : [];
  const postizAuthorization = (postizDiagnostics?.authorization || {}) as RecordMap;
  const postizAuthorizationUrl = text(postizAuthorization.authorizationUrl, '');
  const postizProviderReady = postizAuthorization.providerConfigurationReady === true;
  const configuredImportCount = Number(connectorImportSummary?.totalConfigured || 0);
  const missingImportCount = Number(connectorImportSummary?.totalMissing || 0);
  const blockedImportCount = Number(connectorImportSummary?.totalBlocked || 0);
  const selectedPostizCredential = matrix.find(row => text(row.provider, '').toLowerCase() === 'postiz');
  const postizCredentialConfigured = text(selectedPostizCredential?.status, '').toLowerCase() === 'configured'
    || text((postiz?.health as RecordMap | undefined)?.credentialStatus, '').toLowerCase() === 'configured';
  const postizAnalyticsRows = Array.isArray(postizAnalyticsResult?.kpiRows) ? postizAnalyticsResult.kpiRows as RecordMap[] : [];
  const postizAnalyticsWarnings = Array.isArray(postizAnalyticsResult?.warnings)
    ? postizAnalyticsResult.warnings.filter((item): item is string => typeof item === 'string')
    : [];
  const postizProviderStatus = (postizAnalyticsResult?.providerStatus || {}) as RecordMap;
  const postizAnalyticsReady = postizAnalyticsRows.length > 0;
  const postizChannelsFound = Number(postizProviderStatus.channelsFound ?? postizChannels.length);

  const setupRoadmap = useMemo(() => {
    return SETUP_BLUEPRINTS.map(blueprint => {
      const credentialRows = matrix.filter(row => {
        const provider = text(row.provider, '').toLowerCase();
        const connectionKey = text(row.connectionKey, '').toLowerCase();
        return blueprint.providerKeys.some(key => key === provider || key === connectionKey);
      });
      const primaryCredential = credentialRows.find(row => text(row.status).toLowerCase() === 'configured') || credentialRows[0] || null;
      const credentialConfigured = credentialRows.some(row => text(row.status).toLowerCase() === 'configured');
      const importReadiness = blueprint.importConnectorId
        ? connectorImportReadiness.find(item => text(item.connectorId, '').toLowerCase() === blueprint.importConnectorId)
        : null;
      const importJob = blueprint.importConnectorId
        ? connectorImportJobs.find(job => text(job.connectorId, '').toLowerCase() === blueprint.importConnectorId)
        : null;
      const oauthConnected = blueprint.oauthPlatforms?.some(platform =>
        socialConnections.some(connection => text(connection.platform, '').toLowerCase() === platform && text(connection.status, 'active').toLowerCase() !== 'disabled'),
      ) || false;
      const postizChannelConnected = blueprint.needsPostizChannel ? postizChannels.length > 0 : false;
      const jobState = text(importJob?.state || importReadiness?.jobState, '');
      const importCredentialState = text(importReadiness?.credentialState, '');
      const connectionReady = blueprint.needsPostizChannel
        ? postizChannelConnected
        : blueprint.oauthPlatforms?.length
          ? oauthConnected
          : credentialConfigured;
      const importReady = jobState === 'test_passed' || importCredentialState === 'test_passed' || importCredentialState === 'configured';
      const readinessScore =
        (credentialConfigured ? 1 : 0) +
        (connectionReady ? 1 : 0) +
        (blueprint.importConnectorId ? (importReady ? 1 : 0) : 1);
      const maxScore = blueprint.importConnectorId ? 3 : 2;
      const isReady = readinessScore >= maxScore;
      const needsCredentials = !credentialConfigured;
      const needsConnection = credentialConfigured && !connectionReady;
      const headline = isReady
        ? 'Ready for governed use'
        : needsCredentials
          ? 'Requires customer credentials'
          : needsConnection
            ? 'Connect account or runtime'
            : 'Create test/import job';

      return {
        ...blueprint,
        credentialRows,
        primaryCredential,
        credentialConfigured,
        connectionReady,
        importReady,
        postizChannelConnected,
        oauthConnected,
        importReadiness,
        importJob,
        jobState,
        importCredentialState,
        headline,
        tone: isReady ? 'good' as const : needsCredentials ? 'warn' as const : 'info' as const,
        scoreText: `${readinessScore}/${maxScore}`,
      };
    });
  }, [connectorImportJobs, connectorImportReadiness, matrix, postizChannels.length, socialConnections]);

  function chooseRequirement(row: RecordMap) {
    setSelected(row);
    setDisplayName(text(row.label));
    setSecretValues(Object.fromEntries([...parseRequiredFields(row.requiredFields), ...parseRequiredFields(row.optionalFields)].map(field => [field, ''])));
    setMessage('');
  }

  async function saveCredential() {
    if (!token || !selected) return;
    setSaving(true);
    setMessage('');
    try {
      const missing = selectedFields.filter(field => !secretValues[field]?.trim());
      if (missing.length) {
        setMessage(`Missing required fields: ${missing.join(', ')}`);
        return;
      }
      const secrets = Object.fromEntries(Object.entries(secretValues).filter(([, value]) => value.trim()));
      await integrationCredentialsApi.save({
        provider: selected.provider,
        credentialType: selected.credentialType,
        connectionKey: selected.connectionKey || 'default',
        displayName,
        secrets,
        metadata: {
          purpose: selected.purpose,
          credentialOwner: 'tenant',
          executionPolicy: 'approval_and_runtime_flags_required',
          source: 'admin_ui',
        },
      }, token);
      setMessage(`${text(selected.label)} saved. Raw secret values were encrypted and will not be shown again.`);
      setSecretValues(Object.fromEntries(selectedFields.map(field => [field, ''])));
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save credential');
    } finally {
      setSaving(false);
    }
  }

  async function connectPostizChannel() {
    if (!token) return;
    setConnectingPostiz(true);
    setMessage('');
    try {
      const result = await postizApi.connectChannel({ platform: postizPlatform }, token) as RecordMap;
      const authorizationUrl = text(result.authorizationUrl, '');
      const authorization = (result.authorization || {}) as RecordMap;
      if (authorization.providerConfigurationReady === false) {
        setMessage(text(authorization.failureReason, text(result._label, 'Postiz provider app credentials must be configured before this channel can connect.')));
        await runPostizDiagnostics();
        return;
      }
      if (!authorizationUrl) {
        setMessage(text(result._label, 'Postiz did not return an authorization URL. Check provider credentials in Postiz.'));
        return;
      }
      window.open(authorizationUrl, '_blank', 'noopener,noreferrer');
      setMessage(`Postiz ${display(postizPlatform)} authorization opened. Complete the provider login, then refresh channels.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to start Postiz channel connection');
    } finally {
      setConnectingPostiz(false);
    }
  }

  async function runPostizDiagnostics() {
    if (!token) return;
    setDiagnosingPostiz(true);
    setMessage('');
    try {
      const result = await postizApi.diagnostics({ platform: postizPlatform }, token) as RecordMap;
      setPostizDiagnostics(result);
      setPostizChannels(Array.isArray(result.channels) ? result.channels as RecordMap[] : postizChannels);
      setMessage(text(result._label, 'Postiz diagnostics completed.'));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Postiz diagnostics failed');
    } finally {
      setDiagnosingPostiz(false);
    }
  }

  async function selectPostizChannel(channelId: string) {
    if (!token) return;
    setSelectingPostizChannel(channelId);
    setMessage('');
    try {
      await postizApi.selectChannel({ integrationId: channelId }, token);
      setMessage('Postiz channel selected for scheduling packages. Raw credentials were not displayed or changed.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to select Postiz channel');
    } finally {
      setSelectingPostizChannel('');
    }
  }

  async function validateSelectedProvider() {
    if (!token || !selectedValidationProvider) return;
    setValidatingProvider(selectedValidationProvider);
    setMessage('');
    try {
      const result = await connectorReadinessApi.validateProvider(selectedValidationProvider, token) as RecordMap;
      setProviderValidationResults(current => ({ ...current, [selectedValidationProvider]: result }));
      const status = text(result.status);
      setMessage(`${text(result.displayName, 'Provider')} validation: ${display(status)}. ${text(result.message, '')}`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Provider validation failed');
    } finally {
      setValidatingProvider('');
    }
  }

  async function saveManualPostizIntegrationId() {
    if (!token) return;
    const integrationId = manualPostizIntegrationId.trim();
    if (!integrationId) {
      setMessage('Enter the Postiz integration ID before saving.');
      return;
    }
    setSelectingPostizChannel(integrationId);
    setMessage('');
    try {
      await postizApi.selectChannel({ integrationId, validationMode: 'manual' }, token);
      setPostizAnalyticsResult(null);
      setMessage('Postiz integration ID saved as pending validation. Run analytics test before using it for reporting.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save Postiz integration ID');
    } finally {
      setSelectingPostizChannel('');
    }
  }

  async function runPostizAnalyticsTest() {
    if (!token) return;
    const eventId = postizAnalyticsEventId || text(events[0]?.id, '');
    if (!eventId) {
      setMessage('Create or select an event before testing Postiz analytics.');
      return;
    }
    setTestingPostizAnalytics(true);
    setMessage('');
    try {
      let jobs = connectorImportJobs.filter(job => text(job.eventId, '') === eventId);
      if (!jobs.length) {
        const jobResult = await connectorImportsApi.jobs(token, eventId);
        jobs = Array.isArray(jobResult)
          ? jobResult as RecordMap[]
          : Array.isArray((jobResult as RecordMap).jobs)
            ? (jobResult as RecordMap).jobs as RecordMap[]
            : [];
      }
      const existingJob = jobs.find(job => text(job.connectorId, '').toLowerCase() === 'postiz' && text(job.eventId, '') === eventId);
      if (!existingJob) {
        await connectorImportsApi.createJob({
          connectorId: 'postiz',
          displayName: 'Postiz analytics validation',
          eventId,
          notes: 'Read-only analytics validation from Connector Setup. No scheduling or publishing.',
        }, token);
      }
      const result = await connectorImportsApi.dryRun({ connectorId: 'postiz', eventId }, token) as RecordMap;
      setPostizAnalyticsResult(result);
      const rows = Array.isArray(result.kpiRows) ? result.kpiRows.length : 0;
      const warnings = Array.isArray(result.warnings) ? result.warnings as string[] : [];
      setMessage(rows > 0
        ? `Postiz analytics test passed with ${rows} importable KPI row(s).`
        : warnings[0] || 'Postiz analytics test completed, but no importable KPI rows were found.');
      await load();
    } catch (err) {
      setPostizAnalyticsResult(null);
      setMessage(err instanceof Error ? err.message : 'Postiz analytics test failed');
    } finally {
      setTestingPostizAnalytics(false);
    }
  }

  async function disableCredential(id: string) {
    if (!token) return;
    await integrationCredentialsApi.disable(id, token);
    await load();
  }

  async function startOAuth(platform: string) {
    if (!token) return;
    setMessage('');
    try {
      const result = await socialOAuthApi.start({ platform }, token) as RecordMap;
      const authorizationUrl = text(result.authorizationUrl, '');
      if (!authorizationUrl) {
        setMessage('OAuth start did not return an authorization URL.');
        return;
      }
      window.open(authorizationUrl, '_blank', 'noopener,noreferrer');
      setMessage(`OAuth authorization opened for ${display(platform)}. Complete the provider login in the new tab.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to start OAuth authorization');
    }
  }

  return (
    <AieroPage
      eyebrow="Integrations"
      title="Connect Business Systems"
      subtitle="Connect the customer-owned systems that power the platform: GoHighLevel CRM and WhatsApp readiness, Meta and Instagram ads, YouTube, Postiz scheduling, Formaloo forms, and SmartLabs voice."
      action={<AieroStatusPill accent="teal">Customer-Owned Accounts</AieroStatusPill>}
    >
      {message && <Notice tone={message.toLowerCase().includes('failed') || message.toLowerCase().includes('missing') ? 'warn' : 'good'}>{message}</Notice>}

      <AieroPanel>
        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/38">Setup without confusion</div>
            <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-tight">Connect the tools the customer already uses.</h2>
            <p className="mt-4 text-sm leading-7 text-white/56">
              Save the customer credential, connect the provider account where required, preview imported data, then approve the import.
              GoHighLevel remains the CRM source of truth; Tanaghum becomes the AI operating and reporting layer.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <AieroMetricCard label="GoHighLevel" value={text(ghl?._label)} detail={`${text(ghl?.apiKeyStatus)} API key | CRM, leads, WhatsApp readiness`} accent="rose" />
            <AieroMetricCard label="AI Provider" value={text(aiProvider?.provider, 'Requires LLM')} detail={text(aiProvider?.label, 'AI generation status')} accent="violet" />
            <AieroMetricCard label="Postiz" value={text(postiz?.status)} detail={`${text((postiz?.health as RecordMap | undefined)?.credentialStatus)} credential | scheduling`} accent="teal" />
            <AieroMetricCard label="Tenant Vault" value={`${configuredRows}/${matrix.length}`} detail="Configured credential sets" accent="amber" />
          </div>
        </div>
      </AieroPanel>

      <AieroPanel
        title="Setup Wizard: Choose A Data Source"
        subtitle="Start with the business system the customer wants to connect. The page will show the exact credential, validation, mapping, and import path for that source."
        action={selected ? <AieroStatusPill accent="blue">Selected: {text(selected.label)}</AieroStatusPill> : <AieroStatusPill accent="amber">Choose Connector</AieroStatusPill>}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {setupRoadmap.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => item.primaryCredential && chooseRequirement(item.primaryCredential)}
              disabled={!item.primaryCredential}
              className="flex min-h-[220px] flex-col rounded-[1.25rem] border border-white/10 bg-[#0c0c19] p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-white/24 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium uppercase tracking-wide text-white/38">{item.category}</div>
                  <div className="mt-1 text-base font-semibold text-white">{item.label}</div>
                </div>
                <ProductStatus tone={item.tone}>{item.scoreText}</ProductStatus>
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/48">{item.businessUse}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <ProductStatus tone={item.credentialConfigured ? 'good' : 'warn'}>
                  {item.credentialConfigured ? 'Credentials saved' : 'Needs credentials'}
                </ProductStatus>
                <ProductStatus tone={item.connectionReady ? 'good' : 'info'}>
                  {item.needsPostizChannel
                    ? item.postizChannelConnected ? 'Channel selected' : 'Channel next'
                    : item.oauthPlatforms?.length
                      ? item.oauthConnected ? 'OAuth connected' : 'OAuth next'
                      : 'Credential step'}
                </ProductStatus>
              </div>
              <div className="mt-auto pt-4 text-sm font-semibold text-white">
                {item.primaryCredential ? 'Configure now' : 'Not available yet'}
              </div>
            </button>
          ))}
        </div>
      </AieroPanel>

      <AieroLightPanel
        title={selected ? `Secure Setup: ${text(selected.label)}` : 'Secure Setup Wizard'}
        subtitle={selected ? 'Enter the required fields for this connector. Raw secrets are encrypted and never shown again.' : 'Choose a connector above to open the exact fields required for setup.'}
        action={selected ? <SecondaryAction onClick={() => setSelected(null)}>Clear Selection</SecondaryAction> : undefined}
      >
        {selected ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-4">
              <DetailGrid items={[
                { label: 'Integration', value: text(selected.label) },
                { label: 'Provider', value: text(selected.provider) },
                { label: 'Credential Type', value: text(selected.credentialType) },
                { label: 'Connection Key', value: text(selected.connectionKey, 'default') },
              ]} />
              <Field label="Display Name">
                <input
                  value={displayName}
                  onChange={event => setDisplayName(event.target.value)}
                  className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                {selectedFields.map(field => (
                  <Field key={field} label={display(field)} helper="Secret value is encrypted and never returned after save.">
                    <input
                      type={field.toLowerCase().includes('url') || field.toLowerCase().includes('uri') ? 'url' : 'password'}
                      value={secretValues[field] || ''}
                      onChange={event => setSecretValues(current => ({ ...current, [field]: event.target.value }))}
                      placeholder={`Enter ${field}`}
                      className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </Field>
                ))}
                {optionalFields.map(field => (
                  <Field key={field} label={`${display(field)} (Optional)`} helper="Add this later after the provider creates it.">
                    <input
                      type={field.toLowerCase().includes('url') || field.toLowerCase().includes('uri') ? 'url' : 'password'}
                      value={secretValues[field] || ''}
                      onChange={event => setSecretValues(current => ({ ...current, [field]: event.target.value }))}
                      placeholder={`Enter ${field} when available`}
                      className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </Field>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <PrimaryAction onClick={saveCredential} disabled={saving}>{saving ? 'Saving...' : 'Save Encrypted Credential'}</PrimaryAction>
                <SecondaryAction onClick={() => setSecretValues(Object.fromEntries([...selectedFields, ...optionalFields].map(field => [field, ''])))}>Clear Fields</SecondaryAction>
              </div>
            </div>
            <div className="space-y-4">
              <Notice tone="info">
                Saving credentials only prepares the integration. Imports, CRM writes, messages, voice calls, and publishing still require preview,
                approval, and the correct runtime safety flags before execution.
              </Notice>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-sm font-semibold text-neutral-950">After saving</div>
                <ol className="mt-3 space-y-2 text-sm leading-6 text-neutral-600">
                  {[
                    'Run diagnostics or validate the provider connection.',
                    'Connect OAuth/channel when the provider requires consent.',
                    'Create a dry-run import before KPI data appears in dashboards.',
                    'Keep external execution blocked until the customer authorizes it.',
                  ].map((step, index) => (
                    <li key={step} className="flex gap-3">
                      <span className="font-semibold text-neutral-950">{index + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
              {selectedValidationProvider && (
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-neutral-950">Read-access validation</div>
                      <p className="mt-1 text-sm leading-6 text-neutral-600">
                        Test whether this customer credential can read analytics. This never imports data and never writes to the provider.
                      </p>
                    </div>
                    <ProductStatus tone={selectedValidationResult ? statusTone(text(selectedValidationResult.status)) : 'warn'}>
                      {selectedValidationResult ? display(text(selectedValidationResult.status)) : 'Not tested'}
                    </ProductStatus>
                  </div>
                  <div className="mt-4">
                    <SecondaryAction onClick={validateSelectedProvider} disabled={validatingProvider === selectedValidationProvider}>
                      {validatingProvider === selectedValidationProvider ? 'Checking...' : 'Validate Read Access'}
                    </SecondaryAction>
                  </div>
                  {selectedValidationResult && (
                    <div className="mt-4 space-y-3">
                      <Notice tone={noticeTone(text(selectedValidationResult.status))}>
                        {text(selectedValidationResult.message)}
                      </Notice>
                      <DetailGrid items={[
                        { label: 'Rows found', value: String(((selectedValidationResult.evidence as RecordMap | undefined)?.rowsFound ?? 0)) },
                        { label: 'Endpoint', value: text((selectedValidationResult.evidence as RecordMap | undefined)?.providerEndpoint, 'Not called') },
                        { label: 'Account', value: text((selectedValidationResult.evidence as RecordMap | undefined)?.accountReference, 'Not provided') },
                        { label: 'External writes', value: selectedValidationResult.externalWritesAllowed === false ? 'Off' : 'Unknown' },
                      ]} />
                      {Array.isArray(selectedValidationResult.requiredActions) && selectedValidationResult.requiredActions.length > 0 && (
                        <ol className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm leading-6 text-neutral-700">
                          {(selectedValidationResult.requiredActions as unknown[]).filter((item): item is string => typeof item === 'string').map((action, index) => (
                            <li key={action} className="flex gap-3">
                              <span className="font-semibold text-neutral-950">{index + 1}.</span>
                              <span>{action}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <EmptyProductState
            title="Choose a connector to begin"
            message="Select GoHighLevel, Meta/Instagram, Postiz, YouTube, Formaloo, or SmartLabs from the cards above."
          />
        )}
      </AieroLightPanel>

      <AieroPanel
        title="How Verified Data Reaches Dashboards"
        subtitle="Credentials alone do not create live data. Each source must be connected, previewed, mapped, and approved before it affects event reporting."
        action={
          <div className="flex flex-wrap gap-2">
            <ProductStatus tone={configuredImportCount ? 'good' : 'warn'}>{configuredImportCount} import-ready</ProductStatus>
            <ProductStatus tone={missingImportCount ? 'warn' : 'good'}>{missingImportCount} missing</ProductStatus>
            <ProductStatus tone={blockedImportCount ? 'danger' : 'muted'}>{blockedImportCount} blocked</ProductStatus>
          </div>
        }
      >
        <div className="grid gap-3 lg:grid-cols-4">
          <AieroNumberedStep number="1" title="Save Credentials" detail="Admin or marketing manager saves tenant-owned API/OAuth credentials. Raw secret values are never shown again." accent="teal" />
          <AieroNumberedStep number="2" title="Connect Account" detail="Provider OAuth, Postiz channels, or CRM location checks prove the account belongs to the customer." accent="rose" />
          <AieroNumberedStep number="3" title="Import Evidence" detail="Event dashboards use mappings, dry-runs, and approval before connector data becomes KPI evidence." accent="violet" />
          <AieroNumberedStep number="4" title="Govern Execution" detail="Publishing, CRM, messaging, and voice actions stay blocked until explicit customer authorization." accent="amber" />
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {[
            ['GoHighLevel', 'CRM source of truth for leads, tags, stages, meetings, purchases, and WhatsApp readiness.'],
            ['Meta / YouTube / Formaloo', 'Verified campaign reach, spend, video performance, and form activity for event dashboards.'],
            ['Postiz / SmartLabs', 'Scheduling and voice/chat handoff surfaces that remain approval-gated before execution.'],
          ].map(([title, detail]) => (
            <div key={title} className="rounded-[1.25rem] border border-white/10 bg-[#0c0c19] p-4">
              <div className="text-sm font-semibold text-white">{title}</div>
              <p className="mt-2 text-sm leading-6 text-white/50">{detail}</p>
            </div>
          ))}
        </div>
      </AieroPanel>

      <ProductCard
        title="Postiz Scheduling Connection"
        subtitle="Connect the customer's Postiz workspace, choose the channel used for approved content, then test whether analytics can be read. Nothing is scheduled or published from this page."
        action={<ProductStatus tone={postizAnalyticsReady ? 'good' : postizCredentialConfigured ? 'warn' : 'info'}>{postizAnalyticsReady ? 'Analytics Ready' : postizCredentialConfigured ? 'Needs Channel Test' : 'Needs Credentials'}</ProductStatus>}
      >
        <div className="grid gap-3 lg:grid-cols-3">
          {[
            ['1', 'Save Postiz Access', postizCredentialConfigured ? 'Postiz API key and base URL are saved.' : 'Open Postiz from the connector cards above and save API key + base URL.', postizCredentialConfigured ? 'good' : 'warn'],
            ['2', 'Choose Channel', selectedPostizIntegrationId ? 'A Postiz integration ID is saved for this tenant.' : postizChannels.length ? 'Choose one of the channels returned by Postiz.' : 'Connect a social channel in Postiz or paste its integration ID.', selectedPostizIntegrationId ? 'good' : 'warn'],
            ['3', 'Test Analytics', postizAnalyticsReady ? `${postizAnalyticsRows.length} KPI row(s) can be read.` : 'Run the read-only analytics test before using the channel for reporting.', postizAnalyticsReady ? 'good' : 'info'],
          ].map(([step, title, detail, tone]) => (
            <div key={step} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-950 text-sm font-semibold text-white">{step}</span>
                  <div className="text-sm font-semibold text-neutral-950">{title}</div>
                </div>
                <ProductStatus tone={tone as 'good' | 'warn' | 'info'}>{tone === 'good' ? 'Done' : 'Next'}</ProductStatus>
              </div>
              <p className="mt-3 text-sm leading-6 text-neutral-600">{detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-4">
            <DetailGrid items={[
              { label: 'Postiz status', value: text(postiz?.status) },
              { label: 'Credential', value: postizCredentialConfigured ? 'Configured' : 'Missing' },
              { label: 'Visible channels', value: String(postizChannels.length) },
              { label: 'Saved integration ID', value: selectedPostizIntegrationId || 'Not selected' },
            ]} />

            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="text-sm font-semibold text-neutral-950">Connect or refresh channel list</div>
              <p className="mt-1 text-sm leading-6 text-neutral-600">
                Use this when the customer needs to connect a social account through Postiz. Provider login and account tokens stay inside Postiz.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <select
                  value={postizPlatform}
                  onChange={(event) => setPostizPlatform(event.target.value)}
                  className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950"
                >
                  <option value="instagram">Instagram / Facebook via Meta</option>
                  <option value="instagram-standalone">Instagram Standalone</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="x">X / Twitter</option>
                  <option value="facebook">Facebook</option>
                  <option value="threads">Threads</option>
                  <option value="tiktok">TikTok</option>
                  <option value="youtube">YouTube</option>
                </select>
                <PrimaryAction onClick={connectPostizChannel} disabled={connectingPostiz || !postizCredentialConfigured}>
                  {connectingPostiz ? 'Opening...' : 'Connect'}
                </PrimaryAction>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <SecondaryAction onClick={runPostizDiagnostics} disabled={diagnosingPostiz || !postizCredentialConfigured}>
                  {diagnosingPostiz ? 'Checking...' : 'Check Connection'}
                </SecondaryAction>
                {postizAuthorizationUrl && (
                  <SecondaryAction onClick={() => window.open(postizAuthorizationUrl, '_blank', 'noopener,noreferrer')} disabled={!postizProviderReady}>
                    {postizProviderReady ? 'Open Provider Login' : 'Provider Setup Required'}
                  </SecondaryAction>
                )}
                <SecondaryAction onClick={() => void load()}>Refresh</SecondaryAction>
              </div>
              {postizAuthorizationUrl && !postizProviderReady && (
                <Notice tone="warn">
                  Postiz needs provider app setup before this channel can connect. Configure the provider app in Postiz, then check again.
                </Notice>
              )}
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="text-sm font-semibold text-neutral-950">Paste Postiz integration ID</div>
              <p className="mt-1 text-sm leading-6 text-neutral-600">
                Use this if Postiz shows the channel ID but the channel list is empty here. Saving the ID does not prove it works; the analytics test below does.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  value={manualPostizIntegrationId}
                  onChange={(event) => setManualPostizIntegrationId(event.target.value)}
                  placeholder="Paste Postiz integration/channel ID"
                  className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                />
                <SecondaryAction onClick={saveManualPostizIntegrationId} disabled={!postizCredentialConfigured || selectingPostizChannel === manualPostizIntegrationId.trim()}>
                  {selectingPostizChannel === manualPostizIntegrationId.trim() ? 'Saving...' : 'Save ID'}
                </SecondaryAction>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-neutral-950">Connected Postiz channels</div>
                  <p className="mt-1 text-sm leading-6 text-neutral-600">
                    Choose a listed channel, or paste its ID if Postiz does not return the list yet.
                  </p>
                </div>
                <ProductStatus tone={postizChannels.length ? 'good' : 'warn'}>{postizChannels.length} found</ProductStatus>
              </div>

              {postizChannels.length ? (
                <div className="mt-4">
                  <ProductTable
                    columns={['Channel', 'Provider', 'Status', 'Action']}
                    rows={postizChannels.map(channel => {
                      const channelId = text(channel.id, '');
                      const disabled = Boolean(channel.disabled);
                      const refreshNeeded = Boolean(channel.refreshNeeded);
                      const selectedForScheduling = channelId === selectedPostizIntegrationId;
                      return [
                        <div>
                          <div className="font-medium text-neutral-950">{text(channel.name, text(channel.profile, 'Unnamed channel'))}</div>
                          <div className="mt-1 break-all text-xs text-neutral-500">{channelId}</div>
                        </div>,
                        display(text(channel.providerIdentifier || channel.type)),
                        <ProductStatus tone={disabled || refreshNeeded ? 'warn' : selectedForScheduling ? 'good' : 'info'}>
                          {selectedForScheduling ? 'Selected' : disabled ? 'Disabled' : refreshNeeded ? 'Reconnect' : 'Available'}
                        </ProductStatus>,
                        <SecondaryAction onClick={() => void selectPostizChannel(channelId)} disabled={!channelId || disabled || selectedForScheduling || selectingPostizChannel === channelId}>
                          {selectedForScheduling ? 'Selected' : selectingPostizChannel === channelId ? 'Saving...' : 'Use'}
                        </SecondaryAction>,
                      ];
                    })}
                  />
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-5">
                  <EmptyProductState
                    title="No channels visible yet"
                    message="The Postiz credential is valid only after Postiz returns channels or an entered integration ID passes the analytics test."
                  />
                  {postizNextActions.length > 0 && (
                    <ol className="mt-4 space-y-2 text-sm leading-6 text-neutral-700">
                      {postizNextActions.map((action, index) => (
                        <li key={action} className="flex gap-3">
                          <span className="font-semibold text-neutral-950">{index + 1}.</span>
                          <span>{action}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-neutral-950">Test Postiz analytics</div>
                  <p className="mt-1 text-sm leading-6 text-neutral-600">
                    This reads Postiz analytics for the selected ID and previews KPI rows for one event. It does not import, schedule, or publish.
                  </p>
                </div>
                <ProductStatus tone={postizAnalyticsReady ? 'good' : postizProviderStatus.analyticsFetched ? 'warn' : 'info'}>
                  {postizAnalyticsReady ? 'Rows Found' : postizProviderStatus.analyticsFetched ? 'No Rows' : 'Not Tested'}
                </ProductStatus>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <select
                  value={postizAnalyticsEventId}
                  onChange={(event) => setPostizAnalyticsEventId(event.target.value)}
                  className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950"
                >
                  {events.map(event => (
                    <option key={text(event.id)} value={text(event.id)}>{text(event.name, 'Untitled event')}</option>
                  ))}
                </select>
                <PrimaryAction onClick={runPostizAnalyticsTest} disabled={testingPostizAnalytics || !postizCredentialConfigured || !selectedPostizIntegrationId}>
                  {testingPostizAnalytics ? 'Testing...' : 'Test Analytics'}
                </PrimaryAction>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <MetricCard label="Channels Found" value={postizChannelsFound} detail="Returned by Postiz Public API" tone={postizChannelsFound ? 'good' : 'warn'} />
                <MetricCard label="KPI Rows" value={postizAnalyticsRows.length} detail="Preview rows from analytics" tone={postizAnalyticsRows.length ? 'good' : 'warn'} />
                <MetricCard label="External Writes" value="Off" detail="Read-only validation only" tone="good" />
              </div>
              {postizAnalyticsWarnings.length > 0 && (
                <Notice tone={postizAnalyticsRows.length ? 'info' : 'warn'}>
                  {postizAnalyticsWarnings[0]}
                </Notice>
              )}
              {postizAnalyticsRows.length > 0 && (
                <div className="mt-4">
                  <ProductTable
                    columns={['Date', 'Channel', 'Reach', 'Impressions', 'Interactions', 'Clicks', 'Leads']}
                    rows={postizAnalyticsRows.slice(0, 5).map(row => [
                      text(row.metricDate),
                      text(row.channel),
                      String(row.reach ?? 0),
                      String(row.impressions ?? 0),
                      String(row.interactions ?? 0),
                      String(row.clicks ?? 0),
                      String(row.leads ?? 0),
                    ])}
                  />
                </div>
              )}
            </div>

            {postizDiagnosticChecks.length > 0 && (
              <details className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-neutral-950">Show connection checks</summary>
                <div className="mt-4 space-y-2">
                  {postizDiagnosticChecks.map(check => (
                    <div key={text(check.id)} className="rounded-lg border border-neutral-100 bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-neutral-950">{text(check.label)}</div>
                        <ProductStatus tone={statusTone(text(check.status))}>{display(text(check.status))}</ProductStatus>
                      </div>
                      <div className="mt-1 text-xs leading-5 text-neutral-500">{text(check.detail)}</div>
                    </div>
                  ))}
                  {postizDiagnosticActions.length > 0 && (
                    <ol className="space-y-2 text-sm leading-6 text-neutral-700">
                      {postizDiagnosticActions.map((action, index) => (
                        <li key={action} className="flex gap-3">
                          <span className="font-semibold text-neutral-950">{index + 1}.</span>
                          <span>{action}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      </ProductCard>

      <ProductCard title="Saved Connection Status" subtitle="Credentials are stored securely. Secret values are never displayed after saving.">
        <details>
          <summary className="cursor-pointer rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-950">
            Show saved connection status
          </summary>
          <div className="mt-4">
            {credentials.length ? (
              <ProductTable
                columns={['Credential', 'Fields', 'Fingerprints', 'Status', 'Action']}
                rows={credentials.map(credential => [
                  <div>
                    <div className="font-medium text-neutral-950">{text(credential.displayName)}</div>
                    <div className="mt-1 text-xs text-neutral-500">{display(text(credential.provider))} / {display(text(credential.credentialType))} / {text(credential.connectionKey, 'default')}</div>
                  </div>,
                  <div className="flex flex-wrap gap-1">
                    {parseRequiredFields(credential.secretFields).map(field => <ProductStatus key={field} tone="muted">{field}</ProductStatus>)}
                  </div>,
                  <div className="max-w-sm text-xs leading-5 text-neutral-500">
                    {Object.entries((credential.secretFingerprints || {}) as Record<string, unknown>).map(([key, value]) => `${key}: ${String(value)}`).join(' | ') || 'Hidden'}
                  </div>,
                  <ProductStatus tone={credential.isActive ? 'good' : 'danger'}>{credential.isActive ? 'Configured' : 'Disabled'}</ProductStatus>,
                  credential.isActive ? <SecondaryAction onClick={() => disableCredential(text(credential.id))}>Disable</SecondaryAction> : <ProductStatus tone="muted">Disabled</ProductStatus>,
                ])}
              />
            ) : (
              <EmptyProductState message="No tenant integration credentials have been saved yet." />
            )}
          </div>
        </details>
      </ProductCard>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <ProductCard title="Connect Meta / Instagram Account" subtitle="Use provider OAuth for ad account, page, Instagram business account, and lead-form access when the customer provides the required Meta app setup.">
          <div className="space-y-4">
            <Field label="Platform">
              <select
                value={oauthPlatform}
                onChange={(event) => setOauthPlatform(event.target.value)}
                className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950"
              >
                <option value="meta">Meta / Instagram / Facebook</option>
              </select>
            </Field>
            <Notice tone="info">
              Configure the matching Meta OAuth client first. This starts a real provider redirect; no account is marked connected unless the callback exchanges a valid code.
            </Notice>
            <PrimaryAction onClick={() => startOAuth(oauthPlatform)}>Start OAuth Connection</PrimaryAction>
          </div>
        </ProductCard>

        <ProductCard title="Connected Social Accounts" subtitle="These are real OAuth account records from completed callbacks. Tokens are encrypted and never shown.">
          {socialConnections.length ? (
            <ProductTable
              columns={['Platform', 'Account', 'Scopes', 'Token', 'Status']}
              rows={socialConnections.map(connection => [
                display(text(connection.platform)),
                <div>
                  <div className="font-medium text-neutral-950">{text(connection.accountName, text(connection.accountId))}</div>
                  <div className="mt-1 text-xs text-neutral-500">{text(connection.accountId)}</div>
                </div>,
                <div className="flex flex-wrap gap-1">
                  {(Array.isArray(connection.scopes) ? connection.scopes : []).map(scope => <ProductStatus key={String(scope)} tone="muted">{String(scope)}</ProductStatus>)}
                </div>,
                <div className="text-xs text-neutral-500">Access token encrypted | Refresh token: {text(connection.refreshTokenStatus)}</div>,
                <ProductStatus tone={statusTone(text(connection.status))}>{display(text(connection.status))}</ProductStatus>,
              ])}
            />
          ) : (
            <EmptyProductState message="No social accounts are connected yet. Configure OAuth credentials and complete provider authorization." />
          )}
        </ProductCard>
      </div>
    </AieroPage>
  );
}
