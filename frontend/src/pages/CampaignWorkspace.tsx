export default function CampaignWorkspace() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Campaign Workspace</h1>
      <div className="bg-white border rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-2">Demo Campaign: "Summer Wellness Launch"</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Status:</span> <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">pending_review</span></div>
          <div><span className="text-gray-500">Risk:</span> <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">medium</span></div>
          <div><span className="text-gray-500">Platform:</span> LinkedIn, Instagram</div>
          <div><span className="text-gray-500">Department:</span> Demand Generation</div>
        </div>
      </div>
      <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
        Demo data only — no real campaigns exist.
      </div>
    </div>
  )
}
