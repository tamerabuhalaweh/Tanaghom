import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ghlSetupApi } from '../api';
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
  WorkflowRail,
} from '../components/ProductUI';

type RecordMap = Record<string, unknown>;

function asRecord(value: unknown): RecordMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordMap : {};
}

function asRecords(value: unknown): RecordMap[] {
  return Array.isArray(value) ? value.filter((item): item is RecordMap => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : [];
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function text(value: unknown, fallback = 'Not configured'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function tone(value: string): 'good' | 'warn' | 'danger' | 'info' | 'muted' {
  const lower = value.toLowerCase();
  if (lower.includes('ready') || lower.includes('configured') || lower.includes('validated') || lower.includes('mapped')) return 'good';
  if (lower.includes('blocked') || lower.includes('expired')) return 'danger';
  if (lower.includes('missing') || lower.includes('partial') || lower.includes('not started')) return 'warn';
  return 'info';
}

const INTERNAL_TAGS = [
  'new_lead',
  'contacted',
  'qualified',
  'nurturing',
  'warm',
  'hot',
  'buyer',
  'meeting_booked',
  'purchased',
  'no_show',
  'follow_up_needed',
];

const INTERNAL_STAGES = [
  'new_lead',
  'contacted',
  'meeting_booked',
  'meeting_attended',
  'purchased',
  'lost',
  'follow_up_needed',
];

export default function GhlWizard() {
  const { token } = useAuth();
  const [wizard, setWizard] = useState<RecordMap | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [writeCheck, setWriteCheck] = useState<RecordMap | null>(null);
  const [connectionTest, setConnectionTest] = useState<RecordMap | null>(null);
  const [mappingCheck, setMappingCheck] = useState<RecordMap | null>(null);
  const [locationForm, setLocationForm] = useState({ ghlLocationId: '', displayName: '' });
  const [tagForm, setTagForm] = useState({
    ghlTagId: '',
    ghlTagName: '',
    internalTag: 'new_lead',
    direction: 'bidirectional',
  });
  const [pipelineForm, setPipelineForm] = useState({
    ghlPipelineId: '',
    ghlPipelineName: '',
    ghlStageId: '',
    ghlStageName: '',
    internalStage: 'new_lead',
  });

  async function load() {
    if (!token) return;
    setLoading(true);
    setMessage('');
    try {
      const state = await ghlSetupApi.wizard(token);
      setWizard(state as RecordMap);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'GoHighLevel setup failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function run() {
      await load();
    }
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const credential = asRecord(wizard?.credentialStatus);
  const readiness = asRecord(wizard?.mappingReadiness);
  const connectionAcceptance = asRecord(wizard?.connectionAcceptance);
  const mappingAcceptance = asRecord(wizard?.mappingAcceptance);
  const tagReadiness = asRecord(readiness.tags);
  const pipelineReadiness = asRecord(readiness.pipelines);
  const locationReadiness = asRecord(readiness.location);
  const locationMapping = asRecord(locationReadiness.mapping);
  const tags = asRecords(tagReadiness.items);
  const pipelines = asRecords(pipelineReadiness.items);
  const completedSteps = asStrings(wizard?.completedSteps);
  const currentStep = text(wizard?.currentStep, 'credentials');
  const connectionStatus = text(connectionAcceptance.status, 'requires_credentials');
  const mappingStatus = text(mappingAcceptance.status, 'not_ready');
  const hasApiKey = credential.hasApiKey === true;
  const hasLocationId = credential.hasLocationId === true;
  const liveWriteBlocked = wizard?.liveWriteBlocked === true;
  const missingMappingOutcomes = asRecords((mappingCheck || mappingAcceptance).missingRequiredOutcomes);
  const mappingWarnings = asStrings((mappingCheck || mappingAcceptance).warnings);
  const requiredActions = asStrings((connectionTest || connectionAcceptance).requiredActions);

  const railSteps = useMemo(() => {
    return ['credentials', 'location', 'tags', 'pipeline', 'review'].map(step => ({
      label: titleCase(step),
      state: completedSteps.includes(step)
        ? 'done' as const
        : currentStep === step
          ? 'active' as const
          : liveWriteBlocked && step === 'review'
            ? 'blocked' as const
            : 'waiting' as const,
    }));
  }, [completedSteps, currentStep, liveWriteBlocked]);

  async function saveLocation() {
    if (!token) return;
    setSaving('location');
    setMessage('');
    try {
      await ghlSetupApi.saveLocation(locationForm, token);
      setMessage('GoHighLevel location mapping saved. CRM writes remain blocked by policy.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Location mapping failed');
    } finally {
      setSaving('');
    }
  }

  async function saveTag() {
    if (!token) return;
    setSaving('tag');
    setMessage('');
    try {
      await ghlSetupApi.saveTags([tagForm], token);
      setMessage('GoHighLevel tag mapping saved.');
      setTagForm({ ghlTagId: '', ghlTagName: '', internalTag: 'new_lead', direction: 'bidirectional' });
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Tag mapping failed');
    } finally {
      setSaving('');
    }
  }

  async function savePipeline() {
    if (!token) return;
    setSaving('pipeline');
    setMessage('');
    try {
      await ghlSetupApi.savePipelines([pipelineForm], token);
      setMessage('GoHighLevel pipeline mapping saved.');
      setPipelineForm({
        ghlPipelineId: '',
        ghlPipelineName: '',
        ghlStageId: '',
        ghlStageName: '',
        internalStage: 'new_lead',
      });
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Pipeline mapping failed');
    } finally {
      setSaving('');
    }
  }

  async function testConnection() {
    if (!token) return;
    setSaving('connection');
    setMessage('');
    try {
      const result = await ghlSetupApi.testConnection(token);
      setConnectionTest(result as RecordMap);
      const status = text(asRecord(result).status, 'failed');
      setMessage(status === 'accepted'
        ? 'GHL connection accepted. Tanaghum can read the customer location without exposing secrets.'
        : 'GHL connection could not be accepted yet. Review the required action shown below.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'GHL connection test failed');
    } finally {
      setSaving('');
    }
  }

  async function validateMappings() {
    if (!token) return;
    setSaving('mappings');
    setMessage('');
    try {
      const result = await ghlSetupApi.validateMappings(token);
      setMappingCheck(result as RecordMap);
      const status = text(asRecord(result).status, 'not_ready');
      setMessage(status === 'ready'
        ? 'GHL mappings are ready for authorized read sync.'
        : 'GHL mappings need attention before production read sync.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'GHL mapping validation failed');
    } finally {
      setSaving('');
    }
  }

  async function testWriteGate() {
    if (!token) return;
    setSaving('write');
    setMessage('');
    try {
      const result = await ghlSetupApi.blockedWrite(token);
      setWriteCheck(result as RecordMap);
      setMessage('CRM write gate checked. Production writes are still blocked.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'CRM write gate check failed');
    } finally {
      setSaving('');
    }
  }

  return (
    <ProductPage
      eyebrow="Integrations"
      title="GoHighLevel CRM Setup"
      subtitle="Configure tenant-owned GoHighLevel credentials, location, tags, and pipeline mapping. This prepares lead handoff without enabling uncontrolled CRM writes."
      action={<ProductStatus tone={liveWriteBlocked ? 'warn' : 'good'}>{liveWriteBlocked ? 'CRM Writes Controlled' : 'CRM Writes Enabled'}</ProductStatus>}
    >
      {message && <Notice tone={message.toLowerCase().includes('failed') || message.toLowerCase().includes('blocked') ? 'warn' : 'good'}>{message}</Notice>}

      <WorkflowRail steps={railSteps} />

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Credential" value={titleCase(connectionStatus)} detail={hasApiKey ? 'API key saved in tenant vault' : 'Add customer API key in Integrations'} tone={tone(connectionStatus)} />
        <MetricCard label="Location" value={hasLocationId ? 'Saved' : titleCase(text(locationReadiness.state, 'not_started'))} detail="GHL location controls contact ownership" tone={hasLocationId ? 'good' : tone(text(locationReadiness.state, 'not_started'))} />
        <MetricCard label="Tags" value={`${tagReadiness.mappedCount || 0}/${tagReadiness.totalCount || 0}`} detail="Lead and buyer category mapping" tone={tone(text(tagReadiness.state, 'not_started'))} />
        <MetricCard label="Pipeline" value={`${pipelineReadiness.mappedCount || 0}/${pipelineReadiness.totalCount || 0}`} detail={`Mapping ${titleCase(mappingStatus)}`} tone={tone(mappingStatus)} />
      </div>

      <ProductCard
        title="GHL Connection Acceptance"
        subtitle="Save the customer-owned API key and location ID, then run a read-only contact search to prove Tanaghum can read the GHL location. No CRM writes happen here."
        action={<div className="flex flex-wrap gap-2">
          <Link to="/integration-credentials" className="inline-flex min-h-10 items-center rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50">Open Integrations</Link>
          <PrimaryAction onClick={testConnection} disabled={saving === 'connection' || !hasApiKey || !hasLocationId}>
            {saving === 'connection' ? 'Testing...' : 'Test GHL Connection'}
          </PrimaryAction>
        </div>}
      >
        <DetailGrid items={[
          { label: 'Provider', value: 'gohighlevel' },
          { label: 'Credential Type', value: 'api_key' },
          { label: 'API Key', value: hasApiKey ? 'Configured' : 'Missing' },
          { label: 'Location ID', value: hasLocationId ? 'Configured' : 'Missing' },
          { label: 'Acceptance', value: titleCase(connectionStatus) },
          { label: 'Last Validated', value: text(credential.lastValidatedAt, 'Not validated yet') },
          { label: 'Raw Secrets Returned', value: credential.rawSecretsReturned === false ? 'No' : 'Review required' },
        ]} />
        {requiredActions.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="text-sm font-semibold text-amber-950">Required action</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
              {requiredActions.map(action => <li key={action}>{action}</li>)}
            </ul>
          </div>
        )}
      </ProductCard>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <ProductCard title="Map GHL Location" subtitle="Tell Tanaghum which customer-owned GHL location this workspace belongs to.">
          <div className="space-y-4">
            <Field label="GHL Location ID">
              <input
                value={locationForm.ghlLocationId}
                onChange={event => setLocationForm(current => ({ ...current, ghlLocationId: event.target.value }))}
                className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm"
                placeholder="loc_xxx"
              />
            </Field>
            <Field label="Display Name">
              <input
                value={locationForm.displayName}
                onChange={event => setLocationForm(current => ({ ...current, displayName: event.target.value }))}
                className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm"
                placeholder="Main sales location"
              />
            </Field>
            <PrimaryAction onClick={saveLocation} disabled={saving === 'location' || !locationForm.ghlLocationId || !locationForm.displayName}>
              {saving === 'location' ? 'Saving...' : 'Save Location Mapping'}
            </PrimaryAction>
          </div>
        </ProductCard>

        <ProductCard title="Current Location Mapping" subtitle="Tenant-scoped mapping used for future GHL lead handoff.">
          {locationMapping.ghlLocationId ? (
            <DetailGrid items={[
              { label: 'Location', value: text(locationMapping.displayName) },
              { label: 'Status', value: titleCase(text(locationMapping.status, 'pending')) },
              { label: 'GHL Location ID', value: text(locationMapping.ghlLocationId) },
            ]} />
          ) : (
            <EmptyProductState message="No GHL location mapping has been saved yet." />
          )}
        </ProductCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ProductCard title="Add Tag Mapping" subtitle="Map customer GHL tags to Tanaghum lead states.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="GHL Tag ID">
              <input value={tagForm.ghlTagId} onChange={event => setTagForm(current => ({ ...current, ghlTagId: event.target.value }))} className="w-full rounded-md border border-neutral-200 p-3 text-sm" />
            </Field>
            <Field label="GHL Tag Name">
              <input value={tagForm.ghlTagName} onChange={event => setTagForm(current => ({ ...current, ghlTagName: event.target.value }))} className="w-full rounded-md border border-neutral-200 p-3 text-sm" />
            </Field>
            <Field label="Tanaghum Lead State">
              <select value={tagForm.internalTag} onChange={event => setTagForm(current => ({ ...current, internalTag: event.target.value }))} className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm">
                {INTERNAL_TAGS.map(item => <option key={item} value={item}>{titleCase(item)}</option>)}
              </select>
            </Field>
            <Field label="Direction">
              <select value={tagForm.direction} onChange={event => setTagForm(current => ({ ...current, direction: event.target.value }))} className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm">
                <option value="inbound">GHL to Tanaghum</option>
                <option value="outbound">Tanaghum to GHL</option>
                <option value="bidirectional">Bidirectional</option>
              </select>
            </Field>
          </div>
          <div className="mt-4">
            <PrimaryAction onClick={saveTag} disabled={saving === 'tag' || !tagForm.ghlTagId || !tagForm.ghlTagName}>
              {saving === 'tag' ? 'Saving...' : 'Save Tag Mapping'}
            </PrimaryAction>
          </div>
        </ProductCard>

        <ProductCard title="Saved Tag Mappings" subtitle="These mappings prepare lead tags. They do not write to GHL by themselves.">
          {tags.length ? (
            <ProductTable
              columns={['GHL Tag', 'Tanaghum State', 'Direction', 'Status']}
              rows={tags.map(item => [
                <div>
                  <div className="font-medium text-neutral-950">{text(item.ghlTagName)}</div>
                  <div className="mt-1 text-xs text-neutral-500">{text(item.ghlTagId)}</div>
                </div>,
                titleCase(text(item.internalTag)),
                titleCase(text(item.direction)),
                <ProductStatus tone={tone(text(item.status))}>{titleCase(text(item.status))}</ProductStatus>,
              ])}
            />
          ) : (
            <EmptyProductState message="No GHL tag mappings have been saved yet." />
          )}
        </ProductCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ProductCard title="Add Pipeline Mapping" subtitle="Map GHL opportunity stages to Tanaghum sales outcomes.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="GHL Pipeline ID">
              <input value={pipelineForm.ghlPipelineId} onChange={event => setPipelineForm(current => ({ ...current, ghlPipelineId: event.target.value }))} className="w-full rounded-md border border-neutral-200 p-3 text-sm" />
            </Field>
            <Field label="Pipeline Name">
              <input value={pipelineForm.ghlPipelineName} onChange={event => setPipelineForm(current => ({ ...current, ghlPipelineName: event.target.value }))} className="w-full rounded-md border border-neutral-200 p-3 text-sm" />
            </Field>
            <Field label="GHL Stage ID">
              <input value={pipelineForm.ghlStageId} onChange={event => setPipelineForm(current => ({ ...current, ghlStageId: event.target.value }))} className="w-full rounded-md border border-neutral-200 p-3 text-sm" />
            </Field>
            <Field label="Stage Name">
              <input value={pipelineForm.ghlStageName} onChange={event => setPipelineForm(current => ({ ...current, ghlStageName: event.target.value }))} className="w-full rounded-md border border-neutral-200 p-3 text-sm" />
            </Field>
            <Field label="Tanaghum Sales Stage">
              <select value={pipelineForm.internalStage} onChange={event => setPipelineForm(current => ({ ...current, internalStage: event.target.value }))} className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm">
                {INTERNAL_STAGES.map(item => <option key={item} value={item}>{titleCase(item)}</option>)}
              </select>
            </Field>
          </div>
          <div className="mt-4">
            <PrimaryAction onClick={savePipeline} disabled={saving === 'pipeline' || !pipelineForm.ghlPipelineId || !pipelineForm.ghlPipelineName || !pipelineForm.ghlStageId || !pipelineForm.ghlStageName}>
              {saving === 'pipeline' ? 'Saving...' : 'Save Pipeline Mapping'}
            </PrimaryAction>
          </div>
        </ProductCard>

        <ProductCard title="Saved Pipeline Mappings" subtitle="These mappings prepare sales reporting and future CRM handoff.">
          {pipelines.length ? (
            <ProductTable
              columns={['GHL Pipeline / Stage', 'Tanaghum Stage', 'Status']}
              rows={pipelines.map(item => [
                <div>
                  <div className="font-medium text-neutral-950">{text(item.ghlPipelineName)} / {text(item.ghlStageName)}</div>
                  <div className="mt-1 text-xs text-neutral-500">{text(item.ghlPipelineId)} / {text(item.ghlStageId)}</div>
                </div>,
                titleCase(text(item.internalStage)),
                <ProductStatus tone={tone(text(item.status))}>{titleCase(text(item.status))}</ProductStatus>,
              ])}
            />
          ) : (
            <EmptyProductState message="No GHL pipeline mappings have been saved yet." />
          )}
        </ProductCard>
      </div>

      <ProductCard
        title="Mapping Validation"
        subtitle="Check whether GHL tags and pipeline stages cover the lead journey the sales team needs: booked meetings, attended meetings, no-shows, purchases, lost leads, follow-ups, and lead temperature."
        action={<PrimaryAction onClick={validateMappings} disabled={saving === 'mappings'}>
          {saving === 'mappings' ? 'Checking...' : 'Validate GHL Mappings'}
        </PrimaryAction>}
      >
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-xs font-semibold uppercase text-neutral-500">Read-sync readiness</div>
            <div className="mt-2 text-2xl font-semibold text-neutral-950">{titleCase(mappingStatus)}</div>
            <p className="mt-2 text-sm text-neutral-600">
              {mappingAcceptance.readyForReadSync === true
                ? 'Mappings and environment gate are ready for authorized GHL read sync.'
                : 'Complete the missing mappings before trusting automated CRM reporting.'}
            </p>
          </div>
          <div className="space-y-4">
            {missingMappingOutcomes.length > 0 ? (
              <ProductTable
                columns={['Missing outcome', 'Type']}
                rows={missingMappingOutcomes.map(item => [
                  text(item.label, text(item.key)),
                  titleCase(text(item.category)),
                ])}
              />
            ) : (
              <EmptyProductState message="No missing required mapping outcomes were reported." />
            )}
            {mappingWarnings.length > 0 && (
              <Notice tone="warn">
                {mappingWarnings.join(' ')}
              </Notice>
            )}
          </div>
        </div>
      </ProductCard>

      <ProductCard title="CRM Write Gate" subtitle="Confirm the system still blocks uncontrolled CRM writes. This records an audit trail without writing to GoHighLevel.">
        <div className="space-y-4">
          <Notice tone="warn">{text(wizard?.blockReason, 'GHL live writes are blocked until explicitly authorized and tested.')}</Notice>
          <SecondaryAction onClick={testWriteGate} disabled={saving === 'write'}>
            {saving === 'write' ? 'Checking...' : 'Check Write Gate'}
          </SecondaryAction>
          {writeCheck && (
            <DetailGrid items={[
              { label: 'Allowed', value: String(writeCheck.allowed === true) },
              { label: 'Reason', value: text(writeCheck.reason) },
              { label: 'Status', value: titleCase(text(writeCheck.status, 'blocked')) },
            ]} />
          )}
        </div>
      </ProductCard>

      {!loading && !wizard && (
        <EmptyProductState message="GoHighLevel setup state is unavailable. Check backend connectivity and role permissions." />
      )}
    </ProductPage>
  );
}
