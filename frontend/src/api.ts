function resolveApiBase(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured) return configured;
  if (typeof window !== 'undefined' && window.location.port === '3000') {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }
  return '';
}

const API_BASE = resolveApiBase();

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

interface ApiStreamOptions extends ApiOptions {
  onEvent: (event: { event: string; data: unknown }) => void;
}

export class ApiError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const detail =
      typeof err.error === 'string'
        ? err.error
        : typeof err.message === 'string'
          ? err.message
          : typeof err._label === 'string'
            ? err._label
            : Array.isArray(err.reasons)
              ? err.reasons.join('; ')
              : `API error: ${res.status}`;
    throw new ApiError(detail, res.status, typeof err.code === 'string' ? err.code : undefined);
  }

  return res.json();
}

async function apiStream(path: string, options: ApiStreamOptions): Promise<void> {
  const { method = 'GET', body, token, onEvent } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const detail =
      typeof err.error === 'string'
        ? err.error
        : typeof err.message === 'string'
          ? err.message
          : `API error: ${res.status}`;
    throw new ApiError(detail, res.status, typeof err.code === 'string' ? err.code : undefined);
  }

  if (!res.body) throw new ApiError('Streaming response was empty', 502, 'STREAM_BODY_MISSING');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split(/\r?\n\r?\n/);
      buffer = chunks.pop() || '';
      chunks.forEach(chunk => emitSseChunk(chunk, onEvent));
    }
    buffer += decoder.decode();
    if (buffer.trim()) emitSseChunk(buffer, onEvent);
  } finally {
    reader.releaseLock();
  }
}

function emitSseChunk(chunk: string, onEvent: (event: { event: string; data: unknown }) => void) {
  const lines = chunk.split(/\r?\n/);
  const eventName = lines.find(line => line.startsWith('event:'))?.slice(6).trim() || 'message';
  const dataText = lines
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trim())
    .join('\n');
  if (!dataText) return;
  try {
    onEvent({ event: eventName, data: JSON.parse(dataText) });
  } catch {
    onEvent({ event: eventName, data: dataText });
  }
}

export const authApi = {
  login: (email: string, password: string, mfaCode?: string) =>
    apiFetch<{ token: string; user: unknown; agentRep: unknown }>('/auth/login', { method: 'POST', body: { email, password, ...(mfaCode ? { mfaCode } : {}) } }),
  session: (token: string) =>
    apiFetch<unknown>('/auth/session', { token }),
  logout: (token: string) =>
    apiFetch<unknown>('/auth/logout', { method: 'POST', token }),
  createOnboardingToken: (data: unknown, token: string) =>
    apiFetch<unknown>('/auth/onboarding-token', { method: 'POST', body: data, token }),
  onboardingEmailStatus: (token: string) =>
    apiFetch<unknown>('/auth/onboarding-email-status', { token }),
  acceptOnboarding: (data: unknown) =>
    apiFetch<unknown>('/auth/accept-onboarding', { method: 'POST', body: data }),
  mfaStatus: (token: string) => apiFetch<unknown>('/auth/mfa/status', { token }),
  mfaSetup: (token: string) => apiFetch<unknown>('/auth/mfa/setup', { method: 'POST', token }),
  mfaVerify: (data: unknown, token: string) => apiFetch<unknown>('/auth/mfa/verify', { method: 'POST', body: data, token }),
  mfaDisable: (data: unknown, token: string) => apiFetch<unknown>('/auth/mfa/disable', { method: 'POST', body: data, token }),
  mfaRegenerateRecoveryCodes: (data: unknown, token: string) =>
    apiFetch<unknown>('/auth/mfa/recovery-codes/regenerate', { method: 'POST', body: data, token }),
};

export const campaignsApi = {
  list: (token: string) => apiFetch<unknown[]>('/campaigns', { token }),
  get: (id: string, token: string) => apiFetch<unknown>(`/campaigns/${id}`, { token }),
  create: (data: unknown, token: string) => apiFetch<unknown>('/campaigns', { method: 'POST', body: data, token }),
  transition: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/campaigns/${id}/transition`, { method: 'POST', body: data, token }),
};

export const aiGenerationApi = {
  listCampaignDrafts: (campaignId: string, token: string) =>
    apiFetch<unknown[]>(`/ai-generation/campaigns/${campaignId}/drafts`, { token }),
  generate: (data: unknown, token: string) =>
    apiFetch<unknown>('/ai-generation/generate', { method: 'POST', body: data, token }),
  revise: (data: unknown, token: string) =>
    apiFetch<unknown>('/ai-generation/revise', { method: 'POST', body: data, token }),
  saveEdit: (data: unknown, token: string) =>
    apiFetch<unknown>('/ai-generation/save-edit', { method: 'POST', body: data, token }),
};

export const algoApi = {
  score: (data: unknown, token: string) => apiFetch<unknown>('/algo/score', { method: 'POST', body: data, token }),
  rules: (token: string) => apiFetch<unknown[]>('/algo/rules', { token }),
};

export const approvalsApi = {
  list: (token: string, filters?: Record<string, string>) => {
    const params = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return apiFetch<unknown[]>(`/approvals${params}`, { token });
  },
  get: (id: string, token: string) => apiFetch<unknown>(`/approvals/${id}`, { token }),
  decisionPacket: (id: string, token: string) => apiFetch<unknown>(`/approvals/${id}/decision-packet`, { token }),
  submit: (data: unknown, token: string) => apiFetch<unknown>('/approvals', { method: 'POST', body: data, token }),
  approve: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/approvals/${id}/approve`, { method: 'POST', body: data, token }),
  reject: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/approvals/${id}/reject`, { method: 'POST', body: data, token }),
  requestChanges: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/approvals/${id}/request-changes`, { method: 'POST', body: data, token }),
};

