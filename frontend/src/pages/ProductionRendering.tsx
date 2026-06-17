export default function ProductionRendering() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Production & Rendering</h1>
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <p className="text-red-800 font-medium">M5 Rendering Blocked by Design</p>
        <p className="text-red-700 text-sm mt-1">No real rendering, file uploads, or external design tool calls.</p>
      </div>
      <div className="bg-white border rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-2">Production Requests</h2>
        <div className="space-y-2 text-sm">
          {[
            { type: 'carousel', title: 'Product Showcase Carousel', status: 'draft' },
            { type: 'short_video', title: 'Testimonial Reel', status: 'submitted' },
          ].map(r => (
            <div key={r.title} className="flex justify-between border-b pb-2">
              <span>{r.title} ({r.type})</span>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{r.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
