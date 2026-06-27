import { useEffect, useMemo, useState } from 'react';
import { adminUsersApi, authApi, usersApi } from '../api';
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
  SecondaryAction,
} from '../components/ProductUI';

type RecordMap = Record<string, unknown>;

type RoleTemplate = {
  id: string;
  label: string;
  internalRole: string;
  description: string;
  defaultDepartment: string;
};

const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    id: 'social_media_manager',
    label: 'Social Media Manager',
    internalRole: 'specialist',
    defaultDepartment: 'Demand Generation',
    description: 'Creates campaigns, generates drafts, edits content, requests approval, and reviews performance.',
  },
  {
    id: 'marketing_manager',
    label: 'Marketing Manager',
    internalRole: 'department_head',
    defaultDepartment: 'Brand & Market Intelligence',
    description: 'Owns campaign strategy, approves department-level content, and reviews analytics and lead handoff.',
  },
  {
    id: 'approver_final_publisher',
    label: 'Approver / Final Publisher',
    internalRole: 'reviewer',
    defaultDepartment: 'Brand & Market Intelligence',
    description: 'Reviews submitted content and makes approve, reject, or request-change decisions.',
  },
  {
    id: 'lead_qualification_manager',
    label: 'Lead Qualification Manager',
    internalRole: 'department_head',
    defaultDepartment: 'Revenue Operations',
    description: 'Reviews captured leads, qualifies intent, and prepares CRM or voice handoff packages.',
  },
  {
    id: 'executive_viewer',
    label: 'Executive Viewer',
    internalRole: 'viewer',
    defaultDepartment: 'Customer Growth & Retention',
    description: 'Reads dashboards, workflow status, evidence, and business outcomes without changing records.',
  },
  {
    id: 'platform_admin',
    label: 'Platform Admin',
    internalRole: 'admin',
    defaultDepartment: 'Brand & Market Intelligence',
    description: 'Manages users, integrations, credentials, skills, and safety settings.',
  },
];

function text(value: unknown, fallback = 'Not assigned'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function contextValue(agentRep: RecordMap | null | undefined, key: string): string {
  const context = (agentRep?.permissionsContext || agentRep?.metadata) as RecordMap | undefined;
  return text(context?.[key], '');
}

function roleLabel(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());
}

