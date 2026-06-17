export default function Dashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">STITCH Dashboard</h1>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <p className="text-yellow-800 font-medium">Controlled Pilot/Demo Mode</p>
        <p className="text-yellow-700 text-sm mt-1">All integrations are mock/provider-based. M5 execution blocked by design. No external systems connected.</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatusCard title="Identity" status="active" value="AgentRep + Session Lock" />
        <StatusCard title="SAIF Decisions" status="active" value="10 evaluation dimensions" />
        <StatusCard title="Approvals" status="active" value="Risk-based routing" />
        <StatusCard title="Capabilities" status="active" value="7-step resolution" />
        <StatusCard title="MCP Mediation" status="blocked" value="All direct access blocked" />
        <StatusCard title="SPINE" status="active" value="Run + Artifact lineage" />
        <StatusCard title="Observability" status="active" value="Event + Audit + Learning" />
        <StatusCard title="Publishing" status="mock" value="Mock Postiz only" />
        <StatusCard title="M5 Execution" status="blocked" value="Blocked by design" />
      </div>

      <h2 className="text-lg font-semibold mb-4">Demo Flow</h2>
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center gap-2 text-sm overflow-x-auto">
          {['HumanUser', 'AgentRep', 'Campaign', 'AI Draft', 'Algorithm', 'SAIF Decision', 'Approval', 'Capability Resolution', 'MCP Mediation', 'SPINE', 'Observability', 'Publishing Package', 'Mock Postiz'].map((step, i) => (
            <span key={step}>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">{step}</span>
              {i < 12 && <span className="mx-1 text-gray-400">→</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatusCard({ title, status, value }: { title: string; status: string; value: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-50 border-green-200 text-green-700',
    blocked: 'bg-red-50 border-red-200 text-red-700',
    mock: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  }
  return (
    <div className={`border rounded-lg p-3 ${colors[status] || 'bg-gray-50 border-gray-200'}`}>
      <div className="font-medium text-sm">{title}</div>
      <div className="text-xs mt-1 opacity-75">{value}</div>
      <div className="text-xs mt-1 font-medium uppercase">{status}</div>
    </div>
  )
}
