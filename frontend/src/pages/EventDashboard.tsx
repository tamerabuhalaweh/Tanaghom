import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { connectorMappingsApi, csvImportApi, eventCloseoutApi, eventPlannerApi, eventProblemsApi, eventsApi, leadsApi, learningRecommendationsApi } from '../api';
import {
  BarList,
  DetailGrid,
  EmptyProductState,
  ExecutiveKpiCard,
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
  SecondaryAction,
} from '../components/ProductUI';
import { useAuth } from '../contexts/useAuth';

type RecordMap = Record<string, unknown>;
type LeadStatus = 'new_lead' | 'contacted' | 'meeting_booked' | 'meeting_attended' | 'no_show' | 'purchased' | 'lost' | 'follow_up_needed' | 'qualified' | 'nurturing' | 'converted' | 'archived';
type LeadTemperature = 'cold' | 'warm' | 'hot' | 'buyer';
type ProblemCategory = 'content' | 'ads' | 'audience' | 'funnel' | 'sales' | 'budget' | 'operations' | 'integration' | 'other';
type ProblemSeverity = 'low' | 'medium' | 'high' | 'critical';
type ProblemStatus = 'open' | 'investigating' | 'resolved' | 'dismissed';
type ProblemSource = 'manual' | 'kpi_review' | 'lead_review' | 'sales_feedback' | 'campaign_review' | 'integration_check';
type PlanApprovalStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'changes_requested';
type ContentAssetType = 'video' | 'image' | 'caption' | 'landing_page' | 'carousel' | 'story' | 'email_template' | 'whatsapp_template';
type ContentRequirementStatus = 'pending' | 'in_progress' | 'ready' | 'blocked' | 'delivered';
type SalesTaskType = 'inquiry_response' | 'follow_up' | 'closing' | 'discovery_call' | 'no_show_recovery' | 'feedback_collection';
type SalesTaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';
type ConnectorSource = 'manual_csv' | 'formaloo' | 'meta_ads' | 'youtube' | 'ghl' | 'whatsapp';

const LEAD_STATUSES: LeadStatus[] = ['new_lead', 'qualified', 'nurturing', 'contacted', 'meeting_booked', 'meeting_attended', 'no_show', 'purchased', 'follow_up_needed', 'lost', 'archived'];
const LEAD_TEMPERATURES: LeadTemperature[] = ['cold', 'warm', 'hot', 'buyer'];
const AUDIENCE_SOURCES = ['follower', 'non_follower', 'existing_customer', 'referral'];
const CHANNEL_ATTRIBUTIONS = ['instagram', 'meta', 'youtube', 'whatsapp', 'email', 'organic', 'dark_ad', 'referral', 'manual'];
const PROBLEM_CATEGORIES: ProblemCategory[] = ['content', 'ads', 'audience', 'funnel', 'sales', 'budget', 'operations', 'integration', 'other'];
const PROBLEM_SEVERITIES: ProblemSeverity[] = ['low', 'medium', 'high', 'critical'];
const PROBLEM_SOURCES: ProblemSource[] = ['manual', 'kpi_review', 'lead_review', 'sales_feedback', 'campaign_review', 'integration_check'];
const CONTENT_ASSET_TYPES: ContentAssetType[] = ['video', 'image', 'caption', 'landing_page', 'carousel', 'story', 'email_template', 'whatsapp_template'];
const CONTENT_REQUIREMENT_STATUSES: ContentRequirementStatus[] = ['pending', 'in_progress', 'ready', 'blocked', 'delivered'];
const SALES_TASK_TYPES: SalesTaskType[] = ['inquiry_response', 'follow_up', 'closing', 'discovery_call', 'no_show_recovery', 'feedback_collection'];
const CONNECTOR_SOURCES: ConnectorSource[] = ['manual_csv', 'formaloo', 'meta_ads', 'youtube', 'ghl', 'whatsapp'];
const KPI_TARGET_FIELDS = [
  'metricDate', 'channel', 'reach', 'impressions', 'interactions', 'clicks',
  'formCompletions', 'leads', 'meetingsBooked', 'meetingsAttended',
  'purchases', 'noShows', 'spend', 'notes',
] as const;
const REQUIRED_IMPORT_FIELDS = ['metricDate', 'channel'] as const;
const SALES_TASK_STATUSES: SalesTaskStatus[] = ['pending', 'in_progress', 'completed', 'blocked'];

const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new_lead: ['contacted', 'qualified', 'nurturing', 'lost'],
  contacted: ['meeting_booked', 'follow_up_needed', 'lost'],
  meeting_booked: ['meeting_attended', 'no_show', 'lost'],
  meeting_attended: ['purchased', 'follow_up_needed', 'lost'],
  no_show: ['follow_up_needed', 'lost'],
  purchased: ['archived'],
  lost: [],
  follow_up_needed: ['contacted', 'meeting_booked', 'lost'],
  qualified: ['meeting_booked', 'nurturing', 'lost'],
  nurturing: ['contacted', 'qualified', 'lost'],
  converted: ['archived'],
  archived: [],
};

function list(value: unknown): RecordMap[] {
  return Array.isArray(value) ? value as RecordMap[] : [];
}

function text(value: unknown, fallback = 'Not available'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function displayLabel(value: unknown): string {
  const raw = text(value, 'Not available');
  if (raw === 'kpi_records') return 'KPI Records';
  if (raw === 'content_packages') return 'Content Packages';
  if (raw === 'lead_follow_up') return 'Lead Follow-Up';
  return titleCase(raw);
}

function leadStatus(value: unknown): LeadStatus {
  const normalized = text(value, 'new_lead') as LeadStatus;
  return LEAD_STATUSES.includes(normalized) ? normalized : 'new_lead';
}

function leadTemp(value: unknown): LeadTemperature {
  const normalized = text(value, 'cold') as LeadTemperature;
  return LEAD_TEMPERATURES.includes(normalized) ? normalized : 'cold';
}

function leadName(lead: RecordMap | null): string {
  if (!lead) return 'No lead selected';
  return text(lead.leadName || lead.name, 'Unnamed lead');
}

function statusTone(status: LeadStatus): 'default' | 'good' | 'warn' | 'danger' | 'info' | 'muted' {
  if (status === 'purchased' || status === 'converted') return 'good';
  if (status === 'qualified' || status === 'meeting_attended') return 'info';
  if (status === 'meeting_booked' || status === 'follow_up_needed' || status === 'no_show') return 'warn';
  if (status === 'lost') return 'danger';
  if (status === 'archived') return 'muted';
  return 'default';
}

function problemStatus(value: unknown): ProblemStatus {
  const normalized = text(value, 'open') as ProblemStatus;
  return ['open', 'investigating', 'resolved', 'dismissed'].includes(normalized) ? normalized : 'open';
}

function problemSeverity(value: unknown): ProblemSeverity {
  const normalized = text(value, 'medium') as ProblemSeverity;
  return PROBLEM_SEVERITIES.includes(normalized) ? normalized : 'medium';
}

function problemStatusTone(status: ProblemStatus): 'default' | 'good' | 'warn' | 'danger' | 'info' | 'muted' {
  if (status === 'resolved') return 'good';
  if (status === 'dismissed') return 'muted';
  if (status === 'investigating') return 'info';
  return 'warn';
}

function problemSeverityTone(severity: ProblemSeverity): 'default' | 'good' | 'warn' | 'danger' | 'info' | 'muted' {
  if (severity === 'critical') return 'danger';
  if (severity === 'high') return 'warn';
  if (severity === 'medium') return 'info';
  return 'muted';
}

function recommendationPriorityTone(value: unknown): 'default' | 'good' | 'warn' | 'danger' | 'info' | 'muted' {
  const priority = text(value, 'medium');
  if (priority === 'high') return 'danger';
  if (priority === 'medium') return 'warn';
  if (priority === 'low') return 'info';
  return 'default';
}

function confidenceTone(value: unknown): 'default' | 'good' | 'warn' | 'danger' | 'info' | 'muted' {
  const confidence = text(value, 'low');
  if (confidence === 'high') return 'good';
  if (confidence === 'medium') return 'info';
  return 'warn';
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(item => text(item, '')).filter(Boolean) : [];
}

function approvalStatus(value: unknown): PlanApprovalStatus {
  const normalized = text(value, 'draft') as PlanApprovalStatus;
  return ['draft', 'pending_review', 'approved', 'rejected', 'changes_requested'].includes(normalized) ? normalized : 'draft';
}

function approvalTone(status: PlanApprovalStatus): 'default' | 'good' | 'warn' | 'danger' | 'info' | 'muted' {
  if (status === 'approved') return 'good';
  if (status === 'pending_review') return 'info';
  if (status === 'changes_requested') return 'warn';
  if (status === 'rejected') return 'danger';
  return 'muted';
}

function contentRequirementStatus(value: unknown): ContentRequirementStatus {
  const normalized = text(value, 'pending') as ContentRequirementStatus;
  return CONTENT_REQUIREMENT_STATUSES.includes(normalized) ? normalized : 'pending';
}

function salesTaskStatus(value: unknown): SalesTaskStatus {
  const normalized = text(value, 'pending') as SalesTaskStatus;
  return SALES_TASK_STATUSES.includes(normalized) ? normalized : 'pending';
}

function workStatusTone(status: ContentRequirementStatus | SalesTaskStatus): 'default' | 'good' | 'warn' | 'danger' | 'info' | 'muted' {
  if (status === 'ready' || status === 'delivered' || status === 'completed') return 'good';
  if (status === 'in_progress') return 'info';
  if (status === 'blocked') return 'danger';
  return 'warn';
}

function problemUpdateState(problem: RecordMap | null) {
  return {
    severity: problemSeverity(problem?.severity),
    ownerRole: text(problem?.ownerRole, ''),
    impactSummary: text(problem?.impactSummary, ''),
    recommendedAction: text(problem?.recommendedAction, ''),
    resolutionNotes: text(problem?.resolutionNotes, ''),
  };
}

function nextAllowedStatuses(lead: RecordMap | null): LeadStatus[] {
  if (!lead) return [];
  return LEAD_TRANSITIONS[leadStatus(lead.leadStatus || lead.status)] || [];
}

function dateInputValue(value: unknown): string {
  const date = value ? new Date(String(value)) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 16);
  return date.toISOString().slice(0, 16);
}

function toIsoFromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

