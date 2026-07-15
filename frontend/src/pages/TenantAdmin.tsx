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
  SecondaryAction,
} from '../components/ProductUI';

type RecordMap = Record<string, unknown>;

const RETENTION_OPTIONS = [
  { value: 'legal_review_required', label: 'Legal review required' },
  { value: 'one_year', label: '1 year' },
  { value: 'three_years', label: '3 years' },
  { value: 'seven_years', label: '7 years' },
  { value: 'forever_after_legal_approval', label: 'Forever after legal approval' },
];

const PRIVACY_REVIEW_STATUS_OPTIONS = [
  { value: 'pending_customer_legal_review', label: 'Waiting for customer legal review' },
  { value: 'in_review', label: 'In legal review' },
  { value: 'approved', label: 'Approved by customer legal' },
  { value: 'needs_changes', label: 'Needs policy changes' },
];

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

function humanize(value: unknown, fallback = 'Not available'): string {
  return text(value, fallback)
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

export default function TenantAdmin() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<RecordMap | null>(null);
  const [isolation, setIsolation] = useState<RecordMap | null>(null);
  const [lifecycle, setLifecycle] = useState<RecordMap | null>(null);
  const [subscriptionState, setSubscriptionState] = useState<RecordMap | null>(null);
  const [plans, setPlans] = useState<RecordMap[]>([]);
  const [deletionReadiness, setDeletionReadiness] = useState<RecordMap | null>(null);
  const [privacyGovernance, setPrivacyGovernance] = useState<RecordMap | null>(null);
  const [exportSummary, setExportSummary] = useState<RecordMap | null>(null);
  const [name, setName] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('AED');
  const [lifecycleReason, setLifecycleReason] = useState('');
  const [subscriptionPlanKey, setSubscriptionPlanKey] = useState('commercial_social_production');
  const [subscriptionStatus, setSubscriptionStatus] = useState('active');
  const [subscriptionSource, setSubscriptionSource] = useState('manual');
  const [subscriptionPeriodEnd, setSubscriptionPeriodEnd] = useState('');
  const [subscriptionReason, setSubscriptionReason] = useState('');
  const [deletionReason, setDeletionReason] = useState('');
  const [retentionApproved, setRetentionApproved] = useState(false);
  const [exportReviewed, setExportReviewed] = useState(false);
  const [retentionMode, setRetentionMode] = useState('legal_review_required');
  const [privacyReviewStatus, setPrivacyReviewStatus] = useState('pending_customer_legal_review');
  const [legalBasisNotes, setLegalBasisNotes] = useState('');
  const [customerLegalOwner, setCustomerLegalOwner] = useState('');
  const [dpoOrPrivacyContact, setDpoOrPrivacyContact] = useState('');
  const [storeConversationLogs, setStoreConversationLogs] = useState(true);
  const [storeVoiceCallTranscripts, setStoreVoiceCallTranscripts] = useState(true);
  const [storeSocialDmLogs, setStoreSocialDmLogs] = useState(true);
  const [storeCrmLeadData, setStoreCrmLeadData] = useState(true);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!token) return;
    const [summaryResult, isolationResult, lifecycleResult, plansResult, subscriptionResult, deletionResult, privacyResult] = await Promise.all([
      tenantAdminApi.summary(token),
      tenantAdminApi.isolationReport(token),
      tenantAdminApi.lifecycle(token),
      tenantAdminApi.plans(token),
      tenantAdminApi.subscription(token),
      tenantAdminApi.deletionReadiness(token),
      tenantAdminApi.privacyGovernance(token),
    ]);
    const nextSummary = summaryResult as RecordMap;
    const nextSubscriptionState = subscriptionResult as RecordMap;
    const currentSubscription = objectValue(nextSubscriptionState.subscription);
    setSummary(nextSummary);
    setIsolation(isolationResult as RecordMap);
    setLifecycle(lifecycleResult as RecordMap);
    setPlans(Array.isArray((plansResult as RecordMap).plans) ? (plansResult as RecordMap).plans as RecordMap[] : []);
    setSubscriptionState(nextSubscriptionState);
    setDeletionReadiness(deletionResult as RecordMap);
    applyPrivacyState(privacyResult as RecordMap);
    setName(text(objectValue(nextSummary.tenant).name, ''));
    setDefaultCurrency(text(objectValue(nextSummary.tenant).defaultCurrency, 'AED'));
    setSubscriptionPlanKey(text(currentSubscription.planKey, 'commercial_social_production'));
    setSubscriptionStatus(text(currentSubscription.status, 'active'));
    setSubscriptionSource(text(currentSubscription.source, 'manual'));
    const periodEnd = text(currentSubscription.currentPeriodEnd, '');
    setSubscriptionPeriodEnd(periodEnd ? periodEnd.slice(0, 10) : '');
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function run() {
      try {
        const [summaryResult, isolationResult, lifecycleResult, plansResult, subscriptionResult, deletionResult, privacyResult] = await Promise.all([
          tenantAdminApi.summary(token as string),
          tenantAdminApi.isolationReport(token as string),
          tenantAdminApi.lifecycle(token as string),
          tenantAdminApi.plans(token as string),
          tenantAdminApi.subscription(token as string),
          tenantAdminApi.deletionReadiness(token as string),
          tenantAdminApi.privacyGovernance(token as string),
        ]);
        if (cancelled) return;
        const nextSummary = summaryResult as RecordMap;
        const nextSubscriptionState = subscriptionResult as RecordMap;
        const currentSubscription = objectValue(nextSubscriptionState.subscription);
        setSummary(nextSummary);
        setIsolation(isolationResult as RecordMap);
        setLifecycle(lifecycleResult as RecordMap);
        setPlans(Array.isArray((plansResult as RecordMap).plans) ? (plansResult as RecordMap).plans as RecordMap[] : []);
        setSubscriptionState(nextSubscriptionState);
        setDeletionReadiness(deletionResult as RecordMap);
        applyPrivacyState(privacyResult as RecordMap);
        setName(text(objectValue(nextSummary.tenant).name, ''));
        setDefaultCurrency(text(objectValue(nextSummary.tenant).defaultCurrency, 'AED'));
        setSubscriptionPlanKey(text(currentSubscription.planKey, 'commercial_social_production'));
        setSubscriptionStatus(text(currentSubscription.status, 'active'));
        setSubscriptionSource(text(currentSubscription.source, 'manual'));
        const periodEnd = text(currentSubscription.currentPeriodEnd, '');
        setSubscriptionPeriodEnd(periodEnd ? periodEnd.slice(0, 10) : '');
      } catch (err) {
        if (!cancelled) setMessage(err instanceof Error ? err.message : 'Failed to load tenant admin');
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  function applyPrivacyState(result: RecordMap) {
    setPrivacyGovernance(result);
    const policy = objectValue(result.policy);
    setRetentionMode(text(policy.retentionMode, 'legal_review_required'));
    setPrivacyReviewStatus(text(result.reviewStatus, 'pending_customer_legal_review'));
    setLegalBasisNotes(text(policy.legalBasisNotes, ''));
    setCustomerLegalOwner(text(policy.customerLegalOwner, ''));
    setDpoOrPrivacyContact(text(policy.dpoOrPrivacyContact, ''));
    setStoreConversationLogs(policy.storeConversationLogs !== false);
    setStoreVoiceCallTranscripts(policy.storeVoiceCallTranscripts !== false);
    setStoreSocialDmLogs(policy.storeSocialDmLogs !== false);
    setStoreCrmLeadData(policy.storeCrmLeadData !== false);
  }

  async function saveTenantName() {
    if (!token || !name.trim()) return;
    setSaving(true);
    setMessage('');
    try {
      await tenantAdminApi.update({ name, defaultCurrency }, token);
      setMessage('Workspace identity and planning currency updated. Existing plans keep their stored currency.');
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

  async function updateSubscription() {
    if (!token || subscriptionReason.trim().length < 5) return;
    setSaving(true);
    setMessage('');
    try {
      const payload: Record<string, unknown> = {
        planKey: subscriptionPlanKey,
        status: subscriptionStatus,
        source: subscriptionSource,
        reason: subscriptionReason,
      };
      if (subscriptionPeriodEnd) {
        payload.currentPeriodEnd = new Date(`${subscriptionPeriodEnd}T23:59:59.000Z`).toISOString();
      }
      await tenantAdminApi.updateSubscription(payload, token);
      setMessage('Subscription updated and audit event recorded.');
      setSubscriptionReason('');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to update subscription');
    } finally {
      setSaving(false);
    }
  }

  async function savePrivacyGovernance() {
    if (!token) return;
    setSaving(true);
    setMessage('');
    try {
      const result = await tenantAdminApi.updatePrivacyGovernance({
        retentionMode,
        storeConversationLogs,
        storeVoiceCallTranscripts,
        storeSocialDmLogs,
        storeCrmLeadData,
        exportDeleteRoles: ['admin', 'cco'],
        legalBasisNotes: legalBasisNotes.trim() || null,
        customerLegalOwner: customerLegalOwner.trim() || null,
        dpoOrPrivacyContact: dpoOrPrivacyContact.trim() || null,
        reviewStatus: privacyReviewStatus,
      }, token) as RecordMap;
      applyPrivacyState(result);
      setMessage(text(result._label, 'Privacy and retention policy saved.'));
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save privacy and retention policy');
    } finally {
      setSaving(false);
    }
  }

  async function downloadTenantExport() {
    if (!token) return;
    setSaving(true);
    setMessage('');
    try {
      const result = await tenantAdminApi.exportData(token) as RecordMap;
      const tenantRecord = objectValue(result.tenant);
      const countsRecord = objectValue(result.counts);
      setExportSummary(countsRecord);
      const fileName = `tanaghum-${text(tenantRecord.tenantKey, 'tenant')}-export.json`;
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage('Tenant export generated and downloaded. Raw secrets, API keys, password hashes, and tokens were redacted.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to generate tenant export');
    } finally {
      setSaving(false);
    }
  }

  async function requestTenantDeletion() {
    if (!token || deletionReason.trim().length < 10) return;
    setSaving(true);
    setMessage('');
    try {
      const result = await tenantAdminApi.requestDeletion({
        reason: deletionReason,
        retentionApproved,
        exportReviewed,
      }, token) as RecordMap;
      setMessage(text(result._label, 'Tenant deletion request submitted for review.'));
      setDeletionReason('');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Tenant deletion request was not accepted');
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
  const subscription = objectValue(subscriptionState?.subscription);
  const subscriptionHealth = objectValue(subscriptionState?.health);
  const subscriptionBlockers = Array.isArray(subscriptionHealth.blockers) ? subscriptionHealth.blockers as string[] : [];
  const subscriptionWarnings = Array.isArray(subscriptionHealth.warnings) ? subscriptionHealth.warnings as string[] : [];
  const entitlements = objectValue(subscriptionHealth.entitlements);
  const paymentProvider = objectValue(subscriptionState?.paymentProvider);
  const deletionCounts = objectValue(deletionReadiness?.counts);
  const deletionBlockers = Array.isArray(deletionReadiness?.blockers) ? deletionReadiness.blockers as string[] : [];
  const deletionReady = deletionReadiness?.deletionReady === true;
  const privacyPolicy = objectValue(privacyGovernance?.policy);
  const privacyChecklist = Array.isArray(privacyGovernance?.checklist) ? privacyGovernance.checklist as RecordMap[] : [];
  const storedDataCategories = Array.isArray(privacyGovernance?.storedDataCategories) ? privacyGovernance.storedDataCategories as RecordMap[] : [];
  const allowedActors = objectValue(privacyGovernance?.allowedActors);
  const automationGate = text(privacyGovernance?.automationGate, 'blocked');

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
            <Field label="Default planning currency">
              <select
                value={defaultCurrency}
                onChange={(event) => setDefaultCurrency(event.target.value)}
                className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500"
              >
                <option value="AED">AED - UAE Dirham</option>
                <option value="USD">USD - US Dollar</option>
              </select>
            </Field>
            <Notice tone="info">New commercial plans inherit this currency. Plans intentionally saved in another currency are never rewritten or converted.</Notice>
            <PrimaryAction disabled={saving || !name.trim()} onClick={saveTenantName}>
              {saving ? 'Saving...' : 'Save Workspace Settings'}
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
            <Notice tone="warn">Subscription state and entitlements are managed below. Payment collection remains manual or external until a payment provider is connected. Tenant deletion is intentionally controlled through archive plus an offline purge review, not a dangerous UI hard-delete.</Notice>
          </div>
        </ProductCard>
      </div>

      <ProductCard
        title="Subscription & Entitlements"
        subtitle="Production access is governed by tenant-owned subscription state. Payment collection can be manual, contract-based, or later connected to Stripe without changing customer data ownership."
      >
        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-4">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4">
              <MetricCard label="Plan" value={text(subscription.planName, 'Not configured')} detail={text(subscription.planKey, 'missing')} tone={subscription ? 'good' : 'warn'} />
              <MetricCard label="Subscription" value={humanize(subscription.status, 'Missing')} detail={humanize(subscription.source, 'Source missing')} tone={subscriptionHealth.serviceAccess ? 'good' : 'warn'} />
              <MetricCard label="Service Access" value={subscriptionHealth.serviceAccess ? 'Allowed' : 'Blocked'} detail="Computed from tenant + subscription" tone={subscriptionHealth.serviceAccess ? 'good' : 'danger'} />
              <MetricCard label="Payment Provider" value={humanize(paymentProvider.status, 'Not configured')} detail="No shared customer billing secrets" tone="info" />
            </div>
            <ProductTable
              columns={['Entitlement', 'Value']}
              rows={Object.entries(entitlements).map(([key, value]) => [
                key.replace(/([A-Z])/g, ' $1'),
                typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
                  ? humanize(value)
                  : JSON.stringify(value),
              ])}
            />
            {subscriptionBlockers.length ? <ReadableBlockers blockers={subscriptionBlockers} /> : <Notice tone="good">Subscription health is clear.</Notice>}
            {subscriptionWarnings.map(warning => <Notice key={warning} tone="warn">{warning}</Notice>)}
          </div>
          <div className="space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <Field label="Plan">
              <select
                value={subscriptionPlanKey}
                onChange={(event) => setSubscriptionPlanKey(event.target.value)}
                className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500"
              >
                {plans.map(plan => (
                  <option key={text(plan.planKey)} value={text(plan.planKey)}>{text(plan.name)} ({text(plan.status)})</option>
                ))}
              </select>
            </Field>
            <Field label="Subscription Status">
              <select
                value={subscriptionStatus}
                onChange={(event) => setSubscriptionStatus(event.target.value)}
                className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500"
              >
                {['trialing', 'active', 'past_due', 'suspended', 'cancelled', 'expired'].map(status => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
              </select>
            </Field>
            <Field label="Billing Source">
              <select
                value={subscriptionSource}
                onChange={(event) => setSubscriptionSource(event.target.value)}
                className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500"
              >
                {['manual', 'external_contract', 'stripe'].map(source => <option key={source} value={source}>{source.replaceAll('_', ' ')}</option>)}
              </select>
            </Field>
            <Field label="Current Period End">
              <input
                type="date"
                value={subscriptionPeriodEnd}
                onChange={(event) => setSubscriptionPeriodEnd(event.target.value)}
                className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500"
              />
            </Field>
            <Field label="Reason">
              <textarea
                value={subscriptionReason}
                onChange={(event) => setSubscriptionReason(event.target.value)}
                rows={3}
                placeholder="Required audit reason for subscription change"
                className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500"
              />
            </Field>
            <PrimaryAction disabled={saving || subscriptionReason.trim().length < 5} onClick={updateSubscription}>
              Update Subscription
            </PrimaryAction>
            <Notice tone="info">This controls Tanaghum tenant access and entitlements. It does not collect payment until a payment provider is connected.</Notice>
          </div>
        </div>
      </ProductCard>

      <ProductCard
        title="Privacy, Retention & Export/Delete Policy"
        subtitle="This explains what customer data Tanaghum stores, why it is stored, who can export or request deletion, and what still needs customer legal approval."
        action={<ProductStatus tone={automationGate === 'ready' ? 'good' : automationGate === 'review_required' ? 'warn' : 'danger'}>{automationGate.replaceAll('_', ' ')}</ProductStatus>}
      >
        <div className="space-y-5">
          <Notice tone="info">
            {text(privacyGovernance?.explanation, 'Legal review means the customer confirms what personal data is stored, why it is stored, how long it is retained, and who can export or request deletion.')}
          </Notice>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-4">
              <DetailGrid items={[
                { label: 'Customer authority', value: Array.isArray(allowedActors.customerRoles) ? (allowedActors.customerRoles as string[]).join(', ') : 'CEO, GM, CCO' },
                { label: 'System roles today', value: Array.isArray(allowedActors.implementedSystemRoles) ? (allowedActors.implementedSystemRoles as string[]).join(', ') : 'admin, cco' },
                { label: 'Retention mode', value: humanize(privacyPolicy.retentionMode, 'Legal review required') },
                { label: 'Review status', value: humanize(privacyGovernance?.reviewStatus, 'Pending customer legal review') },
              ]} />
              <ProductTable
                columns={['Stored data', 'Status', 'Why it is stored']}
                rows={storedDataCategories.map(category => [
                  text(category.label),
                  <ProductStatus tone={category.enabled === false ? 'warn' : 'good'}>{category.enabled === false ? 'Off' : 'On'}</ProductStatus>,
                  text(category.why),
                ])}
              />
              <ProductTable
                columns={['Readiness check', 'Status', 'What it means']}
                rows={privacyChecklist.map(item => [
                  text(item.label),
                  <ProductStatus tone={tone(text(item.status))}>{humanize(item.status)}</ProductStatus>,
                  text(item.detail),
                ])}
              />
              <Notice tone={automationGate === 'ready' ? 'good' : 'warn'}>
                {text(privacyGovernance?.liveAutomationPolicy, 'Live social, CRM, voice, and AI-agent workflows remain gated until privacy/legal review is documented.')}
              </Notice>
            </div>
            <div className="space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <Field label="Retention choice">
                <select
                  value={retentionMode}
                  onChange={(event) => setRetentionMode(event.target.value)}
                  className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500"
                >
                  {RETENTION_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </Field>
              <Field label="Customer legal review status">
                <select
                  value={privacyReviewStatus}
                  onChange={(event) => setPrivacyReviewStatus(event.target.value)}
                  className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500"
                >
                  {PRIVACY_REVIEW_STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </Field>
              <Field label="Customer legal/privacy owner">
                <input
                  value={customerLegalOwner}
                  onChange={(event) => setCustomerLegalOwner(event.target.value)}
                  placeholder="Name or role responsible for privacy approval"
                  className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500"
                />
              </Field>
              <Field label="Privacy contact">
                <input
                  value={dpoOrPrivacyContact}
                  onChange={(event) => setDpoOrPrivacyContact(event.target.value)}
                  placeholder="Email or privacy contact"
                  className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500"
                />
              </Field>
              <Field label="Business reason for storing data">
                <textarea
                  value={legalBasisNotes}
                  onChange={(event) => setLegalBasisNotes(event.target.value)}
                  rows={4}
                  placeholder="Example: Store conversations and lead activity for audit, sales quality, customer support, and executive reporting."
                  className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500"
                />
              </Field>
              <div className="grid gap-2 text-sm text-neutral-700">
                {[
                  ['Conversation logs', storeConversationLogs, setStoreConversationLogs],
                  ['Voice call transcripts/summaries', storeVoiceCallTranscripts, setStoreVoiceCallTranscripts],
                  ['Social DM/comment records', storeSocialDmLogs, setStoreSocialDmLogs],
                  ['CRM lead and purchase data', storeCrmLeadData, setStoreCrmLeadData],
                ].map(([label, checked, setter]) => (
                  <label key={String(label)} className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={Boolean(checked)}
                      onChange={(event) => (setter as (next: boolean) => void)(event.target.checked)}
                      className="mt-1"
                    />
                    {String(label)}
                  </label>
                ))}
              </div>
              <PrimaryAction disabled={saving} onClick={savePrivacyGovernance}>
                {saving ? 'Saving...' : 'Save Privacy Policy'}
              </PrimaryAction>
              <Notice tone="warn">{text(privacyGovernance?.legalDisclaimer, 'This is not legal advice. Final UAE PDPL/data-protection acceptance must come from customer legal counsel.')}</Notice>
            </div>
          </div>
        </div>
      </ProductCard>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <ProductCard
          title="Tenant Export"
          subtitle="Download a tenant-scoped JSON export for portability, audit, or deletion review. Secrets and password hashes are redacted."
          action={<SecondaryAction disabled={saving} onClick={downloadTenantExport}>{saving ? 'Working...' : 'Download Export'}</SecondaryAction>}
        >
          <DetailGrid items={[
            { label: 'Export Format', value: 'tenant-export.v1 JSON' },
            { label: 'Password Hashes', value: 'Never included' },
            { label: 'API Keys / Tokens', value: 'Never included' },
            { label: 'Encrypted Secret Payloads', value: 'Never included' },
          ]} />
          {exportSummary && (
            <div className="mt-4">
              <ProductTable
                columns={['Export Section', 'Records']}
                rows={Object.entries(exportSummary).map(([key, value]) => [key.replace(/([A-Z])/g, ' $1'), String(value)])}
              />
            </div>
          )}
        </ProductCard>

        <ProductCard title="Deletion Readiness" subtitle="Deletion is a controlled business process. The product will not hard-delete a customer workspace from the browser.">
          <div className="space-y-4">
            <ProductStatus tone={deletionReady ? 'good' : 'warn'}>
              {deletionReady ? 'Ready for offline purge review' : 'Not deletion ready'}
            </ProductStatus>
            <DetailGrid items={[
              { label: 'Active Users', value: String(numberValue(deletionCounts.activeUsers)) },
              { label: 'Active Memberships', value: String(numberValue(deletionCounts.activeMemberships)) },
              { label: 'Active Credentials', value: String(numberValue(deletionCounts.activeCredentials)) },
              { label: 'Pending Approvals', value: String(numberValue(deletionCounts.pendingApprovals)) },
              { label: 'Pending Packages', value: String(numberValue(deletionCounts.pendingPackages)) },
            ]} />
            {deletionBlockers.length ? (
              <ReadableBlockers blockers={deletionBlockers} />
            ) : (
              <Notice tone="good">No current blockers reported. A separate offline purge job and retention approval are still required.</Notice>
            )}
          </div>
        </ProductCard>
      </div>

      <ProductCard title="Deletion Review Request" subtitle="Use this only after export review and retention approval. It records a request; it does not erase data.">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Field label="Reason">
            <textarea
              value={deletionReason}
              onChange={(event) => setDeletionReason(event.target.value)}
              rows={3}
              placeholder="Required business/legal reason for deletion review"
              className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500"
            />
          </Field>
          <div className="space-y-3">
            <label className="flex items-start gap-3 text-sm text-neutral-700">
              <input type="checkbox" checked={exportReviewed} onChange={(event) => setExportReviewed(event.target.checked)} className="mt-1" />
              Tenant export has been generated and reviewed.
            </label>
            <label className="flex items-start gap-3 text-sm text-neutral-700">
              <input type="checkbox" checked={retentionApproved} onChange={(event) => setRetentionApproved(event.target.checked)} className="mt-1" />
              Legal/retention approval is complete.
            </label>
            <PrimaryAction disabled={saving || deletionReason.trim().length < 10 || !exportReviewed || !retentionApproved} onClick={requestTenantDeletion}>
              Request Offline Purge Review
            </PrimaryAction>
          </div>
        </div>
      </ProductCard>

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

function ReadableBlockers({ blockers }: { blockers: string[] }) {
  return (
    <div className="space-y-2">
      {blockers.map(blocker => (
        <div key={blocker} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
          {blocker}
        </div>
      ))}
    </div>
  );
}
