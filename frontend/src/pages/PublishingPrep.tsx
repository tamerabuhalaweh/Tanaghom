import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { commercialWorkflowApi, postizApi, publishingPackageApi } from '../api';
import { useAuth } from '../contexts/useAuth';
import {
  DetailGrid,
  EmptyProductState,
  Notice,
  PrimaryAction,
  ProductCard,
  ProductPage,
  ProductStatus,
  ProductTable,
  ReadableQueue,
  SecondaryAction,
  WorkflowRail,
} from '../components/ProductUI';

type RecordMap = Record<string, unknown>;

function asRecord(value: unknown): RecordMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordMap : {};
}

function asList(value: unknown): RecordMap[] {
  return Array.isArray(value) ? value.filter((item): item is RecordMap => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : [];
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function text(value: unknown, fallback = 'Not available'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toneForState(value: string): 'default' | 'good' | 'warn' | 'danger' | 'info' | 'muted' {
  const normalized = value.toLowerCase();
  if (normalized.includes('ready') || normalized.includes('connected') || normalized.includes('complete') || normalized.includes('saved')) return 'good';
  if (normalized.includes('blocked') || normalized.includes('missing') || normalized.includes('requires') || normalized.includes('not')) return 'warn';
  if (normalized.includes('failed') || normalized.includes('error')) return 'danger';
  if (normalized.includes('waiting')) return 'muted';
  return 'info';
}

function titleCase(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

async function fetchPublishingReadiness(token: string) {
  const [packageData, statusData, channelData, evidenceData] = await Promise.all([
    publishingPackageApi.list(token),
    postizApi.status(token),
    postizApi.channels(token).catch((err) => ({
      status: 'requires_channel',
      channels: [],
      _label: err instanceof Error ? err.message : 'Postiz channel status unavailable',
    })),
    commercialWorkflowApi.evidence(token).catch(() => null),
  ]);

  return {
    packages: asList(packageData),
    postizStatus: asRecord(statusData),
    postizChannels: asList(asRecord(channelData).channels),
    evidence: evidenceData ? asRecord(evidenceData) : null,
  };
}

export default function PublishingPrep() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [packages, setPackages] = useState<RecordMap[]>([]);
  const [postizStatus, setPostizStatus] = useState<RecordMap | null>(null);
  const [postizChannels, setPostizChannels] = useState<RecordMap[]>([]);
  const [evidence, setEvidence] = useState<RecordMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const result = await fetchPublishingReadiness(token);
      setPackages(result.packages);
      setPostizStatus(result.postizStatus);
      setPostizChannels(result.postizChannels);
      setEvidence(result.evidence);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publishing readiness failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void fetchPublishingReadiness(token)
      .then((result) => {
        if (cancelled) return;
        setPackages(result.packages);
        setPostizStatus(result.postizStatus);
        setPostizChannels(result.postizChannels);
        setEvidence(result.evidence);
        setError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Publishing readiness failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const selectedPackage = packages[0] || null;
  const health = asRecord(postizStatus?.health);
  const credentialStatus = text(health.credentialStatus, 'missing');
  const integrationIdStatus = text(health.integrationIdStatus, 'missing');
  const postizReady = text(postizStatus?.status, 'Requires Credentials');
  const channelCount = postizChannels.length;
  const evidenceCoverage = numberValue(asRecord(evidence?.coverage).score);
  const evidenceActions = asList(evidence?.actions).slice(0, 6);
  const evidenceStages = asList(evidence?.stages);
  const missingActions = stringList(asRecord(evidence?.coverage).missingActions);

  const railSteps = useMemo(() => {
    if (!evidenceStages.length) {
      return [
        { label: 'Package', state: selectedPackage ? 'done' as const : 'active' as const },
        { label: 'Postiz', state: channelCount ? 'done' as const : 'blocked' as const },
        { label: 'Scheduling Review', state: 'waiting' as const },
        { label: 'Evidence', state: 'waiting' as const },
      ];
    }
    return evidenceStages.map(stage => ({
      label: text(stage.label, 'Stage'),
      state: text(stage.state, 'waiting') === 'complete'
        ? 'done' as const
        : text(stage.state, 'waiting') === 'active'
          ? 'active' as const
          : text(stage.state, 'waiting') === 'blocked'
            ? 'blocked' as const
            : 'waiting' as const,
    }));
  }, [channelCount, evidenceStages, selectedPackage]);

  return (
    <ProductPage
      eyebrow="Commercial/Social"
      title="Publishing Readiness"
      subtitle="Review approved publishing packages, Postiz channel readiness, scheduling blockers, and the durable evidence trail before any external action is authorized."
      action={<SecondaryAction onClick={() => void load()} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</SecondaryAction>}
    >
      {error && <Notice tone="danger">{error}</Notice>}

      <WorkflowRail steps={railSteps} />

      <div className="grid gap-4 md:grid-cols-4">
        <ProductCard>
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Packages</div>
          <div className="mt-3 text-3xl font-semibold text-neutral-950">{packages.length}</div>
          <p className="mt-2 text-sm text-neutral-500">Prepared from approved content.</p>
        </ProductCard>
        <ProductCard>
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Postiz</div>
          <div className="mt-3 text-xl font-semibold text-neutral-950">{postizReady}</div>
          <p className="mt-2 text-sm text-neutral-500">Scheduling surface status.</p>
        </ProductCard>
        <ProductCard>
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Channels</div>
          <div className="mt-3 text-3xl font-semibold text-neutral-950">{channelCount}</div>
          <p className="mt-2 text-sm text-neutral-500">Visible through Postiz API.</p>
        </ProductCard>
        <ProductCard>
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Evidence</div>
          <div className="mt-3 text-3xl font-semibold text-neutral-950">{evidenceCoverage}%</div>
          <p className="mt-2 text-sm text-neutral-500">Persistent workflow coverage.</p>
        </ProductCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <ProductCard
          title="Prepared Publishing Packages"
          subtitle="Only approved content can become a scheduling-ready package."
          action={<PrimaryAction onClick={() => navigate('/campaigns')}>Prepare Package</PrimaryAction>}
        >
          {packages.length ? (
            <ProductTable
              columns={['Package', 'Campaign', 'Status', 'Created']}
              rows={packages.map(pkg => [
                <span className="font-medium text-neutral-950">{text(pkg.id).slice(0, 8)}</span>,
                text(pkg.campaignId, 'Campaign linked'),
                <ProductStatus tone={toneForState(text(pkg.status, 'ready'))}>{titleCase(text(pkg.status, 'ready'))}</ProductStatus>,
                text(pkg.createdAt, 'Recorded'),
              ])}
            />
          ) : (
            <EmptyProductState
              title="No publishing package yet"
              message="Approve a generated draft, then prepare a publishing package from the Campaigns workspace."
              action={<PrimaryAction onClick={() => navigate('/campaigns')}>Open Campaigns</PrimaryAction>}
            />
          )}
        </ProductCard>

        <ProductCard title="Scheduling Blockers" subtitle="What must be true before a package can be reviewed for sandbox scheduling.">
          <ReadableQueue
            items={[
              {
                title: 'Approved package',
                meta: selectedPackage ? 'A package exists and is ready for scheduling review.' : 'Create a package after human approval.',
                status: selectedPackage ? 'Ready' : 'Waiting',
                tone: selectedPackage ? 'good' : 'muted',
              },
              {
                title: 'Postiz server',
                meta: text(health.url, 'Postiz URL is not configured.'),
                status: text(postizStatus?.status, 'Requires Credentials'),
                tone: toneForState(text(postizStatus?.status, 'Requires Credentials')),
              },
              {
                title: 'Postiz API key',
                meta: credentialStatus === 'configured' ? 'Tenant credential is saved securely.' : 'Save the tenant Postiz API key in Credentials.',
                status: titleCase(credentialStatus),
                tone: toneForState(credentialStatus),
              },
              {
                title: 'Social channel',
                meta: channelCount ? `${channelCount} social channel(s) are visible.` : 'Complete channel OAuth inside Postiz, then refresh Tanaghum.',
                status: channelCount ? 'Visible' : 'Requires Channel',
                tone: channelCount ? 'good' : 'warn',
              },
              {
                title: 'Selected scheduling channel',
                meta: integrationIdStatus === 'configured' ? 'A Postiz channel ID is selected.' : 'Select a visible channel for scheduling packages.',
                status: titleCase(integrationIdStatus),
                tone: toneForState(integrationIdStatus),
              },
              {
                title: 'External execution',
                meta: 'Scheduling stays blocked until explicit sandbox authorization is enabled for this tenant.',
                status: 'Blocked',
                tone: 'warn',
              },
            ]}
          />
          <div className="mt-5">
            <SecondaryAction onClick={() => navigate('/integration-credentials')}>Open Credentials</SecondaryAction>
          </div>
        </ProductCard>
      </div>

      <ProductCard title="Selected Package Review" subtitle="Plain-language status for the most recent publishing package.">
        {selectedPackage ? (
          <DetailGrid
            items={[
              { label: 'Package Status', value: titleCase(text(selectedPackage.status, 'ready')) },
              { label: 'Campaign', value: text(selectedPackage.campaignId, 'Campaign linked') },
              { label: 'Execution State', value: 'External scheduling blocked until sandbox authorization and channel selection are complete.' },
              { label: 'Next Action', value: channelCount ? 'Select the channel and request sandbox scheduling authorization.' : 'Connect a social channel through Postiz.' },
            ]}
          />
        ) : (
          <EmptyProductState message="No package is available yet. The normal path is draft generation, scoring, human approval, then package preparation." />
        )}
      </ProductCard>

      <ProductCard title="Evidence Trail" subtitle="Durable workflow records stored by Tanaghum, not screenshots or hidden logs.">
        <div className="mb-5">
          <ReadableQueue
            items={[
              {
                title: 'Evidence coverage',
                meta: evidenceCoverage ? 'Required workflow events are being persisted.' : 'Evidence appears after workflow actions are performed.',
                status: `${evidenceCoverage}%`,
                tone: evidenceCoverage >= 80 ? 'good' : evidenceCoverage > 0 ? 'warn' : 'muted',
              },
              {
                title: 'Missing records',
                meta: missingActions.join(', ') || 'No missing required records for the current stage.',
                status: missingActions.length ? 'Review' : 'Clear',
                tone: missingActions.length ? 'warn' : 'good',
              },
            ]}
          />
        </div>
        {evidenceActions.length ? (
          <ProductTable
            columns={['Action', 'Result', 'Source', 'Reason']}
            rows={evidenceActions.map(action => [
              titleCase(text(action.action, 'workflow action')),
              <ProductStatus tone={toneForState(text(action.result, 'success'))}>{titleCase(text(action.result, 'success'))}</ProductStatus>,
              text(action.sourceModule, 'STITCH'),
              text(action.reason, 'Recorded'),
            ])}
          />
        ) : (
          <EmptyProductState message="No persistent workflow audit records are available for the selected campaign yet." />
        )}
      </ProductCard>

      <Notice tone="warn">
        Tanaghum can prepare and verify scheduling packages here. Actual external scheduling remains blocked until a tenant explicitly enables sandbox execution, selects a test channel, and passes the configured approval gates.
      </Notice>
    </ProductPage>
  );
}
