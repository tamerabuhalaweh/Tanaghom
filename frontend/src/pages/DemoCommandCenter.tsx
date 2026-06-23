import { useAuth } from '../contexts/useAuth';
import { ExecutiveMetric, FlowTimeline, IntegrationStatusCard, SafetyGateCard, Badge } from '../components/ExecutiveUI';
import { MCP_CONNECTORS, MCP_SKILLS } from '../modules/mcp-engine/registry-data';

export default function DemoCommandCenter() {
  useAuth();

  const mcpStats = {
    total: MCP_CONNECTORS.length,
    mock: MCP_CONNECTORS.filter(c => c.status === 'mock').length,
    planned: MCP_CONNECTORS.filter(c => c.status === 'planned').length,
    sandbox: MCP_CONNECTORS.filter(c => c.status === 'sandbox_ready').length,
  };

  const skillStats = {
    total: MCP_SKILLS.length,
    working: MCP_SKILLS.filter(s => s.status === 'working').length,
    mock: MCP_SKILLS.filter(s => s.status === 'mock').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Command Center</h1>
          <p className="text-gray-500 text-sm mt-0.5">Commercial / Social Intelligence • Demo Mode</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="mock">Mock Providers</Badge>
          <Badge variant="blocked">M5 Blocked</Badge>
          <Badge variant="success">881 Tests</Badge>
        </div>
      </div>

      {/* Core Value Proposition */}
      <div className="bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-purple-900/30 border border-blue-800/40 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white mb-1">AI prepares → Human approves → System records</h2>
            <p className="text-gray-400 text-sm">Social Media Intelligence + AI Content Preparation + Human Governance + Safe Execution</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-400">100%</div>
            <div className="text-xs text-gray-500">External execution blocked</div>
          </div>
        </div>
      </div>

      {/* Golden Path */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Golden Path Progress</h3>
        <FlowTimeline steps={[
          { label: 'Login', status: 'done' },
          { label: 'Campaign', status: 'done' },
          { label: 'AI Draft', status: 'done', badge: 'Mock LLM' },
          { label: 'Platform Adapt', status: 'done' },
          { label: 'Reach Score', status: 'done' },
          { label: 'Approval', status: 'done' },
          { label: 'Publishing Prep', status: 'active' },
          { label: 'Analytics', status: 'pending', badge: 'Mock' },
          { label: 'Lead Capture', status: 'pending', badge: 'Mock' },
          { label: 'GHL Handoff', status: 'blocked', badge: 'Planned' },
          { label: 'Audit Trail', status: 'done' },
        ]} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-6 gap-3">
        <ExecutiveMetric label="Campaigns" value="2" sublabel="Demo data" trend="flat" />
        <ExecutiveMetric label="AI Drafts" value="3" sublabel="Mock LLM" trend="flat" />
        <ExecutiveMetric label="Reach Score" value="78" sublabel="/ 100" trend="up" />
        <ExecutiveMetric label="MCP Connectors" value={String(mcpStats.total)} sublabel={`${mcpStats.mock} mock`} trend="flat" />
        <ExecutiveMetric label="Agent Skills" value={String(skillStats.total)} sublabel={`${skillStats.working} working`} trend="flat" />
        <ExecutiveMetric label="Safety Gates" value="9/11" sublabel="Blocked" trend="flat" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Integration Readiness */}
        <div className="col-span-2 space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Integration Readiness</h3>
            <div className="grid grid-cols-2 gap-3">
              <IntegrationStatusCard name="Postiz Scheduling" status="sandbox_ready" direction="Prepare-only" />
              <IntegrationStatusCard name="GoHighLevel CRM" status="planned" direction="Write-blocked" />
              <IntegrationStatusCard name="OpenClaw Orchestration" status="planned" direction="Channel only" />
              <IntegrationStatusCard name="AI Provider (LLM)" status="mock" direction="Mock default" />
              <IntegrationStatusCard name="Social Analytics" status="planned" direction="Read-only" />
              <IntegrationStatusCard name="WhatsApp Messaging" status="planned" direction="Write-blocked" />
            </div>
          </div>

          {/* System Health */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">System Health</h3>
              <span className="text-[10px] text-gray-600">Demo readiness snapshot — not live runtime</span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Backend', status: 'Builds clean', color: 'green' },
                { label: 'Database', status: 'Schema ready', color: 'green' },
                { label: 'Redis', status: 'Config present', color: 'green' },
                { label: 'CI/CD', status: '4/4 Green', color: 'green' },
              ].map(item => (
                <div key={item.label} className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">{item.label}</div>
                  <div className={`text-sm font-medium text-${item.color}-400`}>{item.status}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Safety Gates */}
        <SafetyGateCard gates={[
          { label: 'M5 Execution', status: 'blocked' },
          { label: 'External APIs', status: 'blocked' },
          { label: 'Live Publishing', status: 'blocked' },
          { label: 'Real CRM Writes', status: 'blocked' },
          { label: 'Real WhatsApp', status: 'blocked' },
          { label: 'Real Analytics', status: 'blocked' },
          { label: 'Real Rendering', status: 'blocked' },
          { label: 'Voice/Chat', status: 'blocked' },
          { label: 'AI Draft Gen', status: 'clear' },
          { label: 'Approval Flow', status: 'clear' },
        ]} />
      </div>

      {/* Architecture */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Architecture</h3>
        <div className="font-mono text-xs text-gray-500 bg-gray-800/50 rounded p-4">
          Tanaghum STITCH Core → Capability Resolution → SAIF Approval Gateway → MCP Connector Layer → Postiz / Social APIs / GoHighLevel
        </div>
        <div className="flex items-center gap-4 mt-3">
          <span className="text-xs text-gray-500">Tanaghum owns: strategy, AI, approval, audit, learning</span>
          <span className="text-xs text-gray-600">|</span>
          <span className="text-xs text-gray-500">External: scheduling surface only</span>
        </div>
      </div>
    </div>
  );
}