export const publishingPrepApi = {
  listPackages: (token: string, filters?: Record<string, string>) => {
    const params = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return apiFetch<unknown[]>(`/publishing-prep/packages${params}`, { token });
  },
  getPackage: (id: string, token: string) => apiFetch<unknown>(`/publishing-prep/packages/${id}`, { token }),
  getReadiness: (id: string, token: string) => apiFetch<unknown[]>(`/publishing-prep/packages/${id}/readiness`, { token }),
};

export const analyticsApi = {
  sources: (token: string) => apiFetch<unknown[]>('/analytics/sources', { token }),
  snapshots: (token: string) => apiFetch<unknown[]>('/analytics/snapshots', { token }),
  reports: (token: string, filters?: Record<string, string>) => {
    const params = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return apiFetch<unknown[]>(`/analytics/reports${params}`, { token });
  },
  demo: (token: string) => apiFetch<unknown>('/analytics/demo', { token }),
};

export const spineApi = {
  runs: (token: string, filters?: Record<string, string>) => {
    const params = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return apiFetch<unknown[]>(`/spine/runs${params}`, { token });
  },
  getRun: (id: string, token: string) => apiFetch<unknown>(`/spine/runs/${id}`, { token }),
  artifacts: (runId: string, token: string) => apiFetch<unknown[]>(`/spine/runs/${runId}/artifacts`, { token }),
};

export const observabilityApi = {
  events: (token: string, filters?: Record<string, string>) => {
    const params = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return apiFetch<unknown[]>(`/observability/events${params}`, { token });
  },
  audit: (token: string, filters?: Record<string, string>) => {
    const params = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return apiFetch<unknown[]>(`/observability/audit${params}`, { token });
  },
  learningSignals: (token: string) => apiFetch<unknown[]>('/observability/learning-signals', { token }),
};

