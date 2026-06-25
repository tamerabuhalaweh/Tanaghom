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
          : Array.isArray(err.reasons)
            ? err.reasons.join('; ')
            : `API error: ${res.status}`;
    throw new Error(detail);
  }

  return res.json();
}

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<{ token: string; user: unknown; agentRep: unknown }>('/auth/login', { method: 'POST', body: { email, password } }),
  session: (token: string) =>
    apiFetch<unknown>('/auth/session', { token }),
  createOnboardingToken: (data: unknown, token: string) =>
    apiFetch<unknown>('/auth/onboarding-token', { method: 'POST', body: data, token }),
  onboardingEmailStatus: (token: string) =>
    apiFetch<unknown>('/auth/onboarding-email-status', { token }),
  acceptOnboarding: (data: unknown) =>
    apiFetch<unknown>('/auth/accept-onboarding', { method: 'POST', body: data }),
};

export const campaignsApi = {
  list: (token: string) => apiFetch<unknown[]>('/campaigns', { token }),
  get: (id: string, token: string) => apiFetch<unknown>(`/campaigns/${id}`, { token }),
  create: (data: unknown, token: string) => apiFetch<unknown>('/campaigns', { method: 'POST', body: data, token }),
  transition: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/campaigns/${id}/transition`, { method: 'POST', body: data, token }),
};

export const aiGenerationApi = {
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
  schedulePayload: (data: unknown, token: string) =>
    apiFetch<unknown>('/postiz/schedule-payload', { method: 'POST', body: data, token }),
  sandboxSchedule: (data: unknown, token: string) =>
    apiFetch<unknown>('/postiz/sandbox-schedule', { method: 'POST', body: data, token }),
};

export const adminUsersApi = {
  list: (token: string) => apiFetch<unknown[]>('/admin/users', { token }),
  create: (data: unknown, token: string) => apiFetch<unknown>('/admin/users', { method: 'POST', body: data, token }),
  update: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/admin/users/${id}`, { method: 'PUT', body: data, token }),
  deactivate: (id: string, token: string) => apiFetch<unknown>(`/admin/users/${id}/deactivate`, { method: 'POST', token }),
  activate: (id: string, token: string) => apiFetch<unknown>(`/admin/users/${id}/activate`, { method: 'POST', token }),
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

export const integrationCredentialsApi = {
  list: (token: string) => apiFetch<unknown>('/integration-credentials', { token }),
  requirements: (token: string) => apiFetch<unknown>('/integration-credentials/requirements', { token }),
  matrix: (token: string) => apiFetch<unknown>('/integration-credentials/matrix', { token }),
  save: (data: unknown, token: string) =>
    apiFetch<unknown>('/integration-credentials', { method: 'POST', body: data, token }),
  disable: (id: string, token: string) =>
    apiFetch<unknown>(`/integration-credentials/${id}`, { method: 'DELETE', token }),
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
  list: (token: string) => apiFetch<unknown[]>('/leads', { token }),
  create: (data: unknown, token: string) => apiFetch<unknown>('/leads', { method: 'POST', body: data, token }),
  qualify: (id: string, token: string) => apiFetch<unknown>(`/leads/${id}/qualify`, { method: 'POST', token }),
  stats: (token: string) => apiFetch<unknown>('/leads/stats', { token }),
  sandboxExecution: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/crm-conversion/leads/${id}/sandbox-execution`, { method: 'POST', body: data, token }),
};

export const ghlApi = {
  status: (token: string) => apiFetch<unknown>('/ghl/status', { token }),
  wizardOptions: (token: string) => apiFetch<unknown>('/ghl/wizard-options', { token }),
  handoff: (leadId: string, token: string) => apiFetch<unknown>('/ghl/handoff', { method: 'POST', body: { leadId }, token }),
  sandboxContact: (data: unknown, token: string) => apiFetch<unknown>('/ghl/sandbox-contact', { method: 'POST', body: data, token }),
  push: (token: string) => apiFetch<unknown>('/ghl/push', { method: 'POST', token }),
};

export const ideasApi = {
  generate: (data: unknown, token: string) => apiFetch<unknown>('/ideas/generate', { method: 'POST', body: data, token }),
  resumeWorkflow: (threadId: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/ideas/workflows/${threadId}/resume`, { method: 'POST', body: data, token }),
  convertToCampaign: (data: unknown, token: string) =>
    apiFetch<unknown>('/ideas/convert-to-campaign', { method: 'POST', body: data, token }),
};
