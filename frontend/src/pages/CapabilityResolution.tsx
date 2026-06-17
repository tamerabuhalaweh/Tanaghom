export default function CapabilityResolution() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Capability Resolution</h1>
      <div className="bg-white border rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-2">Canonical Chain</h2>
        <div className="flex items-center gap-2 text-sm mb-4 flex-wrap">
          {['Intent', 'Objective', 'Capability', 'ExecutionPattern', 'Resource', 'Implementation', 'Execution'].map((s, i) => (
            <span key={s}>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">{s}</span>
              {i < 6 && <span className="mx-1 text-gray-400">→</span>}
            </span>
          ))}
        </div>
        <h3 className="font-medium text-sm mb-2">Resolved Example</h3>
        <div className="text-sm space-y-1">
          <div><span className="text-gray-500">Intent:</span> Promote new course</div>
          <div><span className="text-gray-500">Objective:</span> Generate platform-specific drafts</div>
          <div><span className="text-gray-500">Capability:</span> GenerateContentDraft</div>
          <div><span className="text-gray-500">Pattern:</span> DraftGenerationPattern</div>
          <div><span className="text-gray-500">Implementation:</span> MockLLMProvider</div>
        </div>
      </div>
      <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
        Demo resolution — no real execution occurs.
      </div>
    </div>
  )
}
