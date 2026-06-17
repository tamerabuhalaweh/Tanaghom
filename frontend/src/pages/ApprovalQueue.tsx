export default function ApprovalQueue() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Approval Queue</h1>
      <div className="bg-white border rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-2">Pending Approvals</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between border-b pb-2">
            <span>Summer Wellness Launch</span>
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">pending</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span>Product Update Post</span>
            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">approved</span>
          </div>
        </div>
      </div>
      <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
        Demo data only — no real approvals pending.
      </div>
    </div>
  )
}
