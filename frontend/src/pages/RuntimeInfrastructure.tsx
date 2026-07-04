import { useEffect, useMemo, useState } from 'react';
import { runtimeBridgesApi } from '../api';
import { useAuth } from '../contexts/useAuth';
import {
  DetailGrid,
  EmptyProductState,
  MetricCard,
  Notice,
  PrimaryAction,
  ProductCard,
  ProductPage,
  ProductStatus,
  ProductTable,
} from '../components/ProductUI';

type RecordMap = Record<string, unknown>;

function text(value: unknown, fallback = 'Not available'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function bool(value: unknown): boolean {
  return value === true;
}

function display(value: unknown): string {
  return text(value, 'Unknown').replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function asRows(value: unknown): RecordMap[] {
  return Array.isArray(value) ? value.filter((item): item is RecordMap => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : [];
}

export default function RuntimeInfrastructure() {
  const { token } = useAuth();
  const [status, setStatus] = useState<RecordMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const result = await runtimeBridgesApi.status(token);
      setStatus(result as RecordMap);
      setMessage('');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load runtime infrastructure evidence');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const result = await runtimeBridgesApi.status(token as string);
        if (cancelled) return;
        setStatus(result as RecordMap);
        setMessage('');
      } catch (err) {
        if (!cancelled) setMessage(err instanceof Error ? err.message : 'Failed to load runtime infrastructure evidence');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const runtimes = useMemo(() => asRows(status?.statuses), [status]);
  const configuredCount = runtimes.filter(runtime => bool(runtime.configured)).length;
  const reachableCount = runtimes.filter(runtime => bool(runtime.reachable)).length;
  const activeCount = runtimes.filter(runtime => bool(runtime.productionActive)).length;
  const allSecretsHidden = runtimes.every(runtime => runtime.rawSecretsReturned === false);
  const flags = runtimes.flatMap(runtime =>
    asRows(runtime.flags).map(flag => ({
      runtime: text(runtime.displayName, display(runtime.provider)),
      name: text(flag.name),
      enabled: bool(flag.enabled),
      purpose: text(flag.purpose),
    })),
  );

  return (
    <ProductPage
      eyebrow="Admin / Ops"
      title="Runtime Infrastructure Evidence"
      subtitle="Internal-only evidence for OpenClaw, agentgateway, and AgentScope. These services are not customer business connectors and are not production runtime infrastructure until a governed pilot is accepted."
      action={<ProductStatus tone={activeCount > 0 ? 'warn' : 'info'}>{activeCount > 0 ? 'Pilot Gate Review Required' : 'Not Production Active'}</ProductStatus>}
    >
      {message && <Notice tone="danger">{message}</Notice>}

      <Notice tone="warn">
        This page is for Admin/Ops only. It does not activate workflows, does not route connector traffic, and does not prove production readiness by itself.
        Tanaghum/STITCH remains the source of truth for tenant data, approvals, audit, and business state.
      </Notice>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Runtime Services" value={`${runtimes.length}/3`} detail="OpenClaw, agentgateway, AgentScope evidence rows" tone={runtimes.length === 3 ? 'info' : 'warn'} />
        <MetricCard label="Configured" value={`${configuredCount}/${runtimes.length || 3}`} detail="Tenant runtime endpoint credentials" tone={configuredCount > 0 ? 'warn' : 'info'} />
        <MetricCard label="Reachable" value={`${reachableCount}/${runtimes.length || 3}`} detail="Live health check result" tone={reachableCount > 0 ? 'warn' : 'info'} />
        <MetricCard label="Production Active" value={activeCount} detail="Must stay zero until a pilot is approved" tone={activeCount > 0 ? 'danger' : 'good'} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.6fr)]">
        <ProductCard
          title="Runtime Bridge Evidence"
          subtitle="Configured/reachable means the runtime endpoint exists. It does not mean Tanaghum is using it for customer workflows."
          action={<PrimaryAction onClick={load} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh Evidence'}</PrimaryAction>}
        >
          {runtimes.length ? (
            <ProductTable
              columns={['Runtime', 'Credential', 'Health', 'Execution Flag', 'Production', 'Last Check']}
              rows={runtimes.map(runtime => {
                const runtimeFlags = asRows(runtime.flags);
                const flagSummary = runtimeFlags.length
                  ? runtimeFlags.map(flag => `${text(flag.name)}: ${bool(flag.enabled) ? 'on' : 'off'}`).join(', ')
                  : 'No flag configured';
                return [
                  <div>
                    <div className="font-medium text-neutral-950">{text(runtime.displayName, display(runtime.provider))}</div>
                    <div className="mt-1 text-xs leading-5 text-neutral-500">{text(runtime.intendedRole)}</div>
                  </div>,
                  <ProductStatus tone={runtime.configured ? 'good' : 'warn'}>{runtime.configured ? 'Configured' : 'Requires Credentials'}</ProductStatus>,
                  <div>
                    <ProductStatus tone={runtime.reachable ? 'good' : 'warn'}>{runtime.reachable ? 'Reachable' : 'Not Reachable'}</ProductStatus>
                    <div className="mt-1 text-xs text-neutral-500">{text(runtime.label)}</div>
                  </div>,
                  <ProductStatus tone={flagSummary.includes(': on') ? 'warn' : 'info'}>{flagSummary}</ProductStatus>,
                  <ProductStatus tone={runtime.productionActive ? 'danger' : 'good'}>{runtime.productionActive ? 'Runtime Active' : 'Not Active'}</ProductStatus>,
                  <div className="text-xs leading-5 text-neutral-500">{text(runtime.lastCheckedAt)}</div>,
                ];
              })}
            />
          ) : (
            <EmptyProductState message="Runtime infrastructure evidence has not loaded yet." />
          )}
        </ProductCard>

        <ProductCard title="Governance Boundary" subtitle="What this page proves and what it does not.">
          <DetailGrid items={[
            { label: 'Source Of Truth', value: text(status?.sourceOfTruth, 'STITCH') },
            { label: 'Customer Facing', value: status?.customerFacing === false ? 'No' : 'Review required' },
            { label: 'Raw Secrets Returned', value: allSecretsHidden ? 'No' : 'Review required' },
            { label: 'Execution Controls', value: 'No direct execution buttons in R1' },
            { label: 'Production Meaning', value: 'Evidence only, not readiness approval' },
            { label: 'Current Label', value: text(status?._label) },
          ]} />
        </ProductCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ProductCard title="Current Blockers" subtitle="These must be cleared before any runtime is called production-ready.">
          {runtimes.length ? (
            <ProductTable
              columns={['Runtime', 'Current Blocker', 'Next Production Gate']}
              rows={runtimes.map(runtime => [
                <div className="font-medium text-neutral-950">{text(runtime.displayName, display(runtime.provider))}</div>,
                <div className="text-sm leading-6 text-neutral-700">{text(runtime.blocker)}</div>,
                <div className="text-sm leading-6 text-neutral-700">{text(runtime.productionGate)}</div>,
              ])}
            />
          ) : (
            <EmptyProductState message="No runtime blockers loaded yet." />
          )}
        </ProductCard>

        <ProductCard title="Execution Flags" subtitle="Environment flags must remain off until the runtime has an accepted pilot, audit evidence, and rollback plan.">
          {flags.length ? (
            <ProductTable
              columns={['Runtime', 'Flag', 'State', 'Purpose']}
              rows={flags.map(flag => [
                flag.runtime,
                <code className="rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-700">{flag.name}</code>,
                <ProductStatus tone={flag.enabled ? 'danger' : 'good'}>{flag.enabled ? 'Enabled' : 'Disabled'}</ProductStatus>,
                <div className="text-sm leading-6 text-neutral-700">{flag.purpose}</div>,
              ])}
            />
          ) : (
            <EmptyProductState message="No runtime execution flags were reported." />
          )}
        </ProductCard>
      </div>

      <ProductCard title="R1 Acceptance Truth" subtitle="This is the exact delivery state after Sprint R1.">
        <div className="grid gap-3 lg:grid-cols-3">
          {[
            ['Done', 'Admin/Ops page separates runtime infrastructure from customer integrations.'],
            ['Done', 'Runtime status is role-gated to admin/CCO at the backend.'],
            ['Not Done', 'OpenClaw is not orchestrating production customer workflows.'],
            ['Not Done', 'agentgateway is not routing production connector traffic.'],
            ['Not Done', 'AgentScope is not executing production agent sessions.'],
            ['Next', 'Pilot one runtime only after a clear business use case and acceptance test.'],
          ].map(([label, detail]) => (
            <div key={`${label}-${detail}`} className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <ProductStatus tone={label === 'Done' ? 'good' : label === 'Next' ? 'info' : 'warn'}>{label}</ProductStatus>
              <p className="mt-3 text-sm leading-6 text-neutral-700">{detail}</p>
            </div>
          ))}
        </div>
      </ProductCard>
    </ProductPage>
  );
}