export const usersApi = {
  list: (token: string) => apiFetch<unknown[]>('/users', { token }),
  me: (token: string) => apiFetch<unknown>('/users/me', { token }),
  departments: (token: string) => apiFetch<unknown[]>('/departments', { token }),
  agentReps: (token: string) => apiFetch<unknown[]>('/agent-reps', { token }),
  myAgentRep: (token: string) => apiFetch<unknown>('/agent-reps/me', { token }),
  createMyAgentRep: (token: string) => apiFetch<unknown>('/agent-reps/me', { method: 'POST', token }),
  createAgentRep: (data: unknown, token: string) =>
    apiFetch<unknown>('/agent-reps', { method: 'POST', body: data, token }),
  functionalAgents: (agentRepId: string, token: string) =>
    apiFetch<unknown[]>(`/agent-reps/${agentRepId}/functional-agents`, { token }),
  createFunctionalAgent: (agentRepId: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/agent-reps/${agentRepId}/functional-agents`, { method: 'POST', body: data, token }),
  importGithubSkill: (agentRepId: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/agent-reps/${agentRepId}/import-github-skill`, { method: 'POST', body: data, token }),
  governanceAgents: (agentRepId: string, token: string) =>
    apiFetch<unknown[]>(`/agent-reps/${agentRepId}/governance-agents`, { token }),
  createGovernanceAgent: (agentRepId: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/agent-reps/${agentRepId}/governance-agents`, { method: 'POST', body: data, token }),
};

export const aiProviderApi = {
  status: (token: string) => apiFetch<unknown>('/ai-provider/status', { token }),
  active: (token: string) => apiFetch<unknown>('/ai-provider/active', { token }),
  credentials: (token: string) => apiFetch<unknown>('/ai-provider/credentials', { token }),
  saveCredential: (data: unknown, token: string) =>
    apiFetch<unknown>('/ai-provider/credentials', { method: 'POST', body: data, token }),
  select: (provider: string, token: string) =>
    apiFetch<unknown>('/ai-provider/select', { method: 'POST', body: { provider }, token }),
  test: (provider: string, token: string) =>
    apiFetch<unknown>('/ai-provider/test', { method: 'POST', body: { provider }, token }),
};

export const demoApi = {
  status: (token: string) => apiFetch<unknown>('/demo/status', { token }),
  integrations: (token: string) => apiFetch<unknown>('/demo/integrations', { token }),
  auditTrail: (token: string) => apiFetch<unknown[]>('/demo/audit-trail', { token }),
  leads: (token: string) => apiFetch<unknown[]>('/demo/leads', { token }),
  handoffPackage: (data: unknown, token: string) =>
    apiFetch<unknown>('/demo/handoff-package', { method: 'POST', body: data, token }),
};

export const publishingPackageApi = {
  create: (data: unknown, token: string) =>
    apiFetch<unknown>('/publishing-package/create', { method: 'POST', body: data, token }),
  list: (token: string) => apiFetch<unknown[]>('/publishing-package/list', { token }),
};

export const postizApi = {
  status: (token: string) => apiFetch<unknown>('/postiz/status', { token }),
  channels: (token: string) => apiFetch<unknown>('/postiz/channels', { token }),
  connectors: (token: string) => apiFetch<unknown[]>('/postiz/connectors', { token }),
  diagnostics: (params: { platform?: string; refresh?: string }, token: string) => {
    const search = new URLSearchParams();
    if (params.platform) search.set('platform', params.platform);
    if (params.refresh) search.set('refresh', params.refresh);
    const query = search.toString();
    return apiFetch<unknown>(`/postiz/diagnostics${query ? `?${query}` : ''}`, { token });
  },
  connectChannel: (data: unknown, token: string) =>
    apiFetch<unknown>('/postiz/connect-channel', { method: 'POST', body: data, token }),
  selectChannel: (data: unknown, token: string) =>
    apiFetch<unknown>('/postiz/select-channel', { method: 'POST', body: data, token }),
  schedulePayload: (data: unknown, token: string) =>
    apiFetch<unknown>('/postiz/schedule-payload', { method: 'POST', body: data, token }),
  packagePayload: (data: unknown, token: string) =>
    apiFetch<unknown>('/postiz/package-payload', { method: 'POST', body: data, token }),
  sandboxSchedule: (data: unknown, token: string) =>
    apiFetch<unknown>('/postiz/sandbox-schedule', { method: 'POST', body: data, token }),
  packageSandboxSchedule: (data: unknown, token: string) =>
    apiFetch<unknown>('/postiz/package-sandbox-schedule', { method: 'POST', body: data, token }),
};

export const postizChannelApi = {
  eventChannels: (eventId: string, token: string) => apiFetch<unknown>(`/postiz-channels/events/${eventId}/channels`, { token }),
  eventReadiness: (eventId: string, token: string) => apiFetch<unknown>(`/postiz-channels/events/${eventId}/readiness`, { token }),
  packageReadiness: (packageId: string, token: string) => apiFetch<unknown>(`/postiz-channels/packages/${packageId}/readiness`, { token }),
  selectEventChannel: (eventId: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/postiz-channels/events/${eventId}/channels`, { method: 'POST', body: data, token }),
  deselectEventChannel: (eventId: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/postiz-channels/events/${eventId}/channels`, { method: 'DELETE', body: data, token }),
};

export const adminUsersApi = {
  list: (token: string) => apiFetch<unknown[]>('/admin/users', { token }),
  create: (data: unknown, token: string) => apiFetch<unknown>('/admin/users', { method: 'POST', body: data, token }),
  update: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/admin/users/${id}`, { method: 'PUT', body: data, token }),
  deactivate: (id: string, token: string) => apiFetch<unknown>(`/admin/users/${id}/deactivate`, { method: 'POST', token }),
  activate: (id: string, token: string) => apiFetch<unknown>(`/admin/users/${id}/activate`, { method: 'POST', token }),
};

export const tenantAdminApi = {
  summary: (token: string) => apiFetch<unknown>('/admin/tenant', { token }),
  update: (data: unknown, token: string) => apiFetch<unknown>('/admin/tenant', { method: 'PUT', body: data, token }),
  isolationReport: (token: string) => apiFetch<unknown>('/admin/tenant/isolation-report', { token }),
  lifecycle: (token: string) => apiFetch<unknown>('/admin/tenant/lifecycle', { token }),
  plans: (token: string) => apiFetch<unknown>('/admin/tenant/plans', { token }),
  subscription: (token: string) => apiFetch<unknown>('/admin/tenant/subscription', { token }),
  updateSubscription: (data: unknown, token: string) =>
    apiFetch<unknown>('/admin/tenant/subscription', { method: 'POST', body: data, token }),
  exportData: (token: string) => apiFetch<unknown>('/admin/tenant/export', { token }),
  deletionReadiness: (token: string) => apiFetch<unknown>('/admin/tenant/deletion-readiness', { token }),
  requestDeletion: (data: unknown, token: string) =>
    apiFetch<unknown>('/admin/tenant/deletion-request', { method: 'POST', body: data, token }),
  privacyGovernance: (token: string) => apiFetch<unknown>('/admin/tenant/privacy-governance', { token }),
  updatePrivacyGovernance: (data: unknown, token: string) =>
    apiFetch<unknown>('/admin/tenant/privacy-governance', { method: 'PUT', body: data, token }),
  updateLifecycle: (data: unknown, token: string) =>
    apiFetch<unknown>('/admin/tenant/lifecycle', { method: 'POST', body: data, token }),
};

