import { useEffect, useState } from 'react';
import { tenantAdminApi } from '../api';
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

function text(value: unknown, fallback = 'Not available'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function objectValue(value: unknown): RecordMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordMap : {};
}

function tone(value: string): 'good' | 'warn' | 'danger' | 'info' {
  const lower = value.toLowerCase();
  if (lower.includes('passed') || lower.includes('active')) return 'good';
  if (lower.includes('critical')) return 'danger';
  if (lower.includes('attention') || lower.includes('missing')) return 'warn';
  return 'info';
}

export default function TenantAdmin() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<RecordMap | null>(null);
  const [isolation, setIsolation] = useState<RecordMap | null>(null);
  const [lifecycle, setLifecycle] = useState<RecordMap | null>(null);
  const [name, setName] = useState('');
  const [lifecycleReason, setLifecycleReason] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!token) return;
    const [summaryResult, isolationResult, lifecycleResult] = await Promise.all([
      tenantAdminApi.summary(token),
      tenantAdminApi.isolationReport(token),
      tenantAdminApi.lifecycle(token),
    ]);
    const nextSummary = summaryResult as RecordMap;
    setSummary(nextSummary);
    setIsolation(isolationResult as RecordMap);
    setLifecycle(lifecycleResult as RecordMap);
    setName(text(objectValue(nextSummary.tenant).name, ''));
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function run() {
      try {
        const [summaryResult, isolationResult, lifecycleResult] = await Promise.all([
          tenantAdminApi.summary(token as string),
          tenantAdminApi.isolationReport(token as string),
          tenantAdminApi.lifecycle(token as string),
        ]);
        if (cancelled) return;
        const nextSummary = summaryResult as RecordMap;
        setSummary(nextSummary);
        setIsolation(isolationResult as RecordMap);
        setLifecycle(lifecycleResult as RecordMap);
        setName(text(objectValue(nextSummary.tenant).name, ''));
      } catch (err) {
        if (!cancelled) setMessage(err instanceof Error ? err.message : 'Failed to load tenant admin');
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function saveTenantName() {
    if (!token || !name.trim()) return;
    setSaving(true);
    setMessage('');
    try {
      await tenantAdminApi.update({ name }, token);
      setMessage('Tenant name updated.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to update tenant');
    } finally {
      setSaving(false);
    }
  }

  async function changeLifecycle(action: 'suspend' | 'reactivate' | 'archive') {
    if (!token || lifecycleReason.trim().length < 3) return;
    setSaving(true);
    setMessage('');
    try {
      const result = await tenantAdminApi.updateLifecycle({ action, reason: lifecycleReason }, token) as RecordMap;
      setMessage(text(result._label, 'Tenant lifecycle updated.'));
      setLifecycleReason('');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to update tenant lifecycle');
    } finally {
      setSaving(false);
    }
  }

  const tenant = objectValue(summary?.tenant);
  const users = objectValue(summary?.users);
  const memberships = objectValue(summary?.memberships);
  const credentials = objectValue(summary?.credentials);
  const counts = objectValue(isolation?.counts);
  const checks = objectValue(isolation?.checks);
  const findings = Array.isArray(isolation?.findings) ? isolation.findings as RecordMap[] : [];
  const isolationStatus = text(isolation?.status, 'not checked');
  const lifecyclePolicy = objectValue(lifecycle?.lifecyclePolicy);

  return (
    <ProductPage
      eyebrow="SaaS Administration"
      title="Tenant Administration"
      subtitle="Manage this customer workspace and verify that users, memberships, and credentials are isolated to the authenticated tenant."
      action={<ProductStatus tone={tone(isolationStatus)}>{isolationStatus.replaceAll('_', ' ')}</ProductStatus>}
    >
      {message && <Notice tone={message.toLowerCase().includes('failed') ? 'danger' : 'info'}>{message}</Notice>}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Tenant" value={text(tenant.status, 'missing')} detail={text(tenant.tenantKey, 'tenant key unavailable')} tone={tone(text(tenant.status, ''))} />
        <MetricCard label="Users" value={numberValue(users.total)} detail={`${numberValue(users.active)} active accounts`} tone="info" />
        <MetricCard label="Memberships" value={numberValue(memberships.active)} detail={`${numberValue(memberships.inactive)} inactive`} tone={numberValue(memberships.inactive) === 0 ? 'good' : 'warn'} />
        <MetricCard label="Credentials" value={numberValue(credentials.active)} detail="Tenant-owned vault entries" tone={numberValue(credentials.active) ? 'good' : 'warn'} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <ProductCard title="Workspace Identity" subtitle="This name appears in admin context and production operations evidence.">
          <div className="space-y-4">
            <DetailGrid items={[
              { label: 'Tenant Key', value: text(tenant.tenantKey) },
              { label: 'Status', value: text(tenant.status) },
              { label: 'Created', value: text(tenant.createdAt) },
              { label: 'Updated', value: text(tenant.updatedAt) },
            ]} />
            <Field label="Tenant Display Name">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500"
              />
            </Field>
            <PrimaryAction disabled={saving || !name.trim()} onClick={saveTenantName}>
              {saving ? 'Saving...' : 'Save Tenant Name'}
            </PrimaryAction>
          </div>
        </ProductCard>

        <ProductCard title="Lifecycle Controls" subtitle="Lifecycle changes are audit-logged. Suspending or archiving a tenant blocks user sign-in.">
          <div className="space-y-4">
            <DetailGrid items={[
              { label: 'Current Status', value: text(lifecycle?.status, text(tenant.status)) },
              { label: 'Suspended Means', value: text(lifecyclePolicy.suspended) },
              { label: 'Archived Means', value: text(lifecyclePolicy.archived) },
              { label: 'Billing Automation', value: text(lifecyclePolicy.billingAutomation) },
            ]} />
            <Field label="Lifecycle Reason">
              <textarea
                value={lifecycleReason}
                onChange={(event) => setLifecycleReason(event.target.value)}
                rows={3}
                placeholder="Required audit reason"
                className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500"
              />
            </Field>
            <div className="flex flex-wrap gap-3">
              <PrimaryAction disabled={saving || lifecycleReason.trim().length < 3} onClick={() => changeLifecycle('reactivate')}>Reactivate</PrimaryAction>
              <PrimaryAction disabled={saving || lifecycleReason.trim().length < 3} onClick={() => changeLifecycle('suspend')}>Suspend</PrimaryAction>
              <PrimaryAction disabled={saving || lifecycleReason.trim().length < 3} onClick={() => changeLifecycle('archive')}>Archive</PrimaryAction>
            </div>
            <Notice tone="warn">Tenant export, tenant deletion, billing, and subscriptions still require dedicated production work. This page does not pretend those are complete.</Notice>
          </div>
        </ProductCard>
      </div>

      <ProductCard title="Isolation Report" subtitle="These checks must pass before onboarding real customer data.">
          <ProductTable
            columns={['Check', 'Status']}
            rows={[
              ['Users have tenant memberships', <ProductStatus tone={checks.usersHaveMemberships ? 'good' : 'danger'}>{checks.usersHaveMemberships ? 'Passed' : 'Failed'}</ProductStatus>],
              ['Active users have active memberships', <ProductStatus tone={checks.activeUsersHaveActiveMemberships ? 'good' : 'danger'}>{checks.activeUsersHaveActiveMemberships ? 'Passed' : 'Failed'}</ProductStatus>],
              ['Membership roles match user roles', <ProductStatus tone={checks.membershipRolesMatchUserRoles ? 'good' : 'warn'}>{checks.membershipRolesMatchUserRoles ? 'Passed' : 'Review'}</ProductStatus>],
              ['Credentials scoped to tenant', <ProductStatus tone={checks.credentialsScopedToTenant ? 'good' : 'danger'}>{checks.credentialsScopedToTenant ? 'Passed' : 'Failed'}</ProductStatus>],
              ['Raw secrets returned', <ProductStatus tone={checks.rawSecretsReturned ? 'danger' : 'good'}>{checks.rawSecretsReturned ? 'Yes' : 'No'}</ProductStatus>],
            ]}
          />
      </ProductCard>

      <ProductCard title="Isolation Findings" subtitle={`${numberValue(counts.findings)} finding(s) found for this tenant.`}>
        {findings.length ? (
          <ProductTable
            columns={['Severity', 'Type', 'Record']}
            rows={findings.map(finding => [
              <ProductStatus tone={tone(text(finding.severity))}>{text(finding.severity)}</ProductStatus>,
              text(finding.type).replaceAll('_', ' '),
              <pre className="whitespace-pre-wrap rounded-md bg-neutral-50 p-3 text-xs text-neutral-600">{JSON.stringify(finding.user || finding, null, 2)}</pre>,
            ])}
          />
        ) : (
          <EmptyProductState title="No isolation findings" message="This tenant currently has no membership or credential isolation findings." />
        )}
      </ProductCard>
    </ProductPage>
  );
}
