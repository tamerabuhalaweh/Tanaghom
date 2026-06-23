import { Card, StatusBadge, Alert, DemoLabel } from '../components/UI'

const gates = [
  { name: 'M5 Publishing', status: 'blocked', description: 'No real Postiz publishing' },
  { name: 'M5 Rendering', status: 'blocked', description: 'No real image/video generation' },
  { name: 'M5 CRM/WhatsApp', status: 'blocked', description: 'No real customer messages' },
  { name: 'Direct Postiz Access', status: 'blocked', description: 'MCP mediation required' },
  { name: 'Direct CRM Access', status: 'blocked', description: 'MCP mediation required' },
  { name: 'Direct ResourceSpace', status: 'blocked', description: 'External reference only' },
  { name: 'Direct Paperclip', status: 'blocked', description: 'Operating surface only' },
  { name: 'External API Calls', status: 'blocked', description: 'No real API integrations' },
  { name: 'File Upload', status: 'blocked', description: 'No file system writes' },
  { name: 'Secret Storage', status: 'clear', description: 'Deployment secrets only' },
  { name: 'Customer PII', status: 'clear', description: 'No real PII stored' },
]

export default function SafetyStatus() {
  const blocked = gates.filter(g => g.status === 'blocked').length
  const clear = gates.length - blocked

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">System Safety Status</h1>
          <p className="mt-1 text-sm text-gray-500">Controlled demo guardrails and execution kill switches</p>
        </div>
        <DemoLabel>Controlled Demo Safe</DemoLabel>
      </div>

      <Alert type="success">
        <strong>Platform is safe for controlled demo/pilot.</strong> All M5 execution paths are blocked. No external systems are connected.
      </Alert>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="text-3xl font-semibold text-white">{blocked}</div>
          <div className="mt-2 text-sm text-gray-400">Blocked gates</div>
        </Card>
        <Card>
          <div className="text-3xl font-semibold text-white">{clear}</div>
          <div className="mt-2 text-sm text-gray-400">Clear checks</div>
        </Card>
        <Card>
          <div className="text-3xl font-semibold text-white">0</div>
          <div className="mt-2 text-sm text-gray-400">Live integrations enabled</div>
        </Card>
      </div>

      <Card title="Safety Gates">
        <div className="space-y-2">
          {gates.map(g => (
            <div key={g.name} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/40 p-3">
              <div>
                <div className="text-sm font-medium text-gray-200">{g.name}</div>
                <div className="mt-0.5 text-xs text-gray-500">{g.description}</div>
              </div>
              <StatusBadge label={g.status} variant={g.status === 'blocked' ? 'danger' : 'success'} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
