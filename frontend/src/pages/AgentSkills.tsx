import { useEffect, useMemo, useState } from 'react';
import { mcpRuntimeApi, usersApi } from '../api';
import { useAuth } from '../contexts/useAuth';
import {
  DetailGrid,
  EmptyProductState,
  Field,
  MetricCard,
  Notice,
  PrimaryAction,
  ProductCard,
  ProductPage,
  ProductStatus,
  ProductTable,
} from '../components/ProductUI';

type RecordMap = Record<string, unknown>;
type SkillKind = 'functional' | 'governance';
type SkillSource = 'stitch_native' | 'mcp_bound';

const CAPABILITY_PRESETS = [
  'campaign.strategy',
  'social.draft_generation',
  'social.platform_adaptation',
  'social.reach_scoring',
  'approval.routing',
  'publishing.preparation',
  'analytics.summary',
  'lead.qualification',
  'crm.handoff_preparation',
  'voice_chat.handoff_preparation',
  'audit.spine_evidence',
];

function text(value: unknown, fallback = 'Not assigned'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function list(value: unknown): RecordMap[] {
  return Array.isArray(value) ? value as RecordMap[] : [];
}

function display(value: string): string {
  return value.replaceAll('_', ' ').replaceAll('.', ' / ').replace(/\b\w/g, char => char.toUpperCase());
}

export default function AgentSkills() {
  const { token } = useAuth();
  const [agentReps, setAgentReps] = useState<RecordMap[]>([]);
  const [connectors, setConnectors] = useState<RecordMap[]>([]);
  const [selectedAgentRepId, setSelectedAgentRepId] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    kind: 'functional' as SkillKind,
    source: 'stitch_native' as SkillSource,
    name: 'Social Draft Generation',
    description: 'Generate platform-ready campaign copy from an approved brief.',
    capability: 'social.draft_generation',
    connectorId: '',
    toolName: '',
    policyScope: 'content_quality,approval_routing,safety_review',
  });
  const [githubForm, setGithubForm] = useState({
    repositoryUrl: '',
    skillPath: 'SKILL.md',
    capability: 'imported.github_skill',
  });

  const selectedAgentRep = useMemo(
    () => agentReps.find(agentRep => String(agentRep.id) === selectedAgentRepId) || agentReps[0] || null,
    [agentReps, selectedAgentRepId],
  );

  async function load() {
    if (!token) return;
    const [agentRepData, connectorData] = await Promise.all([
      usersApi.agentReps(token),
      mcpRuntimeApi.connectors(token),
    ]);
    const nextAgentReps = agentRepData as RecordMap[];
    setAgentReps(nextAgentReps);
    setConnectors(connectorData as RecordMap[]);
    setSelectedAgentRepId(current => current || String(nextAgentReps[0]?.id || ''));
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function run() {
      try {
        const [agentRepData, connectorData] = await Promise.all([
          usersApi.agentReps(token as string),
          mcpRuntimeApi.connectors(token as string),
        ]);
        if (cancelled) return;
        const nextAgentReps = agentRepData as RecordMap[];
        setAgentReps(nextAgentReps);
        setConnectors(connectorData as RecordMap[]);
        setSelectedAgentRepId(current => current || String(nextAgentReps[0]?.id || ''));
      } catch (err) {
        if (!cancelled) setMessage(err instanceof Error ? err.message : 'Failed to load AgentRep skills');
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function createSkill() {
    if (!token || !selectedAgentRep) return;
    setLoading(true);
    setMessage('');
    try {
      if (form.kind === 'functional') {
        await usersApi.createFunctionalAgent(String(selectedAgentRep.id), {
          name: form.name,
          description: form.description,
          capability: form.capability,
          config: {
            source: form.source,
            connectorId: form.source === 'mcp_bound' ? form.connectorId : null,
            toolName: form.source === 'mcp_bound' ? form.toolName : null,
            externalCallsBlocked: true,
            executionMode: 'approval_gated',
          },
        }, token);
      } else {
        await usersApi.createGovernanceAgent(String(selectedAgentRep.id), {
          name: form.name,
          description: form.description,
          policyScope: form.policyScope.split(',').map(scope => scope.trim()).filter(Boolean),
          vetoAuthority: false,
          config: {
            source: form.source,
            connectorId: form.source === 'mcp_bound' ? form.connectorId : null,
            evaluatorOnly: true,
          },
        }, token);
      }
      setMessage(`${form.name} saved under ${text(selectedAgentRep.name)}.`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save skill');
    } finally {
      setLoading(false);
    }
  }

  async function importGithubSkill() {
    if (!token || !selectedAgentRep) return;
    setLoading(true);
    setMessage('');
    try {
      await usersApi.importGithubSkill(String(selectedAgentRep.id), githubForm, token);
      setMessage('GitHub skill metadata imported. Repository code was not executed.');
      setGithubForm({ repositoryUrl: '', skillPath: 'SKILL.md', capability: 'imported.github_skill' });
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to import GitHub skill');
    } finally {
      setLoading(false);
    }
  }

  const functionalAgents = list(selectedAgentRep?.functionalAgents);
  const governanceAgents = list(selectedAgentRep?.governanceAgents);
  const activeConnectors = connectors.filter(connector => text(connector.status) === 'active' || text(connector.status) === 'planned');

  return (
    <ProductPage
      eyebrow="Admin"
      title="Agent Skills"
      subtitle="Create governed skills under user AgentReps. Skills are persisted as functional or governance agents and can be bound to registered MCP connectors."
      action={<ProductStatus tone="info">Persisted AgentRep Skills</ProductStatus>}
    >
      {message && <Notice tone={message.toLowerCase().includes('failed') || message.toLowerCase().includes('permission') ? 'danger' : 'good'}>{message}</Notice>}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="AgentReps" value={agentReps.length} detail="Available identities" tone="info" />
        <MetricCard label="Functional Skills" value={functionalAgents.length} detail="For selected AgentRep" tone={functionalAgents.length ? 'good' : 'warn'} />
        <MetricCard label="Governance Skills" value={governanceAgents.length} detail="Evaluator roles" tone={governanceAgents.length ? 'info' : 'default'} />
        <MetricCard label="MCP Connectors" value={connectors.length} detail="Available for binding" tone={connectors.length ? 'good' : 'warn'} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-6">
        <ProductCard title="Create Skill" subtitle="Choose an AgentRep, skill type, and source. MCP-bound skills remain blocked from direct external execution.">
          <div className="space-y-4">
            <Field label="AgentRep">
              <select value={selectedAgentRepId} onChange={(event) => setSelectedAgentRepId(event.target.value)} className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950">
                {agentReps.map(agentRep => (
                  <option key={String(agentRep.id)} value={String(agentRep.id)}>
                    {text(agentRep.name)} / {text(agentRep.userEmail)}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Skill Type">
                <select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as SkillKind })} className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950">
                  <option value="functional">Functional Skill</option>
                  <option value="governance">Governance Skill</option>
                </select>
              </Field>
              <Field label="Source">
                <select value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value as SkillSource })} className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950">
                  <option value="stitch_native">STITCH Native</option>
                  <option value="mcp_bound">MCP-Bound</option>
                </select>
              </Field>
            </div>

            <Field label="Skill Name">
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500" />
            </Field>
            <Field label="Description">
              <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="min-h-24 w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500" />
            </Field>

            {form.kind === 'functional' ? (
              <Field label="Owning Capability">
                <select value={form.capability} onChange={(event) => setForm({ ...form, capability: event.target.value })} className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950">
                  {CAPABILITY_PRESETS.map(capability => <option key={capability} value={capability}>{display(capability)}</option>)}
                </select>
              </Field>
            ) : (
              <Field label="Policy Scope" helper="Comma-separated evaluator scopes. Governance skills are evaluator-only, not final human authority.">
                <input value={form.policyScope} onChange={(event) => setForm({ ...form, policyScope: event.target.value })} className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500" />
              </Field>
            )}

            {form.source === 'mcp_bound' && (
              <div className="space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <Field label="Registered MCP Connector">
                  <select value={form.connectorId} onChange={(event) => setForm({ ...form, connectorId: event.target.value })} className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950">
                    <option value="">Select connector</option>
                    {activeConnectors.map(connector => <option key={String(connector.id)} value={String(connector.id)}>{text(connector.name)}</option>)}
                  </select>
                </Field>
                <Field label="Tool Name" helper="Use a discovered MCP tool name or enter a governed tool contract manually. Tool execution remains blocked until mediation and approval are implemented.">
                  <input value={form.toolName} onChange={(event) => setForm({ ...form, toolName: event.target.value })} placeholder="e.g. search_social_posts" className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500" />
                </Field>
              </div>
            )}

            <PrimaryAction
              disabled={loading || !selectedAgentRep || !form.name || (form.source === 'mcp_bound' && (!form.connectorId || !form.toolName))}
              onClick={createSkill}
            >
              {loading ? 'Saving...' : 'Save Skill'}
            </PrimaryAction>
          </div>
        </ProductCard>

        <ProductCard title="Import GitHub Skill" subtitle="Import skill metadata from a GitHub repository into the selected AgentRep.">
          <div className="space-y-4">
            <Field label="GitHub Repository URL">
              <input value={githubForm.repositoryUrl} onChange={(event) => setGithubForm({ ...githubForm, repositoryUrl: event.target.value })} placeholder="https://github.com/org/repo" className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Skill Path">
                <input value={githubForm.skillPath} onChange={(event) => setGithubForm({ ...githubForm, skillPath: event.target.value })} placeholder="SKILL.md" className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500" />
              </Field>
              <Field label="Capability">
                <input value={githubForm.capability} onChange={(event) => setGithubForm({ ...githubForm, capability: event.target.value })} className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500" />
              </Field>
            </div>
            <Notice tone="info">Only public GitHub/raw GitHub metadata is imported. Repository code is not executed and external calls remain blocked.</Notice>
            <PrimaryAction disabled={loading || !selectedAgentRep || !githubForm.repositoryUrl || !githubForm.skillPath} onClick={importGithubSkill}>
              {loading ? 'Importing...' : 'Import Skill Metadata'}
            </PrimaryAction>
          </div>
        </ProductCard>
        </div>

        <div className="space-y-6">
          <ProductCard title="Selected AgentRep" subtitle="The skills below belong to the selected user's AI representative.">
            {selectedAgentRep ? (
              <DetailGrid items={[
                { label: 'AgentRep', value: text(selectedAgentRep.name) },
                { label: 'User', value: `${text(selectedAgentRep.userName)} / ${text(selectedAgentRep.userEmail)}` },
                { label: 'Status', value: display(text(selectedAgentRep.status)) },
                { label: 'Type', value: display(text(selectedAgentRep.agentType)) },
              ]} />
            ) : (
              <EmptyProductState message="No AgentRep is available. Create users first from Users & Roles." />
            )}
          </ProductCard>

          <ProductCard title="Existing Skills" subtitle="This is live AgentRep skill state from the backend.">
            {functionalAgents.length || governanceAgents.length ? (
              <ProductTable
                columns={['Skill', 'Type', 'Capability / Scope', 'Source', 'Status']}
                rows={[
                  ...functionalAgents.map(skill => {
                    const config = (skill.config || {}) as RecordMap;
                    return [
                      <div>
                        <div className="font-medium text-neutral-950">{text(skill.name)}</div>
                        <div className="mt-1 text-xs text-neutral-500">{text(skill.description, 'No description')}</div>
                      </div>,
                      'Functional',
                      display(text(skill.capability)),
                      display(text(config.source, 'stitch_native')),
                      <ProductStatus tone={text(skill.status) === 'active' ? 'good' : 'warn'}>{display(text(skill.status))}</ProductStatus>,
                    ];
                  }),
                  ...governanceAgents.map(skill => {
                    const config = (skill.config || {}) as RecordMap;
                    return [
                      <div>
                        <div className="font-medium text-neutral-950">{text(skill.name)}</div>
                        <div className="mt-1 text-xs text-neutral-500">{text(skill.description, 'No description')}</div>
                      </div>,
                      'Governance',
                      list(skill.policyScope).map(scope => text(scope)).join(', ') || 'Policy scope',
                      display(text(config.source, 'stitch_native')),
                      <ProductStatus tone={text(skill.status) === 'active' ? 'good' : 'warn'}>{display(text(skill.status))}</ProductStatus>,
                    ];
                  }),
                ]}
              />
            ) : (
              <EmptyProductState message="No persisted skills are assigned to this AgentRep yet." />
            )}
          </ProductCard>

          <Notice tone="warn">
            Remote MCP discovery and GitHub import persist skill/tool metadata only. Runtime execution is still blocked until human review, capability governance, approval, and MCP mediation are complete.
          </Notice>
        </div>
      </div>
    </ProductPage>
  );
}
