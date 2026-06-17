export default function Observability() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Observability</h1>
      <div className="bg-white border rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-2">Recent Events</h2>
        <div className="space-y-2 text-sm">
          {[
            { type: 'campaign.created', severity: 'info', time: '09:00' },
            { type: 'approval.submitted', severity: 'info', time: '09:05' },
            { type: 'capability.resolved', severity: 'info', time: '09:10' },
            { type: 'mcp.blocked', severity: 'warning', time: '09:15' },
            { type: 'm5.blocked', severity: 'warning', time: '09:20' },
          ].map((e, i) => (
            <div key={i} className="flex justify-between border-b pb-2">
              <span>{e.type}</span>
              <span className="text-gray-500">{e.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
