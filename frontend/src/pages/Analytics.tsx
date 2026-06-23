import { useEffect } from 'react';
import { analyticsApi } from '../api';
import { useAuth } from '../contexts/useAuth';
import { ExecutiveMetric, RecommendationCard, Badge } from '../components/ExecutiveUI';

export default function Analytics() {
  const { token } = useAuth();

  useEffect(() => {
    if (token) {
      analyticsApi.demo(token).catch(console.error);
    }
  }, [token]);

  const topContent = [
    { type: 'Educational Post', platform: 'LinkedIn', engagement: '4.2%', reach: '3,200' },
    { type: 'Carousel', platform: 'Instagram', engagement: '3.8%', reach: '2,800' },
    { type: 'Video', platform: 'TikTok', engagement: '5.1%', reach: '4,100' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics Intelligence</h1>
          <p className="text-gray-500 text-sm mt-0.5">Demo data — official API connectors planned</p>
        </div>
        <Badge variant="mock">Mock Provider</Badge>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3">
        <ExecutiveMetric label="Total Reach" value="8,900" sublabel="Unique viewers" trend="up" />
        <ExecutiveMetric label="Impressions" value="12,500" sublabel="Total views" trend="up" />
        <ExecutiveMetric label="Engagement" value="3.56%" sublabel="Click-through rate" trend="up" />
        <ExecutiveMetric label="Lead Potential" value="24" sublabel="Qualified leads" trend="flat" />
        <ExecutiveMetric label="Approval Velocity" value="2.4h" sublabel="Avg time to approve" trend="down" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Top Content */}
        <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Top Performing Content</h3>
          <div className="space-y-3">
            {topContent.map((item, i) => (
              <div key={i} className="bg-gray-800/50 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-bold text-gray-600">{i + 1}</span>
                  <div>
                    <div className="font-medium text-white text-sm">{item.type}</div>
                    <div className="text-xs text-gray-500">{item.platform}</div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-sm font-medium text-white">{item.reach}</div>
                    <div className="text-xs text-gray-500">Reach</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-green-400">{item.engagement}</div>
                    <div className="text-xs text-gray-500">Engagement</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">AI Recommendations</h3>
            <div className="space-y-3">
              <RecommendationCard title="Best Platform" value="LinkedIn" confidence={85} />
              <RecommendationCard title="Best Time" value="Tuesday 10:00 AM" confidence={78} />
              <RecommendationCard title="Best Format" value="Educational + Image" confidence={82} />
              <RecommendationCard title="Hashtag Strategy" value="3-5 relevant, mix sizes" confidence={70} />
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Learning Signals</h3>
            <div className="space-y-2 text-sm">
              {[
                { signal: 'LinkedIn educational posts outperform by 40%', status: 'accepted' },
                { signal: 'Tuesday 10 AM is peak engagement', status: 'accepted' },
                { signal: 'Carousels increase save rate by 25%', status: 'pending' },
              ].map((s, i) => (
                <div key={i} className="bg-gray-800/50 rounded p-3 flex items-center justify-between">
                  <span className="text-gray-300 text-xs">{s.signal}</span>
                  <Badge variant={s.status === 'accepted' ? 'success' : 'warning'}>{s.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Integration Roadmap */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Integration Roadmap</h3>
        <div className="grid grid-cols-6 gap-3">
          {[
            { phase: '1', desc: 'Demo/mock analytics', status: 'current' },
            { phase: '2', desc: 'Official API read-only', status: 'planned' },
            { phase: '3', desc: 'Approval-gated Postiz', status: 'planned' },
            { phase: '4', desc: 'GoHighLevel CRM', status: 'planned' },
            { phase: '5', desc: 'Voice/chat agent', status: 'planned' },
            { phase: '6', desc: 'Closed-loop learning', status: 'planned' },
          ].map(p => (
            <div key={p.phase} className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-gray-600">{p.phase}</div>
              <div className="text-xs text-gray-400 mt-1">{p.desc}</div>
              <Badge variant={p.status === 'current' ? 'info' : 'default'}>{p.status}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
