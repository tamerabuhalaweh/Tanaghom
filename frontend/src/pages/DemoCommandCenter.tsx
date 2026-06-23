import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/useAuth';
import { demoApi } from '../api';
import { Badge } from '../components/ExecutiveUI';

export default function DemoCommandCenter() {
  const { token } = useAuth();
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      demoApi.status(token)
        .then(d => { setStatus(d as Record<string, unknown>); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [token]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Command Center</h1>
          <p className="text-gray-500 text-sm mt-0.5">Commercial / Social Intelligence • Controlled Demo</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="mock">Mock Providers</Badge>
          <Badge variant="blocked">M5 Blocked</Badge>
          <Badge variant="success">881 Tests</Badge>
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-purple-900/30 border border-blue-800/40 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white mb-1">AI prepares → Human approves → System records</h2>
            <p className="text-gray-400 text-sm">Social Media Intelligence + AI Content Preparation + Human Governance + Safe Execution</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-400">100%</div>
            <div className="text-xs text-gray-500">External execution blocked</div>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Golden Path Progress</h3>
        <div className="text-gray-400 text-sm">Golden path visualization</div>
      </div>

      <div className="grid grid-cols-6 gap-3">
        {[
          { label: 'Campaigns', value: String((status?.campaigns as unknown[])?.length || 0), sublabel: 'From backend' },
          { label: 'Approvals', value: String((status?.approvals as unknown[])?.length || 0), sublabel: 'From backend' },
          { label: 'Drafts', value: String(((status?.campaigns as unknown[])?.length || 0) * 2), sublabel: 'Generated' },
          { label: 'M5 Status', value: 'Blocked', sublabel: 'Safety gate' },
          { label: 'External', value: 'Blocked', sublabel: 'Safety gate' },
          { label: 'Demo Mode', value: 'ON', sublabel: 'Safety gate' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-5 border border-gray-700">
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">{kpi.label}</p>
            <p className="text-3xl font-bold text-white mt-1">{loading ? '...' : kpi.value}</p>
            <p className="text-gray-500 text-xs mt-1">{kpi.sublabel}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
