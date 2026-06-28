import { useEffect, useState } from 'react';
import { operationsApi } from '../api';
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

function text(value: unknown, fallback = 'Not available'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function objectValue(value: unknown): RecordMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordMap : {};
}

function tone(status: string | boolean): 'good' | 'warn' | 'danger' | 'info' {
  if (status === true) return 'good';
  if (status === false) return 'warn';
  const lower = status.toLowerCase();
  if (lower.includes('ready') || lower.includes('configured') || lower.includes('passed')) return 'good';
  if (lower.includes('not_ready') || lower.includes('failed')) return 'danger';
  if (lower.includes('missing') || lower.includes('attention') || lower.includes('requires')) return 'warn';
  return 'info';
}

function formatBytes(value: number): string {
  if (!value) return '0 MB';
  return `${Math.round(value / 1024 / 1024)} MB`;
}

export default function OperationsReadiness() {
  const { token } = useAuth();
  const [readiness, setReadiness] = useState<RecordMap | null>(null);
  const [metrics, setMetrics] = useState<RecordMap | null>(null);
  const [backup, setBackup] = useState<RecordMap | null>(null);
  const [monitoring, setMonitoring] = useState<RecordMap | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [readinessResult, metricsResult, backupResult, monitoringResult] = await Promise.all([
        operationsApi.readiness(token),
        operationsApi.metrics(token),
        operationsApi.backupStatus(token),
        operationsApi.monitoringStatus(token),
      ]);
      setReadiness(readinessResult as RecordMap);
      setMetrics(metricsResult as RecordMap);
      setBackup(backupResult as RecordMap);
      setMonitoring(monitoringResult as RecordMap);
      setMessage('');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load operations readiness');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function run() {
      try {
        const [readinessResult, metricsResult, backupResult, monitoringResult] = await Promise.all([
          operationsApi.readiness(token as string),
          operationsApi.metrics(token as string),
          operationsApi.backupStatus(token as string),
          operationsApi.monitoringStatus(token as string),
        ]);
        if (cancelled) return;
        setReadiness(readinessResult as RecordMap);
        setMetrics(metricsResult as RecordMap);
        setBackup(backupResult as RecordMap);
        setMonitoring(monitoringResult as RecordMap);
        setMessage('');
      } catch (err) {
        if (!cancelled) setMessage(err instanceof Error ? err.message : 'Failed to load operations readiness');
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const summary = objectValue(readiness?.summary);
  const processMetrics = objectValue(metrics?.process);
  const memory = objectValue(metrics?.memory);
  const checks = Array.isArray(readiness?.checks) ? readiness.checks as RecordMap[] : [];
  const tenantSecurity = objectValue(readiness?.tenantSecurity);
  const mfaCoverage = objectValue(tenantSecurity.mfaCoverage);

  return (
    <ProductPage
      eyebrow="Production Operations"
      title="Operations Readiness"
      subtitle="Monitor service health, MFA coverage, backup evidence, and production configuration before customer go-live."
      action={<ProductStatus tone={tone(text(readiness?.status, 'not checked'))}>{text(readiness?.status, 'Not checked').replaceAll('_', ' ')}</ProductStatus>}
    >
      {message && <Notice tone="danger">{message}</Notice>}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Readiness Checks" value={`${numberValue(summary.passed)}/${numberValue(summary.passed) + numberValue(summary.failed)}`} detail={`${numberValue(summary.criticalFailed)} critical failures`} tone={numberValue(summary.criticalFailed) === 0 ? 'good' : 'danger'} />
        <MetricCard label="Admin MFA" value={`${numberValue(mfaCoverage.coveragePct)}%`} detail={`${numberValue(mfaCoverage.adminUsersWithMfa)}/${numberValue(mfaCoverage.adminUsers)} protected admins`} tone={numberValue(mfaCoverage.coveragePct) === 100 ? 'good' : 'warn'} />
        <MetricCard label="Backup" value={backup?.latestBackupFound ? 'Local Found' : 'Missing'} detail={backup?.latestBackupAt ? text(backup.latestBackupAt) : 'No latest backup manifest'} tone={backup?.latestBackupFound ? 'good' : 'warn'} />
        <MetricCard label="Runtime" value={`${numberValue(metrics?.uptimeSeconds)}s`} detail={`Heap ${formatBytes(numberValue(memory.heapUsed))}`} tone="info" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <ProductCard title="Readiness Checks" subtitle="Critical failures block production go-live. Attention items require operational follow-up.">
          {checks.length ? (
            <ProductTable
              columns={['Check', 'Status', 'Message']}
              rows={checks.map(check => [
                text(check.id).replaceAll('_', ' '),
                <ProductStatus tone={tone(Boolean(check.passed))}>{text(check.status).replaceAll('_', ' ')}</ProductStatus>,
                text(check.message),
              ])}
            />
          ) : (
            <EmptyProductState message="No readiness checks loaded yet." />
          )}
        </ProductCard>

        <ProductCard title="Runtime Snapshot" subtitle="Current backend process status.">
          <DetailGrid items={[
            { label: 'Node Environment', value: text(metrics?.nodeEnv) },
            { label: 'Process ID', value: String(processMetrics.pid || 'n/a') },
            { label: 'Platform', value: text(processMetrics.platform) },
            { label: 'Node Version', value: text(processMetrics.nodeVersion) },
            { label: 'RSS Memory', value: formatBytes(numberValue(memory.rss)) },
            { label: 'Heap Total', value: formatBytes(numberValue(memory.heapTotal)) },
          ]} />
          <div className="mt-4">
            <PrimaryAction disabled={loading} onClick={load}>{loading ? 'Refreshing...' : 'Refresh Operations Status'}</PrimaryAction>
          </div>
        </ProductCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ProductCard title="Backup Evidence" subtitle="A backup script is not enough. Production requires scheduled backups, off-server storage, and restore drill evidence.">
          <DetailGrid items={[
            { label: 'Backup Directory Configured', value: backup?.backupDirConfigured ? 'Yes' : 'No' },
            { label: 'Off-Server Target Configured', value: backup?.storageTargetConfigured ? 'Yes' : 'No' },
            { label: 'Off-Server Copy Evidence', value: backup?.offServerCopyFound ? 'Yes' : 'No' },
            { label: 'Off-Server Sync Time', value: text(backup?.latestOffServerSyncAt, 'No off-server sync evidence') },
            { label: 'Storage Provider', value: text(backup?.storageProvider) },
            { label: 'Schedule Configured', value: backup?.scheduleConfigured ? 'Yes' : 'No' },
            { label: 'Restore Drill Evidence', value: backup?.restoreDrillEvidenceConfigured ? 'Yes' : 'No' },
            { label: 'Latest Restore Drill', value: text(backup?.latestRestoreDrillAt, 'No restore drill evidence') },
            { label: 'Latest Backup', value: text(backup?.latestBackupAt, 'No local backup found') },
            { label: 'Checksum Found', value: backup?.latestChecksumFound ? 'Yes' : 'No' },
          ]} />
        </ProductCard>

        <ProductCard title="Monitoring Deployment" subtitle="Prometheus/Grafana or an equivalent stack must be deployed and verified before production go-live.">
          <DetailGrid items={[
            { label: 'Prometheus Metrics Token', value: text(monitoring?.prometheusMetrics) },
            { label: 'Alert Destination', value: text(monitoring?.alertDestination) },
            { label: 'Uptime Check Target', value: text(monitoring?.uptimeCheckTarget) },
            { label: 'Uptime Evidence', value: monitoring?.uptimeEvidenceFound ? 'Yes' : 'No' },
            { label: 'Latest Uptime Check', value: text(monitoring?.latestUptimeCheckAt, 'No uptime evidence') },
            { label: 'Latest Uptime Status', value: text(monitoring?.latestUptimeStatus) },
            { label: 'Health Path', value: text(monitoring?.expectedHealthPath) },
            { label: 'Readiness Path', value: text(monitoring?.expectedReadinessPath) },
            { label: 'Metrics Path', value: text(monitoring?.expectedMetricsPath) },
          ]} />
        </ProductCard>
      </div>
    </ProductPage>
  );
}