export default function AdminUsers() {
  const { token } = useAuth();
  const [users, setUsers] = useState<RecordMap[]>([]);
  const [departments, setDepartments] = useState<RecordMap[]>([]);
  const [emailStatus, setEmailStatus] = useState<RecordMap | null>(null);
  const [message, setMessage] = useState('');
  const [inviteToken, setInviteToken] = useState<RecordMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '',
    name: '',
    roleTemplateId: 'social_media_manager',
    departmentId: '',
  });

  const selectedTemplate = useMemo(
    () => ROLE_TEMPLATES.find(template => template.id === form.roleTemplateId) || ROLE_TEMPLATES[0],
    [form.roleTemplateId],
  );

  async function load() {
    if (!token) return;
    const [userList, departmentList, onboardingEmail] = await Promise.all([
      adminUsersApi.list(token),
      usersApi.departments(token),
      authApi.onboardingEmailStatus(token),
    ]);
    const nextDepartments = departmentList as RecordMap[];
    setUsers(userList as RecordMap[]);
    setDepartments(nextDepartments);
    setEmailStatus(onboardingEmail as RecordMap);
    setForm(current => {
      if (current.departmentId) return current;
      const defaultDepartment = nextDepartments.find(department => text(department.name) === selectedTemplate.defaultDepartment);
      return { ...current, departmentId: defaultDepartment ? String(defaultDepartment.id) : '' };
    });
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function run() {
      try {
        const [userList, departmentList, onboardingEmail] = await Promise.all([
          adminUsersApi.list(token as string),
          usersApi.departments(token as string),
          authApi.onboardingEmailStatus(token as string),
        ]);
        if (cancelled) return;
        const nextDepartments = departmentList as RecordMap[];
        setUsers(userList as RecordMap[]);
        setDepartments(nextDepartments);
        setEmailStatus(onboardingEmail as RecordMap);
        const defaultDepartment = nextDepartments.find(department => text(department.name) === selectedTemplate.defaultDepartment);
        if (defaultDepartment) setForm(current => ({ ...current, departmentId: current.departmentId || String(defaultDepartment.id) }));
      } catch (err) {
        if (!cancelled) setMessage(err instanceof Error ? err.message : 'Failed to load users');
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [token, selectedTemplate.defaultDepartment]);

  async function createUser() {
    if (!token) return;
    setLoading(true);
    setMessage('');
    try {
      await adminUsersApi.create({
        email: form.email,
        name: form.name,
        role: selectedTemplate.internalRole,
        departmentId: form.departmentId || null,
        businessRole: selectedTemplate.id,
        roleTemplate: selectedTemplate.label,
      }, token);
      setMessage(`${selectedTemplate.label} created inactive with AgentRep. Send an invite before the user can sign in.`);
      setForm({ email: '', name: '', roleTemplateId: 'social_media_manager', departmentId: '' });
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setLoading(false);
    }
  }

  async function setActive(id: string, active: boolean) {
    if (!token) return;
    setLoading(true);
    try {
      if (active) await adminUsersApi.activate(id, token);
      else await adminUsersApi.deactivate(id, token);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setLoading(false);
    }
  }

  async function createInviteToken(userId: string, purpose: 'invite' | 'password_reset', sendEmail = false) {
    if (!token) return;
    setLoading(true);
    setInviteToken(null);
    try {
      const result = await authApi.createOnboardingToken({ userId, purpose, sendEmail }, token);
      const record = result as RecordMap;
      setInviteToken(typeof record.token === 'string' && record.token.trim() ? record : null);
      setMessage(sendEmail ? `${roleLabel(purpose)} email sent. No raw token was returned to the browser.` : `${roleLabel(purpose)} token created. Raw token is returned once.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to create onboarding token');
    } finally {
      setLoading(false);
    }
  }

  const activeUsers = users.filter(user => Boolean(user.isActive)).length;
  const agentRepCount = users.filter(user => Boolean(user.agentRep)).length;
  const emailReady = Boolean(emailStatus?.configured) && Boolean(emailStatus?.enabled) && text(emailStatus?.appBaseUrlStatus, '').toLowerCase() === 'configured';

  return (
    <ProductPage
      eyebrow="Admin"
      title="Users, Roles & AgentReps"
      subtitle="Create business users with safe internal permission mapping, assign departments, and verify every account has an AgentRep for governed work."
      action={<ProductStatus tone="info">Admin / CCO Only</ProductStatus>}
    >
      {message && <Notice tone={message.toLowerCase().includes('failed') || message.toLowerCase().includes('error') ? 'danger' : 'good'}>{message}</Notice>}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Users" value={users.length} detail={`${activeUsers} active accounts`} tone="info" />
        <MetricCard label="AgentReps" value={agentRepCount} detail="Session identity coverage" tone={agentRepCount === users.length ? 'good' : 'warn'} />
        <MetricCard label="Invite Email" value={emailReady ? 'Ready' : 'Needs SMTP'} detail="SMTP + APP_BASE_URL required" tone={emailReady ? 'good' : 'warn'} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <ProductCard title="Create User" subtitle="Choose the business role first. The system maps it to a safe internal permission role and records the business role on the AgentRep.">
          <div className="space-y-4">
            <Field label="Business Role Template">
              <select
                value={form.roleTemplateId}
                onChange={(event) => {
                  const template = ROLE_TEMPLATES.find(item => item.id === event.target.value) || ROLE_TEMPLATES[0];
                  const defaultDepartment = departments.find(department => text(department.name) === template.defaultDepartment);
                  setForm({ ...form, roleTemplateId: template.id, departmentId: defaultDepartment ? String(defaultDepartment.id) : form.departmentId });
                }}
                className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950"
              >
                {ROLE_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}
              </select>
            </Field>

            <Notice tone="info">
              {selectedTemplate.description} Internal permission role: {roleLabel(selectedTemplate.internalRole)}.
            </Notice>

            <Field label="Name">
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500" />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500" />
            </Field>
            <Field label="Department">
              <select value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })} className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950">
                <option value="">No department</option>
                {departments.map((department) => <option key={String(department.id)} value={String(department.id)}>{text(department.name)}</option>)}
              </select>
            </Field>
            <Notice tone={emailReady ? 'good' : 'warn'}>
              {emailReady
                ? 'SMTP invite delivery is configured. The user will set their own password from a one-time link.'
                : 'SMTP invite delivery is not fully configured. You can still generate a one-time manual onboarding link.'}
            </Notice>

            <PrimaryAction disabled={loading || !form.email || !form.name} onClick={createUser}>
              {loading ? 'Creating...' : 'Create User + AgentRep'}
            </PrimaryAction>
          </div>
        </ProductCard>

        <ProductCard title="User Directory" subtitle="Business roles are displayed to operators; internal roles remain the authorization source.">
          {users.length ? (
            <ProductTable
              columns={['User', 'Business Role', 'Internal Role', 'Department', 'AgentRep', 'Status', 'Action']}
              rows={users.map(user => {
                const agentRep = user.agentRep as RecordMap | null;
                const active = Boolean(user.isActive);
                return [
                  <div>
                    <div className="font-medium text-neutral-950">{text(user.name)}</div>
                    <div className="mt-1 text-xs text-neutral-500">{text(user.email)}</div>
                  </div>,
                  contextValue(agentRep, 'roleTemplate') || roleLabel(contextValue(agentRep, 'businessRole') || text(user.role)),
                  roleLabel(text(user.role)),
                  text(user.department),
                  <div>
                    <div className="font-medium text-neutral-800">{text(agentRep?.name, 'Missing AgentRep')}</div>
                    <div className="mt-1 text-xs text-neutral-500">{text(agentRep?.status, 'missing')}</div>
                  </div>,
                  <ProductStatus tone={active ? 'good' : 'danger'}>{active ? 'Active' : 'Inactive'}</ProductStatus>,
                  <div className="flex flex-wrap gap-2">
                    <SecondaryAction disabled={loading || !emailReady} onClick={() => createInviteToken(String(user.id), 'invite', true)}>Send Invite Email</SecondaryAction>
                    <SecondaryAction disabled={loading} onClick={() => createInviteToken(String(user.id), 'invite', false)}>Manual Link</SecondaryAction>
                    <SecondaryAction disabled={loading || !emailReady} onClick={() => createInviteToken(String(user.id), 'password_reset', true)}>Send Reset</SecondaryAction>
                    <SecondaryAction disabled={loading} onClick={() => setActive(String(user.id), !active)}>
                      {active ? 'Deactivate' : 'Activate'}
                    </SecondaryAction>
                  </div>,
                ];
              })}
            />
          ) : (
            <EmptyProductState message="No users loaded. Check admin permissions and backend availability." />
          )}
        </ProductCard>
      </div>

      {inviteToken && (
        <ProductCard title="One-Time Onboarding Token" subtitle="Deliver this through an approved secure channel. The backend stores only a hash and will not show it again.">
          <DetailGrid items={[
            { label: 'Purpose', value: roleLabel(text(inviteToken.purpose)) },
            { label: 'Expires', value: text(inviteToken.expiresAt) },
            { label: 'Returned Once', value: String(inviteToken.rawTokenReturnedOnce) },
          ]} />
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 font-mono text-sm text-amber-900 break-all">
            {text(inviteToken.token)}
          </div>
        </ProductCard>
      )}

      <ProductCard title="Effective Role Mapping" subtitle="This keeps the product language business-friendly while the backend retains controlled authorization semantics.">
        <DetailGrid items={ROLE_TEMPLATES.map(template => ({
          label: template.label,
          value: `${template.description} Internal role: ${roleLabel(template.internalRole)}.`,
        }))} />
      </ProductCard>
    </ProductPage>
  );
}
