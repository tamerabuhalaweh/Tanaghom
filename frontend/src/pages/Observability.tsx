import { useState, useEffect } from 'react';
import { observabilityApi } from '../api';
import { useAuth } from '../contexts/useAuth';

export default function Observability() {
  const { token } = useAuth();
  const [events, setEvents] = useState<unknown[]>([]);
  const [audit, setAudit] = useState<unknown[]>([]);
  const [signals, setSignals] = useState<unknown[]>([]);
  const [tab, setTab] = useState<'events' | 'audit' | 'signals'>('events');

  useEffect(() => {
    if (token) {
      observabilityApi.events(token).then(setEvents).catch(console.error);
      observabilityApi.audit(token).then(setAudit).catch(console.error);
      observabilityApi.learningSignals(token).then(setSignals).catch(console.error);
    }
  }, [token]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Observability & Audit</h1>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800 flex items-center gap-2">
        <span className="px-2 py-0.5 bg-blue-200 rounded text-xs font-bold">WORKING LOCALLY</span>
        Full audit trail — every action recorded with actor, timestamp, result
      </div>

      <div className="flex gap-2 mb-4">
        {(['events', 'audit', 'signals'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded text-sm font-medium ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {t === 'events' ? 'Events' : t === 'audit' ? 'Audit Records' : 'Learning Signals'}
          </button>
        ))}
      </div>

      <div className="bg-white border rounded-lg p-4">
        {tab === 'events' && (
          <div>
            <h3 className="font-semibold mb-3">Observability Events</h3>
            {events.length > 0 ? (
              <div className="space-y-2">
                {(events as { id: string; eventType: string; eventCategory: string; severity: string; message: string; timestamp: string }[]).slice(0, 10).map(e => (
                  <div key={e.id} className="border-b pb-2">
                    <div className="flex justify-between">
                      <span className="font-medium text-sm">{e.eventType}</span>
                      <span className={`text-xs px-1 py-0.5 rounded ${e.severity === 'error' ? 'bg-red-100 text-red-700' : e.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{e.severity}</span>
                    </div>
                    <div className="text-xs text-gray-500">{e.message}</div>
                  </div>
                ))}
              </div>
            ) : <div className="text-gray-400 text-sm">No events recorded yet. Actions will appear here as you use the platform.</div>}
          </div>
        )}

        {tab === 'audit' && (
          <div>
            <h3 className="font-semibold mb-3">Audit Records</h3>
            {audit.length > 0 ? (
              <div className="space-y-2">
                {(audit as { id: string; actor: string; action: string; objectType: string; result: string; timestamp: string }[]).slice(0, 10).map(a => (
                  <div key={a.id} className="border-b pb-2">
                    <div className="flex justify-between">
                      <span className="text-sm">{a.actor} — {a.action}</span>
                      <span className={`text-xs px-1 py-0.5 rounded ${a.result === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{a.result}</span>
                    </div>
                    <div className="text-xs text-gray-500">{a.objectType}</div>
                  </div>
                ))}
              </div>
            ) : <div className="text-gray-400 text-sm">No audit records yet. All actions will be logged here.</div>}
          </div>
        )}

        {tab === 'signals' && (
          <div>
            <h3 className="font-semibold mb-3">Learning Signals</h3>
            {signals.length > 0 ? (
              <div className="space-y-2">
                {(signals as { id: string; signalType: string; status: string; summary: string }[]).map(s => (
                  <div key={s.id} className="border-b pb-2">
                    <div className="flex justify-between">
                      <span className="text-sm">{s.signalType}</span>
                      <span className="text-xs px-1 py-0.5 bg-blue-100 text-blue-700 rounded">{s.status}</span>
                    </div>
                    <div className="text-xs text-gray-500">{s.summary}</div>
                  </div>
                ))}
              </div>
            ) : <div className="text-gray-400 text-sm">No learning signals yet. Signals are generated from analytics and campaign outcomes.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
