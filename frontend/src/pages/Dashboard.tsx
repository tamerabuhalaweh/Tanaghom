import { StatusBadge, Card, MetricCard, Alert, DemoLabel } from '../components/UI'

const safetyItems = [
  { label: 'M5 Execution', status: 'Blocked', variant: 'danger' as const },
  { label: 'External APIs', status: 'Blocked', variant: 'danger' as const },
  { label: 'Live Publishing', status: 'Blocked', variant: 'danger' as const },
  { label: 'Real CRM', status: 'Blocked', variant: 'danger' as const },
  { label: 'Real WhatsApp', status: 'Blocked', variant: 'danger' as const },
  { label: 'Real Analytics', status: 'Blocked', variant: 'danger' as const },
  { label: 'AI Draft Gen', status: 'Working', variant: 'success' as const },
  { label: 'Approval Flow', status: 'Working', variant: 'success' as const },
  { label: 'Audit Trail', status: 'Working', variant: 'success' as const },
]

const flowSteps = [
  'Login',
  'Dashboard',
  'Campaign',
  'AI Draft',
  'Platform Adapt',
  'Reach Score',
  'Best Time/Format',
  'Approval',
  'Publishing Prep',
  'Mock Postiz',
  'Analytics',
  'Lead Capture',
  'GoHighLevel',
  'Voice/Chat',
  'Audit Trail',
]

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Commercial / Social Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Social Media Intelligence + AI Content Preparation + Human Approval</p>
        </div>
        <DemoLabel>Controlled Demo Mode</DemoLabel>
      </div>

      <Alert type="info">
        <strong>Demo Principle:</strong> AI prepares. Human approves. System records. External execution remains blocked unless separately authorized.
      </Alert>

      <div className="grid grid-cols-5 gap-4">
        <MetricCard label="Active Campaigns" value="2" sublabel="Demo data" />
        <MetricCard label="Pending Approvals" value="1" sublabel="Human required" />
        <MetricCard label="AI Drafts" value="3" sublabel="Mock LLM" />
        <MetricCard label="Reach Scores" value="3" sublabel="Deterministic" />
        <MetricCard label="Safety Gates" value="9/11" sublabel="Blocked" />
      </div>

      <Card title="Safety Status">
        <div className="grid grid-cols-3 gap-4">
          {safetyItems.map(item => (
            <div key={item.label} className="flex items-center justify-between rounded-lg bg-gray-800/50 p-2">
              <span className="text-sm text-gray-300">{item.label}</span>
              <StatusBadge label={item.status} variant={item.variant} />
            </div>
          ))}
        </div>
      </Card>

      <Card title="Commercial/Social Golden Path">
        <div className="flex items-center gap-1.5 overflow-x-auto py-2">
          {flowSteps.map((step, i) => (
            <span key={step} className="flex items-center">
              <span className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                i < 8
                  ? 'border-emerald-800 bg-emerald-950/60 text-emerald-300'
                  : i < 11
                    ? 'border-amber-800 bg-amber-950/60 text-amber-300'
                    : 'border-gray-700 bg-gray-800 text-gray-400'
              }`}>
                {step}
              </span>
              {i < flowSteps.length - 1 && <span className="mx-1 text-gray-600">→</span>}
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Working</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Mock/Sandbox</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gray-500" /> Planned</span>
        </div>
      </Card>

      <Card title="Architecture">
        <div className="rounded-lg bg-gray-800/50 p-4 font-mono text-sm text-gray-300">
          Tanaghum STITCH Core → Capability Resolution → SAIF Approval Gateway → MCP Connector Layer → Postiz / Social APIs
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs">
          <DemoLabel>Tanaghum owns: strategy, AI, approval, audit, learning</DemoLabel>
          <DemoLabel>Postiz: scheduling surface only</DemoLabel>
        </div>
      </Card>
    </div>
  )
}
