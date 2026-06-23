import { useAuth } from '../contexts/useAuth';
import { Card, StatusBadge, Alert, DemoLabel } from '../components/UI';
import { MCP_SKILLS } from '../modules/mcp-engine/registry-data';

export default function AgentSkills() {
  useAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agent Skills</h1>
          <p className="text-gray-500 text-sm mt-1">Governed capabilities — not random tools</p>
        </div>
        <DemoLabel>STITCH Native / MCP Imported / Planned</DemoLabel>
      </div>

      <Alert type="info">
        <strong>Architecture:</strong> Agents use skills only through STITCH capability resolution and SAIF approval. 
        Agents must not call MCP tools directly. OpenClaw must not call MCP tools directly.
      </Alert>

      <div className="space-y-3">
        {MCP_SKILLS.map(skill => (
          <Card key={skill.id}>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-gray-900">{skill.name}</h3>
                  <StatusBadge label={skill.source.replace('_', ' ')} variant={skill.source === 'stitch_native' ? 'success' : skill.source === 'mcp_imported' ? 'info' : 'default'} />
                  <StatusBadge label={skill.status} variant={skill.status === 'working' ? 'success' : skill.status === 'mock' ? 'mock' : 'default'} />
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                  <div>
                    <div className="text-gray-500 text-xs">Capability</div>
                    <div>{skill.owningCapability}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Role</div>
                    <div>{skill.allowedRole}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Input</div>
                    <div className="truncate">{skill.inputData}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Output</div>
                    <div className="truncate">{skill.outputArtifact}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  {skill.boundConnector && <span className="text-gray-500">MCP: {skill.boundConnector}</span>}
                  {skill.requiresApproval && <StatusBadge label="Approval Required" variant="warning" />}
                  {skill.saifRequired && <StatusBadge label="SAIF Required" variant="info" />}
                  {skill.auditEnabled && <StatusBadge label="Audited" variant="success" />}
                  {skill.canCallExternal ? <StatusBadge label="Can Call External" variant="danger" /> : <StatusBadge label="External Blocked" variant="success" />}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card title="Skill Governance Rules">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="font-medium text-gray-200">Allowed</div>
            <div className="text-gray-600">• Skills accessed through STITCH capability resolution</div>
            <div className="text-gray-600">• SAIF approval for high-risk skills</div>
            <div className="text-gray-600">• Full audit trail for all skill executions</div>
            <div className="text-gray-600">• MCP mediation for external skills</div>
          </div>
          <div className="space-y-2">
            <div className="font-medium text-gray-200">Blocked</div>
            <div className="text-gray-600">• Direct MCP tool calls by agents</div>
            <div className="text-gray-600">• Direct MCP tool calls by OpenClaw</div>
            <div className="text-gray-600">• External system access without approval</div>
            <div className="text-gray-600">• M5 execution without authorization</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
