import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/useAuth';
import { demoApi } from '../api';
import { Badge, ExecutiveMetric, FlowTimeline, SafetyGateCard } from '../components/ExecutiveUI';

type IntegrationStatus = {
  name?: string;
  status?: string;
  url?: string;
  reachable?: boolean;
  scheduling?: string;
  publishing?: string;
  channelExecution?: string;
  writes?: string;
  reads?: string;
  triggers?: string;
  message?: string;
};

type DemoStatus = {
  campaigns?: unknown[];
  approvals?: unknown[];
  auditTrail?: unknown[];
  leadCaptures?: unknown[];
  productionRequests?: unknown[];
  publishingPackages?: unknown[];
  safety?: Record<string, boolean>;
  integrations?: Record<string, IntegrationStatus>;
};

function integrationBadge(status?: string) {
  if (status === 'sandbox_ready' || status === 'gateway_ready') return 'info';
  if (status === 'planned') return 'default';
  return 'warning';
}

function count(value: unknown[] | undefined): number {
  return Array.isArray(value) ? value.length : 0;
}

export default function DemoCommandCenter() {
  const { token } = useAuth();
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    demoApi.status(token)
      .then(d => setStatus(d as DemoStatus))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const integrations = status?.integrations || {};
  const postiz = integrations.postiz;
  const openClaw = integrations.openClaw;

  const workingSteps = [
    { label: 'Login', status: 'done' as const },
    { label: 'Campaign', status: 'done' as const },
    { label: 'AI Draft', status: 'done' as const, badge: 'LLM adapter' },
    { label: 'Reach Score', status: 'done' as const },
    { label: 'Human Approval', status: 'active' as const },
    { label: 'Package', status: 'done' as const, badge: 'Postiz preview' },
    { label: 'External Action', status: 'blocked' as const, badge: 'Blocked' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Command Center</h1>
          <p className="text-slate-500 text-sm mt-0.5">Commercial / Social Intelligence - controlled customer demo</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="mock">Mock LLM default</Badge>
          <Badge variant="blocked">M5 blocked</Badge>
          <Badge variant="success">881 tests</Badge>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-sky-500/20 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.22),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.92))] p-6">
        <div className="grid grid-cols-[1.5fr_1fr] gap-6">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Badge variant="info">Working model</Badge>
              <Badge variant="success">STITCH authoritative</Badge>
              <Badge variant="blocked">Execution gated</Badge>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white">AI prepares. Human approves. System records.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              The demo shows a real Commercial/Social operating path: campaign selection, AI draft generation,
              platform adaptation, deterministic readiness scoring, human approval, publishing package preparation,
              sandbox Postiz readiness, analytics intelligence, and audit evidence.
            </p>
          </div>
          <div className="rounded-xl border border-slate-700/80 bg-slate-950/60 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Live demo endpoints</div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Postiz sandbox</span>
                <Badge variant={postiz?.reachable ? 'info' : 'warning'}>{postiz?.reachable ? 'reachable' : loading ? 'checking' : 'unreachable'}</Badge>
              </div>
              <div className="truncate rounded-lg bg-slate-900 px-3 py-2 font-mono text-xs text-sky-300">{postiz?.url || 'checking...'}</div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">OpenClaw gateway</span>
                <Badge variant={openClaw?.reachable ? 'info' : 'warning'}>{openClaw?.reachable ? 'loopback ready' : loading ? 'checking' : 'not ready'}</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-3">
        <ExecutiveMetric label="Campaigns" value={loading ? '...' : count(status?.campaigns)} sublabel="Backend records" />
        <ExecutiveMetric label="Approvals" value={loading ? '...' : count(status?.approvals)} sublabel="Human queue" />
        <ExecutiveMetric label="Packages" value={loading ? '...' : count(status?.publishingPackages)} sublabel="Prepared only" />
        <ExecutiveMetric label="Audit Events" value={loading ? '...' : count(status?.auditTrail)} sublabel="Recorded evidence" />
        <ExecutiveMetric label="Leads" value={loading ? '...' : count(status?.leadCaptures)} sublabel="Mock handoff data" />
        <ExecutiveMetric label="External Exec" value="Blocked" sublabel="Safety gate" />
      </div>

      <div className="grid grid-cols-[1.4fr_1fr] gap-6">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Golden Path Status</h3>
          <FlowTimeline steps={workingSteps} />
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { label: 'AI generation', value: 'Working through STITCH LLM adapter', variant: 'success' as const },
              { label: 'Postiz scheduling', value: 'Sandbox reachable, scheduling blocked', variant: 'info' as const },
              { label: 'GHL / WhatsApp / Voice', value: 'Package/readiness only', variant: 'default' as const },
            ].map(item => (
              <div key={item.label} className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                <Badge variant={item.variant}>{item.label}</Badge>
                <p className="mt-3 text-sm text-slate-300">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <SafetyGateCard gates={[
          { label: 'M5 write execution', status: 'blocked' },
          { label: 'Live publishing', status: 'blocked' },
          { label: 'CRM writes', status: 'blocked' },
          { label: 'WhatsApp / voice trigger', status: 'blocked' },
          { label: 'Sandbox Postiz health', status: postiz?.reachable ? 'clear' : 'required' },
          { label: 'Human approval', status: 'required' },
        ]} />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Integration Readiness Matrix</h3>
        <div className="grid grid-cols-5 gap-3">
          {Object.entries(integrations).map(([key, item]) => (
            <div key={key} className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-semibold text-white">{item.name || key}</div>
                <Badge variant={integrationBadge(item.status)}>{item.status || 'checking'}</Badge>
              </div>
              <p className="mt-3 min-h-[56px] text-xs leading-5 text-slate-400">{item.message || 'Waiting for backend status.'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
