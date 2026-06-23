import { StatusBadge, Card, MetricCard, Alert, DemoLabel } from '../components/UI';

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Commercial / Social Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Social Media Intelligence + AI Content Preparation + Human Approval</p>
        </div>
        <DemoLabel>Controlled Demo Mode</DemoLabel>
      </div>

      <Alert type="info">
        <strong>Demo Principle:</strong> AI prepares. Human approves. System records. External execution remains blocked unless separately authorized.
      </Alert>

      {/* Key Metrics */}
      <div className="grid grid-cols-5 gap-4">
        <MetricCard label="Active Campaigns" value="2" sublabel="Demo data" />
        <MetricCard label="Pending Approvals" value="1" sublabel="Human required" />
        <MetricCard label="AI Drafts" value="3" sublabel="Mock LLM" />
        <MetricCard label="Reach Scores" value="3" sublabel="Deterministic" />
        <MetricCard label="Safety Gates" value="9/11" sublabel="Blocked" />
      </div>

      {/* Safety Status */}
      <Card title="Safety Status">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'M5 Execution', status: 'Blocked', variant: 'danger' as const },
            { label: 'External APIs', status: 'Blocked', variant: 'danger' as const },
            { label: 'Live Publishing', status: 'Blocked', variant: 'danger' as const },
            { label: 'Real CRM', status: 'Blocked', variant: 'danger' as const },
            { label: 'Real WhatsApp', status: 'Blocked', variant: 'danger' as const },
            { label: 'Real Analytics', status: 'Blocked', variant: 'danger' as const },
            { label: 'AI Draft Gen', status: 'Working', variant: 'success' as const },
            { label: 'Approval Flow', status: 'Working', variant: 'success' as const },
            { label: 'Audit Trail', status: 'Working', variant: 'success' as const },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm text-gray-700">{item.label}</span>
              <StatusBadge label={item.status} variant={item.variant} />
            </div>
          ))}
        </div>
      </Card>

      {/* Demo Flow */}
      <Card title="Commercial/Social Golden Path">
        <div className="flex items-center gap-1.5 overflow-x-auto py-2">
          {[
            'Login', 'Dashboard', 'Campaign', 'AI Draft', 'Platform Adapt', 'Reach Score',
            'Best Time/Format', 'Approval', 'Publishing Prep', 'Mock Postiz', 'Analytics',
            'Lead Capture', 'GoHighLevel', 'Voice/Chat', 'Audit Trail'
          ].map((step, i) => (
            <span key={step}>
              <span className={`px-2.5 py-1.5 rounded-lg text-xs font-medium ${i < 8 ? 'bg-green-100 text-green-800' : i < 11 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'}`}>
                {step}
              </span>
              {i < 14 && <span className="mx-0.5 text-gray-300">→</span>}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-400 rounded-full"></span> Working</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-400 rounded-full"></span> Mock/Sandbox</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-gray-300 rounded-full"></span> Planned</span>
        </div>
      </Card>

      {/* Architecture */}
      <Card title="Architecture">
        <div className="bg-gray-50 rounded p-4 font-mono text-sm text-gray-700">
          Tanaghum STITCH Core → Capability Resolution → SAIF Approval Gateway → MCP Connector Layer → Postiz / Social APIs
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs">
          <DemoLabel>Tanaghum owns: strategy, AI, approval, audit, learning</DemoLabel>
          <DemoLabel>Postiz: scheduling surface only</DemoLabel>
        </div>
      </Card>
    </div>
  );
}
