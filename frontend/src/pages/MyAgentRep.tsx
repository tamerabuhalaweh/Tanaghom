import { useEffect, useState } from 'react';
import { usersApi } from '../api';
import { useAuth } from '../contexts/useAuth';
import {
  DetailGrid,
  EmptyProductState,
  MetricCard,
  Notice,
  PrimaryAction,
  ProductCard,
  ProductPage,
  ProductStatus,
  ProductTable,
} from '../components/ProductUI';

type RecordMap = Record<string, unknown>;

function text(value: unknown, fallback = 'Not assigned'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function list(value: unknown): RecordMap[] {
  return Array.isArray(value) ? value as RecordMap[] : [];
}

function display(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());
}

export default function MyAgentRep() {
  const { token, user, agentRep: sessionAgentRep } = useAuth();
  const [agentRep, setAgentRep] = useState<RecordMap | null>((sessionAgentRep as RecordMap | null) || null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!token) return;
    const data = await usersApi.myAgentRep(token);
    setAgentRep((data as RecordMap | null) || null);
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function run() {
      try {
        const data = await usersApi.myAgentRep(token as string);
        if (!cancelled) setAgentRep((data as RecordMap | null) || null);
      } catch (err) {
        if (!cancelled) setMessage(err instanceof Error ? err.message : 'Failed to load AgentRep');
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function createOwnAgentRep() {
    if (!token) return;
    setLoading(true);
    setMessage('');
    try {
      const data = await usersApi.createMyAgentRep(token);
      setAgentRep(data as RecordMap);
      setMessage('Your AgentRep is ready and attached to your session identity.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to create AgentRep');
    } finally {
      setLoading(false);
    }
  }

  const context = (agentRep?.permissionsContext || agentRep?.metadata || {}) as RecordMap;
  const functionalAgents = list(agentRep?.functionalAgents);
  const governanceAgents = list(agentRep?.governanceAgents);

  return (
    <ProductPage
      eyebrow="My workspace"
      title="My AI Rep"
      subtitle="View the AI representative attached to your user account, the business role it carries, and the skills currently assigned to it."
      action={<ProductStatus tone={agentRep ? 'good' : 'warn'}>{agentRep ? 'AgentRep Active' : 'Setup Required'}</ProductStatus>}
    >
      {message && <Notice tone={message.toLowerCase().includes('failed') ? 'danger' : 'good'}>{message}</Notice>}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="User" value={text((user as RecordMap | null)?.name, 'Signed in')} detail={text((user as RecordMap | null)?.email)} tone="info" />
        <MetricCard label="Business Role" value={text(context.roleTemplate || context.businessRole || (user as RecordMap | null)?.role)} detail="Recorded on AgentRep context" tone="good" />
        <MetricCard label="Functional Skills" value={functionalAgents.length} detail="Assigned executable skills" tone={functionalAgents.length ? 'good' : 'warn'} />
        <MetricCard label="Governance Skills" value={governanceAgents.length} detail="Reviewer/evaluator skills" tone={governanceAgents.length ? 'info' : 'default'} />
      </div>

      {agentRep ? (
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <ProductCard title="AgentRep Identity" subtitle="This identity is loaded into your session and used for governed actions.">
            <DetailGrid items={[
              { label: 'Name', value: text(agentRep.name) },
              { label: 'Status', value: display(text(agentRep.status)) },
              { label: 'Agent Type', value: display(text(agentRep.agentType)) },
              { label: 'Business Role', value: text(context.roleTemplate || context.businessRole || 'Not recorded') },
              { label: 'Internal Role', value: display(text(context.role || (user as RecordMap | null)?.role)) },
              { label: 'Department', value: text((user as RecordMap | null)?.departmentName || context.departmentId, 'Assigned by admin') },
            ]} />
          </ProductCard>

          <ProductCard title="Assigned Skills" subtitle="Skills are persisted as functional or governance agents under your AgentRep.">
            {functionalAgents.length || governanceAgents.length ? (
              <ProductTable
                columns={['Skill', 'Type', 'Capability / Scope', 'Status']}
                rows={[
                  ...functionalAgents.map(skill => [
                    text(skill.name),
                    'Functional',
                    text(skill.capability),
                    <ProductStatus tone={text(skill.status) === 'active' ? 'good' : 'warn'}>{display(text(skill.status))}</ProductStatus>,
                  ]),
                  ...governanceAgents.map(skill => [
                    text(skill.name),
                    'Governance',
                    list(skill.policyScope).map(item => text(item)).join(', ') || 'Policy scope',
                    <ProductStatus tone={text(skill.status) === 'active' ? 'good' : 'warn'}>{display(text(skill.status))}</ProductStatus>,
                  ]),
                ]}
              />
            ) : (
              <EmptyProductState
                title="No skills assigned yet"
                message="Ask an admin to assign functional skills such as campaign strategy, social draft generation, reach scoring, approval routing, or lead handoff."
              />
            )}
          </ProductCard>
        </div>
      ) : (
        <ProductCard title="Initialize AgentRep" subtitle="Most users receive an AgentRep automatically when the admin creates the account. This fallback creates only your own AgentRep.">
          <EmptyProductState
            title="No AgentRep found"
            message="Create your own AgentRep if the admin-provisioned identity is missing. The new identity will be tied only to your authenticated user."
            action={<PrimaryAction disabled={loading} onClick={createOwnAgentRep}>{loading ? 'Creating...' : 'Create My AgentRep'}</PrimaryAction>}
          />
        </ProductCard>
      )}
    </ProductPage>
  );
}
