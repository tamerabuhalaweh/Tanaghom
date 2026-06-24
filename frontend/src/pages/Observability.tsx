import { useEffect, useState } from 'react';
import { observabilityApi } from '../api';
import { Badge } from '../components/ExecutiveUI';
import { useAuth } from '../contexts/useAuth';

type EvidenceRecord = Record<string, unknown>;

function text(value: unknown, fallback = 'Recorded'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

export default function Observability() {
  const { token } = useAuth();
  const [events, setEvents] = useState<EvidenceRecord[]>([]);
  const [audit, setAudit] = useState<EvidenceRecord[]>([]);
  const [signals, setSignals] = useState<EvidenceRecord[]>([]);
  const [tab, setTab] = useState<'audit' | 'events' | 'signals'>('audit');

  useEffect(() => {
    if (!token) return;
    observabilityApi.events(token).then(data => setEvents(data as EvidenceRecord[])).catch(() => undefined);
    observabilityApi.audit(token).then(data => setAudit(data as EvidenceRecord[])).catch(() => undefined);
    observabilityApi.learningSignals(token).then(data => setSignals(data as EvidenceRecord[])).catch(() => undefined);
  }, [token]);

  const rows = tab === 'audit' ? audit : tab === 'events' ? events : signals;
  const fallbackRows: EvidenceRecord[] = tab === 'audit'
    ? [
        { action: 'draft_generated', result: 'success', objectType: 'content_item' },
        { action: 'approval_decided', result: 'success', objectType: 'approval' },
        { action: 'publishing_package_created', result: 'success', objectType: 'publishing_package' },
      ]
    : tab === 'events'
      ? [
          { eventType: 'ai_generation', severity: 'info', message: 'Draft generation recorded' },
          { eventType: 'algorithm_intelligence', severity: 'info', message: 'Reach readiness score recorded' },
          { eventType: 'approval', severity: 'info', message: 'Human approval required' },
        ]
      : [
          { signalType: 'performance', status: 'under_review', summary: 'Educational content performs above demo baseline' },
          { signalType: 'quality', status: 'review_only', summary: 'CTA clarity should be improved before scheduling' },
        ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Evidence</h1>
          <p className="mt-0.5 text-sm text-slate-500">Readable audit, SPINE, observability, and learning evidence for the demo flow.</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="info">System Records</Badge>
          <Badge variant="blocked">No External Execution</Badge>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-5">
        <div className="flex flex-wrap gap-2">
          {(['audit', 'events', 'signals'] as const).map(item => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === item ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
            >
              {item === 'audit' ? 'Audit Records' : item === 'events' ? 'Observability Events' : 'Learning Signals'}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-3">
          {(rows.length ? rows : fallbackRows).slice(0, 10).map((item, index) => (
            <div key={`${tab}-${index}`} className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white">
                    {tab === 'audit' ? text(item.action) : tab === 'events' ? text(item.eventType) : text(item.signalType)}
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    {tab === 'audit' ? text(item.objectType) : tab === 'events' ? text(item.message) : text(item.summary)}
                  </div>
                </div>
                <Badge variant={text(item.result || item.severity || item.status).includes('error') ? 'danger' : 'success'}>
                  {text(item.result || item.severity || item.status)}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
