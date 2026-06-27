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
  const [discoveredTools, setDiscoveredTools] = useState<RecordMap[]>([]);
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
  const [discoveryForm, setDiscoveryForm] = useState({
    name: '',
    endpointUrl: '',
    targetSystem: '',
    description: '',
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
      const result = await mcpRuntimeApi.healthCheck(connectorId, token);
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

  async function discoverRemoteMcp() {
    if (!token) return;
    setLoading('discover');
    setMessage('');
    setDiscoveredTools([]);
    try {
      const result = await mcpRuntimeApi.discover({
        name: discoveryForm.name,
        endpointUrl: discoveryForm.endpointUrl,
        targetSystem: discoveryForm.targetSystem,
        description: discoveryForm.description || undefined,
      }, token);
      const record = result as RecordMap;
      setMessage(text(record._label, 'Remote MCP tools discovered and stored.'));
      setDiscoveredTools(Array.isArray(record.tools) ? record.tools as RecordMap[] : []);
      setDiscoveryForm({ name: '', endpointUrl: '', targetSystem: '', description: '' });
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Remote MCP discovery failed');
    } finally {
      setLoading('');
    }
  }

  async function loadDiscoveredTools(connectorId: string) {
    if (!token) return;
    setLoading(`tools-${connectorId}`);
    setDiscoveredTools([]);
    try {
      const result = await mcpRuntimeApi.discoveredTools(connectorId, token);
      const record = result as RecordMap;
      setDiscoveredTools(Array.isArray(record.tools) ? record.tools as RecordMap[] : []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load discovered tools');
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
        <div className="space-y-6">
        <ProductCard title="Discover Remote MCP Server" subtitle="Connect to a Streamable HTTP MCP endpoint and import its tool list. No tools are invoked.">
          <div className="space-y-4">
            <Field label="Display Name">
              <input value={discoveryForm.name} onChange={(event) => setDiscoveryForm({ ...discoveryForm, name: event.target.value })} placeholder="e.g. Content Intelligence MCP" className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500" />
            </Field>
            <Field label="MCP Endpoint URL">
              <input value={discoveryForm.endpointUrl} onChange={(event) => setDiscoveryForm({ ...discoveryForm, endpointUrl: event.target.value })} placeholder="https://mcp.example.com/mcp" className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500" />
            </Field>
            <Field label="Target System">
              <input value={discoveryForm.targetSystem} onChange={(event) => setDiscoveryForm({ ...discoveryForm, targetSystem: event.target.value })} placeholder="Content Intelligence / GoHighLevel / Social Analytics" className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500" />
            </Field>
            <Field label="Description">
              <textarea value={discoveryForm.description} onChange={(event) => setDiscoveryForm({ ...discoveryForm, description: event.target.value })} className="min-h-20 w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500" />
            </Field>
            <Notice tone="info">Discovery performs a read-only tools/list call. Tool execution remains blocked behind STITCH, SAIF, MCP mediation, approval, and M5 policy.</Notice>
            <PrimaryAction disabled={loading === 'discover' || !discoveryForm.name || !discoveryForm.endpointUrl || !discoveryForm.targetSystem} onClick={discoverRemoteMcp}>
              {loading === 'discover' ? 'Discovering...' : 'Discover MCP Tools'}
            </PrimaryAction>
          </div>
        </ProductCard>

        <ProductCard title="Add Connector Manually" subtitle="Register an MCP or integration surface. This creates configuration only; it does not execute tools or enable external writes.">
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
        </div>

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
                  <div className="flex flex-wrap gap-2">
                    <SecondaryAction disabled={loading === `health-${connector.id}`} onClick={() => runHealthCheck(String(connector.id))}>
                      {loading === `health-${connector.id}` ? 'Checking...' : 'Health Check'}
                    </SecondaryAction>
                    <SecondaryAction disabled={loading === `tools-${connector.id}`} onClick={() => loadDiscoveredTools(String(connector.id))}>
                      {loading === `tools-${connector.id}` ? 'Loading...' : 'Tools'}
                    </SecondaryAction>
                  </div>,
                ])}
              />
            ) : (
              <EmptyProductState message="No connectors are registered yet. Add the first connector from the form." />
            )}
          </ProductCard>

          <ProductCard title="Discovered MCP Tools" subtitle="Persisted read-only tool metadata from remote MCP discovery or selected connector.">
            {discoveredTools.length ? (
              <ProductTable
                columns={['Tool', 'Description', 'Imported', 'Execution']}
                rows={discoveredTools.map(tool => [
                  <div className="font-medium text-neutral-950">{text(tool.toolName)}</div>,
                  <div className="text-sm leading-5 text-neutral-500">{text(tool.description, 'No description returned')}</div>,
                  <ProductStatus tone={tool.importedAsSkill ? 'good' : 'info'}>{tool.importedAsSkill ? 'Skill Imported' : 'Tool Discovered'}</ProductStatus>,
                  <ProductStatus tone="danger">Execution Blocked</ProductStatus>,
                ])}
              />
            ) : (
              <EmptyProductState message="No discovered tools loaded yet. Discover a remote MCP server or open Tools on a connector." />
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
