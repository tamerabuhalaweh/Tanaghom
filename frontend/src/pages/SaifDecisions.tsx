export default function SaifDecisions() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">SAIF Decision Records</h1>
      <div className="bg-white border rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-2">Decision: Content Campaign Approval</h2>
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div><span className="text-gray-500">Status:</span> <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">accepted</span></div>
          <div><span className="text-gray-500">Confidence:</span> medium</div>
        </div>
        <h3 className="font-medium text-sm mb-2">Evaluation Dimensions</h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {['Capability Impact', 'Security Posture*', 'Cost', 'Latency', 'Maintainability', 'Reversibility', 'Human Oversight*', 'Compliance*', 'Observability', 'Learning Potential'].map(d => (
            <div key={d} className="flex items-center gap-2">
              <span className={`px-1 rounded ${d.includes('*') ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>{d}</span>
              <span className="text-green-600">✓</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">* Critical dimensions — must be positive or mitigated</p>
      </div>
    </div>
  )
}