export const operationsApi = {
  readiness: (token: string) => apiFetch<unknown>('/ops/readiness', { token }),
  metrics: (token: string) => apiFetch<unknown>('/ops/metrics', { token }),
  backupStatus: (token: string) => apiFetch<unknown>('/ops/backup/status', { token }),
  monitoringStatus: (token: string) => apiFetch<unknown>('/ops/monitoring/status', { token }),
};

export const integrationsApi = {
  list: (token: string) => apiFetch<unknown[]>('/integrations', { token }),
  get: (name: string, token: string) => apiFetch<unknown>(`/integrations/${name}`, { token }),
  healthCheck: (name: string, token: string) =>
    apiFetch<unknown>(`/integrations/${name}/health-check`, { method: 'POST', token }),
};

export const integrationStatusApi = {
  get: (token: string) => apiFetch<unknown>('/integration-status', { token }),
};

export const commercialWorkflowApi = {
  state: (token: string, campaignId?: string) => {
    const params = campaignId ? `?${new URLSearchParams({ campaignId }).toString()}` : '';
    return apiFetch<unknown>(`/commercial-workflow/state${params}`, { token });
  },
  runs: (token: string) => apiFetch<unknown>('/commercial-workflow/runs', { token }),
  startRun: (data: unknown, token: string) =>
    apiFetch<unknown>('/commercial-workflow/runs', { method: 'POST', body: data, token }),
  currentRun: (token: string, campaignId?: string) => {
    const params = campaignId ? `?${new URLSearchParams({ campaignId }).toString()}` : '';
    return apiFetch<unknown>(`/commercial-workflow/runs/current${params}`, { token });
  },
  syncRun: (runId: string, token: string) =>
    apiFetch<unknown>(`/commercial-workflow/runs/${runId}/sync`, { method: 'POST', token }),
  evidence: (token: string, campaignId?: string) => {
    const params = campaignId ? `?${new URLSearchParams({ campaignId }).toString()}` : '';
    return apiFetch<unknown>(`/commercial-workflow/evidence${params}`, { token });
  },
};

export const integrationCredentialsApi = {
  list: (token: string) => apiFetch<unknown>('/integration-credentials', { token }),
  requirements: (token: string) => apiFetch<unknown>('/integration-credentials/requirements', { token }),
  matrix: (token: string) => apiFetch<unknown>('/integration-credentials/matrix', { token }),
  save: (data: unknown, token: string) =>
    apiFetch<unknown>('/integration-credentials', { method: 'POST', body: data, token }),
  disable: (id: string, token: string) =>
    apiFetch<unknown>(`/integration-credentials/${id}`, { method: 'DELETE', token }),
};

export const connectorImportsApi = {
  readiness: (token: string) => apiFetch<unknown>('/connector-imports/readiness', { token }),
  requirements: (token: string) => apiFetch<unknown>('/connector-imports/requirements', { token }),
  jobs: (token: string, eventId?: string) => {
    const params = eventId ? `?${new URLSearchParams({ eventId }).toString()}` : '';
    return apiFetch<unknown>(`/connector-imports/jobs${params}`, { token });
  },
  syncStatus: (token: string, eventId?: string) => {
    const params = eventId ? `?${new URLSearchParams({ eventId }).toString()}` : '';
    return apiFetch<unknown>(`/connector-imports/sync-status${params}`, { token });
  },
  createJob: (data: unknown, token: string) =>
    apiFetch<unknown>('/connector-imports/jobs', { method: 'POST', body: data, token }),
  markReady: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/connector-imports/jobs/${id}/mark-ready`, { method: 'POST', body: data, token }),
  disableJob: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/connector-imports/jobs/${id}/disable`, { method: 'POST', body: data, token }),
  dryRun: (data: unknown, token: string) =>
    apiFetch<unknown>('/connector-imports/dry-run', { method: 'POST', body: data, token }),
  approveImport: (data: unknown, token: string) =>
    apiFetch<unknown>('/connector-imports/approve-import', { method: 'POST', body: data, token }),
};

export const connectorReadinessApi = {
  global: (token: string) => apiFetch<unknown>('/connector-readiness/global', { token }),
  event: (eventId: string, token: string) => apiFetch<unknown>(`/connector-readiness/events/${eventId}`, { token }),
  validateProvider: (providerId: string, token: string) =>
    apiFetch<unknown>(`/connector-readiness/validate/${providerId}`, { method: 'POST', token }),
};

export const socialOAuthApi = {
  connections: (token: string) => apiFetch<unknown>('/social-oauth/connections', { token }),
  start: (data: unknown, token: string) =>
    apiFetch<unknown>('/social-oauth/start', { method: 'POST', body: data, token }),
};

export const runtimeBridgesApi = {
  status: (token: string) => apiFetch<unknown>('/runtime-bridges/status', { token }),
  openClawOrchestrate: (data: unknown, token: string) =>
    apiFetch<unknown>('/runtime-bridges/openclaw/orchestrate', { method: 'POST', body: data, token }),
  agentScopeProcess: (data: unknown, token: string) =>
    apiFetch<unknown>('/runtime-bridges/agentscope/process', { method: 'POST', body: data, token }),
};

