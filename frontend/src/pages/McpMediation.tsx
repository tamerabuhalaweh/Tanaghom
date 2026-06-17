export default function McpMediation() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">MCP Mediation Boundary</h1>
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <p className="text-red-800 font-medium">All direct external access is blocked.</p>
        <p className="text-red-700 text-sm mt-1">Agents must go through MCP mediation for any external system access.</p>
      </div>
      <div className="bg-white border rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-2">Mock Connectors</h2>
        <div className="space-y-2 text-sm">
          {['future_postiz_mcp', 'future_resourcespace_mcp', 'future_analytics_social_mcp', 'future_rendering_mcp', 'future_crm_whatsapp_mcp', 'future_spine_postgres_mcp'].map(c => (
            <div key={c} className="flex justify-between border-b pb-2">
              <span>{c}</span>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded">planned</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
