import { useEffect, useState } from 'react';
import { demoApi } from '../api';
import { useAuth } from '../contexts/useAuth';
import { Badge, ExecutiveMetric, FlowTimeline, SafetyGateCard } from '../components/ExecutiveUI';

type DemoStatus = {
  campaigns?: unknown[];
  approvals?: unknown[];
  publishingPackages?: unknown[];
  auditTrail?: unknown[];
  integrations?: Record<string, { reachable?: boolean; status?: string; message?: string }>;
};

function count(items?: unknown[]) {
  return Array.isArray(items) ? items.length : 0;
}

export default function Dashboard() {
  const { token } = useAuth();
  const [status, setStatus] = useState<DemoStatus | null>(null);

  useEffect(() => {
    if (!token) return;
    demoApi.status(token).then(d => setStatus(d as DemoStatus)).catch(console.error);
  }, [token]);

  const postizReady = status?.integrations?.postiz?.reachable === true;
  const openClawReady = status?.integrations?.openClaw?.reachable === true;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Commercial / Social Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Operational view for the CEO demo path</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info">Controlled Demo</Badge>
          <Badge variant="blocked">Live execution disabled</Badge>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <ExecutiveMetric label="Campaigns" value={status ? count(status.campaigns) : '...'} sublabel="Backend records" />
        <ExecutiveMetric label="Approvals" value={status ? count(status.approvals) : '...'} sublabel="Human queue" />
        <ExecutiveMetric label="Packages" value={status ? count(status.publishingPackages) : '...'} sublabel="Prepared only" />
        <ExecutiveMetric label="Postiz" value={postizReady ? 'Ready' : 'Checking'} sublabel="Sandbox surface" />
        <ExecutiveMetric label="OpenClaw" value={openClawReady ? 'Ready' : 'Checking'} sublabel="Loopback gateway" />
      </div>

      <div className="grid grid-cols-[1.3fr_1fr] gap-6">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Commercial/Social Golden Path</h2>
          <FlowTimeline steps={[
            { label: 'Login', status: 'done' },
            { label: 'Campaign', status: 'done' },
            { label: 'AI Draft', status: 'done' },
            { label: 'Reach Score', status: 'done' },
            { label: 'Approval', status: 'active' },
            { label: 'Package', status: postizReady ? 'done' : 'active', badge: 'Postiz sandbox' },
            { label: 'External Action', status: 'blocked', badge: 'Blocked' },
          ]} />

          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-sm font-semibold text-white">Architecture Boundary</div>
            <div className="mt-3 font-mono text-xs leading-6 text-slate-300">
              STITCH Core - Capability Resolution - SAIF Approval Gateway - MCP Connector Layer - Postiz / CRM / Voice APIs
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="success">STITCH is source of truth</Badge>
              <Badge variant="info">Postiz is scheduling surface</Badge>
              <Badge variant="blocked">M5 blocked</Badge>
            </div>
          </div>
        </div>

        <SafetyGateCard gates={[
          { label: 'M5 Execution', status: 'blocked' },
          { label: 'Live Publishing', status: 'blocked' },
          { label: 'Real CRM Write', status: 'blocked' },
          { label: 'WhatsApp Message', status: 'blocked' },
          { label: 'Voice Trigger', status: 'blocked' },
          { label: 'Postiz Sandbox', status: postizReady ? 'clear' : 'required' },
        ]} />
      </div>
    </div>
  );
}