function formatDate(value: unknown): string {
  if (!value) return 'Not set';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function money(value: unknown): string {
  return `${numberValue(value).toLocaleString()} SAR`;
}

function percent(value: unknown): string {
  const normalized = numberValue(value);
  return `${Math.round(normalized * 1000) / 10}%`;
}

function countEntries(value: unknown): { label: string; value: number }[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .map(([label, entryValue]) => ({ label: titleCase(label), value: numberValue(entryValue) }))
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseCsv(textValue: string): { headers: string[]; rows: Record<string, string>[]; error: string } {
  const lines = textValue
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return { headers: [], rows: [], error: 'Paste a CSV header row and at least one data row.' };
  const headers = parseCsvLine(lines[0]).map(header => header.trim()).filter(Boolean);
  if (!headers.length) return { headers: [], rows: [], error: 'CSV header row is empty.' };
  const rows = lines.slice(1).map(line => {
    const cells = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((record, header, index) => {
      record[header] = cells[index] || '';
      return record;
    }, {});
  });
  return { headers, rows, error: '' };
}

function inferSourceField(headers: string[], targetField: string): string {
  const normalizedTarget = targetField.toLowerCase();
  const aliases: Record<string, string[]> = {
    metricDate: ['metricdate', 'date', 'day', 'reportdate'],
    channel: ['channel', 'source', 'platform', 'medium'],
    formCompletions: ['formcompletions', 'forms', 'submissions', 'formfills'],
    meetingsBooked: ['meetingsbooked', 'meetings', 'bookedmeetings', 'bookings'],
    meetingsAttended: ['meetingsattended', 'attendedmeetings', 'attended'],
    noShows: ['noshows', 'no_show', 'noshow'],
  };
  const candidates = aliases[targetField] || [normalizedTarget];
  return headers.find(header => {
    const normalized = header.toLowerCase().replace(/[\s_-]/g, '');
    return candidates.includes(normalized);
  }) || '';
}

function strongestChannel(rows: RecordMap[]): RecordMap | null {
  if (!rows.length) return null;
  return [...rows].sort((a, b) => {
    const purchaseDelta = numberValue(b.purchases) - numberValue(a.purchases);
    if (purchaseDelta !== 0) return purchaseDelta;
    return numberValue(b.leads) - numberValue(a.leads);
  })[0] || null;
}

function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(value: unknown): number | null {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function EventDashboard() {
  const { token } = useAuth();
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [events, setEvents] = useState<RecordMap[]>([]);
  const [dashboard, setDashboard] = useState<RecordMap | null>(null);
  const [salesLeads, setSalesLeads] = useState<RecordMap[]>([]);
  const [problemDashboard, setProblemDashboard] = useState<RecordMap | null>(null);
  const [eventProblems, setEventProblems] = useState<RecordMap[]>([]);
  const [closeoutReport, setCloseoutReport] = useState<RecordMap | null>(null);
  const [learningSummary, setLearningSummary] = useState<RecordMap | null>(null);
  const [learningError, setLearningError] = useState('');
  const [emailPlans, setEmailPlans] = useState<RecordMap[]>([]);
  const [whatsappPlans, setWhatsappPlans] = useState<RecordMap[]>([]);
  const [upsellPlans, setUpsellPlans] = useState<RecordMap[]>([]);
  const [contentRequirements, setContentRequirements] = useState<RecordMap[]>([]);
  const [salesTasks, setSalesTasks] = useState<RecordMap[]>([]);
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState('');
  const [pageLoading, setPageLoading] = useState(Boolean(token));
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [selectedProblemId, setSelectedProblemId] = useState('');
  const [selectedEmailPlanId, setSelectedEmailPlanId] = useState('');
  const [selectedWhatsappPlanId, setSelectedWhatsappPlanId] = useState('');
  const [selectedUpsellPlanId, setSelectedUpsellPlanId] = useState('');
  const [selectedContentRequirementId, setSelectedContentRequirementId] = useState('');
  const [selectedSalesTaskId, setSelectedSalesTaskId] = useState('');
  const [leadFilters, setLeadFilters] = useState({
    status: 'all',
    temperature: 'all',
    channel: 'all',
  });
  const [leadForm, setLeadForm] = useState({
    leadName: '',
    leadEmail: '',
    leadPhone: '',
    audienceSource: 'follower',
    channelAttribution: 'instagram',
    platform: 'instagram',
    salesNotes: '',
  });
  const [leadUpdateForm, setLeadUpdateForm] = useState({
    nextAction: '',
    followUpDate: '',
    salesNotes: '',
    temperature: 'warm' as LeadTemperature,
  });
  const [meetingForm, setMeetingForm] = useState({
    meetingDate: dateInputValue(null),
    meetingType: 'strategy_call',
    meetingOutcome: '',
  });
  const [purchaseForm, setPurchaseForm] = useState({
    purchaseDate: dateInputValue(null),
    purchaseAmount: '',
    purchaseReference: '',
  });
  const [kpiForm, setKpiForm] = useState({
    metricDate: todayInput(),
    channel: 'instagram',
    sourceName: 'manual',
    reach: '',
    impressions: '',
    interactions: '',
    clicks: '',
    formCompletions: '',
    leads: '',
    meetingsBooked: '',
    meetingsAttended: '',
    purchases: '',
    noShows: '',
    spend: '',
    notes: '',
  });
  const [connectorMappings, setConnectorMappings] = useState<RecordMap[]>([]);
  const [importForm, setImportForm] = useState({
    connectorId: 'manual_csv' as ConnectorSource,
    displayName: 'Event KPI CSV Import',
    csvText: '',
    selectedMappingId: '',
    notes: '',
  });
  const [fieldSelections, setFieldSelections] = useState<Record<string, string>>({});
  const [csvDryRun, setCsvDryRun] = useState<RecordMap | null>(null);
  const [csvParseMessage, setCsvParseMessage] = useState('');
  const [problemForm, setProblemForm] = useState({
    title: '',
    category: 'sales' as ProblemCategory,
    severity: 'medium' as ProblemSeverity,
    source: 'manual' as ProblemSource,
    ownerRole: 'sales_manager',
    description: '',
    impactSummary: '',
    recommendedAction: '',
    relatedLeadId: '',
    relatedCampaignId: '',
    dueDate: '',
  });
  const [problemUpdateForm, setProblemUpdateForm] = useState({
    severity: 'medium' as ProblemSeverity,
    ownerRole: '',
    impactSummary: '',
    recommendedAction: '',
    resolutionNotes: '',
  });
  const [emailPlanForm, setEmailPlanForm] = useState({
    sequenceName: '',
    audienceSegment: '',
    emailCount: '3',
    plannedSendDate: '',
    subjectDraft: '',
    contentDraft: '',
    contentType: 'text',
  });
  const [whatsappPlanForm, setWhatsappPlanForm] = useState({
    audienceSegment: '',
    frequency: '2 reminders before the event',
    contentType: 'text',
    messageDraft: '',
  });
  const [upsellPlanForm, setUpsellPlanForm] = useState({
    targetSegment: '',
    offer: '',
    fomoAngle: '',
    plannedChannel: 'whatsapp',
  });
  const [contentRequirementForm, setContentRequirementForm] = useState({
    assetType: 'video' as ContentAssetType,
    platform: 'Instagram',
    description: '',
    dueDate: '',
  });
  const [salesTaskForm, setSalesTaskForm] = useState({
    taskType: 'follow_up' as SalesTaskType,
    ownerRole: 'sales_manager',
    description: '',
    dueDate: '',
  });

  const selectedEventId = eventId || String(events[0]?.id || '');

  async function load(selected = selectedEventId) {
    if (!token) return;
    const eventList = await eventsApi.list(token);
    const normalizedEvents = list(eventList);
    setEvents(normalizedEvents);
    const nextEventId = selected || String(normalizedEvents[0]?.id || '');
    if (nextEventId) {
      setCloseoutReport(null);
      setLearningError('');
      const [data, leadData, problemSummary, problems, emailData, whatsappData, upsellData, contentData, salesTaskData, mappingData, recommendationData] = await Promise.all([
        eventsApi.dashboard(nextEventId, token),
        leadsApi.list(token, { eventId: nextEventId }),
        eventProblemsApi.dashboard(nextEventId, token),
        eventProblemsApi.list(token, { eventId: nextEventId }),
        eventPlannerApi.emailPlans(nextEventId, token),
        eventPlannerApi.whatsappPlans(nextEventId, token),
        eventPlannerApi.upsellPlans(nextEventId, token),
        eventPlannerApi.contentRequirements(nextEventId, token),
        eventPlannerApi.salesTasks(nextEventId, token),
        connectorMappingsApi.list(token),
        learningRecommendationsApi.forEvent(nextEventId, token).catch(error => ({
          __learningError: error instanceof Error ? error.message : 'Learning recommendations failed to load',
        })),
      ]);
      setDashboard(data as RecordMap);
      setSalesLeads(list(leadData));
      setProblemDashboard(problemSummary as RecordMap);
      const normalizedProblems = list(problems);
      setEventProblems(normalizedProblems);
      const nextProblemId = selectedProblemId && normalizedProblems.some(problem => String(problem.id) === selectedProblemId)
        ? selectedProblemId
        : String(normalizedProblems[0]?.id || '');
      const nextProblem = normalizedProblems.find(problem => String(problem.id) === nextProblemId) || null;
      setSelectedProblemId(nextProblemId);
      setProblemUpdateForm(problemUpdateState(nextProblem));
      setEmailPlans(list(emailData));
      setWhatsappPlans(list(whatsappData));
      setUpsellPlans(list(upsellData));
      setContentRequirements(list(contentData));
      setSalesTasks(list(salesTaskData));
      setConnectorMappings(list(mappingData).filter(mapping => !mapping.eventId || String(mapping.eventId) === nextEventId));
      if (recommendationData && typeof recommendationData === 'object' && '__learningError' in recommendationData) {
        setLearningSummary(null);
        setLearningError(text((recommendationData as RecordMap).__learningError, 'Learning recommendations failed to load'));
      } else {
        setLearningSummary(recommendationData as RecordMap);
      }
    } else {
      setDashboard(null);
      setSalesLeads([]);
      setProblemDashboard(null);
      setEventProblems([]);
      setCloseoutReport(null);
      setLearningSummary(null);
      setLearningError('');
      setSelectedProblemId('');
      setEmailPlans([]);
      setWhatsappPlans([]);
      setUpsellPlans([]);
      setContentRequirements([]);
      setSalesTasks([]);
      setConnectorMappings([]);
    }
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function run() {
      try {
        await load(eventId || '');
      } catch (error) {
        if (!cancelled) setMessage(`Events failed to load: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, eventId]);

  const event = useMemo(() => (dashboard?.event || {}) as RecordMap, [dashboard]);
  const kpis = (dashboard?.kpis || {}) as RecordMap;
  const sourceStatus = (dashboard?.sourceStatus || {}) as RecordMap;
  const funnel = list(dashboard?.funnel);
  const channelPerformance = list(dashboard?.channelPerformance);
  const leadTemperatureBreakdown = list(dashboard?.leadTemperature);
  const nextActions = list(dashboard?.nextActions);
  const kpiRecords = list(dashboard?.kpiRecords);
  const leads = list(dashboard?.leads);
  const campaigns = list(dashboard?.campaigns);
  const parsedCsv = useMemo(() => parseCsv(importForm.csvText), [importForm.csvText]);
  const eventConnectorMappings = useMemo(
    () => connectorMappings.filter(mapping => !mapping.eventId || String(mapping.eventId) === selectedEventId),
    [connectorMappings, selectedEventId],
  );
  const dryRunRows = list(csvDryRun?.kpiRows);
  const dryRunErrors = list(csvDryRun?.validationErrors);
  const problemTopBlockers = list(problemDashboard?.topBlockers);
  const problemCountsByCategory = (problemDashboard?.byCategory || {}) as RecordMap;
  const daysRemaining = daysUntil(event.eventDate);

  function applyHeaderAutoMap() {
    if (!parsedCsv.headers.length) {
      setCsvParseMessage(parsedCsv.error || 'Paste CSV data before mapping fields.');
      return;
    }
    const nextSelections = KPI_TARGET_FIELDS.reduce<Record<string, string>>((acc, targetField) => {
      acc[targetField] = inferSourceField(parsedCsv.headers, targetField);
      return acc;
    }, {});
    setFieldSelections(nextSelections);
    setCsvParseMessage('Headers detected. Review required mappings before saving.');
  }

  async function saveCsvMapping() {
    if (!token || !selectedEventId) return;
    if (!parsedCsv.headers.length) {
      setCsvParseMessage(parsedCsv.error || 'Paste CSV data before saving a mapping.');
      return;
    }
    const missingRequired = REQUIRED_IMPORT_FIELDS.filter(field => !fieldSelections[field]);
    if (missingRequired.length) {
      setCsvParseMessage(`Map required field(s): ${missingRequired.map(titleCase).join(', ')}.`);
      return;
    }
    const fieldMappings = KPI_TARGET_FIELDS
      .map(targetField => ({ targetField, sourceField: fieldSelections[targetField] || '' }))
      .filter(mapping => mapping.sourceField);
    setLoading('save-csv-mapping');
    setMessage('');
    try {
      const mapping = await connectorMappingsApi.create({
        connectorId: importForm.connectorId,
        eventId: selectedEventId,
        displayName: importForm.displayName || `${titleCase(importForm.connectorId)} KPI Import`,
        targetType: 'event_kpi_record',
        fieldMappings,
      }, token) as RecordMap;
      const mappingId = String(mapping.id || '');
      setImportForm(current => ({ ...current, selectedMappingId: mappingId }));
      await load(selectedEventId);
      setMessage('Connector mapping saved. Run dry-run preview before importing KPI records.');
    } catch (error) {
      setMessage(`Mapping could not be saved: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function runCsvDryRun() {
    if (!token || !selectedEventId) return;
    const mappingId = importForm.selectedMappingId;
    if (!mappingId) {
      setMessage('Save or choose a mapping before running a CSV dry-run.');
      return;
    }
    if (!parsedCsv.rows.length) {
      setMessage(parsedCsv.error || 'Paste CSV rows before running a dry-run.');
      return;
    }
    setLoading('csv-dry-run');
    setMessage('');
    try {
      const result = await csvImportApi.dryRun({ mappingId, eventId: selectedEventId, rows: parsedCsv.rows }, token) as RecordMap;
      setCsvDryRun(result);
      setMessage(`Dry-run complete: ${numberValue(result.validRows)} valid row(s), ${numberValue(result.invalidRows)} invalid row(s).`);
    } catch (error) {
      setCsvDryRun(null);
      setMessage(`CSV dry-run failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function approveCsvImport() {
    if (!token || !selectedEventId) return;
    const mappingId = importForm.selectedMappingId;
    if (!mappingId || !csvDryRun) {
      setMessage('Run a successful dry-run before approving the import.');
      return;
    }
    setLoading('csv-approve-import');
    setMessage('');
    try {
      const result = await csvImportApi.approveImport({
        mappingId,
        eventId: selectedEventId,
        notes: importForm.notes || 'Approved from Event Dashboard CSV import workflow.',
      }, token) as RecordMap;
      const imported = (result.imported || {}) as RecordMap;
      setCsvDryRun(null);
      setImportForm(current => ({ ...current, csvText: '', notes: '' }));
      await load(selectedEventId);
      setMessage(`Import approved: ${numberValue(imported.kpiRecords)} KPI record(s) added to this event.`);
    } catch (error) {
      setMessage(`CSV import could not be approved: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  const filteredSalesLeads = useMemo(
    () => salesLeads.filter(lead => {
      const status = leadStatus(lead.leadStatus || lead.status);
      const temperature = leadTemp(lead.leadTemperature);
      const channel = text(lead.channelAttribution || lead.platform, 'manual');
      if (leadFilters.status !== 'all' && status !== leadFilters.status) return false;
      if (leadFilters.temperature !== 'all' && temperature !== leadFilters.temperature) return false;
      if (leadFilters.channel !== 'all' && channel !== leadFilters.channel) return false;
      return true;
    }),
    [leadFilters.channel, leadFilters.status, leadFilters.temperature, salesLeads],
  );
  const selectedLead = useMemo(
    () => filteredSalesLeads.find(lead => String(lead.id) === selectedLeadId) || filteredSalesLeads[0] || salesLeads[0] || null,
    [filteredSalesLeads, salesLeads, selectedLeadId],
  );
  const selectedStatus = leadStatus(selectedLead?.leadStatus || selectedLead?.status);
  const allowedStatuses = nextAllowedStatuses(selectedLead);
  const salesCounts = useMemo((): { total: number; newLeads: number; contacted: number; meetings: number; attended: number; noShows: number; purchases: number; hot: number } => {
    return salesLeads.reduce<{ total: number; newLeads: number; contacted: number; meetings: number; attended: number; noShows: number; purchases: number; hot: number }>(
      (counts, lead) => {
        const status = leadStatus(lead.leadStatus || lead.status);
        counts.total += 1;
        if (status === 'new_lead') counts.newLeads += 1;
        if (status === 'contacted') counts.contacted += 1;
        if (status === 'meeting_booked') counts.meetings += 1;
        if (status === 'meeting_attended') counts.attended += 1;
        if (status === 'no_show') counts.noShows += 1;
        if (status === 'purchased') counts.purchases += 1;
        if (leadTemp(lead.leadTemperature) === 'hot') counts.hot += 1;
        return counts;
      },
      { total: 0, newLeads: 0, contacted: 0, meetings: 0, attended: 0, noShows: 0, purchases: 0, hot: 0 },
    );
  }, [salesLeads]);
  const selectedProblem = useMemo(
    () => eventProblems.find(problem => String(problem.id) === selectedProblemId) || eventProblems[0] || null,
    [eventProblems, selectedProblemId],
  );
  const openProblemCount = numberValue(problemDashboard?.openProblems);
  const criticalProblemCount = numberValue(problemDashboard?.criticalOpen);
  const plannerCounts = {
    emails: emailPlans.length,
    whatsapp: whatsappPlans.length,
    upsells: upsellPlans.length,
    content: contentRequirements.length,
    tasks: salesTasks.length,
  };
  const plannerTotal = plannerCounts.emails + plannerCounts.whatsapp + plannerCounts.upsells + plannerCounts.content + plannerCounts.tasks;
  const closeoutBudget = (closeoutReport?.budget || {}) as RecordMap;
  const closeoutLeadFunnel = (closeoutReport?.leadFunnel || {}) as RecordMap;
  const closeoutSalesOutcomes = (closeoutReport?.salesOutcomes || {}) as RecordMap;
  const closeoutPlannerSummary = (closeoutReport?.plannerSummary || {}) as RecordMap;
  const closeoutCompleteness = (closeoutReport?.dataCompleteness || {}) as RecordMap;
  const closeoutTimeline = list(closeoutReport?.timeline);
  const closeoutChannels = list(closeoutReport?.channelPerformance);
  const closeoutSources = list(closeoutReport?.sourcePerformance);
  const closeoutBarriers = list(closeoutReport?.topBarriers);
  const closeoutFollowUps = list(closeoutReport?.openFollowUps);
  const closeoutMissingSections = Array.isArray(closeoutCompleteness.missingSections) ? closeoutCompleteness.missingSections.map(displayLabel) : [];
  const topCloseoutChannel = strongestChannel(closeoutChannels);
  const topCloseoutSource = strongestChannel(closeoutSources);
  const learningRecommendations = list(learningSummary?.recommendations);
  const learningWarnings = stringList(learningSummary?.dataCompletenessWarnings).map(displayLabel);
  const highPriorityRecommendations = learningRecommendations.filter(item => text(item.priority) === 'high').length;
  const recommendationGeneratedAt = learningSummary?.generatedAt ? formatDate(learningSummary.generatedAt) : 'Not generated yet';

  function selectLeadForWork(lead: RecordMap) {
    setSelectedLeadId(String(lead.id || ''));
    setLeadUpdateForm({
      nextAction: text(lead.nextAction, ''),
      followUpDate: lead.followUpDate ? dateInputValue(lead.followUpDate) : '',
      salesNotes: text(lead.salesNotes, ''),
      temperature: leadTemp(lead.leadTemperature),
    });
    setMeetingForm(current => ({
      ...current,
      meetingDate: lead.meetingDate ? dateInputValue(lead.meetingDate) : current.meetingDate,
      meetingType: text(lead.meetingType, current.meetingType),
      meetingOutcome: text(lead.meetingOutcome, current.meetingOutcome),
    }));
    setPurchaseForm(current => ({
      ...current,
      purchaseDate: lead.purchaseDate ? dateInputValue(lead.purchaseDate) : current.purchaseDate,
      purchaseAmount: lead.purchaseAmount != null ? String(numberValue(lead.purchaseAmount)) : current.purchaseAmount,
      purchaseReference: text(lead.purchaseReference, current.purchaseReference),
    }));
  }

  function selectProblemForWork(problem: RecordMap) {
    setSelectedProblemId(String(problem.id || ''));
    setProblemUpdateForm(problemUpdateState(problem));
  }

  function selectEmailPlan(plan: RecordMap) {
    setSelectedEmailPlanId(String(plan.id || ''));
    setEmailPlanForm({
      sequenceName: text(plan.sequenceName, ''),
      audienceSegment: text(plan.audienceSegment, ''),
      emailCount: String(numberValue(plan.emailCount) || 1),
      plannedSendDate: Array.isArray(plan.plannedSendDates) && plan.plannedSendDates[0] ? dateInputValue(plan.plannedSendDates[0]) : '',
      subjectDraft: text(plan.subjectDraft, ''),
      contentDraft: text(plan.contentDraft, ''),
      contentType: text(plan.contentType, 'text'),
    });
  }

  function selectWhatsappPlan(plan: RecordMap) {
    setSelectedWhatsappPlanId(String(plan.id || ''));
    setWhatsappPlanForm({
      audienceSegment: text(plan.audienceSegment, ''),
      frequency: text(plan.frequency, ''),
      contentType: text(plan.contentType, 'text'),
      messageDraft: text(plan.messageDraft, ''),
    });
  }

  function selectUpsellPlan(plan: RecordMap) {
    setSelectedUpsellPlanId(String(plan.id || ''));
    setUpsellPlanForm({
      targetSegment: text(plan.targetSegment, ''),
      offer: text(plan.offer, ''),
      fomoAngle: text(plan.fomoAngle, ''),
      plannedChannel: text(plan.plannedChannel, 'whatsapp'),
    });
  }

  function selectContentRequirement(item: RecordMap) {
    setSelectedContentRequirementId(String(item.id || ''));
    setContentRequirementForm({
      assetType: (CONTENT_ASSET_TYPES.includes(text(item.assetType, 'video') as ContentAssetType) ? text(item.assetType, 'video') : 'video') as ContentAssetType,
      platform: text(item.platform, 'Instagram'),
      description: text(item.description, ''),
      dueDate: item.dueDate ? dateInputValue(item.dueDate) : '',
    });
  }

  function selectSalesTask(task: RecordMap) {
    setSelectedSalesTaskId(String(task.id || ''));
    setSalesTaskForm({
      taskType: (SALES_TASK_TYPES.includes(text(task.taskType, 'follow_up') as SalesTaskType) ? text(task.taskType, 'follow_up') : 'follow_up') as SalesTaskType,
      ownerRole: text(task.ownerRole, 'sales_manager'),
      description: text(task.description, ''),
      dueDate: task.dueDate ? dateInputValue(task.dueDate) : '',
    });
  }

  const eventDetails = useMemo(
    () => [
      { label: 'Event Type', value: titleCase(text(event.eventType, 'Not set')) },
      { label: 'Event Date', value: formatDate(event.eventDate) },
      { label: 'Location', value: text(event.location, 'Not set') },
      { label: 'Campaign Start', value: formatDate(event.campaignStartDate) },
      { label: 'Campaign End', value: formatDate(event.campaignEndDate) },
      { label: 'Owner', value: text(event.ownerUserName, 'Not assigned') },
      { label: 'Expected Attendance', value: String(numberValue(event.expectedAttendance)) },
      { label: 'Revenue Target', value: money(event.revenueTarget) },
    ],
    [event],
  );

  async function saveKpi() {
    if (!token || !selectedEventId) return;
    setLoading('save-kpi');
    setMessage('');
    try {
      const payload: RecordMap = {
        sourceType: 'manual',
        sourceName: kpiForm.sourceName || 'manual',
        metricDate: new Date(`${kpiForm.metricDate}T12:00:00Z`).toISOString(),
        channel: kpiForm.channel || 'manual',
        notes: kpiForm.notes || null,
      };

      for (const key of ['reach', 'impressions', 'interactions', 'clicks', 'formCompletions', 'leads', 'meetingsBooked', 'meetingsAttended', 'purchases', 'noShows', 'spend']) {
        const value = kpiForm[key as keyof typeof kpiForm];
        if (value !== '') payload[key] = Number(value);
      }

      await eventsApi.createKpi(selectedEventId, payload, token);
      setMessage('Event KPI update saved. Dashboard refreshed.');
      setKpiForm(current => ({
        ...current,
        reach: '',
        impressions: '',
        interactions: '',
        clicks: '',
        formCompletions: '',
        leads: '',
        meetingsBooked: '',
        meetingsAttended: '',
        purchases: '',
        noShows: '',
        spend: '',
        notes: '',
      }));
      await load(selectedEventId);
    } catch (error) {
      setMessage(`Could not save KPI update: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function refreshSalesWorkflow(successMessage?: string) {
    await load(selectedEventId);
    if (successMessage) setMessage(successMessage);
  }

  async function generateCloseoutReport() {
    if (!token || !selectedEventId) return;
    setLoading('generate-closeout');
    setMessage('');
    try {
      const report = await eventCloseoutApi.report(selectedEventId, token);
      setCloseoutReport(report as RecordMap);
      setMessage('Closeout report generated from current event data.');
    } catch (error) {
      setMessage(`Could not generate closeout report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  function printCloseoutReport() {
    document.body.classList.add('printing-closeout');
    window.addEventListener('afterprint', () => document.body.classList.remove('printing-closeout'), { once: true });
    window.print();
  }

  async function saveEmailPlan() {
    if (!token || !selectedEventId || !emailPlanForm.sequenceName.trim()) return;
    setLoading('save-email-plan');
    setMessage('');
    try {
      const payload: RecordMap = {
        sequenceName: emailPlanForm.sequenceName.trim(),
        audienceSegment: emailPlanForm.audienceSegment || null,
        emailCount: Number(emailPlanForm.emailCount || 1),
        subjectDraft: emailPlanForm.subjectDraft || null,
        contentDraft: emailPlanForm.contentDraft || null,
        contentType: emailPlanForm.contentType,
      };
      if (emailPlanForm.plannedSendDate) payload.plannedSendDates = [toIsoFromLocalInput(emailPlanForm.plannedSendDate)];

      if (selectedEmailPlanId) {
        await eventPlannerApi.updateEmailPlan(selectedEmailPlanId, payload, token);
      } else {
        const created = await eventPlannerApi.createEmailPlan({ ...payload, eventId: selectedEventId }, token) as RecordMap;
        setSelectedEmailPlanId(String(created.id || ''));
      }
      await refreshSalesWorkflow(selectedEmailPlanId ? 'Email plan updated.' : 'Email plan added to this event.');
    } catch (error) {
      setMessage(`Could not save email plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function saveWhatsappPlan() {
    if (!token || !selectedEventId || !whatsappPlanForm.messageDraft.trim()) return;
    setLoading('save-whatsapp-plan');
    setMessage('');
    try {
      const payload: RecordMap = {
        audienceSegment: whatsappPlanForm.audienceSegment || null,
        frequency: whatsappPlanForm.frequency || null,
        contentType: whatsappPlanForm.contentType,
        messageDraft: whatsappPlanForm.messageDraft,
      };
      if (selectedWhatsappPlanId) {
        await eventPlannerApi.updateWhatsappPlan(selectedWhatsappPlanId, payload, token);
      } else {
        const created = await eventPlannerApi.createWhatsappPlan({ ...payload, eventId: selectedEventId }, token) as RecordMap;
        setSelectedWhatsappPlanId(String(created.id || ''));
      }
      await refreshSalesWorkflow(selectedWhatsappPlanId ? 'WhatsApp plan updated.' : 'WhatsApp plan added to this event.');
    } catch (error) {
      setMessage(`Could not save WhatsApp plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function saveUpsellPlan() {
    if (!token || !selectedEventId || !upsellPlanForm.offer.trim()) return;
    setLoading('save-upsell-plan');
    setMessage('');
    try {
      const payload: RecordMap = {
        targetSegment: upsellPlanForm.targetSegment || null,
        offer: upsellPlanForm.offer,
        fomoAngle: upsellPlanForm.fomoAngle || null,
        plannedChannel: upsellPlanForm.plannedChannel || null,
      };
      if (selectedUpsellPlanId) {
        await eventPlannerApi.updateUpsellPlan(selectedUpsellPlanId, payload, token);
      } else {
        const created = await eventPlannerApi.createUpsellPlan({ ...payload, eventId: selectedEventId }, token) as RecordMap;
        setSelectedUpsellPlanId(String(created.id || ''));
      }
      await refreshSalesWorkflow(selectedUpsellPlanId ? 'Upsell plan updated.' : 'Upsell plan added to this event.');
    } catch (error) {
      setMessage(`Could not save upsell plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function saveContentRequirement() {
    if (!token || !selectedEventId || !contentRequirementForm.description.trim()) return;
    setLoading('save-content-requirement');
    setMessage('');
    try {
      const payload: RecordMap = {
        assetType: contentRequirementForm.assetType,
        platform: contentRequirementForm.platform || null,
        description: contentRequirementForm.description,
      };
      if (contentRequirementForm.dueDate) payload.dueDate = toIsoFromLocalInput(contentRequirementForm.dueDate);
      if (selectedContentRequirementId) {
        await eventPlannerApi.updateContentRequirement(selectedContentRequirementId, payload, token);
      } else {
        const created = await eventPlannerApi.createContentRequirement({ ...payload, eventId: selectedEventId }, token) as RecordMap;
        setSelectedContentRequirementId(String(created.id || ''));
      }
      await refreshSalesWorkflow(selectedContentRequirementId ? 'Content requirement updated.' : 'Content requirement added to this event.');
    } catch (error) {
      setMessage(`Could not save content requirement: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function updateContentRequirementStatus(item: RecordMap, status: ContentRequirementStatus) {
    if (!token || !item.id) return;
    setLoading(`content-${status}`);
    setMessage('');
    try {
      await eventPlannerApi.updateContentRequirement(String(item.id), { status }, token);
      await refreshSalesWorkflow(`Content requirement marked ${titleCase(status)}.`);
    } catch (error) {
      setMessage(`Could not update content status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function saveSalesTask() {
    if (!token || !selectedEventId || !salesTaskForm.description.trim()) return;
    setLoading('save-sales-task');
    setMessage('');
    try {
      const payload: RecordMap = {
        taskType: salesTaskForm.taskType,
        ownerRole: salesTaskForm.ownerRole || null,
        description: salesTaskForm.description,
      };
      if (salesTaskForm.dueDate) payload.dueDate = toIsoFromLocalInput(salesTaskForm.dueDate);
      if (selectedSalesTaskId) {
        await eventPlannerApi.updateSalesTask(selectedSalesTaskId, payload, token);
      } else {
        const created = await eventPlannerApi.createSalesTask({ ...payload, eventId: selectedEventId }, token) as RecordMap;
        setSelectedSalesTaskId(String(created.id || ''));
      }
      await refreshSalesWorkflow(selectedSalesTaskId ? 'Sales task updated.' : 'Sales task added to this event.');
    } catch (error) {
      setMessage(`Could not save sales task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function updateSalesTaskStatus(task: RecordMap, status: SalesTaskStatus) {
    if (!token || !task.id) return;
    setLoading(`sales-task-${status}`);
    setMessage('');
    try {
      await eventPlannerApi.updateSalesTask(String(task.id), { status }, token);
      await refreshSalesWorkflow(`Sales task marked ${titleCase(status)}.`);
    } catch (error) {
      setMessage(`Could not update sales task status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function createProblem() {
    if (!token || !selectedEventId || !problemForm.title.trim()) return;
    setLoading('create-problem');
    setMessage('');
    try {
      const payload: RecordMap = {
        eventId: selectedEventId,
        title: problemForm.title.trim(),
        category: problemForm.category,
        severity: problemForm.severity,
        source: problemForm.source,
      };
      if (problemForm.ownerRole.trim()) payload.ownerRole = problemForm.ownerRole.trim();
      if (problemForm.description.trim()) payload.description = problemForm.description.trim();
      if (problemForm.impactSummary.trim()) payload.impactSummary = problemForm.impactSummary.trim();
      if (problemForm.recommendedAction.trim()) payload.recommendedAction = problemForm.recommendedAction.trim();
      if (problemForm.relatedLeadId) payload.relatedLeadId = problemForm.relatedLeadId;
      if (problemForm.relatedCampaignId) payload.relatedCampaignId = problemForm.relatedCampaignId;
      if (problemForm.dueDate) payload.dueDate = toIsoFromLocalInput(problemForm.dueDate);

      const created = await eventProblemsApi.create(payload, token) as RecordMap;
      setSelectedProblemId(String(created.id || ''));
      setProblemForm({
        title: '',
        category: 'sales',
        severity: 'medium',
        source: 'manual',
        ownerRole: 'sales_manager',
        description: '',
        impactSummary: '',
        recommendedAction: '',
        relatedLeadId: '',
        relatedCampaignId: '',
        dueDate: '',
      });
      await refreshSalesWorkflow('Barrier recorded for this event.');
    } catch (error) {
      setMessage(`Could not record barrier: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function updateSelectedProblem() {
    if (!token || !selectedProblem) return;
    setLoading('update-problem');
    setMessage('');
    try {
      await eventProblemsApi.update(String(selectedProblem.id), {
        severity: problemUpdateForm.severity,
        ownerRole: problemUpdateForm.ownerRole || null,
        impactSummary: problemUpdateForm.impactSummary || null,
        recommendedAction: problemUpdateForm.recommendedAction || null,
      }, token);
      await refreshSalesWorkflow('Barrier action plan updated.');
    } catch (error) {
      setMessage(`Could not update barrier: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function transitionSelectedProblem(toStatus: ProblemStatus) {
    if (!token || !selectedProblem) return;
    setLoading(`problem-${toStatus}`);
    setMessage('');
    try {
      const payload: RecordMap = { toStatus };
      if (toStatus === 'resolved' || toStatus === 'dismissed') {
        payload.resolutionNotes = problemUpdateForm.resolutionNotes || problemUpdateForm.recommendedAction || 'Reviewed from event dashboard.';
      }
      await eventProblemsApi.transition(String(selectedProblem.id), payload, token);
      await refreshSalesWorkflow(`Barrier marked ${titleCase(toStatus)}.`);
    } catch (error) {
      setMessage(`Could not change barrier status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function createLead() {
    if (!token || !selectedEventId) return;
    setLoading('create-lead');
    setMessage('');
    try {
      const created = await leadsApi.create({
        eventId: selectedEventId,
        leadName: leadForm.leadName || undefined,
        leadEmail: leadForm.leadEmail || undefined,
        leadPhone: leadForm.leadPhone || undefined,
        platform: leadForm.platform || leadForm.channelAttribution,
        audienceSource: leadForm.audienceSource,
        channelAttribution: leadForm.channelAttribution,
        salesNotes: leadForm.salesNotes || undefined,
      }, token) as RecordMap;
      selectLeadForWork(created);
      setLeadForm({
        leadName: '',
        leadEmail: '',
        leadPhone: '',
        audienceSource: 'follower',
        channelAttribution: 'instagram',
        platform: 'instagram',
        salesNotes: '',
      });
      await refreshSalesWorkflow('Lead captured and linked to this event.');
    } catch (error) {
      setMessage(`Could not capture lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function updateSelectedLead() {
    if (!token || !selectedLead) return;
    setLoading('update-lead');
    setMessage('');
    try {
      await leadsApi.update(String(selectedLead.id), {
        nextAction: leadUpdateForm.nextAction || null,
        followUpDate: leadUpdateForm.followUpDate ? toIsoFromLocalInput(leadUpdateForm.followUpDate) : null,
        salesNotes: leadUpdateForm.salesNotes || null,
      }, token);
      await leadsApi.setTemperature(String(selectedLead.id), {
        temperature: leadUpdateForm.temperature,
        reason: 'Updated from event sales workflow',
      }, token);
      await refreshSalesWorkflow('Lead follow-up details updated.');
    } catch (error) {
      setMessage(`Could not update lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function transitionSelectedLead(toStatus: LeadStatus, reason: string) {
    if (!token || !selectedLead) return;
    setLoading(`transition-${toStatus}`);
    setMessage('');
    try {
      await leadsApi.transition(String(selectedLead.id), { toStatus, reason }, token);
      await refreshSalesWorkflow(`Lead moved to ${titleCase(toStatus)}.`);
    } catch (error) {
      setMessage(`Could not move lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function recordMeeting() {
    if (!token || !selectedLead) return;
    setLoading('record-meeting');
    setMessage('');
    try {
      await leadsApi.recordMeeting(String(selectedLead.id), {
        meetingDate: toIsoFromLocalInput(meetingForm.meetingDate),
        meetingType: meetingForm.meetingType,
        meetingOutcome: meetingForm.meetingOutcome || undefined,
      }, token);
      await refreshSalesWorkflow('Meeting booked for selected lead.');
    } catch (error) {
      setMessage(`Could not book meeting: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  async function recordPurchase() {
    if (!token || !selectedLead) return;
    setLoading('record-purchase');
    setMessage('');
    try {
      await leadsApi.recordPurchase(String(selectedLead.id), {
        purchaseDate: toIsoFromLocalInput(purchaseForm.purchaseDate),
        purchaseAmount: Number(purchaseForm.purchaseAmount || 0),
        purchaseReference: purchaseForm.purchaseReference || undefined,
      }, token);
      await refreshSalesWorkflow('Purchase recorded for selected lead.');
    } catch (error) {
      setMessage(`Could not record purchase: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading('');
    }
  }

  if (pageLoading) {
    return (
      <ProductPage eyebrow="Events" title="Event Dashboard" subtitle="Loading event results...">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map(item => <div key={item} className="skeleton-pulse h-36 rounded-xl" />)}
        </div>
      </ProductPage>
    );
  }

  return (
    <ProductPage
      eyebrow="Event Revenue Operations"
      title="Events"
      subtitle="Track each course, camp, or live event from campaign launch to leads, meetings, purchases, no-shows, and learning."
      action={(
        <>
          <ProductStatus tone="info">Amro Workspace</ProductStatus>
          <SecondaryAction onClick={() => navigate('/events/master')}>Portfolio Dashboard</SecondaryAction>
          <PrimaryAction onClick={() => navigate('/events/new')}>Create Event</PrimaryAction>
        </>
      )}
    >
      {message && <Notice tone={message.toLowerCase().includes('could not') || message.toLowerCase().includes('failed') ? 'danger' : 'good'}>{message}</Notice>}

      {events.length === 0 ? (
        <EmptyProductState
          title="No events yet"
          message="Create the first event strategy, then this page becomes Amro's operating dashboard for leads, spend, meetings, purchases, and follow-up."
          action={<PrimaryAction onClick={() => navigate('/events/new')}>Create Event Strategy</PrimaryAction>}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-4">
            <ProductCard title="Event Queue" subtitle="Choose the event Amro is operating today.">
              <div className="space-y-3">
                {events.map(item => {
                  const active = String(item.id) === selectedEventId;
                  return (
                    <button
                      key={String(item.id)}
                      type="button"
                      onClick={() => navigate(`/events/${String(item.id)}`)}
                      className={`w-full rounded-lg border p-4 text-left transition ${active ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white hover:bg-neutral-50'}`}
                    >
                      <div className="font-semibold">{text(item.name, 'Untitled event')}</div>
                      <div className={`mt-2 text-sm leading-5 ${active ? 'text-white/65' : 'text-neutral-500'}`}>
                        {titleCase(text(item.eventType, 'event'))} / {formatDate(item.eventDate)}
                      </div>
                      <div className="mt-3">
                        <ProductStatus tone={active ? 'muted' : 'info'}>{titleCase(text(item.status, 'draft'))}</ProductStatus>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ProductCard>

            <ProductCard title="Manual KPI Update" subtitle="Use this until official Meta, YouTube, Formaloo, GHL, and WhatsApp connectors are enabled.">
              <div className="space-y-4">
                <Field label="Date">
                  <input
                    type="date"
                    value={kpiForm.metricDate}
                    onChange={event => setKpiForm(current => ({ ...current, metricDate: event.target.value }))}
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Channel">
                  <select
                    value={kpiForm.channel}
                    onChange={event => setKpiForm(current => ({ ...current, channel: event.target.value }))}
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                  >
                    {['instagram', 'meta_ads', 'youtube', 'whatsapp', 'email', 'organic', 'dark_ads', 'referral', 'manual'].map(channel => (
                      <option key={channel} value={channel}>{titleCase(channel)}</option>
                    ))}
                  </select>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['reach', 'Reach'],
                    ['interactions', 'Interactions'],
                    ['formCompletions', 'Forms'],
                    ['leads', 'Leads'],
                    ['meetingsBooked', 'Meetings'],
                    ['purchases', 'Purchases'],
                    ['noShows', 'No-shows'],
                    ['spend', 'Spend'],
                  ].map(([key, label]) => (
                    <Field key={key} label={label}>
                      <input
                        type="number"
                        min="0"
                        value={kpiForm[key as keyof typeof kpiForm]}
                        onChange={event => setKpiForm(current => ({ ...current, [key]: event.target.value }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      />
                    </Field>
                  ))}
                </div>
                <Field label="Notes">
                  <textarea
                    value={kpiForm.notes}
                    onChange={event => setKpiForm(current => ({ ...current, notes: event.target.value }))}
                    className="min-h-24 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                    placeholder="Example: Meta campaign adjusted after low interaction rate."
                  />
                </Field>
                <PrimaryAction onClick={saveKpi} disabled={loading === 'save-kpi'}>
                  {loading === 'save-kpi' ? 'Saving...' : 'Save KPI Update'}
                </PrimaryAction>
              </div>
            </ProductCard>

            <ProductCard title="Import KPI CSV" subtitle="Bring real event results from customer-owned exports. Paste CSV, map fields, dry-run, then approve import.">
              <div className="space-y-4">
                <Notice tone="info">
                  This does not call Meta, YouTube, Formaloo, GHL, or WhatsApp. It imports customer-provided CSV data into this event after validation.
                </Notice>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Source">
                    <select
                      value={importForm.connectorId}
                      onChange={event => setImportForm(current => ({ ...current, connectorId: event.target.value as ConnectorSource, selectedMappingId: '' }))}
                      className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                    >
                      {CONNECTOR_SOURCES.map(source => (
                        <option key={source} value={source}>{titleCase(source)}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Mapping name">
                    <input
                      value={importForm.displayName}
                      onChange={event => setImportForm(current => ({ ...current, displayName: event.target.value }))}
                      className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      placeholder="Formaloo event export"
                    />
                  </Field>
                </div>

                {eventConnectorMappings.length > 0 && (
                  <Field label="Saved mapping">
                    <select
                      value={importForm.selectedMappingId}
                      onChange={event => {
                        const mappingId = event.target.value;
                        const mapping = eventConnectorMappings.find(item => String(item.id) === mappingId);
                        const entries = list(mapping?.fieldMappings);
                        setImportForm(current => ({ ...current, selectedMappingId: mappingId }));
                        setFieldSelections(entries.reduce<Record<string, string>>((acc, entry) => {
                          acc[text(entry.targetField, '')] = text(entry.sourceField, '');
                          return acc;
                        }, {}));
                      }}
                      className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                    >
                      <option value="">Create or choose mapping</option>
                      {eventConnectorMappings.map(mapping => (
                        <option key={String(mapping.id)} value={String(mapping.id)}>
                          {text(mapping.displayName)} / {titleCase(text(mapping.connectorId))}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}

                <Field label="CSV rows" helper="First row must be headers. Required target fields are metric date and channel.">
                  <textarea
                    value={importForm.csvText}
                    onChange={event => {
                      setImportForm(current => ({ ...current, csvText: event.target.value }));
                      setCsvDryRun(null);
                      setCsvParseMessage('');
                    }}
                    className="min-h-32 w-full rounded-md border border-neutral-200 px-3 py-2 font-mono text-xs leading-5"
                    placeholder="date,channel,reach,leads,purchases,spend&#10;2026-07-01,instagram,1200,18,3,450"
                  />
                </Field>

                <div className="flex flex-wrap gap-2">
                  <SecondaryAction onClick={applyHeaderAutoMap} disabled={!importForm.csvText.trim()}>Detect Headers</SecondaryAction>
                  <PrimaryAction onClick={saveCsvMapping} disabled={loading === 'save-csv-mapping' || !parsedCsv.headers.length}>
                    {loading === 'save-csv-mapping' ? 'Saving...' : 'Save Mapping'}
                  </PrimaryAction>
                </div>

                {(csvParseMessage || parsedCsv.error) && (
                  <Notice tone={parsedCsv.error && !parsedCsv.headers.length ? 'warn' : 'info'}>
                    {csvParseMessage || parsedCsv.error}
                  </Notice>
                )}

                {parsedCsv.headers.length > 0 && (
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-neutral-950">Field mapping</div>
                        <p className="mt-1 text-xs leading-5 text-neutral-500">
                          {parsedCsv.rows.length} row(s) detected. Map only fields that exist in the CSV.
                        </p>
                      </div>
                      <ProductStatus tone="info">{parsedCsv.headers.length} headers</ProductStatus>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {KPI_TARGET_FIELDS.map(targetField => (
                        <Field key={targetField} label={`${titleCase(targetField)}${REQUIRED_IMPORT_FIELDS.includes(targetField as typeof REQUIRED_IMPORT_FIELDS[number]) ? ' *' : ''}`}>
                          <select
                            value={fieldSelections[targetField] || ''}
                            onChange={event => setFieldSelections(current => ({ ...current, [targetField]: event.target.value }))}
                            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
                          >
                            <option value="">Not mapped</option>
                            {parsedCsv.headers.map(header => <option key={header} value={header}>{header}</option>)}
                          </select>
                        </Field>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <PrimaryAction onClick={runCsvDryRun} disabled={loading === 'csv-dry-run' || !importForm.selectedMappingId || !parsedCsv.rows.length}>
                    {loading === 'csv-dry-run' ? 'Running...' : 'Run Dry-Run'}
                  </PrimaryAction>
                  <PrimaryAction onClick={approveCsvImport} disabled={loading === 'csv-approve-import' || !csvDryRun || numberValue(csvDryRun.validRows) === 0 || dryRunErrors.length > 0}>
                    {loading === 'csv-approve-import' ? 'Importing...' : 'Approve Import'}
                  </PrimaryAction>
                </div>

                <Field label="Import notes">
                  <textarea
                    value={importForm.notes}
                    onChange={event => setImportForm(current => ({ ...current, notes: event.target.value }))}
                    className="min-h-20 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                    placeholder="Example: Imported Formaloo export after event registration campaign review."
                  />
                </Field>

                {csvDryRun && (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <MetricCard label="Total rows" value={numberValue(csvDryRun.totalRows)} tone="info" />
                      <MetricCard label="Valid rows" value={numberValue(csvDryRun.validRows)} tone={numberValue(csvDryRun.validRows) ? 'good' : 'warn'} />
                      <MetricCard label="Invalid rows" value={numberValue(csvDryRun.invalidRows)} tone={numberValue(csvDryRun.invalidRows) ? 'danger' : 'good'} />
                    </div>
                    {dryRunRows.length > 0 && (
                      <ProductTable
                        columns={['Date', 'Channel', 'Leads', 'Meetings', 'Purchases', 'Spend']}
                        rows={dryRunRows.slice(0, 5).map(row => [
                          formatDate(row.metricDate),
                          titleCase(text(row.channel)),
                          numberValue(row.leads).toLocaleString(),
                          numberValue(row.meetingsBooked).toLocaleString(),
                          numberValue(row.purchases).toLocaleString(),
                          money(row.spend),
                        ])}
                      />
                    )}
                    {dryRunErrors.length > 0 && (
                      <Notice tone="danger">
                        {dryRunErrors.length} row issue(s) found. Fix the CSV and run dry-run again before importing.
                      </Notice>
                    )}
                  </div>
                )}
              </div>
            </ProductCard>
          </div>

          <div className="space-y-6">
            <ProductCard
              title={text(event.name, 'Selected event')}
              subtitle="This is the event-level operating view: budget, leads, meetings, purchases, no-shows, and next actions."
              action={<ProductStatus tone={text(event.status) === 'active' ? 'good' : 'info'}>{titleCase(text(event.status, 'planning'))}</ProductStatus>}
            >
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                <DetailGrid items={eventDetails} />
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-5">
                  <div className="text-sm font-semibold text-neutral-950">Time pressure</div>
                  <div className="mt-3 text-4xl font-semibold tracking-tight text-neutral-950">
                    {daysRemaining == null ? 'N/A' : Math.max(0, daysRemaining)}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-neutral-500">
                    {daysRemaining == null ? 'Event date is not available.' : 'day(s) until event date. Campaign activity should intensify as this number drops.'}
                  </div>
                </div>
              </div>
            </ProductCard>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <ExecutiveKpiCard label="New Leads" value={numberValue(kpis.newLeads)} detail={`${numberValue(kpis.formCompletions)} forms completed`} tone={numberValue(kpis.newLeads) ? 'good' : 'warn'} series={[numberValue(kpis.formCompletions), numberValue(kpis.newLeads), numberValue(kpis.meetingsBooked), numberValue(kpis.purchases)]} />
              <ExecutiveKpiCard label="Meetings" value={numberValue(kpis.meetingsBooked)} detail={`${numberValue(kpis.noShows)} no-show(s)`} tone={numberValue(kpis.meetingsBooked) ? 'info' : 'warn'} series={[numberValue(kpis.newLeads), numberValue(kpis.meetingsBooked), numberValue(kpis.meetingsAttended), numberValue(kpis.noShows)]} />
              <ExecutiveKpiCard label="Purchases" value={numberValue(kpis.purchases)} detail={`${money(kpis.actualSpend)} actual spend`} tone={numberValue(kpis.purchases) ? 'good' : 'warn'} series={[numberValue(kpis.meetingsBooked), numberValue(kpis.meetingsAttended), numberValue(kpis.purchases)]} />
              <ExecutiveKpiCard label="Interaction Rate" value={`${numberValue(kpis.interactionRate)}%`} detail={`${numberValue(kpis.reach).toLocaleString()} reach`} tone={numberValue(kpis.interactionRate) ? 'info' : 'warn'} series={[numberValue(kpis.reach), numberValue(kpis.interactions), numberValue(kpis.clicks)]} />
            </div>

            <ProductCard
              title="Connector Data Status"
              subtitle="Shows whether this event is using manual records, approved CSV imports, or future live connector records."
              action={<ProductStatus tone={numberValue(sourceStatus.connectorRecords) ? 'good' : numberValue(sourceStatus.importedRecords) ? 'info' : 'warn'}>{numberValue(sourceStatus.connectorRecords) ? 'Approved Import Active' : numberValue(sourceStatus.importedRecords) ? 'Imported Data Active' : 'Manual Data Active'}</ProductStatus>}
            >
              <div className="grid gap-3 md:grid-cols-4">
                <MetricCard label="Saved mappings" value={eventConnectorMappings.length} detail="Event-scoped import mappings" tone={eventConnectorMappings.length ? 'good' : 'warn'} />
                <MetricCard label="Manual records" value={numberValue(sourceStatus.manualRecords)} detail="Entered by the team" tone={numberValue(sourceStatus.manualRecords) ? 'info' : 'default'} />
                <MetricCard label="Imported records" value={numberValue(sourceStatus.importedRecords)} detail="Approved CSV/import jobs" tone={numberValue(sourceStatus.importedRecords) ? 'good' : 'default'} />
                <MetricCard label="Connector records" value={numberValue(sourceStatus.connectorRecords)} detail="Approved connector or CSV import records" tone={numberValue(sourceStatus.connectorRecords) ? 'good' : 'warn'} />
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {[
                  {
                    title: 'Manual KPI Entry',
                    status: numberValue(sourceStatus.manualRecords) ? 'Recording Data' : 'Available',
                    detail: 'Fast path for Amro while customer-owned connectors are being configured.',
                    tone: numberValue(sourceStatus.manualRecords) ? 'info' : 'default',
                  },
                  {
                    title: 'CSV Import',
                    status: eventConnectorMappings.length ? 'Mapping Ready' : 'Needs Mapping',
                    detail: 'Use exported rows from Formaloo, Meta, YouTube, GHL, WhatsApp, or sheets.',
                    tone: eventConnectorMappings.length ? 'good' : 'warn',
                  },
                  {
                    title: 'Live Connectors',
                    status: 'Customer Credentials Required',
                    detail: 'Official integrations remain tenant-owned and cannot run without credentials.',
                    tone: 'warn',
                  },
                ].map(item => (
                  <div key={item.title} className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-neutral-950">{item.title}</div>
                      <ProductStatus tone={item.tone as 'default' | 'good' | 'warn' | 'danger' | 'info' | 'muted'}>{item.status}</ProductStatus>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-neutral-500">{item.detail}</p>
                  </div>
                ))}
              </div>
            </ProductCard>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <ProductCard title="Event Funnel" subtitle="Where the event is gaining or losing momentum.">
                {funnel.some(stage => numberValue(stage.value) > 0) ? (
                  <FunnelChart stages={funnel.map(stage => ({ label: text(stage.label), value: numberValue(stage.value), tone: numberValue(stage.value) ? 'info' : 'default' }))} />
                ) : (
                  <EmptyProductState message="Add KPI data or link leads to this event to see the funnel." />
                )}
              </ProductCard>

              <ProductCard title="Budget Control" subtitle="Manual spend until ad connectors are enabled.">
                <div className="grid gap-3">
                  <MetricCard label="Planned Budget" value={money(kpis.plannedBudget)} detail="From event strategy" tone="info" />
                  <MetricCard label="Actual Spend" value={money(kpis.actualSpend)} detail="From KPI records" tone={numberValue(kpis.actualSpend) ? 'warn' : 'default'} />
                  <MetricCard label="Cost Per Lead" value={money(kpis.costPerLead)} detail="Spend / event leads" tone={numberValue(kpis.costPerLead) ? 'info' : 'default'} />
                </div>
              </ProductCard>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <ProductCard title="Next Required Actions" subtitle="Operational actions for Amro and the sales/content teams.">
                {nextActions.length ? (
                  <ReadableQueue
                    items={nextActions.map(action => ({
                      title: text(action.title),
                      meta: text(action.detail),
                      status: titleCase(text(action.priority)),
                      tone: text(action.priority) === 'high' ? 'warn' : 'info',
                    }))}
                  />
                ) : (
                  <EmptyProductState message="No urgent action detected from the current event data." />
                )}
              </ProductCard>

              <ProductCard title="Lead Temperature" subtitle="Simple funnel temperature from linked leads and event KPI records.">
                <BarList
                  items={leadTemperatureBreakdown.map(item => ({
                    label: text(item.label),
                    value: numberValue(item.value),
                    tone: text(item.label).toLowerCase().includes('buyer') ? 'good' : text(item.label).toLowerCase().includes('no') ? 'warn' : 'info',
                  }))}
                />
              </ProductCard>
            </div>

            <ProductCard
              title="What To Improve Next"
              subtitle="Evidence-backed recommendations from this event's recorded KPIs, leads, planner work, and barrier log. These are advisory and require human decision before any operational change."
              action={(
                <div className="flex flex-wrap gap-2">
                  <ProductStatus tone={highPriorityRecommendations ? 'warn' : learningRecommendations.length ? 'info' : 'muted'}>
                    {learningRecommendations.length} recommendation(s)
                  </ProductStatus>
                  <ProductStatus tone={highPriorityRecommendations ? 'danger' : 'good'}>
                    {highPriorityRecommendations} high priority
                  </ProductStatus>
                  <ProductStatus tone="info">Generated {recommendationGeneratedAt}</ProductStatus>
                </div>
              )}
            >
              <div className="space-y-4">
                {learningError && (
                  <Notice tone="warn">
                    Recommendations could not be loaded right now: {learningError}. The rest of the event dashboard is still usable.
                  </Notice>
                )}

                {learningWarnings.length > 0 && (
                  <Notice tone="warn">
                    Recommendation confidence is limited because these data sections are missing: {learningWarnings.join(', ')}.
                  </Notice>
                )}

                {learningRecommendations.length ? (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {learningRecommendations.map(item => {
                      const missingWarnings = stringList(item.missingDataWarnings);
                      const sourceSections = stringList(item.sourceSections).map(displayLabel);
                      const ownerRole = text(item.suggestedOwnerRole, '');

                      return (
                        <article key={text(item.id, text(item.title, 'recommendation'))} className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                                {displayLabel(item.category)}
                              </div>
                              <h3 className="mt-1 text-base font-semibold tracking-tight text-neutral-950">
                                {text(item.title, 'Event recommendation')}
                              </h3>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-2">
                              <ProductStatus tone={recommendationPriorityTone(item.priority)}>
                                {displayLabel(item.priority)} Priority
                              </ProductStatus>
                              <ProductStatus tone={confidenceTone(item.confidence)}>
                                {displayLabel(item.confidence)} Confidence
                              </ProductStatus>
                            </div>
                          </div>

                          <div className="mt-4 space-y-3 text-sm leading-6">
                            <div>
                              <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Recommendation</div>
                              <p className="mt-1 text-neutral-800">{text(item.recommendation, 'No recommendation text available.')}</p>
                            </div>
                            <div>
                              <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Why it matters</div>
                              <p className="mt-1 text-neutral-600">{text(item.rationale, 'No rationale available yet.')}</p>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="rounded-md border border-neutral-100 bg-white p-3">
                                <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Evidence</div>
                                <p className="mt-1 text-neutral-700">{text(item.evidenceSummary, 'No evidence summary available.')}</p>
                              </div>
                              <div className="rounded-md border border-neutral-100 bg-white p-3">
                                <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Next action</div>
                                <p className="mt-1 text-neutral-700">{text(item.nextAction, 'Review with the event owner.')}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {ownerRole && (
                                <ProductStatus tone="info">Owner: {displayLabel(ownerRole)}</ProductStatus>
                              )}
                              {sourceSections.length > 0 && (
                                <ProductStatus tone="muted">Evidence: {sourceSections.join(', ')}</ProductStatus>
                              )}
                            </div>
                            {missingWarnings.length > 0 && (
                              <Notice tone="warn">
                                Limited evidence: {missingWarnings.join(' ')}
                              </Notice>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : !learningError ? (
                  <EmptyProductState
                    title="No recommendations yet"
                    message="Add KPI records, leads, planner work, and event barriers to generate evidence-backed next-event recommendations."
                  />
                ) : null}

                <Notice tone="info">
                  Recommendations do not change ads, budgets, CRM, WhatsApp, voice, or content workflows automatically. Amro or an authorized manager decides what to apply.
                </Notice>
              </div>
            </ProductCard>

            <ProductCard
              title="Event Campaign Planner"
              subtitle="Plan the email, WhatsApp, upsell, content, and sales work for this event. This screen prepares work only; nothing is sent to customers from here."
              action={(
                <div className="flex flex-wrap gap-2">
                  <ProductStatus tone={plannerTotal ? 'good' : 'warn'}>{plannerTotal} planner item(s)</ProductStatus>
                  <ProductStatus tone="info">Outbound Sending Controlled</ProductStatus>
                </div>
              )}
            >
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <MetricCard label="Email Plans" value={plannerCounts.emails} detail="Upsell and reminder sequences" tone={plannerCounts.emails ? 'good' : 'warn'} />
                <MetricCard label="WhatsApp Plans" value={plannerCounts.whatsapp} detail="Controlled message planning" tone={plannerCounts.whatsapp ? 'good' : 'warn'} />
                <MetricCard label="Upsell Offers" value={plannerCounts.upsells} detail="Existing-customer conversion" tone={plannerCounts.upsells ? 'good' : 'warn'} />
                <MetricCard label="Content Assets" value={plannerCounts.content} detail="Requests for the content team" tone={plannerCounts.content ? 'info' : 'warn'} />
                <MetricCard label="Sales Tasks" value={plannerCounts.tasks} detail="Follow-up work before the event" tone={plannerCounts.tasks ? 'info' : 'warn'} />
              </div>

              <Notice tone="info">
                Planner records are tied to the selected event. Approval status is shown for clarity, but approval changes stay in governed review. Email, WhatsApp, CRM, and ad execution remain outside this screen until customer-owned connectors are configured and authorized.
              </Notice>

              <div className="grid gap-5 xl:grid-cols-2">
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-neutral-950">Email plan</div>
                      <p className="mt-1 text-sm leading-6 text-neutral-500">Define awareness, reminder, and upsell emails for this event.</p>
                    </div>
                    <ProductStatus tone="info">{selectedEmailPlanId ? 'Editing' : 'New'}</ProductStatus>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field label="Sequence name">
                      <input
                        value={emailPlanForm.sequenceName}
                        onChange={event => setEmailPlanForm(current => ({ ...current, sequenceName: event.target.value }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                        placeholder="Awareness sequence"
                      />
                    </Field>
                    <Field label="Audience segment">
                      <input
                        value={emailPlanForm.audienceSegment}
                        onChange={event => setEmailPlanForm(current => ({ ...current, audienceSegment: event.target.value }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                        placeholder="Existing customers"
                      />
                    </Field>
                    <Field label="Email count">
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={emailPlanForm.emailCount}
                        onChange={event => setEmailPlanForm(current => ({ ...current, emailCount: event.target.value }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      />
                    </Field>
                    <Field label="First send date">
                      <input
                        type="datetime-local"
                        value={emailPlanForm.plannedSendDate}
                        onChange={event => setEmailPlanForm(current => ({ ...current, plannedSendDate: event.target.value }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      />
                    </Field>
                  </div>
                  <div className="mt-3 grid gap-3">
                    <Field label="Subject draft">
                      <input
                        value={emailPlanForm.subjectDraft}
                        onChange={event => setEmailPlanForm(current => ({ ...current, subjectDraft: event.target.value }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                        placeholder="Last seats before the event"
                      />
                    </Field>
                    <Field label="Email content">
                      <textarea
                        value={emailPlanForm.contentDraft}
                        onChange={event => setEmailPlanForm(current => ({ ...current, contentDraft: event.target.value }))}
                        className="min-h-24 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                        placeholder="Write the draft message Amro's team wants to review."
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <PrimaryAction onClick={saveEmailPlan} disabled={loading === 'save-email-plan' || !emailPlanForm.sequenceName.trim()}>
                        {loading === 'save-email-plan' ? 'Saving...' : selectedEmailPlanId ? 'Update Email Plan' : 'Add Email Plan'}
                      </PrimaryAction>
                      {selectedEmailPlanId && (
                        <SecondaryAction onClick={() => setSelectedEmailPlanId('')}>New Email Plan</SecondaryAction>
                      )}
                    </div>
                  </div>
                  <div className="mt-4">
                    {emailPlans.length ? (
                      <ReadableQueue
                        items={emailPlans.map(plan => ({
                          title: text(plan.sequenceName, 'Email sequence'),
                          meta: `${text(plan.audienceSegment, 'Audience not set')} / ${numberValue(plan.emailCount) || 1} email(s)`,
                          status: titleCase(approvalStatus(plan.approvalStatus)),
                          tone: approvalTone(approvalStatus(plan.approvalStatus)),
                        }))}
                      />
                    ) : (
                      <EmptyProductState title="No email plan yet" message="Add the first email sequence for reminders, upsell, or FOMO." />
                    )}
                    {emailPlans.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {emailPlans.map(plan => (
                          <SecondaryAction key={String(plan.id)} onClick={() => selectEmailPlan(plan)}>Edit {text(plan.sequenceName, 'plan')}</SecondaryAction>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-neutral-950">WhatsApp plan</div>
                      <p className="mt-1 text-sm leading-6 text-neutral-500">Prepare reminder content and frequency without sending messages.</p>
                    </div>
                    <ProductStatus tone="info">{selectedWhatsappPlanId ? 'Editing' : 'New'}</ProductStatus>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field label="Audience segment">
                      <input
                        value={whatsappPlanForm.audienceSegment}
                        onChange={event => setWhatsappPlanForm(current => ({ ...current, audienceSegment: event.target.value }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                        placeholder="Booked but not paid"
                      />
                    </Field>
                    <Field label="Frequency">
                      <input
                        value={whatsappPlanForm.frequency}
                        onChange={event => setWhatsappPlanForm(current => ({ ...current, frequency: event.target.value }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                        placeholder="Two reminders before event"
                      />
                    </Field>
                    <Field label="Content type">
                      <select
                        value={whatsappPlanForm.contentType}
                        onChange={event => setWhatsappPlanForm(current => ({ ...current, contentType: event.target.value }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      >
                        {['text', 'image', 'video'].map(type => <option key={type} value={type}>{titleCase(type)}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="mt-3 grid gap-3">
                    <Field label="Message draft">
                      <textarea
                        value={whatsappPlanForm.messageDraft}
                        onChange={event => setWhatsappPlanForm(current => ({ ...current, messageDraft: event.target.value }))}
                        className="min-h-24 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                        placeholder="Short reminder, proof point, or answer to a common objection."
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <PrimaryAction onClick={saveWhatsappPlan} disabled={loading === 'save-whatsapp-plan' || !whatsappPlanForm.messageDraft.trim()}>
                        {loading === 'save-whatsapp-plan' ? 'Saving...' : selectedWhatsappPlanId ? 'Update WhatsApp Plan' : 'Add WhatsApp Plan'}
                      </PrimaryAction>
                      {selectedWhatsappPlanId && (
                        <SecondaryAction onClick={() => setSelectedWhatsappPlanId('')}>New WhatsApp Plan</SecondaryAction>
                      )}
                    </div>
                  </div>
                  <div className="mt-4">
                    {whatsappPlans.length ? (
                      <ReadableQueue
                        items={whatsappPlans.map(plan => ({
                          title: text(plan.audienceSegment, 'WhatsApp segment'),
                          meta: `${text(plan.frequency, 'Frequency not set')} / ${titleCase(text(plan.contentType, 'text'))}`,
                          status: titleCase(approvalStatus(plan.approvalStatus)),
                          tone: approvalTone(approvalStatus(plan.approvalStatus)),
                        }))}
                      />
                    ) : (
                      <EmptyProductState title="No WhatsApp plan yet" message="Add the reminder or follow-up sequence before the sales team starts outreach." />
                    )}
                    {whatsappPlans.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {whatsappPlans.map(plan => (
                          <SecondaryAction key={String(plan.id)} onClick={() => selectWhatsappPlan(plan)}>Edit {text(plan.audienceSegment, 'segment')}</SecondaryAction>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-neutral-950">Upsell offer</div>
                      <p className="mt-1 text-sm leading-6 text-neutral-500">Plan the offer and urgency angle for existing customers or warm leads.</p>
                    </div>
                    <ProductStatus tone="info">{selectedUpsellPlanId ? 'Editing' : 'New'}</ProductStatus>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field label="Target segment">
                      <input
                        value={upsellPlanForm.targetSegment}
                        onChange={event => setUpsellPlanForm(current => ({ ...current, targetSegment: event.target.value }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                        placeholder="Past course buyers"
                      />
                    </Field>
                    <Field label="Channel">
                      <input
                        value={upsellPlanForm.plannedChannel}
                        onChange={event => setUpsellPlanForm(current => ({ ...current, plannedChannel: event.target.value }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                        placeholder="WhatsApp / email / call"
                      />
                    </Field>
                  </div>
                  <div className="mt-3 grid gap-3">
                    <Field label="Offer">
                      <textarea
                        value={upsellPlanForm.offer}
                        onChange={event => setUpsellPlanForm(current => ({ ...current, offer: event.target.value }))}
                        className="min-h-20 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                        placeholder="Example: VIP seat upgrade with bonus consultation."
                      />
                    </Field>
                    <Field label="FOMO angle">
                      <textarea
                        value={upsellPlanForm.fomoAngle}
                        onChange={event => setUpsellPlanForm(current => ({ ...current, fomoAngle: event.target.value }))}
                        className="min-h-20 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                        placeholder="Example: limited seats, registration deadline, location urgency."
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <PrimaryAction onClick={saveUpsellPlan} disabled={loading === 'save-upsell-plan' || !upsellPlanForm.offer.trim()}>
                        {loading === 'save-upsell-plan' ? 'Saving...' : selectedUpsellPlanId ? 'Update Upsell Plan' : 'Add Upsell Plan'}
                      </PrimaryAction>
                      {selectedUpsellPlanId && (
                        <SecondaryAction onClick={() => setSelectedUpsellPlanId('')}>New Upsell Plan</SecondaryAction>
                      )}
                    </div>
                  </div>
                  <div className="mt-4">
                    {upsellPlans.length ? (
                      <ReadableQueue
                        items={upsellPlans.map(plan => ({
                          title: text(plan.targetSegment, 'Upsell segment'),
                          meta: `${text(plan.plannedChannel, 'Channel not set')} / ${text(plan.fomoAngle, 'FOMO angle not set')}`,
                          status: titleCase(approvalStatus(plan.approvalStatus)),
                          tone: approvalTone(approvalStatus(plan.approvalStatus)),
                        }))}
                      />
                    ) : (
                      <EmptyProductState title="No upsell plan yet" message="Add one offer for warm leads or existing customers." />
                    )}
                    {upsellPlans.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {upsellPlans.map(plan => (
                          <SecondaryAction key={String(plan.id)} onClick={() => selectUpsellPlan(plan)}>Edit {text(plan.targetSegment, 'offer')}</SecondaryAction>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-neutral-950">Content requirement</div>
                      <p className="mt-1 text-sm leading-6 text-neutral-500">Create the assets the content team needs before launch.</p>
                    </div>
                    <ProductStatus tone="info">{selectedContentRequirementId ? 'Editing' : 'New'}</ProductStatus>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field label="Asset type">
                      <select
                        value={contentRequirementForm.assetType}
                        onChange={event => setContentRequirementForm(current => ({ ...current, assetType: event.target.value as ContentAssetType }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      >
                        {CONTENT_ASSET_TYPES.map(type => <option key={type} value={type}>{titleCase(type)}</option>)}
                      </select>
                    </Field>
                    <Field label="Platform">
                      <input
                        value={contentRequirementForm.platform}
                        onChange={event => setContentRequirementForm(current => ({ ...current, platform: event.target.value }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                        placeholder="Instagram / YouTube / Email"
                      />
                    </Field>
                    <Field label="Due date">
                      <input
                        type="datetime-local"
                        value={contentRequirementForm.dueDate}
                        onChange={event => setContentRequirementForm(current => ({ ...current, dueDate: event.target.value }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      />
                    </Field>
                  </div>
                  <div className="mt-3 grid gap-3">
                    <Field label="Requirement">
                      <textarea
                        value={contentRequirementForm.description}
                        onChange={event => setContentRequirementForm(current => ({ ...current, description: event.target.value }))}
                        className="min-h-24 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                        placeholder="Describe the video, image, caption, carousel, landing page, or template needed."
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <PrimaryAction onClick={saveContentRequirement} disabled={loading === 'save-content-requirement' || !contentRequirementForm.description.trim()}>
                        {loading === 'save-content-requirement' ? 'Saving...' : selectedContentRequirementId ? 'Update Requirement' : 'Add Requirement'}
                      </PrimaryAction>
                      {selectedContentRequirementId && (
                        <SecondaryAction onClick={() => setSelectedContentRequirementId('')}>New Requirement</SecondaryAction>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {contentRequirements.length ? contentRequirements.map(item => {
                      const status = contentRequirementStatus(item.status);
                      return (
                        <div key={String(item.id)} className="rounded-lg border border-neutral-200 bg-white p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="font-semibold text-neutral-950">{titleCase(text(item.assetType, 'asset'))}</div>
                              <div className="mt-1 text-sm leading-5 text-neutral-500">{text(item.description, 'No description')}</div>
                              <div className="mt-2 text-xs text-neutral-500">{text(item.platform, 'Platform not set')} / due {formatDate(item.dueDate)}</div>
                            </div>
                            <ProductStatus tone={workStatusTone(status)}>{titleCase(status)}</ProductStatus>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <SecondaryAction onClick={() => selectContentRequirement(item)}>Edit</SecondaryAction>
                            {status !== 'ready' && <SecondaryAction onClick={() => updateContentRequirementStatus(item, 'ready')}>Mark Ready</SecondaryAction>}
                            {status !== 'delivered' && <SecondaryAction onClick={() => updateContentRequirementStatus(item, 'delivered')}>Mark Delivered</SecondaryAction>}
                            {status !== 'blocked' && <SecondaryAction onClick={() => updateContentRequirementStatus(item, 'blocked')}>Mark Blocked</SecondaryAction>}
                          </div>
                        </div>
                      );
                    }) : (
                      <EmptyProductState title="No content requirements yet" message="Add the first required asset for the content team." />
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 xl:col-span-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-neutral-950">Sales tasks</div>
                      <p className="mt-1 text-sm leading-6 text-neutral-500">Assign follow-up, closing, no-show recovery, and inquiry-response work before the event.</p>
                    </div>
                    <ProductStatus tone="info">{selectedSalesTaskId ? 'Editing' : 'New'}</ProductStatus>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-4">
                    <Field label="Task type">
                      <select
                        value={salesTaskForm.taskType}
                        onChange={event => setSalesTaskForm(current => ({ ...current, taskType: event.target.value as SalesTaskType }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      >
                        {SALES_TASK_TYPES.map(type => <option key={type} value={type}>{titleCase(type)}</option>)}
                      </select>
                    </Field>
                    <Field label="Owner role">
                      <input
                        value={salesTaskForm.ownerRole}
                        onChange={event => setSalesTaskForm(current => ({ ...current, ownerRole: event.target.value }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                        placeholder="sales_manager"
                      />
                    </Field>
                    <Field label="Due date">
                      <input
                        type="datetime-local"
                        value={salesTaskForm.dueDate}
                        onChange={event => setSalesTaskForm(current => ({ ...current, dueDate: event.target.value }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      />
                    </Field>
                    <div className="flex items-end gap-2">
                      <PrimaryAction onClick={saveSalesTask} disabled={loading === 'save-sales-task' || !salesTaskForm.description.trim()}>
                        {loading === 'save-sales-task' ? 'Saving...' : selectedSalesTaskId ? 'Update Task' : 'Add Task'}
                      </PrimaryAction>
                      {selectedSalesTaskId && (
                        <SecondaryAction onClick={() => setSelectedSalesTaskId('')}>New</SecondaryAction>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    <Field label="Task description">
                      <textarea
                        value={salesTaskForm.description}
                        onChange={event => setSalesTaskForm(current => ({ ...current, description: event.target.value }))}
                        className="min-h-20 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                        placeholder="Example: Follow up with booked leads who did not complete payment."
                      />
                    </Field>
                  </div>
                  <div className="mt-4">
                    {salesTasks.length ? (
                      <ProductTable
                        columns={['Task', 'Owner', 'Due', 'Status', 'Actions']}
                        rows={salesTasks.map(task => {
                          const status = salesTaskStatus(task.status);
                          return [
                            <div key="task">
                              <div className="font-medium text-neutral-950">{titleCase(text(task.taskType, 'task'))}</div>
                              <div className="mt-1 max-w-xl text-sm leading-5 text-neutral-500">{text(task.description, 'No description')}</div>
                            </div>,
                            text(task.ownerRole, 'Unassigned'),
                            formatDate(task.dueDate),
                            <ProductStatus key="status" tone={workStatusTone(status)}>{titleCase(status)}</ProductStatus>,
                            <div key="actions" className="flex flex-wrap gap-2">
                              <SecondaryAction onClick={() => selectSalesTask(task)}>Edit</SecondaryAction>
                              {status !== 'in_progress' && <SecondaryAction onClick={() => updateSalesTaskStatus(task, 'in_progress')}>Start</SecondaryAction>}
                              {status !== 'completed' && <SecondaryAction onClick={() => updateSalesTaskStatus(task, 'completed')}>Complete</SecondaryAction>}
                              {status !== 'blocked' && <SecondaryAction onClick={() => updateSalesTaskStatus(task, 'blocked')}>Block</SecondaryAction>}
                            </div>,
                          ];
                        })}
                      />
                    ) : (
                      <EmptyProductState title="No sales tasks yet" message="Add the first follow-up, closing, or no-show recovery task for the sales team." />
                    )}
                  </div>
                </div>
              </div>
            </ProductCard>

            <ProductCard
              title="Barriers & Risks"
              subtitle="Record the objections, funnel issues, creative delays, and sales blockers that explain why an event is underperforming."
              action={(
                <div className="flex flex-wrap gap-2">
                  <ProductStatus tone={openProblemCount ? 'warn' : 'good'}>{openProblemCount} active</ProductStatus>
                  <ProductStatus tone={criticalProblemCount ? 'danger' : 'good'}>{criticalProblemCount} critical</ProductStatus>
                </div>
              )}
            >
              <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)_360px]">
                <div className="space-y-4">
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                    <div className="text-sm font-semibold text-neutral-950">Record a barrier</div>
                    <p className="mt-1 text-sm leading-6 text-neutral-500">
                      Use this when the team hears an objection, spots weak form completion, loses meetings to no-shows, or finds a campaign execution blocker.
                    </p>
                  </div>
                  <Field label="Barrier title">
                    <input
                      value={problemForm.title}
                      onChange={event => setProblemForm(current => ({ ...current, title: event.target.value }))}
                      className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      placeholder="Example: WhatsApp follow-up is taking more than 24 hours"
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <Field label="Area">
                      <select
                        value={problemForm.category}
                        onChange={event => setProblemForm(current => ({ ...current, category: event.target.value as ProblemCategory }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      >
                        {PROBLEM_CATEGORIES.map(category => <option key={category} value={category}>{titleCase(category)}</option>)}
                      </select>
                    </Field>
                    <Field label="Severity">
                      <select
                        value={problemForm.severity}
                        onChange={event => setProblemForm(current => ({ ...current, severity: event.target.value as ProblemSeverity }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      >
                        {PROBLEM_SEVERITIES.map(severity => <option key={severity} value={severity}>{titleCase(severity)}</option>)}
                      </select>
                    </Field>
                    <Field label="Source">
                      <select
                        value={problemForm.source}
                        onChange={event => setProblemForm(current => ({ ...current, source: event.target.value as ProblemSource }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      >
                        {PROBLEM_SOURCES.map(source => <option key={source} value={source}>{titleCase(source)}</option>)}
                      </select>
                    </Field>
                    <Field label="Owner">
                      <input
                        value={problemForm.ownerRole}
                        onChange={event => setProblemForm(current => ({ ...current, ownerRole: event.target.value }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                        placeholder="sales_manager"
                      />
                    </Field>
                  </div>
                  <Field label="What happened?">
                    <textarea
                      value={problemForm.description}
                      onChange={event => setProblemForm(current => ({ ...current, description: event.target.value }))}
                      className="min-h-20 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      placeholder="Short team note, form insight, call feedback, or execution issue."
                    />
                  </Field>
                  <Field label="Business impact">
                    <textarea
                      value={problemForm.impactSummary}
                      onChange={event => setProblemForm(current => ({ ...current, impactSummary: event.target.value }))}
                      className="min-h-20 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      placeholder="Example: fewer qualified meetings, weaker show-up rate, or higher cost per lead."
                    />
                  </Field>
                  <Field label="Recommended action">
                    <textarea
                      value={problemForm.recommendedAction}
                      onChange={event => setProblemForm(current => ({ ...current, recommendedAction: event.target.value }))}
                      className="min-h-20 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      placeholder="Example: assign same-day WhatsApp callback and test a stronger FOMO message."
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <Field label="Related lead">
                      <select
                        value={problemForm.relatedLeadId}
                        onChange={event => setProblemForm(current => ({ ...current, relatedLeadId: event.target.value }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      >
                        <option value="">None</option>
                        {salesLeads.map(lead => <option key={String(lead.id)} value={String(lead.id)}>{leadName(lead)}</option>)}
                      </select>
                    </Field>
                    <Field label="Related campaign">
                      <select
                        value={problemForm.relatedCampaignId}
                        onChange={event => setProblemForm(current => ({ ...current, relatedCampaignId: event.target.value }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      >
                        <option value="">None</option>
                        {campaigns.map(campaign => <option key={String(campaign.id)} value={String(campaign.id)}>{text(campaign.title, 'Event campaign')}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Field label="Due date">
                    <input
                      type="datetime-local"
                      value={problemForm.dueDate}
                      onChange={event => setProblemForm(current => ({ ...current, dueDate: event.target.value }))}
                      className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </Field>
                  <PrimaryAction onClick={createProblem} disabled={loading === 'create-problem' || !problemForm.title.trim()}>
                    {loading === 'create-problem' ? 'Recording...' : 'Record Barrier'}
                  </PrimaryAction>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <MetricCard label="Active Barriers" value={openProblemCount} detail="Open or being investigated" tone={openProblemCount ? 'warn' : 'good'} />
                    <MetricCard label="Critical" value={criticalProblemCount} detail="Needs leadership attention" tone={criticalProblemCount ? 'danger' : 'good'} />
                    <MetricCard label="Total Logged" value={numberValue(problemDashboard?.totalProblems)} detail="Event-scoped records" tone="info" />
                  </div>

                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                    <div className="text-sm font-semibold text-neutral-950">Top blockers</div>
                    <p className="mt-1 text-sm leading-6 text-neutral-500">Highest-severity active barriers for this event.</p>
                    <div className="mt-4">
                    {problemTopBlockers.length ? (
                      <ReadableQueue
                        items={problemTopBlockers.map(problem => ({
                          title: text(problem.title, 'Untitled barrier'),
                          meta: `${titleCase(text(problem.category, 'other'))} / owned by ${text(problem.ownerRole, 'unassigned')}`,
                          status: titleCase(text(problem.severity, 'medium')),
                          tone: problemSeverityTone(problemSeverity(problem.severity)),
                        }))}
                      />
                    ) : (
                      <EmptyProductState
                        title="No active barriers"
                        message="When the team records objections, funnel issues, creative delays, no-show risks, or sales blockers, the most urgent items appear here."
                      />
                    )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                    <div className="text-sm font-semibold text-neutral-950">Barrier categories</div>
                    <p className="mt-1 text-sm leading-6 text-neutral-500">Where the event is getting stuck.</p>
                    <div className="mt-4">
                    {Object.keys(problemCountsByCategory).length ? (
                      <BarList
                        items={PROBLEM_CATEGORIES
                          .map(category => ({
                            label: titleCase(category),
                            value: numberValue(problemCountsByCategory[category]),
                            tone: category === 'sales' || category === 'funnel' ? 'warn' as const : 'info' as const,
                          }))
                          .filter(item => item.value > 0)}
                      />
                    ) : (
                      <EmptyProductState message="No category signals yet. Record the first barrier to start building closeout evidence." />
                    )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                    <div className="text-sm font-semibold text-neutral-950">Barrier list</div>
                    <p className="mt-1 text-sm leading-6 text-neutral-500">Select a barrier to update ownership, impact, next action, or status.</p>
                    <div className="mt-4">
                    {eventProblems.length ? (
                      <div className="max-h-[440px] overflow-y-auto divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
                        {eventProblems.map(problem => {
                          const active = String(problem.id) === String(selectedProblem?.id || '');
                          const status = problemStatus(problem.status);
                          const severity = problemSeverity(problem.severity);
                          return (
                            <button
                              key={String(problem.id)}
                              type="button"
                              onClick={() => selectProblemForWork(problem)}
                              className={`w-full p-4 text-left transition ${active ? 'bg-neutral-950 text-white' : 'bg-white hover:bg-neutral-50'}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-semibold">{text(problem.title, 'Untitled barrier')}</div>
                                  <div className={`mt-1 text-sm leading-5 ${active ? 'text-white/65' : 'text-neutral-500'}`}>
                                    {titleCase(text(problem.category, 'other'))} / {text(problem.ownerRole, 'unassigned')}
                                  </div>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-2">
                                  <ProductStatus tone={active ? 'muted' : problemSeverityTone(severity)}>{titleCase(severity)}</ProductStatus>
                                  <ProductStatus tone={active ? 'muted' : problemStatusTone(status)}>{titleCase(status)}</ProductStatus>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <EmptyProductState
                        title="No barriers recorded"
                        message="Start by recording the most important objection or campaign blocker the team has seen for this event."
                      />
                    )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                    <div className="text-sm font-semibold text-neutral-950">Selected barrier action</div>
                    <p className="mt-1 text-sm leading-6 text-neutral-500">Keep ownership, impact, and resolution evidence clean for the closeout report.</p>
                    <div className="mt-4">
                    {selectedProblem ? (
                      <div className="space-y-4">
                        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                          <div className="text-sm font-semibold text-neutral-950">{text(selectedProblem.title, 'Selected barrier')}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <ProductStatus tone={problemSeverityTone(problemSeverity(selectedProblem.severity))}>{titleCase(text(selectedProblem.severity, 'medium'))}</ProductStatus>
                            <ProductStatus tone={problemStatusTone(problemStatus(selectedProblem.status))}>{titleCase(text(selectedProblem.status, 'open'))}</ProductStatus>
                            <ProductStatus tone="info">{titleCase(text(selectedProblem.category, 'other'))}</ProductStatus>
                          </div>
                        </div>
                        <Field label="Severity">
                          <select
                            value={problemUpdateForm.severity}
                            onChange={event => setProblemUpdateForm(current => ({ ...current, severity: event.target.value as ProblemSeverity }))}
                            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                          >
                            {PROBLEM_SEVERITIES.map(severity => <option key={severity} value={severity}>{titleCase(severity)}</option>)}
                          </select>
                        </Field>
                        <Field label="Owner">
                          <input
                            value={problemUpdateForm.ownerRole}
                            onChange={event => setProblemUpdateForm(current => ({ ...current, ownerRole: event.target.value }))}
                            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                            placeholder="sales_manager"
                          />
                        </Field>
                        <Field label="Impact">
                          <textarea
                            value={problemUpdateForm.impactSummary}
                            onChange={event => setProblemUpdateForm(current => ({ ...current, impactSummary: event.target.value }))}
                            className="min-h-20 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                          />
                        </Field>
                        <Field label="Recommended action">
                          <textarea
                            value={problemUpdateForm.recommendedAction}
                            onChange={event => setProblemUpdateForm(current => ({ ...current, recommendedAction: event.target.value }))}
                            className="min-h-20 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                          />
                        </Field>
                        <PrimaryAction onClick={updateSelectedProblem} disabled={loading === 'update-problem'}>
                          {loading === 'update-problem' ? 'Saving...' : 'Save Barrier Update'}
                        </PrimaryAction>
                        <div className="border-t border-neutral-100 pt-4">
                          <Field label="Resolution note">
                            <textarea
                              value={problemUpdateForm.resolutionNotes}
                              onChange={event => setProblemUpdateForm(current => ({ ...current, resolutionNotes: event.target.value }))}
                              className="min-h-20 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                              placeholder="Required when resolving or dismissing."
                            />
                          </Field>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {problemStatus(selectedProblem.status) === 'open' && (
                              <SecondaryAction onClick={() => transitionSelectedProblem('investigating')} disabled={loading === 'problem-investigating'}>
                                Start Investigation
                              </SecondaryAction>
                            )}
                            {problemStatus(selectedProblem.status) === 'investigating' && (
                              <SecondaryAction onClick={() => transitionSelectedProblem('open')} disabled={loading === 'problem-open'}>
                                Reopen
                              </SecondaryAction>
                            )}
                            {(problemStatus(selectedProblem.status) === 'open' || problemStatus(selectedProblem.status) === 'investigating') && (
                              <>
                                <SecondaryAction onClick={() => transitionSelectedProblem('resolved')} disabled={loading === 'problem-resolved'}>
                                  Resolve
                                </SecondaryAction>
                                <SecondaryAction onClick={() => transitionSelectedProblem('dismissed')} disabled={loading === 'problem-dismissed'}>
                                  Dismiss
                                </SecondaryAction>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <EmptyProductState
                        title="Select or record a barrier"
                        message="Choose an item from the list, or record the first blocker for this event."
                      />
                    )}
                    </div>
                  </div>

                  <Notice tone="info">
                    These records become closeout evidence. They explain why campaigns, forms, meetings, no-shows, and purchases moved the way they did.
                  </Notice>
                </div>
              </div>
            </ProductCard>

            <ProductCard
              title="Sales Workflow"
              subtitle="Capture event leads, assign follow-up, and move each prospect from interest to meeting, no-show recovery, or purchase."
              action={<ProductStatus tone={salesCounts.total ? 'good' : 'warn'}>{salesCounts.total} event lead(s)</ProductStatus>}
            >
              <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)_380px]">
                <div className="space-y-4">
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                    <div className="text-sm font-semibold text-neutral-950">Capture lead</div>
                    <p className="mt-1 text-sm leading-6 text-neutral-500">
                      Add a lead from a form, DM, WhatsApp conversation, live event inquiry, or manual sales note.
                    </p>
                  </div>
                  <Field label="Lead name">
                    <input
                      value={leadForm.leadName}
                      onChange={event => setLeadForm(current => ({ ...current, leadName: event.target.value }))}
                      className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      placeholder="Example: Ahmed Al-Rashid"
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      type="email"
                      value={leadForm.leadEmail}
                      onChange={event => setLeadForm(current => ({ ...current, leadEmail: event.target.value }))}
                      className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      placeholder="name@example.com"
                    />
                  </Field>
                  <Field label="Phone">
                    <input
                      value={leadForm.leadPhone}
                      onChange={event => setLeadForm(current => ({ ...current, leadPhone: event.target.value }))}
                      className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      placeholder="+966..."
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <Field label="Audience">
                      <select
                        value={leadForm.audienceSource}
                        onChange={event => setLeadForm(current => ({ ...current, audienceSource: event.target.value }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      >
                        {AUDIENCE_SOURCES.map(source => <option key={source} value={source}>{titleCase(source)}</option>)}
                      </select>
                    </Field>
                    <Field label="Channel">
                      <select
                        value={leadForm.channelAttribution}
                        onChange={event => setLeadForm(current => ({ ...current, channelAttribution: event.target.value, platform: event.target.value }))}
                        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      >
                        {CHANNEL_ATTRIBUTIONS.map(channel => <option key={channel} value={channel}>{titleCase(channel)}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Field label="Sales note">
                    <textarea
                      value={leadForm.salesNotes}
                      onChange={event => setLeadForm(current => ({ ...current, salesNotes: event.target.value }))}
                      className="min-h-24 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      placeholder="What did the lead ask for? What problem did they mention?"
                    />
                  </Field>
                  <PrimaryAction onClick={createLead} disabled={loading === 'create-lead' || !selectedEventId}>
                    {loading === 'create-lead' ? 'Capturing...' : 'Capture Lead'}
                  </PrimaryAction>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <MetricCard label="Total" value={salesCounts.total} detail="Linked to this event" tone={salesCounts.total ? 'info' : 'default'} />
                    <MetricCard label="Meetings" value={salesCounts.meetings} detail={`${salesCounts.attended} attended`} tone={salesCounts.meetings ? 'warn' : 'default'} />
                    <MetricCard label="No-shows" value={salesCounts.noShows} detail="Needs recovery" tone={salesCounts.noShows ? 'warn' : 'default'} />
                    <MetricCard label="Purchases" value={salesCounts.purchases} detail="Recorded sales" tone={salesCounts.purchases ? 'good' : 'default'} />
                  </div>

                  <div className="rounded-lg border border-neutral-200 bg-white p-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Status">
                        <select
                          value={leadFilters.status}
                          onChange={event => setLeadFilters(current => ({ ...current, status: event.target.value }))}
                          className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                        >
                          <option value="all">All statuses</option>
                          {LEAD_STATUSES.map(status => <option key={status} value={status}>{titleCase(status)}</option>)}
                        </select>
                      </Field>
                      <Field label="Temperature">
                        <select
                          value={leadFilters.temperature}
                          onChange={event => setLeadFilters(current => ({ ...current, temperature: event.target.value }))}
                          className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                        >
                          <option value="all">All temperatures</option>
                          {LEAD_TEMPERATURES.map(temp => <option key={temp} value={temp}>{titleCase(temp)}</option>)}
                        </select>
                      </Field>
                      <Field label="Channel">
                        <select
                          value={leadFilters.channel}
                          onChange={event => setLeadFilters(current => ({ ...current, channel: event.target.value }))}
                          className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                        >
                          <option value="all">All channels</option>
                          {CHANNEL_ATTRIBUTIONS.map(channel => <option key={channel} value={channel}>{titleCase(channel)}</option>)}
                        </select>
                      </Field>
                    </div>
                  </div>

                  {filteredSalesLeads.length ? (
                    <div className="overflow-hidden rounded-lg border border-neutral-200">
                      <div className="max-h-[520px] overflow-y-auto divide-y divide-neutral-100 bg-white">
                        {filteredSalesLeads.map(lead => {
                          const status = leadStatus(lead.leadStatus || lead.status);
                          const active = String(lead.id) === String(selectedLead?.id || '');
                          return (
                            <button
                              key={String(lead.id)}
                              type="button"
                              onClick={() => selectLeadForWork(lead)}
                              className={`w-full p-4 text-left transition ${active ? 'bg-neutral-950 text-white' : 'bg-white hover:bg-neutral-50'}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate font-semibold">{leadName(lead)}</div>
                                  <div className={`mt-1 text-sm ${active ? 'text-white/65' : 'text-neutral-500'}`}>
                                    {titleCase(text(lead.channelAttribution || lead.platform, 'manual'))} / {titleCase(leadTemp(lead.leadTemperature))}
                                  </div>
                                </div>
                                <ProductStatus tone={active ? 'muted' : statusTone(status)}>{titleCase(status)}</ProductStatus>
                              </div>
                              <div className={`mt-3 text-sm leading-5 ${active ? 'text-white/65' : 'text-neutral-500'}`}>
                                {text(lead.nextAction, 'No next action set')}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <EmptyProductState
                      title="No matching leads"
                      message="Capture a lead or clear the filters. Leads appear here only when they are linked to the selected event."
                    />
                  )}
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-neutral-950">{leadName(selectedLead)}</div>
                        <div className="mt-1 text-sm leading-6 text-neutral-500">
                          {selectedLead
                            ? `${text(selectedLead.leadEmail, 'No email')} / ${text(selectedLead.leadPhone, 'No phone')}`
                            : 'Select or capture a lead to operate it.'}
                        </div>
                      </div>
                      {selectedLead && <ProductStatus tone={statusTone(selectedStatus)}>{titleCase(selectedStatus)}</ProductStatus>}
                    </div>
                  </div>

                  {selectedLead ? (
                    <>
                      <ProductCard title="Next sales action" subtitle="Keep the sales team aligned before CRM/WhatsApp automation is enabled.">
                        <div className="space-y-4">
                          <Field label="Lead temperature">
                            <select
                              value={leadUpdateForm.temperature}
                              onChange={event => setLeadUpdateForm(current => ({ ...current, temperature: event.target.value as LeadTemperature }))}
                              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                            >
                              {LEAD_TEMPERATURES.map(temp => <option key={temp} value={temp}>{titleCase(temp)}</option>)}
                            </select>
                          </Field>
                          <Field label="Next action">
                            <input
                              value={leadUpdateForm.nextAction}
                              onChange={event => setLeadUpdateForm(current => ({ ...current, nextAction: event.target.value }))}
                              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                              placeholder="Example: Confirm event package and book strategy call"
                            />
                          </Field>
                          <Field label="Follow-up date">
                            <input
                              type="datetime-local"
                              value={leadUpdateForm.followUpDate}
                              onChange={event => setLeadUpdateForm(current => ({ ...current, followUpDate: event.target.value }))}
                              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                            />
                          </Field>
                          <Field label="Sales notes">
                            <textarea
                              value={leadUpdateForm.salesNotes}
                              onChange={event => setLeadUpdateForm(current => ({ ...current, salesNotes: event.target.value }))}
                              className="min-h-24 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                            />
                          </Field>
                          <PrimaryAction onClick={updateSelectedLead} disabled={loading === 'update-lead'}>
                            {loading === 'update-lead' ? 'Saving...' : 'Save Follow-up'}
                          </PrimaryAction>
                        </div>
                      </ProductCard>

                      <ProductCard title="Lifecycle actions" subtitle="Every action is recorded by the backend. External CRM, WhatsApp, and voice execution stay controlled.">
                        <div className="flex flex-wrap gap-2">
                          {allowedStatuses.includes('contacted') && (
                            <SecondaryAction onClick={() => transitionSelectedLead('contacted', 'Contacted from event sales workflow')} disabled={loading === 'transition-contacted'}>
                              Mark Contacted
                            </SecondaryAction>
                          )}
                          {allowedStatuses.includes('qualified') && (
                            <SecondaryAction onClick={() => transitionSelectedLead('qualified', 'Qualified from event sales workflow')} disabled={loading === 'transition-qualified'}>
                              Mark Qualified
                            </SecondaryAction>
                          )}
                          {allowedStatuses.includes('nurturing') && (
                            <SecondaryAction onClick={() => transitionSelectedLead('nurturing', 'Moved to nurturing from event sales workflow')} disabled={loading === 'transition-nurturing'}>
                              Move To Nurture
                            </SecondaryAction>
                          )}
                          {allowedStatuses.includes('follow_up_needed') && (
                            <SecondaryAction onClick={() => transitionSelectedLead('follow_up_needed', 'Follow-up needed from event sales workflow')} disabled={loading === 'transition-follow_up_needed'}>
                              Follow-up Needed
                            </SecondaryAction>
                          )}
                          {allowedStatuses.includes('meeting_attended') && (
                            <SecondaryAction onClick={() => transitionSelectedLead('meeting_attended', 'Meeting attended')} disabled={loading === 'transition-meeting_attended'}>
                              Mark Attended
                            </SecondaryAction>
                          )}
                          {allowedStatuses.includes('no_show') && (
                            <SecondaryAction onClick={() => transitionSelectedLead('no_show', 'Meeting no-show')} disabled={loading === 'transition-no_show'}>
                              Mark No-show
                            </SecondaryAction>
                          )}
                          {allowedStatuses.includes('lost') && (
                            <SecondaryAction onClick={() => transitionSelectedLead('lost', 'Lost from event sales workflow')} disabled={loading === 'transition-lost'}>
                              Mark Lost
                            </SecondaryAction>
                          )}
                          {allowedStatuses.includes('archived') && (
                            <SecondaryAction onClick={() => transitionSelectedLead('archived', 'Archived after completion')} disabled={loading === 'transition-archived'}>
                              Archive
                            </SecondaryAction>
                          )}
                        </div>
                      </ProductCard>

                      {(allowedStatuses.includes('meeting_booked') || selectedStatus === 'meeting_booked') && (
                        <ProductCard title="Book meeting" subtitle="Use this after the lead has been contacted or qualified.">
                          <div className="space-y-4">
                            <Field label="Meeting date">
                              <input
                                type="datetime-local"
                                value={meetingForm.meetingDate}
                                onChange={event => setMeetingForm(current => ({ ...current, meetingDate: event.target.value }))}
                                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                              />
                            </Field>
                            <Field label="Meeting type">
                              <input
                                value={meetingForm.meetingType}
                                onChange={event => setMeetingForm(current => ({ ...current, meetingType: event.target.value }))}
                                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                              />
                            </Field>
                            <Field label="Meeting note">
                              <textarea
                                value={meetingForm.meetingOutcome}
                                onChange={event => setMeetingForm(current => ({ ...current, meetingOutcome: event.target.value }))}
                                className="min-h-20 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                              />
                            </Field>
                            <PrimaryAction onClick={recordMeeting} disabled={loading === 'record-meeting'}>
                              {loading === 'record-meeting' ? 'Booking...' : 'Book Meeting'}
                            </PrimaryAction>
                          </div>
                        </ProductCard>
                      )}

                      {allowedStatuses.includes('purchased') && (
                        <ProductCard title="Record purchase" subtitle="Use this after the meeting was attended and the customer purchased.">
                          <div className="space-y-4">
                            <Field label="Purchase date">
                              <input
                                type="datetime-local"
                                value={purchaseForm.purchaseDate}
                                onChange={event => setPurchaseForm(current => ({ ...current, purchaseDate: event.target.value }))}
                                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                              />
                            </Field>
                            <Field label="Amount">
                              <input
                                type="number"
                                min="0"
                                value={purchaseForm.purchaseAmount}
                                onChange={event => setPurchaseForm(current => ({ ...current, purchaseAmount: event.target.value }))}
                                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                                placeholder="0"
                              />
                            </Field>
                            <Field label="Reference">
                              <input
                                value={purchaseForm.purchaseReference}
                                onChange={event => setPurchaseForm(current => ({ ...current, purchaseReference: event.target.value }))}
                                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                                placeholder="Invoice, GHL deal, or manual reference"
                              />
                            </Field>
                            <PrimaryAction onClick={recordPurchase} disabled={loading === 'record-purchase' || !purchaseForm.purchaseAmount}>
                              {loading === 'record-purchase' ? 'Recording...' : 'Record Purchase'}
                            </PrimaryAction>
                          </div>
                        </ProductCard>
                      )}

                      <Notice tone="info">
                        GHL, WhatsApp, and SmartLabs handoff stay preparation-only until the customer connects tenant-owned credentials and authorizes execution.
                      </Notice>
                    </>
                  ) : (
                    <EmptyProductState
                      title="Select a lead"
                      message="Capture a new lead or choose one from the list to operate the sales workflow."
                    />
                  )}
                </div>
              </div>
            </ProductCard>

            <ProductCard
              title="Post-Event Closeout Report"
              subtitle="Generate a readable management report from this event's recorded data. Missing sections are labeled honestly; the report does not invent performance claims."
              action={(
                <div className="flex flex-wrap gap-2">
                  <PrimaryAction onClick={generateCloseoutReport} disabled={loading === 'generate-closeout' || !selectedEventId}>
                    {loading === 'generate-closeout' ? 'Generating...' : closeoutReport ? 'Refresh Report' : 'Generate Report'}
                  </PrimaryAction>
                  {closeoutReport && <SecondaryAction onClick={printCloseoutReport}>Print / Save PDF</SecondaryAction>}
                </div>
              )}
            >
              {closeoutReport ? (
                <div id="closeout-report" className="space-y-5 print:space-y-4">
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-neutral-950">Executive closeout</div>
                        <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-500">
                          This report summarizes what happened for {text((closeoutReport.event as RecordMap | undefined)?.eventName, text(event.name, 'this event'))}: spend, lead funnel, sales outcomes, channel/source performance, barriers, open work, and missing evidence.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <ProductStatus tone={closeoutMissingSections.length ? 'warn' : 'good'}>
                          {closeoutMissingSections.length ? `${closeoutMissingSections.length} missing data section(s)` : 'Complete Evidence'}
                        </ProductStatus>
                        <ProductStatus tone="info">Traceable To Event Data</ProductStatus>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      ['Known Spend', money(closeoutBudget.knownSpend), displayLabel(closeoutBudget.spendSource || 'No spend source')],
                      ['Lead Funnel', numberValue(closeoutLeadFunnel.totalLeads).toLocaleString(), 'Total event leads'],
                      ['Purchases', numberValue(closeoutSalesOutcomes.purchases).toLocaleString(), `${money(closeoutSalesOutcomes.revenue)} revenue`],
                      ['No-show Rate', percent(closeoutSalesOutcomes.noShowRate), `${numberValue(closeoutSalesOutcomes.noShows)} no-show(s)`],
                    ].map(([label, value, detail]) => (
                      <div key={label} className="rounded-lg border border-neutral-200 bg-white p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
                        <div className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">{value}</div>
                        <div className="mt-1 text-sm leading-5 text-neutral-500">{detail}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
                    <div className="rounded-lg border border-neutral-200 bg-white p-4">
                      <div className="text-sm font-semibold text-neutral-950">Timeline</div>
                      <p className="mt-1 text-sm leading-6 text-neutral-500">Key event and campaign moments in chronological order.</p>
                      <div className="mt-4">
                        {closeoutTimeline.length ? (
                          <ReadableQueue
                            items={closeoutTimeline.map(item => ({
                              title: text(item.label, 'Timeline item'),
                              meta: formatDate(item.date),
                              status: titleCase(text(item.category, 'event')),
                              tone: text(item.category, 'event') === 'lead' ? 'good' : 'info',
                            }))}
                          />
                        ) : (
                          <EmptyProductState message="No timeline evidence is available yet." />
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-neutral-200 bg-white p-4">
                      <div className="text-sm font-semibold text-neutral-950">Budget</div>
                      <p className="mt-1 text-sm leading-6 text-neutral-500">Planned budget compared with known recorded spend.</p>
                      <div className="mt-4 space-y-3 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-neutral-500">Planned budget</span>
                          <span className="font-medium text-neutral-950">{closeoutBudget.plannedBudget == null ? 'Not set' : money(closeoutBudget.plannedBudget)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-neutral-500">Known spend</span>
                          <span className="font-medium text-neutral-950">{money(closeoutBudget.knownSpend)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-neutral-500">Variance</span>
                          <span className="font-medium text-neutral-950">{closeoutBudget.budgetVariance == null ? 'Not available' : money(closeoutBudget.budgetVariance)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-5 xl:grid-cols-2">
                    <div className="rounded-lg border border-neutral-200 bg-white p-4">
                      <div className="text-sm font-semibold text-neutral-950">Lead Funnel</div>
                      <p className="mt-1 text-sm leading-6 text-neutral-500">Lead status and temperature from event-linked records.</p>
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        {countEntries(closeoutLeadFunnel.byStatus).length ? (
                          <BarList items={countEntries(closeoutLeadFunnel.byStatus).map(item => ({ ...item, tone: item.label.includes('Purchased') ? 'good' : 'info' }))} />
                        ) : (
                          <EmptyProductState message="No lead status data is available." />
                        )}
                        {countEntries(closeoutLeadFunnel.byTemperature).length ? (
                          <BarList items={countEntries(closeoutLeadFunnel.byTemperature).map(item => ({ ...item, tone: item.label.includes('Buyer') ? 'good' : 'warn' }))} />
                        ) : (
                          <EmptyProductState message="No lead temperature data is available." />
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-neutral-200 bg-white p-4">
                      <div className="text-sm font-semibold text-neutral-950">Sales Outcomes</div>
                      <p className="mt-1 text-sm leading-6 text-neutral-500">Meetings, no-shows, purchases, and known revenue.</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {[
                          ['Meetings Booked', numberValue(closeoutSalesOutcomes.meetingsBooked)],
                          ['Meetings Attended', numberValue(closeoutSalesOutcomes.meetingsAttended)],
                          ['No-shows', numberValue(closeoutSalesOutcomes.noShows)],
                          ['Purchases', numberValue(closeoutSalesOutcomes.purchases)],
                        ].map(([label, value]) => (
                          <div key={String(label)} className="rounded-md border border-neutral-100 bg-neutral-50 p-3">
                            <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
                            <div className="mt-1 text-xl font-semibold text-neutral-950">{String(value)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-5 xl:grid-cols-2">
                    <div className="rounded-lg border border-neutral-200 bg-white p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-neutral-950">Channel Performance</div>
                          <p className="mt-1 text-sm leading-6 text-neutral-500">Lead, purchase, and spend signals by channel.</p>
                        </div>
                        {topCloseoutChannel && <ProductStatus tone="good">Top recorded signal: {titleCase(text(topCloseoutChannel.channel, 'Channel'))}</ProductStatus>}
                      </div>
                      <div className="mt-4">
                        {closeoutChannels.length ? (
                          <ProductTable
                            columns={['Channel', 'Leads', 'Purchases', 'Spend']}
                            rows={closeoutChannels.map(channel => [
                              titleCase(text(channel.channel, 'Unknown')),
                              numberValue(channel.leads),
                              numberValue(channel.purchases),
                              money(channel.spend),
                            ])}
                          />
                        ) : (
                          <EmptyProductState message="No channel performance data is available yet." />
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-neutral-200 bg-white p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-neutral-950">Audience Source Performance</div>
                          <p className="mt-1 text-sm leading-6 text-neutral-500">Which audience sources produced the strongest sales signals.</p>
                        </div>
                        {topCloseoutSource && <ProductStatus tone="good">Top recorded signal: {titleCase(text(topCloseoutSource.source, 'Source'))}</ProductStatus>}
                      </div>
                      <div className="mt-4">
                        {closeoutSources.length ? (
                          <ProductTable
                            columns={['Source', 'Leads', 'Purchases']}
                            rows={closeoutSources.map(source => [
                              titleCase(text(source.source, 'Unknown')),
                              numberValue(source.leads),
                              numberValue(source.purchases),
                            ])}
                          />
                        ) : (
                          <EmptyProductState message="No source performance data is available yet." />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
                    <div className="rounded-lg border border-neutral-200 bg-white p-4">
                      <div className="text-sm font-semibold text-neutral-950">Top Barriers</div>
                      <p className="mt-1 text-sm leading-6 text-neutral-500">Problems and blockers that explain weak outcomes or operational risk.</p>
                      <div className="mt-4">
                        {closeoutBarriers.length ? (
                          <ReadableQueue
                            items={closeoutBarriers.map(barrier => ({
                              title: text(barrier.title, 'Barrier'),
                              meta: `${titleCase(text(barrier.category, 'Other'))} / owned by ${text(barrier.ownerRole, 'unassigned')}`,
                              status: titleCase(text(barrier.severity, 'medium')),
                              tone: problemSeverityTone(problemSeverity(barrier.severity)),
                            }))}
                          />
                        ) : (
                          <EmptyProductState message="No barriers were recorded for this event." />
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-neutral-200 bg-white p-4">
                      <div className="text-sm font-semibold text-neutral-950">Planner Summary</div>
                      <p className="mt-1 text-sm leading-6 text-neutral-500">Prepared campaign work linked to this event.</p>
                      <div className="mt-4 space-y-3 text-sm">
                        {[
                          ['Email plans', closeoutPlannerSummary.emailPlans],
                          ['WhatsApp plans', closeoutPlannerSummary.whatsappPlans],
                          ['Upsell plans', closeoutPlannerSummary.upsellPlans],
                          ['Content requirements', closeoutPlannerSummary.contentRequirements],
                          ['Sales tasks', closeoutPlannerSummary.salesTasks],
                        ].map(([label, value]) => (
                          <div key={String(label)} className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-2 last:border-b-0 last:pb-0">
                            <span className="text-neutral-500">{String(label)}</span>
                            <span className="font-medium text-neutral-950">{numberValue(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-5 xl:grid-cols-2">
                    <div className="rounded-lg border border-neutral-200 bg-white p-4">
                      <div className="text-sm font-semibold text-neutral-950">Open Follow-Ups</div>
                      <p className="mt-1 text-sm leading-6 text-neutral-500">Remaining lead, sales, content, or problem items that need attention after the event.</p>
                      <div className="mt-4">
                        {closeoutFollowUps.length ? (
                          <ReadableQueue
                            items={closeoutFollowUps.slice(0, 10).map(item => ({
                              title: text(item.title, 'Open follow-up'),
                              meta: `${titleCase(text(item.type, 'follow_up'))} / due ${formatDate(item.dueDate)}`,
                              status: item.severity ? titleCase(text(item.severity)) : text(item.ownerRole, 'Owner not set'),
                              tone: item.severity ? problemSeverityTone(problemSeverity(item.severity)) : 'info',
                            }))}
                          />
                        ) : (
                          <EmptyProductState message="No open follow-up items are currently recorded." />
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-neutral-200 bg-white p-4">
                      <div className="text-sm font-semibold text-neutral-950">Data Completeness</div>
                      <p className="mt-1 text-sm leading-6 text-neutral-500">The report labels missing evidence instead of guessing.</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {[
                          ['KPI records', closeoutCompleteness.hasKpiRecords],
                          ['Leads', closeoutCompleteness.hasLeads],
                          ['Campaigns', closeoutCompleteness.hasCampaigns],
                          ['Barriers', closeoutCompleteness.hasProblems],
                          ['Content packages', closeoutCompleteness.hasContentPackages],
                          ['Planner data', closeoutCompleteness.hasPlannerData],
                        ].map(([label, available]) => (
                          <ProductStatus key={String(label)} tone={available ? 'good' : 'warn'}>{String(label)}: {available ? 'Available' : 'Missing'}</ProductStatus>
                        ))}
                      </div>
                      <div className="mt-4">
                        {closeoutMissingSections.length ? (
                          <Notice tone="warn">Missing evidence: {closeoutMissingSections.join(', ')}. These sections should be completed before using this closeout as final management evidence.</Notice>
                        ) : (
                          <Notice tone="good">All required evidence sections are available for this closeout report.</Notice>
                        )}
                      </div>
                    </div>
                  </div>

                  <Notice tone="info">
                    This report is a snapshot of stored event data. It does not perform ad optimization, CRM updates, message sending, or autonomous strategy changes.
                  </Notice>
                </div>
              ) : (
                <EmptyProductState
                  title="No closeout report generated yet"
                  message="Generate the closeout after the event or during review to see the event summary, funnel, spend, outcomes, barriers, open follow-ups, and missing evidence."
                  action={<PrimaryAction onClick={generateCloseoutReport} disabled={loading === 'generate-closeout' || !selectedEventId}>Generate Closeout Report</PrimaryAction>}
                />
              )}
            </ProductCard>

            <ProductCard title="Channel Performance" subtitle="Compare where event attention and sales signals are coming from.">
              {channelPerformance.length ? (
                <ProductTable
                  columns={['Channel', 'Reach', 'Interactions', 'Leads', 'Purchases', 'Spend', 'Conversion']}
                  rows={channelPerformance.map(channel => [
                    titleCase(text(channel.channel)),
                    numberValue(channel.reach).toLocaleString(),
                    numberValue(channel.interactions).toLocaleString(),
                    numberValue(channel.leads).toLocaleString(),
                    numberValue(channel.purchases).toLocaleString(),
                    money(channel.spend),
                    `${numberValue(channel.conversionRate)}%`,
                  ])}
                />
              ) : (
                <EmptyProductState message="No channel metrics yet. Add manual KPI data for Instagram, Meta Ads, YouTube, WhatsApp, email, dark ads, or referrals." />
              )}
            </ProductCard>

            <ProductCard title="Leads For This Event" subtitle="Only leads linked to this event are shown. No other event data is mixed in.">
              {(salesLeads.length || leads.length) ? (
                <ProductTable
                  columns={['Lead', 'Channel', 'Temperature', 'Status', 'Next Action', 'Email', 'Created']}
                  rows={(salesLeads.length ? salesLeads : leads).map(lead => [
                    leadName(lead),
                    titleCase(text(lead.channelAttribution || lead.platform, 'manual')),
                    titleCase(leadTemp(lead.leadTemperature)),
                    titleCase(leadStatus(lead.leadStatus || lead.status)),
                    text(lead.nextAction, 'Not set'),
                    text(lead.leadEmail, 'Not provided'),
                    formatDate(lead.createdAt),
                  ])}
                />
              ) : (
                <EmptyProductState message="No leads are linked to this event yet. Capture leads from Performance or link imported leads after customer-owned connectors are configured." />
              )}
            </ProductCard>

            <ProductCard title="KPI Evidence" subtitle="Every dashboard number comes from manual/imported/connector records.">
              <div className="mb-4 flex flex-wrap gap-2">
                <ProductStatus tone="info">{numberValue(sourceStatus.manualRecords)} manual</ProductStatus>
                <ProductStatus tone="info">{numberValue(sourceStatus.importedRecords)} imported</ProductStatus>
                <ProductStatus tone="info">{numberValue(sourceStatus.connectorRecords)} connector</ProductStatus>
              </div>
              {kpiRecords.length ? (
                <ProductTable
                  columns={['Date', 'Channel', 'Leads', 'Meetings', 'Purchases', 'Spend', 'Source']}
                  rows={kpiRecords.slice(0, 12).map(record => [
                    formatDate(record.metricDate),
                    titleCase(text(record.channel)),
                    numberValue(record.leads).toLocaleString(),
                    numberValue(record.meetingsBooked).toLocaleString(),
                    numberValue(record.purchases).toLocaleString(),
                    money(record.spend),
                    titleCase(text(record.sourceType)),
                  ])}
                />
              ) : (
                <EmptyProductState message="No KPI records yet. Add the first update from the form on the left." />
              )}
            </ProductCard>

            <ProductCard title="Linked Campaigns" subtitle="Campaigns connected to this event.">
              {campaigns.length ? (
                <ReadableQueue
                  items={campaigns.map(campaign => ({
                    title: text(campaign.title, 'Event campaign'),
                    meta: `${text(campaign.objective, 'No objective')} / ${list(campaign.platforms).join(', ') || 'No platform set'}`,
                    status: titleCase(text(campaign.status, 'idea')),
                    tone: 'info',
                  }))}
                />
              ) : (
                <EmptyProductState message="No campaigns are linked to this event yet. Link a campaign from the event strategy workflow." />
              )}
            </ProductCard>

            <div className="flex justify-end">
              <SecondaryAction onClick={() => load(selectedEventId)}>Refresh Event Data</SecondaryAction>
            </div>
          </div>
        </div>
      )}
    </ProductPage>
  );
}