export const mcpRuntimeApi = {
  connectors: (token: string) => apiFetch<unknown[]>('/mcp-runtime/connectors', { token }),
  createConnector: (data: unknown, token: string) =>
    apiFetch<unknown>('/mcp-runtime/connectors', { method: 'POST', body: data, token }),
  discover: (data: unknown, token: string) =>
    apiFetch<unknown>('/mcp-runtime/discover', { method: 'POST', body: data, token }),
  discoveredTools: (id: string, token: string) =>
    apiFetch<unknown>(`/mcp-runtime/connectors/${id}/discovered-tools`, { token }),
  healthCheck: (id: string, token: string) =>
    apiFetch<unknown>(`/mcp-runtime/connectors/${id}/health-check`, { method: 'POST', token }),
  toolPreview: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/mcp-runtime/connectors/${id}/tool-preview`, { method: 'POST', body: data, token }),
};

export const leadsApi = {
  list: (token: string, filters?: Record<string, string>) => {
    const params = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return apiFetch<unknown[]>(`/leads${params}`, { token });
  },
  get: (id: string, token: string) => apiFetch<unknown>(`/leads/${id}`, { token }),
  create: (data: unknown, token: string) => apiFetch<unknown>('/leads', { method: 'POST', body: data, token }),
  update: (id: string, data: unknown, token: string) => apiFetch<unknown>(`/leads/${id}`, { method: 'PUT', body: data, token }),
  transition: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/leads/${id}/transition`, { method: 'POST', body: data, token }),
  recordMeeting: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/leads/${id}/meeting`, { method: 'POST', body: data, token }),
  recordPurchase: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/leads/${id}/purchase`, { method: 'POST', body: data, token }),
  setTemperature: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/leads/${id}/temperature`, { method: 'POST', body: data, token }),
  qualify: (id: string, token: string) => apiFetch<unknown>(`/leads/${id}/qualify`, { method: 'POST', token }),
  stats: (token: string) => apiFetch<unknown>('/leads/stats', { token }),
  sandboxExecution: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/crm-conversion/leads/${id}/sandbox-execution`, { method: 'POST', body: data, token }),
  whatsappStatus: (token: string) => apiFetch<unknown>('/crm-conversion/whatsapp/status', { token }),
  whatsappFollowUpPreview: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/crm-conversion/leads/${id}/whatsapp-follow-up-preview`, { method: 'POST', body: data, token }),
};

export const smartLabsApi = {
  status: (token: string) => apiFetch<unknown>('/smartlabs/status', { token }),
  testAgents: (token: string) => apiFetch<unknown>('/smartlabs/agents/test', { method: 'POST', token }),
  testVoices: (token: string) => apiFetch<unknown>('/smartlabs/voices/test', { method: 'POST', token }),
  conversation: (data: unknown, token: string) =>
    apiFetch<unknown>('/smartlabs/conversation', { method: 'POST', body: data, token }),
  textToSpeech: (data: unknown, token: string) =>
    apiFetch<unknown>('/smartlabs/text-to-speech', { method: 'POST', body: data, token }),
  leadHandoffPreview: (leadId: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/smartlabs/leads/${leadId}/handoff-preview`, { method: 'POST', body: data, token }),
};

export const smartLabsValidationApi = {
  summary: (token: string) => apiFetch<unknown>('/smartlabs-validation', { token }),
};

export const ghlApi = {
  status: (token: string) => apiFetch<unknown>('/ghl/status', { token }),
  wizardOptions: (token: string) => apiFetch<unknown>('/ghl/wizard-options', { token }),
  handoff: (leadId: string, token: string) => apiFetch<unknown>('/ghl/handoff', { method: 'POST', body: { leadId }, token }),
  sandboxContact: (data: unknown, token: string) => apiFetch<unknown>('/ghl/sandbox-contact', { method: 'POST', body: data, token }),
  push: (token: string) => apiFetch<unknown>('/ghl/push', { method: 'POST', token }),
};

export const ghlSetupApi = {
  wizard: (token: string) => apiFetch<unknown>('/ghl-setup/wizard', { token }),
  credentialStatus: (token: string) => apiFetch<unknown>('/ghl-setup/credential-status', { token }),
  mappingReadiness: (token: string) => apiFetch<unknown>('/ghl-setup/mapping-readiness', { token }),
  testConnection: (token: string) => apiFetch<unknown>('/ghl-setup/test-connection', { method: 'POST', token }),
  validateMappings: (token: string) => apiFetch<unknown>('/ghl-setup/validate-mappings', { method: 'POST', token }),
  liveValidation: (token: string) => apiFetch<unknown>('/ghl-setup/live-validation', { method: 'POST', token }),
  saveTags: (mappings: unknown[], token: string) =>
    apiFetch<unknown>('/ghl-setup/tags', { method: 'POST', body: { mappings }, token }),
  savePipelines: (mappings: unknown[], token: string) =>
    apiFetch<unknown>('/ghl-setup/pipelines', { method: 'POST', body: { mappings }, token }),
  saveLocation: (data: unknown, token: string) =>
    apiFetch<unknown>('/ghl-setup/location', { method: 'POST', body: data, token }),
  blockedWrite: (token: string) => apiFetch<unknown>('/ghl-setup/write', { method: 'POST', token }),
};

