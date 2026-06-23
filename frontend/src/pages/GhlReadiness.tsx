import { useAuth } from '../contexts/useAuth';
import { Card, StatusBadge, Alert, DemoLabel } from '../components/UI';
import { GHL_READINESS, CONTENT_ALGO_READINESS } from '../modules/mcp-engine/registry-data';

export default function GhlReadiness() {
  useAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">GoHighLevel CRM MCP Readiness</h1>
          <p className="text-gray-500 text-sm mt-1">Lead capture, qualification, CRM handoff</p>
        </div>
        <DemoLabel>Mock/Planned — No Real CRM Writes</DemoLabel>
      </div>

      <Alert type="warning">
        <strong>Current State:</strong> {GHL_READINESS.currentState}. {GHL_READINESS.demoState}. 
        Real CRM writes are blocked.
      </Alert>

      <div className="grid grid-cols-2 gap-6">
        <Card title="Purpose">
          <p className="text-sm text-gray-400">{GHL_READINESS.purpose}</p>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Current State</span>
              <StatusBadge label={GHL_READINESS.currentState} variant="mock" />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Demo State</span>
              <span>{GHL_READINESS.demoState}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Real CRM Writes</span>
              <StatusBadge label={GHL_READINESS.realCrmWrites} variant="danger" />
            </div>
          </div>
        </Card>

        <Card title="Required Credentials">
          <div className="space-y-3">
            {GHL_READINESS.requiredCredentials.map(cred => (
              <div key={cred.name} className="flex items-center justify-between rounded-lg bg-gray-800/50 p-2">
                <div>
                  <div className="font-mono text-sm">{cred.name}</div>
                  <div className="text-xs text-gray-500">{cred.description}</div>
                </div>
                <StatusBadge label={cred.status} variant={cred.status === 'configured' ? 'success' : 'warning'} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card title="Required Approvals">
          <div className="space-y-2">
            {GHL_READINESS.requiredApprovals.map((approval, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <StatusBadge label="Required" variant="warning" />
                <span>{approval}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Data Boundary">
          <div className="space-y-2">
            {GHL_READINESS.dataBoundary.map((boundary, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <StatusBadge label="Enforced" variant="success" />
                <span>{boundary}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Future Integration Path">
        <div className="rounded-lg bg-gray-800/50 p-4 font-mono text-sm text-gray-300">
          {GHL_READINESS.futurePath}
        </div>
      </Card>

      {/* Content/Social Algorithm Readiness */}
      <div className="mt-8">
        <h2 className="mb-4 text-xl font-bold text-white">Content / Social Algorithm MCP Readiness</h2>
        <Alert type="info">
          <strong>Demo Intelligence:</strong> Using internal deterministic rules and mock analytics. 
          Official API connectors planned.
        </Alert>

        <div className="space-y-3 mt-4">
          {CONTENT_ALGO_READINESS.capabilities.map(cap => (
            <Card key={cap.name}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white">{cap.name}</h3>
                  <p className="text-sm text-gray-400">{cap.label}</p>
                </div>
                <StatusBadge label={cap.status} variant={cap.status === 'working' ? 'success' : 'mock'} />
              </div>
            </Card>
          ))}
        </div>

        <Card title="Future Path" className="mt-4">
          <div className="rounded-lg bg-gray-800/50 p-4 font-mono text-sm text-gray-300">
            {CONTENT_ALGO_READINESS.futurePath}
          </div>
        </Card>
      </div>
    </div>
  );
}
