import { useEffect, useState } from 'react';
import { adminUsersApi, usersApi } from '../api';
import { useAuth } from '../contexts/useAuth';
import { Alert, Card, StatusBadge } from '../components/UI';

type RecordMap = Record<string, unknown>;

const ROLES = ['admin', 'cco', 'department_head', 'specialist', 'reviewer', 'viewer'];

function text(value: unknown, fallback = 'Not assigned'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

export default function AdminUsers() {
  const { token } = useAuth();
  const [users, setUsers] = useState<RecordMap[]>([]);
  const [departments, setDepartments] = useState<RecordMap[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '',
    name: '',
    role: 'specialist',
    departmentId: '',
    password: 'TempPassword123!',
  });

  async function load() {
    if (!token) return;
    const [userList, departmentList] = await Promise.all([
      adminUsersApi.list(token),
      usersApi.departments(token),
    ]);
    setUsers(userList as RecordMap[]);
    setDepartments(departmentList as RecordMap[]);
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function run() {
      try {
        const [userList, departmentList] = await Promise.all([
          adminUsersApi.list(token as string),
          usersApi.departments(token as string),
        ]);
        if (cancelled) return;
        setUsers(userList as RecordMap[]);
        setDepartments(departmentList as RecordMap[]);
      } catch (err) {
        if (!cancelled) setMessage(err instanceof Error ? err.message : 'Failed to load users');
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function createUser() {
    if (!token) return;
    setLoading(true);
    setMessage('');
    try {
      await adminUsersApi.create({
        ...form,
        departmentId: form.departmentId || null,
      }, token);
      setMessage('User and AgentRep created. Session Context Lock is ready for the new account.');
      setForm({ email: '', name: '', role: 'specialist', departmentId: '', password: 'TempPassword123!' });
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

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <StatusBadge label="Admin / CCO only" variant="info" />
          <StatusBadge label="AgentRep required" variant="success" />
          <StatusBadge label="Session Context Lock" variant="success" />
        </div>
        <h1 className="mt-4 text-3xl font-semibold text-neutral-950">Users, Roles & AgentReps</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
          Create operators, assign roles/departments, and verify each account has an AgentRep for governed work preparation.
        </p>
      </header>

      {message && <Alert type={message.includes('Failed') || message.includes('required') ? 'warning' : 'success'}>{message}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card title="Create User">
          <div className="space-y-4">
            <Field label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
            <Field label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Role</span>
              <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="mt-2 w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950">
                {ROLES.map((role) => <option key={role} value={role}>{role.replaceAll('_', ' ')}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Department</span>
              <select value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })} className="mt-2 w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950">
                <option value="">No department</option>
                {departments.map((department) => <option key={String(department.id)} value={String(department.id)}>{text(department.name)}</option>)}
              </select>
            </label>
            <Field label="Temporary Password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} />
            <button disabled={loading || !form.email || !form.name} onClick={createUser} className="w-full rounded-md bg-neutral-950 px-5 py-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
              {loading ? 'Creating...' : 'Create User + AgentRep'}
            </button>
          </div>
        </Card>

        <Card title="User Directory">
          <div className="space-y-3">
            {users.map((user) => {
              const agentRep = user.agentRep as RecordMap | null;
              const active = Boolean(user.isActive);
              return (
                <div key={String(user.id)} className="rounded-lg border border-neutral-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-neutral-950">{text(user.name)}</div>
                      <div className="mt-1 text-sm text-neutral-500">{text(user.email)}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatusBadge label={text(user.role).replaceAll('_', ' ')} variant="info" />
                        <StatusBadge label={text(user.department)} variant="default" />
                        <StatusBadge label={active ? 'Active' : 'Inactive'} variant={active ? 'success' : 'danger'} />
                      </div>
                    </div>
                    <button disabled={loading} onClick={() => setActive(String(user.id), !active)} className="rounded-md border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
                      {active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                  <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">AgentRep</div>
                        <div className="mt-1 text-sm text-neutral-700">{text(agentRep?.name, 'Missing AgentRep')}</div>
                      </div>
                      <StatusBadge label={text(agentRep?.status, 'missing')} variant={agentRep?.status === 'active' ? 'success' : 'danger'} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500" />
    </label>
  );
}