export const ghlSyncApi = {
  status: (token: string, eventId?: string) => apiFetch<unknown>(`/ghl-sync/status${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ''}`, { token }),
  pullPreview: (token: string, data: { eventId?: string; limit?: number }) => apiFetch<unknown>('/ghl-sync/pull-preview', { method: 'POST', body: data, token }),
  pullSync: (token: string, data: { eventId?: string; limit?: number }) => apiFetch<unknown>('/ghl-sync/pull-sync', { method: 'POST', body: data, token }),
  writeBackPreview: (token: string, data: { leadId: string }) => apiFetch<unknown>('/ghl-sync/write-back-preview', { method: 'POST', body: data, token }),
  writeBack: (token: string, data: { leadId: string }) => apiFetch<unknown>('/ghl-sync/write-back', { method: 'POST', body: data, token }),
};

export const kajabiApi = {
  status: (token: string) => apiFetch<unknown>('/kajabi/status', { token }),
  validateReadAccess: (token: string) => apiFetch<unknown>('/kajabi/validate-read-access', { method: 'POST', token }),
};

export const ideasApi = {
  generate: (data: unknown, token: string) => apiFetch<unknown>('/ideas/generate', { method: 'POST', body: data, token }),
  resumeWorkflow: (threadId: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/ideas/workflows/${threadId}/resume`, { method: 'POST', body: data, token }),
  convertToCampaign: (data: unknown, token: string) =>
    apiFetch<unknown>('/ideas/convert-to-campaign', { method: 'POST', body: data, token }),
};

export const socialGrowthApi = {
  summary: (token: string) => apiFetch<unknown>('/social-growth/summary', { token }),
  templates: (token: string) => apiFetch<unknown>('/social-growth/templates', { token }),
  createCampaignFromTemplate: (templateId: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/social-growth/templates/${templateId}/campaign`, { method: 'POST', body: data, token }),
  algorithmPack: (token: string) => apiFetch<unknown>('/social-growth/algorithm-pack', { token }),
};

export const eventsApi = {
  list: (token: string) => apiFetch<unknown[]>('/events', { token }),
  get: (id: string, token: string) => apiFetch<unknown>(`/events/${id}`, { token }),
  create: (data: unknown, token: string) => apiFetch<unknown>('/events', { method: 'POST', body: data, token }),
  update: (id: string, data: unknown, token: string) => apiFetch<unknown>(`/events/${id}`, { method: 'PUT', body: data, token }),
  transition: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/events/${id}/transition`, { method: 'POST', body: data, token }),
  dashboard: (id: string, token: string) => apiFetch<unknown>(`/events/${id}/dashboard`, { token }),
  campaigns: (id: string, token: string) => apiFetch<unknown[]>(`/events/${id}/campaigns`, { token }),
  leads: (id: string, token: string) => apiFetch<unknown[]>(`/events/${id}/leads`, { token }),
  createKpi: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/events/${id}/kpis`, { method: 'POST', body: data, token }),
  updateKpi: (eventId: string, kpiId: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/events/${eventId}/kpis/${kpiId}`, { method: 'PUT', body: data, token }),
};

export const connectorMappingsApi = {
  list: (token: string, connectorId?: string) => {
    const params = connectorId ? `?${new URLSearchParams({ connectorId }).toString()}` : '';
    return apiFetch<unknown[]>(`/connector-mappings${params}`, { token });
  },
  create: (data: unknown, token: string) =>
    apiFetch<unknown>('/connector-mappings', { method: 'POST', body: data, token }),
  update: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/connector-mappings/${id}`, { method: 'PUT', body: data, token }),
};

export const csvImportApi = {
  dryRun: (data: unknown, token: string) =>
    apiFetch<unknown>('/csv-import/dry-run', { method: 'POST', body: data, token }),
  approveImport: (data: unknown, token: string) =>
    apiFetch<unknown>('/csv-import/approve-import', { method: 'POST', body: data, token }),
};

