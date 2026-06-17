export default function SafetyStatus() {
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
    { name: 'Secret Storage', status: 'clear', description: 'Placeholders only' },
    { name: 'Customer PII', status: 'clear', description: 'No real PII stored' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">System Safety Status</h1>
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <p className="text-green-800 font-medium">Platform is safe for controlled demo/pilot.</p>
        <p className="text-green-700 text-sm mt-1">All M5 execution paths are blocked. No external systems connected.</p>
      </div>
      <div className="bg-white border rounded-lg p-4">
        <h2 className="font-semibold mb-4">Safety Gates</h2>
        <div className="space-y-2">
          {gates.map(g => (
            <div key={g.name} className="flex justify-between items-center border-b pb-2">
              <div>
                <span className="font-medium text-sm">{g.name}</span>
                <span className="text-gray-500 text-xs ml-2">{g.description}</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                g.status === 'blocked' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
              }`}>
                {g.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
