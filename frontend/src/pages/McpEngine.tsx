import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import { Card, StatusBadge, Alert, DemoLabel } from '../components/UI';
import { MCP_CONNECTORS } from '../modules/mcp-engine/registry-data';
import { mcpRuntimeApi } from '../api';

interface RuntimeConnector {
  id: string;
  name: string;
  description?: string;
  purpose?: string;
  targetSystem?: string;
  connectorType?: string;
  status: string;
  supportsRead?: boolean;
  supportsWrite?: boolean;
  m5Allowed?: boolean;
  credentialRequired?: boolean;
  credentialStatus?: string;
  sourceOfTruth?: string;
  executionPolicy?: {
    allowed: boolean;
    reason: string;
    label: string;
  };
}

interface HealthResult {
  connectorId: string;
  name: string;
  result: string;
  executionPerformed: boolean;
  _label: string;
}

export default function McpEngine() {
  const { token } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [connectors, setConnectors] = useState<RuntimeConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<HealthResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadConnectors() {
      if (!token) return;
      setLoading(true);
      setError('');
      try {
        const data = await mcpRuntimeApi.connectors(token) as RuntimeConnector[];
        if (!cancelled) setConnectors(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load runtime connectors');
          setConnectors([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadConnectors();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const displayConnectors = useMemo<RuntimeConnector[]>(() => {
    if (connectors.length > 0) return connectors;
    return MCP_CONNECTORS.map((connector) => ({
      id: connector.id,
      name: connector.name,
      purpose: connector.purpose,
      targetSystem: connector.boundCapability,
      status: connector.status,
      supportsRead: connector.direction === 'read_only' || connector.direction === 'prepare_only',
      supportsWrite: connector.direction === 'write_blocked',
      m5Allowed: connector.requiresM5,
      credentialRequired: connector.envVars.length > 0,
      credentialStatus: connector.credentialStatus,
      sourceOfTruth: connector.sourceOfTruth,
      executionPolicy: {
        allowed: false,
        reason: 'Registry fallback only. Backend connector record not loaded.',
        label: 'Blocked',
      },
    }));
  }, [connectors]);

  const selectedConnector = displayConnectors.find((connector) => connector.id === selected);

  const handleTestConnection = async (id: string) => {
    if (!token) return;
    setTesting(id);
    setTestResult(null);
    setError('');
    try {
      const result = await mcpRuntimeApi.mockHealthCheck(id, token) as HealthResult;
      setTestResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mock health check failed');
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <DemoLabel>STITCH-Mediated Runtime</DemoLabel>
            <StatusBadge label="External Execution Blocked" variant="danger" />
            <StatusBadge label="M5 Disabled" variant="danger" />
          </div>
          <h1 className="mt-4 text-3xl font-semibold text-white">MCP Engine & Integration Registry</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Register integration surfaces, inspect credential readiness, and test mock connector health without letting tools become the source of truth or execute outside STITCH.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <SummaryTile label="Runtime Connectors" value={String(displayConnectors.length)} />
          <SummaryTile label="Backend Source" value={connectors.length > 0 ? 'Live registry' : 'Fallback'} />
          <SummaryTile label="Writable Allowed" value="0" />
          <SummaryTile label="Live Activation" value="Blocked" />
        </div>
      </div>

      {error && <Alert type="warning">{error}</Alert>}
      {loading && <Alert type="info">Loading backend MCP registry...</Alert>}

      <Alert type="info">
        <strong>Product rule:</strong> MCP servers can import skills and connector metadata, but STITCH remains source of truth.
        Any external action must pass capability resolution, SAIF/approval, MCP mediation, and environment kill switches.
      </Alert>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <h2 className="font-semibold text-slate-300">Connectors</h2>
          {displayConnectors.map((connector) => (
            <Card key={connector.id} className={`cursor-pointer transition-all ${selected === connector.id ? 'ring-2 ring-sky-500' : ''}`}>
              <div onClick={() => setSelected(connector.id === selected ? null : connector.id)}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-white">{connector.name}</h3>
                    <p className="mt-1 text-sm text-slate-400">{connector.description || connector.purpose || connector.targetSystem}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <StatusBadge label={normalizeStatus(connector.status)} variant={statusVariant(connector.status)} />
                    <StatusBadge label={connector.executionPolicy?.label || 'Blocked'} variant={connector.executionPolicy?.allowed ? 'warning' : 'danger'} />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-xs text-slate-500 md:grid-cols-4">
                  <span>Source: {connector.sourceOfTruth || 'STITCH'}</span>
                  <span>Credentials: {connector.credentialStatus || (connector.credentialRequired ? 'requires_credentials' : 'not_required')}</span>
                  <span>Read: {connector.supportsRead ? 'Yes' : 'No'}</span>
                  <span>Write: {connector.supportsWrite ? 'Blocked' : 'No'}</span>
                </div>
              </div>

              {selected === connector.id && selectedConnector && (
                <div className="mt-5 space-y-4 border-t border-slate-800 pt-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <PolicyBox label="M5" value={selectedConnector.m5Allowed ? 'Required but disabled' : 'Not allowed'} danger={Boolean(selectedConnector.m5Allowed)} />
                    <PolicyBox label="External Execution" value={selectedConnector.executionPolicy?.allowed ? 'Policy allowed' : 'Blocked'} danger={!selectedConnector.executionPolicy?.allowed} />
                    <PolicyBox label="Live Activation" value="Not available from UI" danger />
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm">
                    <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Policy Reason</div>
                    <p className="mt-2 text-slate-300">{selectedConnector.executionPolicy?.reason || 'Connector execution must be mediated by STITCH.'}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleTestConnection(selectedConnector.id)}
                    disabled={testing === selectedConnector.id || connectors.length === 0}
                    className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {testing === selectedConnector.id ? 'Testing...' : 'Run Mock Health Check'}
                  </button>

                  {testResult && testResult.connectorId === selectedConnector.id && (
                    <Alert type={testResult.executionPerformed ? 'warning' : 'success'}>
                      {testResult._label} | Result: {testResult.result}
                    </Alert>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>

        <aside className="space-y-4">
          <Card title="Safety Gates">
            <div className="space-y-2 text-xs text-slate-400">
              <div>External API calls: blocked by default</div>
              <div>Postiz scheduling: sandbox gated</div>
              <div>CRM writes: blocked unless authorized</div>
              <div>WhatsApp/Telegram: blocked unless authorized</div>
              <div>Voice/chat trigger: blocked unless authorized</div>
              <div>Tool source of truth: never</div>
            </div>
          </Card>

          <Card title="Runtime Pattern">
            <div className="rounded-xl bg-slate-900 p-3 font-mono text-xs leading-6 text-slate-300">
              STITCH Core<br />
              - Capability Resolution<br />
              - SAIF / Approval<br />
              - MCP Mediation<br />
              - Connector / Gateway<br />
              - External System
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function PolicyBox({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${danger ? 'border-red-500/30 bg-red-500/10' : 'border-emerald-500/30 bg-emerald-500/10'}`}>
      <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</div>
      <div className={danger ? 'mt-1 text-sm font-semibold text-red-200' : 'mt-1 text-sm font-semibold text-emerald-200'}>{value}</div>
    </div>
  );
}

function normalizeStatus(status: string): string {
  return status.replaceAll('_', ' ');
}

function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'info' | 'mock' | 'default' {
  if (status === 'active' || status === 'sandbox_ready') return 'success';
  if (status === 'mock') return 'mock';
  if (status === 'planned') return 'default';
  if (status === 'blocked') return 'danger';
  return 'info';
}