export const eventPlannerApi = {
  emailPlans: (eventId: string, token: string) => apiFetch<unknown[]>(`/planner/events/${eventId}/email-plans`, { token }),
  createEmailPlan: (data: unknown, token: string) => apiFetch<unknown>('/planner/email-plans', { method: 'POST', body: data, token }),
  updateEmailPlan: (id: string, data: unknown, token: string) => apiFetch<unknown>(`/planner/email-plans/${id}`, { method: 'PUT', body: data, token }),
  whatsappPlans: (eventId: string, token: string) => apiFetch<unknown[]>(`/planner/events/${eventId}/whatsapp-plans`, { token }),
  createWhatsappPlan: (data: unknown, token: string) => apiFetch<unknown>('/planner/whatsapp-plans', { method: 'POST', body: data, token }),
  updateWhatsappPlan: (id: string, data: unknown, token: string) => apiFetch<unknown>(`/planner/whatsapp-plans/${id}`, { method: 'PUT', body: data, token }),
  upsellPlans: (eventId: string, token: string) => apiFetch<unknown[]>(`/planner/events/${eventId}/upsell-plans`, { token }),
  createUpsellPlan: (data: unknown, token: string) => apiFetch<unknown>('/planner/upsell-plans', { method: 'POST', body: data, token }),
  updateUpsellPlan: (id: string, data: unknown, token: string) => apiFetch<unknown>(`/planner/upsell-plans/${id}`, { method: 'PUT', body: data, token }),
  contentRequirements: (eventId: string, token: string) => apiFetch<unknown[]>(`/planner/events/${eventId}/content-requirements`, { token }),
  createContentRequirement: (data: unknown, token: string) => apiFetch<unknown>('/planner/content-requirements', { method: 'POST', body: data, token }),
  updateContentRequirement: (id: string, data: unknown, token: string) => apiFetch<unknown>(`/planner/content-requirements/${id}`, { method: 'PUT', body: data, token }),
  salesTasks: (eventId: string, token: string) => apiFetch<unknown[]>(`/planner/events/${eventId}/sales-tasks`, { token }),
  createSalesTask: (data: unknown, token: string) => apiFetch<unknown>('/planner/sales-tasks', { method: 'POST', body: data, token }),
  updateSalesTask: (id: string, data: unknown, token: string) => apiFetch<unknown>(`/planner/sales-tasks/${id}`, { method: 'PUT', body: data, token }),
};

export const masterEventsApi = {
  dashboard: (token: string, filters?: Record<string, string>) => {
    const params = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return apiFetch<unknown>(`/master-events/dashboard${params}`, { token });
  },
};

export const commercialCommandCenterApi = {
  dashboard: (token: string, filters?: Record<string, string>) => {
    const params = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return apiFetch<unknown>(`/commercial-command-center/dashboard${params}`, { token });
  },
  revenueLines: (token: string) => apiFetch<unknown[]>('/commercial-command-center/revenue-lines', { token }),
  revenueLineDashboard: (revenueLineType: string, token: string) =>
    apiFetch<unknown>(`/commercial-command-center/revenue-lines/${encodeURIComponent(revenueLineType)}/dashboard`, { token }),
  createRevenueLine: (data: unknown, token: string) =>
    apiFetch<unknown>('/commercial-command-center/revenue-lines', { method: 'POST', body: data, token }),
  plans: (token: string, filters?: Record<string, string>) => {
    const params = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return apiFetch<unknown[]>(`/commercial-command-center/plans${params}`, { token });
  },
  createPlan: (data: unknown, token: string) =>
    apiFetch<unknown>('/commercial-command-center/plans', { method: 'POST', body: data, token }),
  updatePlan: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/commercial-command-center/plans/${id}`, { method: 'PUT', body: data, token }),
  assessmentSignals: (token: string, filters?: Record<string, string>) => {
    const params = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return apiFetch<unknown[]>(`/commercial-command-center/assessment-signals${params}`, { token });
  },
  createAssessmentSignal: (data: unknown, token: string) =>
    apiFetch<unknown>('/commercial-command-center/assessment-signals', { method: 'POST', body: data, token }),
};

export const commercialAssessmentApi = {
  preview: (data: unknown, token: string) =>
    apiFetch<unknown>('/commercial-assessments/preview', { method: 'POST', body: data, token }),
  list: (token: string, filters?: Record<string, string>) => {
    const params = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return apiFetch<unknown[]>(`/commercial-assessments${params}`, { token });
  },
  create: (data: unknown, token: string) =>
    apiFetch<unknown>('/commercial-assessments', { method: 'POST', body: data, token }),
  get: (id: string, token: string) => apiFetch<unknown>(`/commercial-assessments/${id}`, { token }),
  generate: (id: string, token: string) =>
    apiFetch<unknown>(`/commercial-assessments/${id}/generate`, { method: 'POST', token }),
  decideFinding: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/commercial-assessments/findings/${id}/decision`, { method: 'POST', body: data, token }),
  learningSets: (token: string) => apiFetch<unknown[]>('/commercial-assessments/learning-sets', { token }),
};

export const annualCommercialPlanningApi = {
  list: (token: string, filters?: Record<string, string>) => {
    const params = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return apiFetch<unknown[]>(`/annual-commercial-plans${params}`, { token });
  },
  get: (id: string, token: string) => apiFetch<unknown>(`/annual-commercial-plans/${id}`, { token }),
  create: (data: unknown, token: string) => apiFetch<unknown>('/annual-commercial-plans', { method: 'POST', body: data, token }),
  update: (id: string, data: unknown, token: string) => apiFetch<unknown>(`/annual-commercial-plans/${id}`, { method: 'PUT', body: data, token }),
  transition: (id: string, transition: 'submit' | 'approve' | 'reject' | 'activate' | 'close' | 'archive', data: unknown, token: string) =>
    apiFetch<unknown>(`/annual-commercial-plans/${id}/${transition}`, { method: 'POST', body: data, token }),
  updateLearningSets: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/annual-commercial-plans/${id}/learning-sets`, { method: 'PUT', body: data, token }),
  createItem: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/annual-commercial-plans/${id}/items`, { method: 'POST', body: data, token }),
  updateItem: (id: string, itemId: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/annual-commercial-plans/${id}/items/${itemId}`, { method: 'PUT', body: data, token }),
  archiveItem: (id: string, itemId: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/annual-commercial-plans/${id}/items/${itemId}/archive`, { method: 'POST', body: data, token }),
};

