import { useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import { Card, StatusBadge, Alert, DemoLabel } from '../components/UI';
import { MCP_CONNECTORS } from '../modules/mcp-engine/registry-data';

export default function McpEngine() {
  useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleTestConnection = async (id: string) => {
    setTesting(id);
    setTestResult(null);
    await new Promise(r => setTimeout(r, 1000));
    setTestResult(`${id}: Mock connection successful — no external call made`);
    setTesting(null);
  };

  const selectedConnector = MCP_CONNECTORS.find(c => c.id === selected);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">MCP Engine</h1>
          <p className="text-slate-500 text-sm mt-1">Model Context Protocol — Integration & Skill Engine</p>
        </div>
        <DemoLabel>Mock/Sandbox Only — No Live Execution</DemoLabel>
      </div>

      <Alert type="info">
        <strong>Architecture:</strong> MCP servers expose tools and skills. STITCH imports and registers them into the Capability Registry. 
        Agents use approved skills through STITCH → SAIF → MCP mediation. Tools/MCP servers are never source of truth.
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Connector List */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="font-semibold text-slate-300">MCP Connectors ({MCP_CONNECTORS.length})</h2>
          {MCP_CONNECTORS.map(connector => (
            <Card key={connector.id} className={`cursor-pointer transition-all ${selected === connector.id ? 'ring-2 ring-blue-500' : ''}`}>
              <div onClick={() => setSelected(connector.id === selected ? null : connector.id)}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-white">{connector.name}</h3>
                    <p className="text-sm text-slate-400 mt-1">{connector.purpose}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge label={connector.status} variant={connector.status === 'mock' ? 'mock' : connector.status === 'sandbox_ready' ? 'info' : 'default'} />
                    <StatusBadge label={connector.direction} variant={connector.direction === 'write_blocked' ? 'danger' : 'warning'} />
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                  <span>Capability: {connector.boundCapability}</span>
                  <span>Source: {connector.sourceOfTruth}</span>
                  <span>External: {connector.externalExecution}</span>
                </div>
              </div>

              {selected === connector.id && selectedConnector && (
                <div className="mt-4 pt-4 border-t border-slate-800 space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-slate-500 mb-1">Tools/Skills</div>
                      <div className="flex flex-wrap gap-1">
                        {selectedConnector.tools.map(t => <span key={t} className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-xs">{t}</span>)}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 mb-1">Allowed Roles</div>
                      <div className="flex flex-wrap gap-1">
                        {selectedConnector.allowedRoles.map(r => <span key={r} className="px-2 py-0.5 bg-sky-500/10 text-sky-300 border border-sky-500/30 rounded text-xs">{r}</span>)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="bg-slate-900 rounded p-2">
                      <div className="text-slate-500 text-xs">Approval</div>
                      <div className="font-medium">{selectedConnector.requiresApproval ? 'Required' : 'Not required'}</div>
                    </div>
                    <div className="bg-slate-900 rounded p-2">
                      <div className="text-slate-500 text-xs">M5</div>
                      <div className="font-medium">{selectedConnector.requiresM5 ? 'Required' : 'Not required'}</div>
                    </div>
                    <div className="bg-slate-900 rounded p-2">
                      <div className="text-slate-500 text-xs">Credentials</div>
                      <div className="font-medium">{selectedConnector.credentialStatus}</div>
                    </div>
                  </div>

                  <div className="bg-slate-900 rounded p-3 text-sm">
                    <div className="text-slate-500 text-xs mb-1">Health Check</div>
                    <div>{selectedConnector.lastHealthCheck}</div>
                  </div>

                  {selectedConnector.envVars.length > 0 && (
                    <div className="bg-slate-900 rounded p-3 text-sm">
                      <div className="text-slate-500 text-xs mb-1">Required Env Vars</div>
                      <div className="font-mono text-xs">{selectedConnector.envVars.join(', ')}</div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTestConnection(selectedConnector.id)}
                      disabled={testing === selectedConnector.id}
                      className="px-3 py-1.5 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 disabled:opacity-50"
                    >
                      {testing === selectedConnector.id ? 'Testing...' : 'Test Mock Connection'}
                    </button>
                  </div>

                  {testResult && <Alert type="success">{testResult}</Alert>}

                  <Alert type="warning">
                    <strong>Safety:</strong> Source of truth is STITCH, never MCP/tool. 
                    External execution is blocked. No live activation from UI.
                  </Alert>
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Summary Panel */}
        <div className="space-y-4">
          <Card title="MCP Status Summary">
            <div className="space-y-2 text-sm">
              {['planned', 'mock', 'sandbox_ready', 'live_disabled'].map(status => {
                const count = MCP_CONNECTORS.filter(c => c.status === status).length;
                return (
                  <div key={status} className="flex justify-between">
                    <span className="capitalize">{status.replace('_', ' ')}</span>
                    <StatusBadge label={String(count)} variant={status === 'mock' ? 'mock' : status === 'sandbox_ready' ? 'info' : 'default'} />
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Safety Rules">
            <div className="space-y-2 text-xs text-slate-400">
              <div>• Source of truth: STITCH, never MCP</div>
              <div>• No real external API calls</div>
              <div>• No real MCP tool execution</div>
              <div>• External execution blocked</div>
              <div>• M5 disabled unless authorized</div>
              <div>• All actions audited</div>
            </div>
          </Card>

          <Card title="Future Path">
            <div className="font-mono text-xs bg-slate-900 rounded p-3">
              STITCH → SAIF → MCP Connector Layer → External APIs
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
