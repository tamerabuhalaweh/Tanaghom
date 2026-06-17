export default function SpineTimeline() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">SPINE Timeline</h1>
      <div className="bg-white border rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-2">Run History</h2>
        <div className="space-y-3">
          {[
            { id: 'run-1', type: 'planned', status: 'succeeded', action: 'Generate campaign draft', time: '2026-06-17 09:00' },
            { id: 'run-2', type: 'simulated', status: 'succeeded', action: 'Evaluate reach score', time: '2026-06-17 09:05' },
            { id: 'run-3', type: 'advisory', status: 'succeeded', action: 'Create approval package', time: '2026-06-17 09:10' },
          ].map(run => (
            <div key={run.id} className="border-b pb-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{run.action}</span>
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">{run.status}</span>
              </div>
              <div className="text-gray-500 text-xs mt-1">{run.type} • {run.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