export const commercialExecutiveApi = {
  dashboard: (token: string, filters?: Record<string, string>) => {
    const params = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return apiFetch<unknown>(`/commercial-executive/dashboard${params}`, { token });
  },
  reports: (token: string, filters?: Record<string, string>) => {
    const params = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return apiFetch<unknown[]>(`/commercial-executive/reports${params}`, { token });
  },
  createReportPreview: (data: unknown, token: string) =>
    apiFetch<unknown>('/commercial-executive/reports/preview', { method: 'POST', body: data, token }),
  schedules: (token: string, filters?: Record<string, string>) => {
    const params = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return apiFetch<unknown[]>(`/commercial-executive/schedules${params}`, { token });
  },
  createSchedule: (data: unknown, token: string) =>
    apiFetch<unknown>('/commercial-executive/schedules', { method: 'POST', body: data, token }),
};

export const commercialDisciplinesApi = {
  workspaces: (token: string) => apiFetch<unknown[]>('/commercial-disciplines/workspaces', { token }),
  records: (token: string, filters?: Record<string, string>) => {
    const params = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return apiFetch<unknown[]>(`/commercial-disciplines/records${params}`, { token });
  },
  createRecord: (data: unknown, token: string) =>
    apiFetch<unknown>('/commercial-disciplines/records', { method: 'POST', body: data, token }),
  updateRecord: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/commercial-disciplines/records/${id}`, { method: 'PUT', body: data, token }),
  context: (token: string, discipline?: string) =>
    apiFetch<unknown>(`/commercial-disciplines/context${discipline ? `?discipline=${encodeURIComponent(discipline)}` : ''}`, { token }),
};

export const eventProblemsApi = {
  list: (token: string, filters?: Record<string, string>) => {
    const params = filters ? `?${new URLSearchParams(filters).toString()}` : '';
    return apiFetch<unknown[]>(`/event-problems${params}`, { token });
  },
  dashboard: (eventId: string, token: string) => apiFetch<unknown>(`/event-problems/dashboard/${eventId}`, { token }),
  create: (data: unknown, token: string) => apiFetch<unknown>('/event-problems', { method: 'POST', body: data, token }),
  update: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/event-problems/${id}`, { method: 'PUT', body: data, token }),
  transition: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/event-problems/${id}/transition`, { method: 'POST', body: data, token }),
};

export const eventCloseoutApi = {
  report: (eventId: string, token: string) => apiFetch<unknown>(`/closeout/events/${eventId}/report`, { token }),
};

export const learningRecommendationsApi = {
  forEvent: (eventId: string, token: string) =>
    apiFetch<unknown>(`/learning-recommendations/events/${eventId}`, { token }),
};

export const stitchiApi = {
  conversations: (token: string, filters?: { eventId?: string; includeTenant?: boolean }) => {
    const params = new URLSearchParams();
    if (filters?.eventId) params.set('eventId', filters.eventId);
    if (filters?.includeTenant) params.set('includeTenant', 'true');
    const query = params.toString();
    return apiFetch<unknown[]>(`/stitchi/conversations${query ? `?${query}` : ''}`, { token });
  },
  createConversation: (data: unknown, token: string) =>
    apiFetch<unknown>('/stitchi/conversations', { method: 'POST', body: data, token }),
  messages: (conversationId: string, token: string) =>
    apiFetch<unknown[]>(`/stitchi/conversations/${conversationId}/messages`, { token }),
  actions: (conversationId: string, token: string) =>
    apiFetch<unknown[]>(`/stitchi/conversations/${conversationId}/actions`, { token }),
  orchestrate: (conversationId: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/stitchi/conversations/${conversationId}/orchestrate`, { method: 'POST', body: data, token }),
  respondStream: (
    conversationId: string,
    data: unknown,
    token: string,
    onEvent: (event: { event: string; data: unknown }) => void,
  ) => apiStream(`/stitchi/conversations/${conversationId}/respond/stream`, {
    method: 'POST',
    body: data,
    token,
    onEvent,
  }),
  approveAction: (actionId: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/stitchi/actions/${actionId}/approve`, { method: 'POST', body: data, token }),
  approveAndExecuteAction: (actionId: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/stitchi/actions/${actionId}/approve-and-execute`, { method: 'POST', body: data, token }),
  rejectAction: (actionId: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/stitchi/actions/${actionId}/reject`, { method: 'POST', body: data, token }),
  executeAction: (actionId: string, token: string) =>
    apiFetch<unknown>(`/stitchi/actions/${actionId}/execute`, { method: 'POST', token }),
};
