export default function LearningSignals() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Learning Signal Review</h1>
      <div className="bg-white border rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-2">Signals Under Review</h2>
        <div className="space-y-2 text-sm">
          {[
            { type: 'performance', summary: 'Engagement rate above benchmark', status: 'under_review' },
            { type: 'quality', summary: 'Video content outperforms static', status: 'accepted' },
            { type: 'compliance', summary: 'Medical claims flagged', status: 'observed' },
          ].map(s => (
            <div key={s.summary} className="flex justify-between border-b pb-2">
              <span>{s.summary}</span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{s.status}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
        Learning signals are evidence only — cannot approve, publish, or change strategy.
      </div>
    </div>
  )
}
