import { useAuth } from '../contexts/useAuth';
import { Card, MetricCard, StatusBadge, Alert, DemoLabel } from '../components/UI';
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
    planned: MCP_SKILLS.filter(s => s.status === 'planned').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Demo Command Center</h1>
          <p className="text-gray-500 text-sm mt-1">Executive Boardroom View — Commercial/Social Model</p>
        </div>
        <DemoLabel>Controlled Demo — Live Execution Blocked</DemoLabel>
      </div>

      <Alert type="info">
        <strong>Tanaghum is ready for controlled expansion into real integrations.</strong> 
        Live execution remains blocked until authorized.
      </Alert>

      {/* Key Metrics */}
      <div className="grid grid-cols-6 gap-4">
        <MetricCard label="Campaigns" value="2" sublabel="Demo data" />
        <MetricCard label="AI Drafts" value="3" sublabel="Mock LLM" />
        <MetricCard label="MCP Connectors" value={String(mcpStats.total)} sublabel={`${mcpStats.mock} mock`} />
        <MetricCard label="Agent Skills" value={String(skillStats.total)} sublabel={`${skillStats.working} working`} />
        <MetricCard label="Safety Gates" value="9/11" sublabel="Blocked" />
        <MetricCard label="Tests" value="871" sublabel="All passing" />
      </div>

      {/* Golden Path Status */}
      <Card title="Commercial/Social Golden Path">
        <div className="grid grid-cols-5 gap-3">
          {[
            { step: 'Login', status: 'working' },
            { step: 'Campaign Select', status: 'working' },
            { step: 'AI Draft', status: 'working' },
            { step: 'Reach Score', status: 'working' },
            { step: 'Approval', status: 'working' },
            { step: 'Publishing Prep', status: 'working' },
            { step: 'Mock Postiz', status: 'mock' },
            { step: 'Analytics', status: 'mock' },
            { step: 'Lead Capture', status: 'mock' },
            { step: 'GHL Handoff', status: 'planned' },
            { step: 'WhatsApp', status: 'planned' },
            { step: 'Voice/Chat', status: 'planned' },
            { step: 'Audit Trail', status: 'working' },
            { step: 'SPINE', status: 'working' },
            { step: 'Observability', status: 'working' },
          ].map(item => (
            <div key={item.step} className="text-center p-2 bg-gray-50 rounded">
              <div className="text-xs font-medium">{item.step}</div>
              <StatusBadge label={item.status} variant={item.status === 'working' ? 'success' : item.status === 'mock' ? 'mock' : 'default'} />
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        {/* MCP Engine Status */}
        <Card title="MCP Engine Status">
          <div className="space-y-3">
            {MCP_CONNECTORS.slice(0, 6).map(connector => (
              <div key={connector.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{connector.name}</span>
                <StatusBadge label={connector.status} variant={connector.status === 'mock' ? 'mock' : 'default'} />
              </div>
            ))}
            <div className="text-xs text-gray-400">+ {MCP_CONNECTORS.length - 6} more connectors</div>
          </div>
        </Card>

        {/* Agent Skills Status */}
        <Card title="Agent Skills Status">
          <div className="space-y-3">
            {MCP_SKILLS.slice(0, 6).map(skill => (
              <div key={skill.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{skill.name}</span>
                <StatusBadge label={skill.status} variant={skill.status === 'working' ? 'success' : skill.status === 'mock' ? 'mock' : 'default'} />
              </div>
            ))}
            <div className="text-xs text-gray-400">+ {MCP_SKILLS.length - 6} more skills</div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* GoHighLevel Readiness */}
        <Card title="GoHighLevel CRM">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <StatusBadge label="Planned" variant="default" />
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">CRM Writes</span>
              <StatusBadge label="Blocked" variant="danger" />
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Credentials</span>
              <StatusBadge label="Missing" variant="warning" />
            </div>
          </div>
        </Card>

        {/* Postiz Sandbox */}
        <Card title="Postiz Sandbox">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <StatusBadge label="Sandbox Ready" variant="info" />
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Publishing</span>
              <StatusBadge label="Blocked" variant="danger" />
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Credentials</span>
              <StatusBadge label="Missing" variant="warning" />
            </div>
          </div>
        </Card>

        {/* OpenClaw Readiness */}
        <Card title="OpenClaw">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <StatusBadge label="Planned" variant="default" />
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Channel Orchestration</span>
              <StatusBadge label="Blocked" variant="danger" />
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Source of Truth</span>
              <span className="font-medium">STITCH</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Safety Gates */}
      <Card title="Safety Gates">
        <div className="grid grid-cols-3 gap-3">
          {[
            { gate: 'M5 Execution', status: 'Blocked' },
            { gate: 'External APIs', status: 'Blocked' },
            { gate: 'Live Publishing', status: 'Blocked' },
            { gate: 'Real CRM Writes', status: 'Blocked' },
            { gate: 'Real WhatsApp', status: 'Blocked' },
            { gate: 'Real Analytics', status: 'Blocked' },
            { gate: 'Real Rendering', status: 'Blocked' },
            { gate: 'Voice/Chat', status: 'Blocked' },
            { gate: 'M5 Approval', status: 'Required' },
          ].map(item => (
            <div key={item.gate} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
              <span>{item.gate}</span>
              <StatusBadge label={item.status} variant="danger" />
            </div>
          ))}
        </div>
      </Card>

      {/* Deployment Status */}
      <Card title="Deployment Status">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Frontend</span>
              <StatusBadge label="Vercel Ready" variant="success" />
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Backend</span>
              <StatusBadge label="VPS/Container Ready" variant="success" />
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Database</span>
              <StatusBadge label="PostgreSQL 16" variant="success" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">CI/CD</span>
              <StatusBadge label="4/4 Green" variant="success" />
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">AI Provider</span>
              <StatusBadge label="Mock (default)" variant="mock" />
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tests</span>
              <StatusBadge label="871 passing" variant="success" />
            </div>
          </div>
        </div>
      </Card>

      {/* Audit Evidence */}
      <Card title="Audit / SPINE Evidence Available">
        <div className="grid grid-cols-3 gap-3 text-sm">
          {[
            'Observability Events',
            'Audit Records',
            'SPINE Runs & Artifacts',
            'Learning Signals',
            'Approval Decisions',
            'Campaign State Transitions',
          ].map(item => (
            <div key={item} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
              <StatusBadge label="Available" variant="success" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
