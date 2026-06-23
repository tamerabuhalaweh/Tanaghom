import { useState, useEffect } from 'react';
import { analyticsApi } from '../api';
import { useAuth } from '../contexts/useAuth';
import { Card, MetricCard, Alert, DemoLabel, StatusBadge } from '../components/UI';

export default function Analytics() {
  const { token } = useAuth();
  const [demoData, setDemoData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      analyticsApi.demo(token).then(d => setDemoData(d as Record<string, unknown>)).catch(console.error).finally(() => setLoading(false));
    }
  }, [token]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics & Reporting</h1>
        <DemoLabel>Mock Provider — Demo Data</DemoLabel>
      </div>

      <Alert type="warning">
        <strong>Demo Analytics</strong> — No real social API calls. Data shown is for demonstration purposes only.
      </Alert>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading analytics...</div>
      ) : demoData ? (
        <>
          <div className="grid grid-cols-4 gap-4">
            <MetricCard label="Impressions" value={String(demoData.impressions || '12,500')} sublabel="Total reach" />
            <MetricCard label="Reach" value={String(demoData.reach || '8,900')} sublabel="Unique viewers" />
            <MetricCard label="Engagement" value={String(demoData.engagementRate || '3.56%')} sublabel="Click-through rate" />
            <MetricCard label="Best Platform" value={String(demoData.bestPlatform || 'LinkedIn')} sublabel="Highest engagement" />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <Card title="Top Performing Content">
              <div className="space-y-3">
                {[
                  { type: 'Educational Post', platform: 'LinkedIn', engagement: '4.2%' },
                  { type: 'Carousel', platform: 'Instagram', engagement: '3.8%' },
                  { type: 'Video', platform: 'TikTok', engagement: '5.1%' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div>
                      <div className="font-medium text-sm">{item.type}</div>
                      <div className="text-xs text-gray-500">{item.platform}</div>
                    </div>
                    <StatusBadge label={item.engagement} variant="success" />
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Best Time & Format">
              <div className="space-y-3">
                <div className="flex justify-between p-2 bg-gray-50 rounded">
                  <span className="text-gray-600">Best Time</span>
                  <span className="font-medium">{String(demoData.bestTime || 'Tuesday 10:00 AM')}</span>
                </div>
                <div className="flex justify-between p-2 bg-gray-50 rounded">
                  <span className="text-gray-600">Top Format</span>
                  <span className="font-medium">{String(demoData.topContent || 'Educational posts with images')}</span>
                </div>
                <div className="flex justify-between p-2 bg-gray-50 rounded">
                  <span className="text-gray-600">Recommended</span>
                  <span className="font-medium">LinkedIn + Instagram</span>
                </div>
              </div>
            </Card>
          </div>

          <Card title="Integration Roadmap">
            <div className="space-y-2 text-sm">
              {[
                { phase: 'Phase 1', desc: 'Demo/mock analytics', status: 'current' },
                { phase: 'Phase 2', desc: 'Official analytics API read-only connectors', status: 'planned' },
                { phase: 'Phase 3', desc: 'Approval-gated Postiz scheduling', status: 'planned' },
                { phase: 'Phase 4', desc: 'GoHighLevel lead capture', status: 'planned' },
                { phase: 'Phase 5', desc: 'AI voice/chat agent handoff', status: 'planned' },
                { phase: 'Phase 6', desc: 'Closed-loop learning', status: 'planned' },
              ].map(p => (
                <div key={p.phase} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div>
                    <span className="font-medium">{p.phase}</span>
                    <span className="text-gray-500 ml-2">{p.desc}</span>
                  </div>
                  <StatusBadge label={p.status} variant={p.status === 'current' ? 'info' : 'default'} />
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : (
        <div className="text-center py-8 text-gray-400">No analytics data available</div>
      )}
    </div>
  );
}
