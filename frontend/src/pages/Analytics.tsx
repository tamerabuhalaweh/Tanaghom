import { useState, useEffect } from 'react';
import { analyticsApi } from '../api';
import { useAuth } from '../contexts/AuthContext';

export default function Analytics() {
  const { token } = useAuth();
  const [demoData, setDemoData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      analyticsApi.demo(token)
        .then(setDemoData)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [token]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Analytics & Reporting</h1>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-sm text-yellow-800 flex items-center gap-2">
        <span className="px-2 py-0.5 bg-yellow-200 rounded text-xs font-bold">MOCK PROVIDER</span>
        Demo analytics data — no real social API calls
      </div>

      {loading ? (
        <div className="text-gray-400">Loading analytics...</div>
      ) : demoData ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{(demoData as { impressions?: number }).impressions || '12,500'}</div>
              <div className="text-gray-500 text-sm">Impressions</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{(demoData as { reach?: number }).reach || '8,900'}</div>
              <div className="text-gray-500 text-sm">Reach</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{(demoData as { engagementRate?: string }).engagementRate || '3.56%'}</div>
              <div className="text-gray-500 text-sm">Engagement Rate</div>
            </div>
          </div>
          <pre className="bg-gray-50 border rounded p-4 text-sm overflow-auto">{JSON.stringify(demoData, null, 2)}</pre>
        </div>
      ) : (
        <div className="text-gray-400">No analytics data available</div>
      )}

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
        <strong>Integration Roadmap:</strong> Phase 2 will add official analytics API read-only connectors. Phase 3 will add approval-gated Postiz scheduling.
      </div>
    </div>
  );
}
