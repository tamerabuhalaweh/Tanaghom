import { useEffect, useMemo, useState } from 'react';
import { analyticsApi, ghlApi, leadsApi } from '../api';
import {
  BarList,
  DetailGrid,
  EmptyProductState,
  Field,
  FunnelChart,
  MetricCard,
  Notice,
  PrimaryAction,
  ProductCard,
  ProductPage,
  ProductStatus,
  ProductTable,
  ReadableQueue,
  ScoreRing,
  SecondaryAction,
} from '../components/ProductUI';
import { useAuth } from '../contexts/useAuth';

type RecordMap = Record<string, unknown>;

function list(value: unknown): RecordMap[] {
  return Array.isArray(value) ? value as RecordMap[] : [];
}

function text(value: unknown, fallback = 'Not available'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function titleCase(value: string): string {
  if (value === 'x') return 'X / Twitter';
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function metricTotal(snapshots: RecordMap[], key: string): number {
  return snapshots.reduce((total, snapshot) => {
    const metrics = ((snapshot.normalizedMetrics || snapshot.metrics || {}) as RecordMap);
    return total + numberValue(metrics[key]);
  }, 0);
}

export default function Analytics() {
  const { token } = useAuth();
  const [sources, setSources] = useState<RecordMap[]>([]);
  const [snapshots, setSnapshots] = useState<RecordMap[]>([]);
  const [reports, setReports] = useState<RecordMap[]>([]);
  const [leads, setLeads] = useState<RecordMap[]>([]);
  const [leadStats, setLeadStats] = useState<RecordMap | null>(null);
  const [selectedLeadIndex, setSelectedLeadIndex] = useState(0);
  const [ghlPreview, setGhlPreview] = useState<RecordMap | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState('');
  const [leadForm, setLeadForm] = useState({
    sourcePlatform: 'linkedin',
    leadName: '',
    leadEmail: '',
    leadPhone: '',
    consentStatus: 'pending',
  });

  async function load() {
    if (!token) return;
    const [sourceData, snapshotData, reportData, leadData, statsData] = await Promise.all([
      analyticsApi.sources(token),
      analyticsApi.snapshots(token),
      analyticsApi.reports(token),
      leadsApi.list(token),
      leadsApi.stats(token),
    ]);
    setSources(list(sourceData));
    setSnapshots(list(snapshotData));
    setReports(list(reportData));
    setLeads(list(leadData));
    setLeadStats(statsData as RecordMap);
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function run() {
      try {
        await load();
      } catch (error) {
        if (!cancelled) setMessage(`Analytics failed to load: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const reach = metricTotal(snapshots, 'reach');
  const impressions = metricTotal(snapshots, 'impressions');
  const engagement = metricTotal(snapshots, 'engagement');
  const selectedLead = leads[selectedLeadIndex] || leads[0] || null;
  const qualified = numberValue(leadStats?.qualified);
  const totalLeads = numberValue(leadStats?.total);
  const hasAnalyticsData = snapshots.length > 0 || reports.length > 0;

  const selectedLeadDetails = useMemo(() => selectedLead ? [
    { label: 'Platform', value: titleCase(text(selectedLead.sourcePlatform, 'manual')) },
    { label: 'Status', value: titleCase(text(selectedLead.leadStatus, 'new_lead')) },
    { label: 'Qualification Score', value: String(numberValue(selectedLead.qualificationScore)) },
    { label: 'Consent', value: titleCase(text(selectedLead.consentStatus, 'pending')) },
    { label: 'Campaign Link', value: selectedLead.campaignId ? 'Linked to campaign' : 'Not linked' },
  ] : [], [selectedLead]);

  async function captureLead() {
    if (!token) return;
    setLoading('capture-lead');
    setMessage('');
    try {
      await leadsApi.create(leadForm, token);
      setLeadForm({ sourcePlatform: 'linkedin', leadName: '', leadEmail: '', leadPhone: '', consentStatus: 'pending' });
      setMessage('Lead captured inside STITCH. No CRM write was performed.');
      await load();
    } catch (error) {
      setMessage(`Lead capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function qualifyLead() {
    if (!token || !selectedLead) return;
    setLoading('qualify-lead');
    setMessage('');
    try {
      await leadsApi.qualify(String(selectedLead.id), token);
      setMessage('Lead qualification updated using backend rules.');
      await load();
    } catch (error) {
      setMessage(`Lead qualification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function previewGhlPayload() {
    if (!token || !selectedLead) return;
    setLoading('ghl-preview');
    setMessage('');
    try {
      const result = await ghlApi.sandboxContact({ leadId: selectedLead.id, mode: 'preview' }, token) as RecordMap;
      setGhlPreview(result);
      setMessage('GoHighLevel sandbox payload prepared. No CRM write was performed.');
    } catch (error) {
      setMessage(`GHL preview failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  return (
    <ProductPage
      eyebrow="Performance and revenue handoff"
      title="Analytics & Leads"
      subtitle="Shows real analytics records and captured leads from the backend. If official analytics connectors are not configured, this page shows an honest empty state."
      action={<ProductStatus tone={hasAnalyticsData ? 'good' : 'warn'}>{hasAnalyticsData ? 'Data Available' : 'No Analytics Data'}</ProductStatus>}
    >
      {message && <Notice tone={message.toLowerCase().includes('failed') ? 'danger' : 'good'}>{message}</Notice>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Analytics Sources" value={sources.length} detail="Official or MCP-backed sources" tone={sources.length ? 'good' : 'warn'} />
        <MetricCard label="Reach" value={reach.toLocaleString()} detail="From analytics snapshots" tone={reach ? 'good' : 'muted'} />
        <MetricCard label="Impressions" value={impressions.toLocaleString()} detail="From analytics snapshots" tone={impressions ? 'info' : 'muted'} />
        <MetricCard label="Reports" value={reports.length} detail="Generated performance reports" tone={reports.length ? 'good' : 'muted'} />
        <MetricCard label="Qualified Leads" value={qualified} detail={`${totalLeads} total captured`} tone={qualified ? 'good' : totalLeads ? 'info' : 'muted'} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)_380px]">
        <ScoreRing
          value={Math.min(100, Math.round((qualified / Math.max(1, totalLeads)) * 100))}
          label="Lead Quality"
          detail="Percentage of captured leads currently marked qualified."
        />
        <ProductCard title="Performance Mix" subtitle="Only actual analytics snapshots are counted.">
          {snapshots.length ? (
            <BarList items={[
              { label: 'Reach', value: reach, detail: reach.toLocaleString(), tone: 'good' },
              { label: 'Impressions', value: impressions, detail: impressions.toLocaleString(), tone: 'info' },
              { label: 'Engagement', value: engagement, detail: engagement.toLocaleString(), tone: 'warn' },
            ]} />
          ) : (
            <EmptyProductState message="No analytics snapshots exist yet. Connect read-only official analytics sources before reporting performance." />
          )}
        </ProductCard>
        <ProductCard title="Lead Handoff Funnel" subtitle="Real lead records from the STITCH lead table.">
          <FunnelChart stages={[
            { label: 'Captured', value: totalLeads, tone: totalLeads ? 'info' : 'default' },
            { label: 'Qualified', value: qualified, tone: qualified ? 'good' : 'default' },
            { label: 'Nurturing', value: numberValue(leadStats?.nurturing), tone: numberValue(leadStats?.nurturing) ? 'warn' : 'default' },
            { label: 'External Writes', value: 0, tone: 'danger' },
          ]} />
        </ProductCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <ProductCard title="Analytics Evidence" subtitle="Configured sources, snapshots, and reports.">
          {hasAnalyticsData ? (
            <ProductTable
              columns={['Type', 'Record', 'Status', 'Evidence']}
              rows={[
                ...sources.slice(0, 4).map(source => [
                  'Source',
                  text(source.name),
                  <ProductStatus tone={text(source.status) === 'active' ? 'good' : 'warn'}>{titleCase(text(source.status))}</ProductStatus>,
                  text(source.sourceType),
                ]),
                ...reports.slice(0, 4).map(report => [
                  'Report',
                  text(report.summary, 'Performance report'),
                  <ProductStatus tone="info">{titleCase(text(report.reportStatus, 'draft'))}</ProductStatus>,
                  report.campaignId ? 'Linked to campaign' : 'Standalone report',
                ]),
              ]}
            />
          ) : (
            <EmptyProductState
              title="No performance evidence yet"
              message="Official social analytics connectors are not configured. This page will stay empty instead of showing invented reach, impression, or engagement numbers."
            />
          )}
        </ProductCard>

        <ProductCard title="Capture Lead" subtitle="Create a real internal lead record without writing to CRM.">
          <div className="space-y-3">
            <Field label="Source Platform">
              <select value={leadForm.sourcePlatform} onChange={event => setLeadForm(current => ({ ...current, sourcePlatform: event.target.value }))} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950">
                <option value="linkedin">LinkedIn</option>
                <option value="instagram">Instagram</option>
                <option value="x">X / Twitter</option>
                <option value="manual">Manual</option>
              </select>
            </Field>
            <Field label="Lead Name">
              <input value={leadForm.leadName} onChange={event => setLeadForm(current => ({ ...current, leadName: event.target.value }))} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950" />
            </Field>
            <Field label="Email">
              <input value={leadForm.leadEmail} onChange={event => setLeadForm(current => ({ ...current, leadEmail: event.target.value }))} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950" />
            </Field>
            <Field label="Phone">
              <input value={leadForm.leadPhone} onChange={event => setLeadForm(current => ({ ...current, leadPhone: event.target.value }))} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950" />
            </Field>
            <Field label="Consent">
              <select value={leadForm.consentStatus} onChange={event => setLeadForm(current => ({ ...current, consentStatus: event.target.value }))} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-950">
                <option value="pending">Pending</option>
                <option value="granted">Granted</option>
                <option value="denied">Denied</option>
              </select>
            </Field>
            <PrimaryAction onClick={captureLead} disabled={loading === 'capture-lead'}>{loading === 'capture-lead' ? 'Capturing...' : 'Capture Lead'}</PrimaryAction>
          </div>
        </ProductCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <ProductCard title="Lead Queue" subtitle="Captured leads ready for qualification and handoff preparation.">
          {leads.length ? (
            <div className="space-y-3">
              {leads.map((lead, index) => {
                const active = selectedLeadIndex === index;
                return (
                  <button
                    key={String(lead.id)}
                    type="button"
                    onClick={() => {
                      setSelectedLeadIndex(index);
                      setGhlPreview(null);
                    }}
                    className={`w-full rounded-lg border p-4 text-left transition ${active ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white hover:bg-neutral-50'}`}
                  >
                    <div className="font-semibold">{titleCase(text(lead.sourcePlatform, 'Manual'))} lead</div>
                    <div className={`mt-2 text-sm ${active ? 'text-white/60' : 'text-neutral-500'}`}>
                      {titleCase(text(lead.leadStatus, 'new_lead'))} / score {numberValue(lead.qualificationScore)}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyProductState message="No leads exist yet. Capture a lead above or connect approved lead sources." />
          )}
        </ProductCard>

        <ProductCard title="Selected Lead and Handoff" subtitle="Prepare CRM/voice handoff from a real internal lead record.">
          {selectedLead ? (
            <div className="space-y-5">
              <DetailGrid items={selectedLeadDetails} />
              <div className="flex flex-wrap gap-2">
                <PrimaryAction onClick={qualifyLead} disabled={loading === 'qualify-lead'}>
                  {loading === 'qualify-lead' ? 'Qualifying...' : 'Qualify Lead'}
                </PrimaryAction>
                <SecondaryAction onClick={previewGhlPayload} disabled={loading === 'ghl-preview'}>
                  {loading === 'ghl-preview' ? 'Preparing...' : 'Preview GHL Payload'}
                </SecondaryAction>
              </div>
              <ReadableQueue items={[
                { title: 'CRM write', meta: 'Preview only unless sandbox credentials and execution flags are configured.', status: 'Blocked by Default', tone: 'warn' },
                { title: 'Voice follow-up', meta: 'Requires consent review and explicit test authorization.', status: 'Blocked by Default', tone: 'warn' },
              ]} />
              {ghlPreview && (
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                  <div className="font-semibold text-neutral-950">GoHighLevel Payload Preview</div>
                  <div className="mt-1 text-sm text-neutral-500">Prepared by backend; no external CRM write was performed.</div>
                  <div className="mt-4">
                  <DetailGrid items={[
                    { label: 'Status', value: text(ghlPreview.status) },
                    { label: 'Credential Source', value: text(ghlPreview.credentialSource) },
                    { label: 'Connector Route', value: ghlPreview.endpoint ? 'Backend connector configured' : 'Not configured' },
                    { label: 'Execution', value: text((ghlPreview.safety as RecordMap | undefined)?.executionPerformed, 'false') },
                  ]} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyProductState message="Select or capture a lead to prepare CRM and voice handoff." />
          )}
        </ProductCard>
      </div>
    </ProductPage>
  );
}
