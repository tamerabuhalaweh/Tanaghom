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
  return Array.isArray(value) ? (value as RecordMap[]) : [];
}

function display(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
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
        if (!cancelled) setMessage(err instanceof Error ? err.message : 'Could not load your profile');
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
      setMessage('Your profile is ready and linked to your account.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not create your profile');
    } finally {
      setLoading(false);
    }
  }

  const context = (agentRep?.permissionsContext || agentRep?.metadata || {}) as RecordMap;
  const functionalAgents = list(agentRep?.functionalAgents);
  const governanceAgents = list(agentRep?.governanceAgents);

  return (
    <ProductPage
      eyebrow="Your Workspace"
      title="My Profile"
      subtitle="Your account details, assigned role, and the skills available to you."
      action={
        <ProductStatus tone={agentRep ? 'good' : 'warn'}>
          {agentRep ? 'Profile Active' : 'Setup Required'}
        </ProductStatus>
      }
    >
      {message && (
        <Notice tone={message.toLowerCase().includes('failed') || message.toLowerCase().includes('could not') ? 'danger' : 'good'}>
          {message}
        </Notice>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Name"
          value={text((user as RecordMap | null)?.name, 'Signed in')}
          detail={text((user as RecordMap | null)?.email)}
          tone="info"
        />
        <MetricCard
          label="Role"
          value={text(context.roleTemplate || context.businessRole || (user as RecordMap | null)?.role)}
          detail="Assigned by your admin"
          tone="good"
        />
        <MetricCard
          label="Functional Skills"
          value={functionalAgents.length}
          detail="Capabilities available to you"
          tone={functionalAgents.length ? 'good' : 'warn'}
        />
        <MetricCard
          label="Review Skills"
          value={governanceAgents.length}
          detail="Approval and evaluation capabilities"
          tone={governanceAgents.length ? 'info' : 'default'}
        />
      </div>

      {agentRep ? (
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <ProductCard
            title="Profile Details"
            subtitle="Your account identity and role. Set by your admin when your account was created."
          >
            <DetailGrid
              items={[
                { label: 'Display Name', value: text(agentRep.name) },
                { label: 'Status', value: display(text(agentRep.status)) },
                { label: 'Profile Type', value: display(text(agentRep.agentType)) },
                {
                  label: 'Business Role',
                  value: text(context.roleTemplate || context.businessRole || 'Not recorded'),
                },
                {
                  label: 'System Role',
                  value: display(text(context.role || (user as RecordMap | null)?.role)),
                },
                {
                  label: 'Department',
                  value: text(
                    (user as RecordMap | null)?.departmentName || context.departmentId,
                    'Assigned by admin',
                  ),
                },
              ]}
            />
          </ProductCard>

          <ProductCard
            title="Your Skills"
            subtitle="Skills assigned to you by your admin. These determine what you can do in the platform."
          >
            {functionalAgents.length || governanceAgents.length ? (
              <ProductTable
                columns={['Skill', 'Type', 'Capability', 'Status']}
                rows={[
                  ...functionalAgents.map((skill) => [
                    text(skill.name),
                    'Functional',
                    text(skill.capability),
                    <ProductStatus tone={text(skill.status) === 'active' ? 'good' : 'warn'}>
                      {display(text(skill.status))}
                    </ProductStatus>,
                  ]),
                  ...governanceAgents.map((skill) => [
                    text(skill.name),
                    'Review',
                    list(skill.policyScope)
                      .map((item) => text(item))
                      .join(', ') || 'Review scope',
                    <ProductStatus tone={text(skill.status) === 'active' ? 'good' : 'warn'}>
                      {display(text(skill.status))}
                    </ProductStatus>,
                  ]),
                ]}
              />
            ) : (
              <EmptyProductState
                title="No skills assigned yet"
                message="Your admin assigns skills based on your role. This includes things like campaign strategy, content drafting, quality review, and lead management."
              />
            )}
          </ProductCard>
        </div>
      ) : (
        <ProductCard
          title="Set Up Your Profile"
          subtitle="Your profile is usually created automatically when your admin adds you. If it's missing, you can create it here."
        >
          <EmptyProductState
            title="Profile not found"
            message="This happens if your profile wasn't set up during account creation. You can create it now - it will be linked to your account."
            action={
              <PrimaryAction disabled={loading} onClick={createOwnAgentRep}>
                {loading ? 'Creating...' : 'Set Up My Profile'}
              </PrimaryAction>
            }
          />
        </ProductCard>
      )}
    </ProductPage>
  );
}
