export default function Analytics() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Analytics & Reporting</h1>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <p className="text-yellow-800 font-medium">Mock Analytics Only</p>
        <p className="text-yellow-700 text-sm mt-1">All data is mock/provider-based. No real social API calls.</p>
      </div>
      <div className="bg-white border rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-2">Mock Performance Report</h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center"><div className="text-2xl font-bold">12,500</div><div className="text-gray-500">Impressions</div></div>
          <div className="text-center"><div className="text-2xl font-bold">8,900</div><div className="text-gray-500">Reach</div></div>
          <div className="text-center"><div className="text-2xl font-bold">3.56%</div><div className="text-gray-500">CTR</div></div>
        </div>
      </div>
    </div>
  )
}
