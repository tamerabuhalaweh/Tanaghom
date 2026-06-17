export default function CrmConversion() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">CRM / WhatsApp Conversion</h1>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <p className="text-yellow-800 font-medium">Mock Providers Only</p>
        <p className="text-yellow-700 text-sm mt-1">No real CRM writes, no real WhatsApp messages, no real customer contact.</p>
      </div>
      <div className="bg-white border rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-2">Lead Capture Records</h2>
        <div className="space-y-2 text-sm">
          {[
            { name: 'John D.', source: 'LinkedIn Campaign', status: 'new_lead' },
            { name: 'Jane S.', source: 'Instagram Ad', status: 'contacted' },
          ].map(l => (
            <div key={l.name} className="flex justify-between border-b pb-2">
              <span>{l.name} — {l.source}</span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{l.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
