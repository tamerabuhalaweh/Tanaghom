export default function PublishingPrep() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Publishing Preparation</h1>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <p className="text-yellow-800 font-medium">M5 Publishing Blocked by Design</p>
        <p className="text-yellow-700 text-sm mt-1">Publishing packages are prepared but never executed. No real Postiz calls.</p>
      </div>
      <div className="bg-white border rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-2">Readiness Checks</h2>
        <div className="space-y-2 text-sm">
          {['content_approved', 'saif_critical_dimensions_resolved', 'approval_record_exists', 'capability_resolution_exists'].map(c => (
            <div key={c} className="flex justify-between border-b pb-2">
              <span>{c}</span>
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">passed</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
