import { useEffect, useState } from 'react';
import { integrationStatusApi, postizApi, ghlApi } from '../api';
import { useAuth } from '../contexts/useAuth';
import { Alert, Card, StatusBadge } from '../components/UI';

type RecordMap = Record<string, unknown>;

function text(value: unknown, fallback = 'Not configured'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function statusVariant(value: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  const lower = value.toLowerCase();
  if (lower.includes('configured') || lower.includes('connected') || lower.includes('ready')) return 'success';
  if (lower.includes('missing') || lower.includes('requires')) return 'warning';
  if (lower.includes('blocked') || lower.includes('disabled')) return 'danger';
  return 'info';
}

export default function IntegrationCredentials() {
  const { token } = useAuth();
  const [status, setStatus] = useState<RecordMap | null>(null);
  const [postiz, setPostiz] = useState<RecordMap | null>(null);
  const [ghl, setGhl] = useState<RecordMap | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;
    Promise.all([
      integrationStatusApi.get(token),
      postizApi.status(token),
      ghlApi.status(token),
    ])
      .then(([integration, postizStatus, ghlStatus]) => {
        setStatus(integration as RecordMap);
        setPostiz(postizStatus as RecordMap);
        setGhl(ghlStatus as RecordMap);
      })
      .catch((err) => setMessage(err instanceof Error ? err.message : 'Failed to load integration status'));
  }, [token]);

  const connectors = Array.isArray(status?.connectors) ? status.connectors as RecordMap[] : [];
  const aiProvider = status?.aiProvider as RecordMap | undefined;
  const safety = status?.safety as RecordMap | undefined;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label="Secrets hidden" variant="success" />
          <StatusBadge label="Env/deployment only" variant="info" />
          <StatusBadge label="Live activation blocked from UI" variant="danger" />
        </div>
        <h1 className="mt-4 text-3xl font-semibold text-white">Integration Credential Control Plane</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          View provider and connector readiness without exposing raw secrets. Credentials must be configured in deployment secrets or VPS environment files.
        </p>
      </header>

      {message && <Alert type="warning">{message}</Alert>}

      <div className="grid gap-4 md:grid-cols-4">
        <StatusCard label="AI Provider" value={`${text(aiProvider?.provider)} / ${text(aiProvider?.model)}`} badge={text(aiProvider?.label, 'Unknown')} />
        <StatusCard label="Postiz" value={text(postiz?.status)} badge={text((postiz?.health as RecordMap | undefined)?.credentialStatus)} />
        <StatusCard label="GoHighLevel" value={text(ghl?._label)} badge={text(ghl?.apiKeyStatus)} />
        <StatusCard label="Execution" value={safety?.externalExecutionEnabled ? 'Enabled' : 'Blocked'} badge={safety?.m5WriteExecutionEnabled ? 'M5 Enabled' : 'M5 Disabled'} danger />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card title="Connector Credential Status">
          <div className="space-y-3">
            {connectors.map((connector) => (
              <div key={String(connector.id)} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{text(connector.name)}</div>
                    <div className="mt-1 text-xs text-slate-500">Policy: {text((connector.executionPolicy as RecordMap | undefined)?.label, 'Blocked')}</div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <StatusBadge label={text(connector.credentialStatus)} variant={statusVariant(text(connector.credentialStatus))} />
                    <StatusBadge label={text(connector.endpointStatus)} variant={statusVariant(text(connector.endpointStatus))} />
                  </div>
                </div>
              </div>
            ))}
            {connectors.length === 0 && <div className="text-sm text-slate-500">No connector status returned by backend.</div>}
          </div>
        </Card>

        <Card title="Deployment Secrets Needed">
          <div className="space-y-4 text-sm">
            <SecretGroup title="LLM Provider" items={['LLM_PROVIDER=openai|claude|mock', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'CLAUDE_API_KEY', 'CLAUDE_MODEL']} />
            <SecretGroup title="Postiz Sandbox" items={['POSTIZ_SANDBOX_URL', 'POSTIZ_API_KEY', 'POSTIZ_SANDBOX_INTEGRATION_ID', 'POSTIZ_SANDBOX_SCHEDULING_ENABLED=false by default']} />
            <SecretGroup title="GoHighLevel Sandbox" items={['GHL_API_KEY or GOHIGHLEVEL_API_KEY', 'GHL_LOCATION_ID', 'GHL_SANDBOX_WRITE_ENABLED=false by default']} />
            <SecretGroup title="Execution Gates" items={['DEMO_MODE=true blocks real writes', 'EXTERNAL_EXECUTION_ENABLED=false by default', 'M5_WRITE_EXECUTION_ENABLED=false by default']} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatusCard({ label, value, badge, danger }: { label: string; value: string; badge: string; danger?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-2 min-h-10 text-sm font-semibold text-white">{value}</div>
      <div className="mt-3">
        <StatusBadge label={badge} variant={danger ? 'danger' : statusVariant(`${value} ${badge}`)} />
      </div>
    </div>
  );
}

function SecretGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="font-semibold text-white">{title}</div>
      <div className="mt-2 space-y-1">
        {items.map((item) => (
          <div key={item} className="rounded-lg bg-slate-900 px-3 py-2 font-mono text-xs text-slate-400">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
