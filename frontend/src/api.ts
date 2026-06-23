const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error: ${res.status}`);
  }

  return res.json();
}

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<{ token: string; user: unknown; agentRep: unknown }>('/auth/login', { method: 'POST', body: { email, password } }),
  session: (token: string) =>
    apiFetch<{ user: unknown; agentRep: unknown }>('/auth/session', { token }),
};

// Campaigns
export const campaignsApi = {
  list: (token: string) =>
    apiFetch<unknown[]>('/campaigns', { token }),
  get: (id: string, token: string) =>
    apiFetch<unknown>(`/campaigns/${id}`, { token }),
  create: (data: unknown, token: string) =>
    apiFetch<unknown>('/campaigns', { method: 'POST', body: data, token }),
  transition: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/campaigns/${id}/transition`, { method: 'POST', body: data, token }),
};

// AI Generation
export const aiGenerationApi = {
  generate: (data: unknown, token: string) =>
    apiFetch<unknown>('/ai-generation/generate', { method: 'POST', body: data, token }),
  revise: (data: unknown, token: string) =>
    apiFetch<unknown>('/ai-generation/revise', { method: 'POST', body: data, token }),
};

// Algorithm Intelligence
export const algoApi = {
  score: (data: unknown, token: string) =>
    apiFetch<unknown>('/algo/score', { method: 'POST', body: data, token }),
  rules: (token: string) =>
    apiFetch<unknown[]>('/algo/rules', { token }),
};

// Approvals
export const approvalsApi = {
  list: (token: string, filters?: Record<string, string>) => {
    const params = filters ? '?' + new URLSearchParams(filters).toString() : '';
    return apiFetch<unknown[]>(`/approvals${params}`, { token });
  },
  get: (id: string, token: string) =>
    apiFetch<unknown>(`/approvals/${id}`, { token }),
  submit: (data: unknown, token: string) =>
    apiFetch<unknown>('/approvals', { method: 'POST', body: data, token }),
  approve: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/approvals/${id}/approve`, { method: 'POST', body: data, token }),
  reject: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/approvals/${id}/reject`, { method: 'POST', body: data, token }),
  requestChanges: (id: string, data: unknown, token: string) =>
    apiFetch<unknown>(`/approvals/${id}/request-changes`, { method: 'POST', body: data, token }),
};

// Publishing Preparation
export const publishingPrepApi = {
  listPackages: (token: string, filters?: Record<string, string>) => {
    const params = filters ? '?' + new URLSearchParams(filters).toString() : '';
    return apiFetch<unknown[]>(`/publishing-prep/packages${params}`, { token });
  },
  getPackage: (id: string, token: string) =>
    apiFetch<unknown>(`/publishing-prep/packages/${id}`, { token }),
  getReadiness: (id: string, token: string) =>
    apiFetch<unknown[]>(`/publishing-prep/packages/${id}/readiness`, { token }),
};

// Analytics
export const analyticsApi = {
  sources: (token: string) =>
    apiFetch<unknown[]>('/analytics/sources', { token }),
  snapshots: (token: string) =>
    apiFetch<unknown[]>('/analytics/snapshots', { token }),
  reports: (token: string, filters?: Record<string, string>) => {
    const params = filters ? '?' + new URLSearchParams(filters).toString() : '';
    return apiFetch<unknown[]>(`/analytics/reports${params}`, { token });
  },
  demo: (token: string) =>
    apiFetch<unknown>('/analytics/demo', { token }),
};

// SPINE
export const spineApi = {
  runs: (token: string, filters?: Record<string, string>) => {
    const params = filters ? '?' + new URLSearchParams(filters).toString() : '';
    return apiFetch<unknown[]>(`/spine/runs${params}`, { token });
  },
  getRun: (id: string, token: string) =>
    apiFetch<unknown>(`/spine/runs/${id}`, { token }),
  artifacts: (runId: string, token: string) =>
    apiFetch<unknown[]>(`/spine/runs/${runId}/artifacts`, { token }),
};

// Observability
export const observabilityApi = {
  events: (token: string, filters?: Record<string, string>) => {
    const params = filters ? '?' + new URLSearchParams(filters).toString() : '';
    return apiFetch<unknown[]>(`/observability/events${params}`, { token });
  },
  audit: (token: string, filters?: Record<string, string>) => {
    const params = filters ? '?' + new URLSearchParams(filters).toString() : '';
    return apiFetch<unknown[]>(`/observability/audit${params}`, { token });
  },
  learningSignals: (token: string) =>
    apiFetch<unknown[]>('/observability/learning-signals', { token }),
};

// Users
export const usersApi = {
  list: (token: string) =>
    apiFetch<unknown[]>('/users', { token }),
  me: (token: string) =>
    apiFetch<unknown>('/users/me', { token }),
};

// AI Provider
export const aiProviderApi = {
  status: (token: string) =>
    apiFetch<unknown>('/ai-provider/status', { token }),
  active: (token: string) =>
    apiFetch<unknown>('/ai-provider/active', { token }),
};

// Demo
export const demoApi = {
  status: (token: string) =>
    apiFetch<unknown>('/demo/status', { token }),
  auditTrail: (token: string) =>
    apiFetch<unknown[]>('/demo/audit-trail', { token }),
  leads: (token: string) =>
    apiFetch<unknown[]>('/demo/leads', { token }),
};

// Publishing Package
export const publishingPackageApi = {
  create: (data: unknown, token: string) =>
    apiFetch<unknown>('/publishing-package/create', { method: 'POST', body: data, token }),
  list: (token: string) =>
    apiFetch<unknown[]>('/publishing-package/list', { token }),
};
