import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import { mcpRuntimeApi } from '../api';
import {
  DetailGrid,
  EmptyProductState,
  Field,
  MetricCard,
  Notice,
  PrimaryAction,
  ProductCard,
  ProductPage,
  ProductStatus,
  ProductTable,
  SecondaryAction,
} from '../components/ProductUI';

type RecordMap = Record<string, unknown>;

const CONNECTOR_TYPES = [
  { id: 'social_intelligence', label: 'Social Intelligence' },
  { id: 'postiz_scheduling', label: 'Postiz Scheduling' },
  { id: 'social_analytics', label: 'Social Analytics' },
  { id: 'gohighlevel_crm', label: 'GoHighLevel CRM' },
  { id: 'messaging', label: 'WhatsApp / Telegram Messaging' },
  { id: 'voice_chat', label: 'Voice / Chat Agent API' },
  { id: 'mcp_server', label: 'Generic MCP Server' },
  { id: 'asset_management', label: 'ResourceSpace / Assets' },
  { id: 'rendering', label: 'Rendering / Production' },
];

function text(value: unknown, fallback = 'Not configured'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function bool(value: unknown): boolean {
  return value === true;
}

function display(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function statusTone(status: string): 'good' | 'warn' | 'danger' | 'info' | 'default' {
  if (status === 'active') return 'good';
  if (status === 'planned') return 'info';
  if (status === 'suspended') return 'danger';
  if (status === 'inactive') return 'warn';
  return 'default';
}

export default function McpEngine() {
  const { token } = useAuth();
  const [connectors, setConnectors] = useState<RecordMap[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState('');
  const [healthResult, setHealthResult] = useState<RecordMap | null>(null);
  const [toolPreview, setToolPreview] = useState<RecordMap | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    connectorType: 'mcp_server',
    targetSystem: '',
    supportsRead: true,
    supportsWrite: false,
    credentialRequired: true,
    ownerSubstrate: '',
  });
  const [toolForm, setToolForm] = useState({
    toolName: '',
    operation: 'read',
  });

  const selectedConnector = useMemo(
    () => connectors.find(connector => String(connector.id) === selectedId) || connectors[0] || null,
    [connectors, selectedId],
  );

  async function load() {
    if (!token) return;
    const data = await mcpRuntimeApi.connectors(token);
    const next = data as RecordMap[];
    setConnectors(next);
    setSelectedId(current => current || String(next[0]?.id || ''));
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function run() {
      try {
        const data = await mcpRuntimeApi.connectors(token as string);
        if (cancelled) return;
        const next = data as RecordMap[];
        setConnectors(next);
        setSelectedId(current => current || String(next[0]?.id || ''));
      } catch (err) {
        if (!cancelled) setMessage(err instanceof Error ? err.message : 'Failed to load MCP connectors');
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function createConnector() {
    if (!token) return;
    setLoading('create');
    setMessage('');
    try {
      await mcpRuntimeApi.createConnector({
        name: form.name,
        description: form.description || undefined,
        connectorType: form.connectorType,
        targetSystem: form.targetSystem || form.name,
        status: 'planned',
        isExternal: true,
        supportsRead: form.supportsRead,
        supportsWrite: form.supportsWrite,
        m4Allowed: true,
        m5Allowed: false,
        credentialRequired: form.credentialRequired,
        ownerSubstrate: form.ownerSubstrate || undefined,
      }, token);
      setMessage(`${form.name} registered. Execution remains blocked until governed activation is implemented.`);
      setForm({ name: '', description: '', connectorType: 'mcp_server', targetSystem: '', supportsRead: true, supportsWrite: false, credentialRequired: true, ownerSubstrate: '' });
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to create connector');
    } finally {
      setLoading('');
    }
  }

  async function runHealthCheck(connectorId: string) {
    if (!token) return;
    setLoading(`health-${connectorId}`);
    setMessage('');
    setHealthResult(null);
    try {
      const result = await mcpRuntimeApi.mockHealthCheck(connectorId, token);
      setHealthResult(result as RecordMap);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Health check failed');
    } finally {
      setLoading('');
    }
  }

  async function previewTool() {
    if (!token || !selectedConnector) return;
    setLoading('preview');
    setMessage('');
    setToolPreview(null);
    try {
      const result = await mcpRuntimeApi.toolPreview(String(selectedConnector.id), {
        toolName: toolForm.toolName,
        operation: toolForm.operation,
        payloadSchema: {
          type: 'object',
          source: 'admin_tool_preview',
        },
      }, token);
      setToolPreview(result as RecordMap);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Tool preview failed');
    } finally {
      setLoading('');
    }
  }

  const writable = connectors.filter(connector => bool(connector.supportsWrite)).length;
  const credentialRequired = connectors.filter(connector => bool(connector.credentialRequired)).length;

  return (
    <ProductPage
      eyebrow="Admin"
      title="Integrations & MCP Connectors"
      subtitle="Register external surfaces, inspect safety policy, run non-executing health checks, and preview tool contracts without allowing live activation from the UI."
      action={<ProductStatus tone="warn">Live Activation Blocked</ProductStatus>}
    >
      {message && <Notice tone={message.toLowerCase().includes('failed') || message.toLowerCase().includes('error') ? 'danger' : 'good'}>{message}</Notice>}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Connectors" value={connectors.length} detail="Persisted registry records" tone="info" />
        <MetricCard label="Credential Required" value={credentialRequired} detail="Need secure setup" tone={credentialRequired ? 'warn' : 'good'} />
        <MetricCard label="Write-Capable" value={writable} detail="Still M5 disabled" tone={writable ? 'warn' : 'good'} />
        <MetricCard label="Live Activations" value="0" detail="Not available from UI" tone="good" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <ProductCard title="Add Connector" subtitle="Register an MCP or integration surface. This creates configuration only; it does not execute tools or enable external writes.">
          <div className="space-y-4">
            <Field label="Connector Name">
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Customer Postiz Sandbox" className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500" />
            </Field>
            <Field label="Connector Type">
              <select value={form.connectorType} onChange={(event) => setForm({ ...form, connectorType: event.target.value })} className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950">
                {CONNECTOR_TYPES.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
              </select>
            </Field>
            <Field label="Target System">
              <input value={form.targetSystem} onChange={(event) => setForm({ ...form, targetSystem: event.target.value })} placeholder="URL, product name, or MCP server alias" className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500" />
            </Field>
            <Field label="Description">
              <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="min-h-24 w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-sm">
                <input type="checkbox" checked={form.supportsRead} onChange={(event) => setForm({ ...form, supportsRead: event.target.checked })} />
                Supports read
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-sm">
                <input type="checkbox" checked={form.supportsWrite} onChange={(event) => setForm({ ...form, supportsWrite: event.target.checked })} />
                Has write actions
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-sm">
                <input type="checkbox" checked={form.credentialRequired} onChange={(event) => setForm({ ...form, credentialRequired: event.target.checked })} />
                Requires credentials
              </label>
            </div>
            {form.supportsWrite && (
              <Notice tone="warn">Write-capable connectors are registered as planned only. M5 and live activation remain disabled.</Notice>
            )}
            <PrimaryAction disabled={loading === 'create' || !form.name || !form.targetSystem} onClick={createConnector}>
              {loading === 'create' ? 'Registering...' : 'Register Connector'}
            </PrimaryAction>
          </div>
        </ProductCard>

        <div className="space-y-6">
          <ProductCard title="Connector Registry" subtitle="These records are loaded from the backend MCP registry.">
            {connectors.length ? (
              <ProductTable
                columns={['Connector', 'Type', 'Target', 'Policy', 'Credentials', 'Action']}
                rows={connectors.map(connector => [
                  <div>
                    <button type="button" onClick={() => setSelectedId(String(connector.id))} className="text-left font-medium text-neutral-950 hover:underline">
                      {text(connector.name)}
                    </button>
                    <div className="mt-1 text-xs text-neutral-500">{text(connector.description, 'No description')}</div>
                  </div>,
                  display(text(connector.connectorType)),
                  text(connector.targetSystem),
                  <div className="space-y-1">
                    <ProductStatus tone={statusTone(text(connector.status))}>{display(text(connector.status))}</ProductStatus>
                    {bool(connector.supportsWrite) && <ProductStatus tone="warn">Write Blocked</ProductStatus>}
                  </div>,
                  bool(connector.credentialRequired) ? 'Required' : 'Not required',
                  <SecondaryAction disabled={loading === `health-${connector.id}`} onClick={() => runHealthCheck(String(connector.id))}>
                    {loading === `health-${connector.id}` ? 'Checking...' : 'Mock Health Check'}
                  </SecondaryAction>,
                ])}
              />
            ) : (
              <EmptyProductState message="No connectors are registered yet. Add the first connector from the form." />
            )}
          </ProductCard>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <ProductCard title="Selected Connector" subtitle="Readiness and safety summary.">
              {selectedConnector ? (
                <DetailGrid items={[
                  { label: 'Name', value: text(selectedConnector.name) },
                  { label: 'Type', value: display(text(selectedConnector.connectorType)) },
                  { label: 'Target', value: text(selectedConnector.targetSystem) },
                  { label: 'Status', value: display(text(selectedConnector.status)) },
                  { label: 'Read', value: bool(selectedConnector.supportsRead) ? 'Allowed through mediation' : 'No' },
                  { label: 'Write', value: bool(selectedConnector.supportsWrite) ? 'Registered but blocked by policy' : 'No write actions' },
                  { label: 'M5', value: bool(selectedConnector.m5Allowed) ? 'Required but disabled' : 'Disabled' },
                  { label: 'Source of Truth', value: text(selectedConnector.sourceOfTruth, 'STITCH') },
                ]} />
              ) : (
                <EmptyProductState message="Select a connector to inspect." />
              )}
            </ProductCard>

            <ProductCard title="Tool Preview" subtitle="Register a UI planning preview only. No MCP tool is invoked.">
              <div className="space-y-4">
                <Field label="Tool Name">
                  <input value={toolForm.toolName} onChange={(event) => setToolForm({ ...toolForm, toolName: event.target.value })} placeholder="e.g. get_social_metrics" className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500" />
                </Field>
                <Field label="Operation">
                  <select value={toolForm.operation} onChange={(event) => setToolForm({ ...toolForm, operation: event.target.value })} className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950">
                    <option value="read">Read</option>
                    <option value="prepare">Prepare</option>
                    <option value="write">Write - Preview Only</option>
                  </select>
                </Field>
                <PrimaryAction disabled={!selectedConnector || !toolForm.toolName || loading === 'preview'} onClick={previewTool}>
                  {loading === 'preview' ? 'Previewing...' : 'Create Tool Preview'}
                </PrimaryAction>
                {toolPreview && (
                  <Notice tone="info">{text(toolPreview._label)} Executable: {String(toolPreview.executable)}</Notice>
                )}
              </div>
            </ProductCard>
          </div>

          {healthResult && (
            <Notice tone={healthResult.executionPerformed ? 'warn' : 'good'}>
              {text(healthResult._label)} Result: {text(healthResult.result)}.
            </Notice>
          )}
        </div>
      </div>
    </ProductPage>
  );
}
