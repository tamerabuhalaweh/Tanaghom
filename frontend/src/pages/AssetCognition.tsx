export default function AssetCognition() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Asset Cognition</h1>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <p className="text-blue-800 font-medium">STITCH owns canonical asset identity.</p>
        <p className="text-blue-700 text-sm mt-1">ResourceSpace and rendering tools are external reference surfaces only.</p>
      </div>
      <div className="bg-white border rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-2">Assets</h2>
        <div className="space-y-2 text-sm">
          {[
            { name: 'Campaign Hero Image', type: 'image', owner: 'STITCH' },
            { name: 'Product Video Clip', type: 'video', owner: 'STITCH' },
            { name: 'Brand Guidelines PDF', type: 'document', owner: 'STITCH' },
          ].map(a => (
            <div key={a.name} className="flex justify-between border-b pb-2">
              <span>{a.name} ({a.type})</span>
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">{a.owner}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
