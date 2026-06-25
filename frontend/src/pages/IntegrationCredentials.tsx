import { useEffect, useState } from 'react';
import { ghlApi, integrationStatusApi, postizApi } from '../api';
import { useAuth } from '../contexts/useAuth';
import {
  DetailGrid,
  EmptyProductState,
  MetricCard,
  Notice,
  ProductCard,
  ProductPage,
  ProductStatus,
  ProductTable,
} from '../components/ProductUI';

type RecordMap = Record<string, unknown>;

function text(value: unknown, fallback = 'Not configured'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function bool(value: unknown): boolean {
  return value === true;
}

function display(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function statusTone(value: string): 'good' | 'warn' | 'danger' | 'info' | 'default' {
  const lower = value.toLowerCase();
  if (lower.includes('configured') || lower.includes('ready')) return 'good';
  if (lower.includes('missing') || lower.includes('requires')) return 'warn';
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
    let cancelled = false;
    Promise.all([
      integrationStatusApi.get(token),
      postizApi.status(token),
      ghlApi.status(token),
    ])
      .then(([integration, postizStatus, ghlStatus]) => {
        if (cancelled) return;
        setStatus(integration as RecordMap);
        setPostiz(postizStatus as RecordMap);
        setGhl(ghlStatus as RecordMap);
      })
      .catch((err) => {
        if (!cancelled) setMessage(err instanceof Error ? err.message : 'Failed to load integration status');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const connectors = Array.isArray(status?.connectors) ? status.connectors as RecordMap[] : [];
  const aiProvider = status?.aiProvider as RecordMap | undefined;
  const configuredConnectors = connectors.filter(connector => text(connector.credentialStatus).toLowerCase().includes('configured')).length;

  return (
    <ProductPage
      eyebrow="Admin"
      title="Credentials & Readiness"
      subtitle="Review credential status without exposing secrets. LLM credentials are user-owned; most integration credentials are still deployment-level until the tenant integration vault is implemented."
      action={<ProductStatus tone="good">Secrets Hidden</ProductStatus>}
    >
      {message && <Notice tone="danger">{message}</Notice>}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="AI Provider" value={text(aiProvider?.provider, 'mock')} detail={text(aiProvider?.label, 'Status loaded from backend')} tone={statusTone(text(aiProvider?.label))} />
        <MetricCard label="Postiz" value={text(postiz?.status)} detail={text((postiz?.health as RecordMap | undefined)?.credentialStatus)} tone={statusTone(`${text(postiz?.status)} ${text((postiz?.health as RecordMap | undefined)?.credentialStatus)}`)} />
        <MetricCard label="GoHighLevel" value={text(ghl?._label)} detail={text(ghl?.apiKeyStatus)} tone={statusTone(`${text(ghl?._label)} ${text(ghl?.apiKeyStatus)}`)} />
        <MetricCard label="Connector Credentials" value={`${configuredConnectors}/${connectors.length}`} detail="Configured from backend status" tone={configuredConnectors === connectors.length && connectors.length > 0 ? 'good' : 'warn'} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <ProductCard title="Connector Credential Status" subtitle="Status only. Raw tokens, API keys, and secrets are never displayed.">
          {connectors.length ? (
            <ProductTable
              columns={['Connector', 'Credential', 'Endpoint', 'Execution Policy']}
              rows={connectors.map(connector => {
                const policy = (connector.executionPolicy || {}) as RecordMap;
                return [
                  <div>
                    <div className="font-medium text-neutral-950">{text(connector.name)}</div>
                    <div className="mt-1 text-xs text-neutral-500">{text(connector.id)}</div>
                  </div>,
                  <ProductStatus tone={statusTone(text(connector.credentialStatus))}>{display(text(connector.credentialStatus))}</ProductStatus>,
                  <ProductStatus tone={statusTone(text(connector.endpointStatus))}>{display(text(connector.endpointStatus))}</ProductStatus>,
                  <div>
                    <ProductStatus tone={bool(policy.allowed) ? 'warn' : 'danger'}>{text(policy.label, 'Blocked')}</ProductStatus>
                    <div className="mt-1 text-xs text-neutral-500">{text(policy.reason, text(policy.reasons))}</div>
                  </div>,
                ];
              })}
            />
          ) : (
            <EmptyProductState message="No connector status returned by backend." />
          )}
        </ProductCard>

        <ProductCard title="Credential Model" subtitle="What is real now and what still needs production vault work.">
          <div className="space-y-4">
            <DetailGrid items={[
              { label: 'LLM Keys', value: 'User-owned encrypted credentials are supported.' },
              { label: 'Postiz', value: 'Deployment/sandbox env credentials are checked; tenant UI vault is not complete.' },
              { label: 'GoHighLevel', value: 'Sandbox env credentials are checked; tenant UI vault is not complete.' },
              { label: 'Messaging / Voice', value: 'Credential status is read-only until tenant vault is implemented.' },
            ]} />
            <Notice tone="warn">
              Remaining production gap: implement tenant integration credential vault for Postiz, GHL, WhatsApp, Telegram, voice/chat, and social API OAuth. Do not mark this as fixed yet.
            </Notice>
          </div>
        </ProductCard>
      </div>

      <ProductCard title="Deployment Secret Names" subtitle="Current deployment-level configuration requirements.">
        <ProductTable
          columns={['Area', 'Required Variables']}
          rows={[
            ['LLM Provider', 'OPENAI_API_KEY / OPENAI_MODEL / CLAUDE_API_KEY / CLAUDE_MODEL, or user-owned credentials from AI Provider page'],
            ['Postiz Sandbox', 'POSTIZ_SANDBOX_URL / POSTIZ_API_KEY / POSTIZ_SANDBOX_INTEGRATION_ID / POSTIZ_SANDBOX_SCHEDULING_ENABLED=false by default'],
            ['GoHighLevel Sandbox', 'GHL_API_KEY or GOHIGHLEVEL_API_KEY / GHL_LOCATION_ID / GHL_SANDBOX_WRITE_ENABLED=false by default'],
            ['Execution Gates', 'DEMO_MODE / EXTERNAL_EXECUTION_ENABLED / M5_WRITE_EXECUTION_ENABLED / CRM_LIVE_ENABLED'],
          ]}
        />
      </ProductCard>
    </ProductPage>
  );
}
