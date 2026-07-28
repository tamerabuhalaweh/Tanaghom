import { ExternalServiceError } from '@shared/errors';
import type { GhlAppointment, GhlContact, GhlOpportunity, GhlPullResult } from './types';

export interface GhlClientConfig {
  baseUrl: string;
  apiKey: string;
  locationId: string;
  version: string;
}

export interface GhlClient {
  pull(limit: number): Promise<GhlPullResult>;
  upsertContact(
    payload: Record<string, unknown>,
  ): Promise<{ ok: boolean; status: number; body: unknown }>;
}

export interface GhlConnectionTestResult {
  checkedContacts: number;
  rawPayloadReturned: false;
}

export interface GhlRemoteTagReference {
  id: string;
  name: string;
}

export interface GhlRemotePipelineStageReference {
  pipelineId: string;
  pipelineName: string;
  stageId: string;
  stageName: string;
}

export interface GhlLiveReadValidationResult {
  canReadContacts: boolean;
  checkedContacts: number;
  canReadOpportunities: boolean;
  checkedOpportunities: number;
  canReadTags: boolean;
  tagsFound: number;
  canReadPipelines: boolean;
  pipelinesFound: number;
  stagesFound: number;
  remoteTags: GhlRemoteTagReference[];
  remotePipelineStages: GhlRemotePipelineStageReference[];
  warnings: string[];
  rawPayloadReturned: false;
}

export interface GhlReferenceDataResult {
  canReadTags: boolean;
  canReadPipelines: boolean;
  remoteTags: GhlRemoteTagReference[];
  remotePipelineStages: GhlRemotePipelineStageReference[];
  warnings: string[];
  rawPayloadReturned: false;
}

interface GhlCustomFieldDefinition {
  id: string;
  fieldKey: string | null;
  name: string | null;
}

const READ_RETRY_STATUSES = new Set([429, 502, 503, 504]);
const READ_MAX_ATTEMPTS = 4;
const READ_CONCURRENCY = 4;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function firstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function firstNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value)))
      return Number(value);
  }
  return null;
}

function extractItems(body: unknown, keys: string[]): unknown[] {
  const record = asRecord(body);
  for (const key of keys) {
    const direct = asArray(record[key]);
    if (direct.length) return direct;
  }
  const data = asRecord(record.data);
  for (const key of keys) {
    const nested = asArray(data[key]);
    if (nested.length) return nested;
  }
  return [];
}

function normalizeRemoteTag(input: unknown): GhlRemoteTagReference | null {
  const record = asRecord(input);
  const id = firstString(record, ['id', 'tagId', '_id']);
  const name = firstString(record, ['name', 'tagName', 'label']);
  if (!id || !name) return null;
  return { id, name };
}

function flattenStages(input: unknown[]): unknown[] {
  return input.flatMap((item) => (Array.isArray(item) ? item : [item]));
}

function normalizePipelineStages(input: unknown): GhlRemotePipelineStageReference[] {
  const pipeline = asRecord(input);
  const pipelineId = firstString(pipeline, ['id', 'pipelineId', '_id']);
  const pipelineName = firstString(pipeline, ['name', 'pipelineName']);
  if (!pipelineId || !pipelineName) return [];

  return flattenStages(asArray(pipeline.stages))
    .map((stageInput) => {
      const stage = asRecord(stageInput);
      const stageId = firstString(stage, ['id', 'stageId', 'pipelineStageId', '_id']);
      const stageName = firstString(stage, ['name', 'stageName']);
      if (!stageId || !stageName) return null;
      return { pipelineId, pipelineName, stageId, stageName };
    })
    .filter((stage): stage is GhlRemotePipelineStageReference => Boolean(stage));
}

function normalizeContact(input: unknown): GhlContact | null {
  const record = asRecord(input);
  const id = firstString(record, ['id', 'contactId', '_id']);
  if (!id) return null;
  const tags = asArray(record.tags)
    .map((tag) => (typeof tag === 'string' ? tag : firstString(asRecord(tag), ['name', 'id'])))
    .filter((tag): tag is string => Boolean(tag));
  const customFields = normalizeCustomFields(
    record.customFields ?? record.custom_fields ?? record.customField,
  );
  return {
    id,
    firstName: firstString(record, ['firstName', 'first_name']),
    lastName: firstString(record, ['lastName', 'last_name']),
    name: firstString(record, ['name', 'fullName', 'full_name']),
    email: firstString(record, ['email']),
    phone: firstString(record, ['phone']),
    source: firstString(record, ['source']),
    tags,
    customFields,
  };
}

function normalizeCustomFields(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return { ...(input as Record<string, unknown>) };
  }
  const result: Record<string, unknown> = {};
  for (const item of asArray(input)) {
    const field = asRecord(item);
    const key = firstString(field, [
      'id',
      'key',
      'fieldKey',
      'field_key',
      'fieldId',
      'field_id',
      'name',
    ]);
    if (!key) continue;
    const valueKey = [
      'value',
      'field_value',
      'fieldValue',
      'fieldValueString',
      'fieldValueNumber',
      'fieldValueDate',
      'fieldValueBoolean',
      'fieldValueArray',
      'fieldValueCheckbox',
    ].find((candidate) => Object.prototype.hasOwnProperty.call(field, candidate));
    result[key] = valueKey ? field[valueKey] : null;
  }
  return result;
}

function normalizeCustomFieldDefinition(input: unknown): GhlCustomFieldDefinition | null {
  const record = asRecord(input);
  const id = firstString(record, ['id', '_id', 'fieldId', 'field_id']);
  if (!id) return null;
  return {
    id,
    fieldKey: firstString(record, ['fieldKey', 'field_key', 'key']),
    name: firstString(record, ['name', 'label']),
  };
}

function addCustomFieldAliases(
  customFields: Record<string, unknown>,
  definitions: GhlCustomFieldDefinition[],
): Record<string, unknown> {
  const result = { ...customFields };
  for (const definition of definitions) {
    if (!Object.prototype.hasOwnProperty.call(customFields, definition.id)) continue;
    const value = customFields[definition.id];
    if (definition.fieldKey && !Object.prototype.hasOwnProperty.call(result, definition.fieldKey)) {
      result[definition.fieldKey] = value;
    }
    if (definition.name && !Object.prototype.hasOwnProperty.call(result, definition.name)) {
      result[definition.name] = value;
    }
  }
  return result;
}

function normalizeOpportunity(input: unknown): GhlOpportunity | null {
  const record = asRecord(input);
  const id = firstString(record, ['id', 'opportunityId', '_id']);
  const contactId = firstString(record, ['contactId', 'contact_id']);
  if (!id || !contactId) return null;
  return {
    id,
    contactId,
    pipelineId: firstString(record, ['pipelineId', 'pipeline_id']),
    stageId: firstString(record, ['pipelineStageId', 'pipeline_stage_id', 'stageId', 'stage_id']),
    status: firstString(record, ['status']),
    monetaryValue: firstNumber(record, ['monetaryValue', 'monetary_value', 'value']),
    name: firstString(record, ['name', 'title']),
    updatedAt: firstString(record, ['updatedAt', 'updated_at']),
    customFields: normalizeCustomFields(
      record.customFields ?? record.custom_fields ?? record.customField,
    ),
  };
}

function opportunityDetailRecord(body: unknown): Record<string, unknown> {
  const root = asRecord(body);
  const data = asRecord(root.data);
  return asRecord(root.opportunity ?? data.opportunity ?? body);
}

function normalizeAppointment(input: unknown, fallbackContactId: string): GhlAppointment | null {
  const record = asRecord(input);
  const id = firstString(record, ['id', 'appointmentId', 'eventId', '_id']);
  const contactId = firstString(record, ['contactId', 'contact_id']) || fallbackContactId;
  if (!id || !contactId) return null;
  return {
    id,
    contactId,
    status: firstString(record, ['status', 'appointmentStatus']),
    title: firstString(record, ['title', 'name', 'appointmentTitle']),
    calendarId: firstString(record, ['calendarId', 'calendar_id']),
    startTime: firstString(record, ['startTime', 'start_time', 'startDate', 'start_date', 'date']),
    endTime: firstString(record, ['endTime', 'end_time', 'endDate', 'end_date']),
  };
}

export class LeadConnectorClient implements GhlClient {
  constructor(private readonly config: GhlClientConfig) {}

  async testConnection(): Promise<GhlConnectionTestResult> {
    const contactsBody = await this.request('/contacts/search', {
      method: 'POST',
      body: JSON.stringify(contactSearchPage(this.config.locationId, 1)),
    });
    return {
      checkedContacts: extractItems(contactsBody, ['contacts', 'items', 'results']).length,
      rawPayloadReturned: false,
    };
  }

  async validateReadAccess(): Promise<GhlLiveReadValidationResult> {
    const warnings: string[] = [];
    const contactsResult = await this.readValidationEndpoint('/contacts/search', {
      method: 'POST',
      body: JSON.stringify(contactSearchPage(this.config.locationId, 1)),
    });
    const opportunitiesResult = await this.readValidationEndpoint(
      `/opportunities/search?location_id=${encodeURIComponent(this.config.locationId)}&limit=1`,
      {
        method: 'GET',
      },
    );
    const tagsResult = await this.readValidationEndpoint(
      `/locations/${encodeURIComponent(this.config.locationId)}/tags`,
      {
        method: 'GET',
      },
    );
    const pipelinesResult = await this.readValidationEndpoint(
      `/opportunities/pipelines?locationId=${encodeURIComponent(this.config.locationId)}`,
      {
        method: 'GET',
      },
    );

    if (!contactsResult.ok)
      warnings.push(`Contacts read check failed with status ${contactsResult.status}.`);
    if (!opportunitiesResult.ok)
      warnings.push(`Opportunities read check failed with status ${opportunitiesResult.status}.`);
    if (!tagsResult.ok) warnings.push(`Tags read check failed with status ${tagsResult.status}.`);
    if (!pipelinesResult.ok)
      warnings.push(`Pipeline read check failed with status ${pipelinesResult.status}.`);

    const contactItems = contactsResult.ok
      ? extractItems(contactsResult.body, ['contacts', 'items', 'results'])
      : [];
    const opportunityItems = opportunitiesResult.ok
      ? extractItems(opportunitiesResult.body, ['opportunities', 'items', 'results'])
      : [];
    const remoteTags = tagsResult.ok
      ? extractItems(tagsResult.body, ['tags', 'items', 'results'])
          .map(normalizeRemoteTag)
          .filter((tag): tag is GhlRemoteTagReference => Boolean(tag))
      : [];
    const pipelines = pipelinesResult.ok
      ? extractItems(pipelinesResult.body, ['pipelines', 'items', 'results'])
      : [];
    const remotePipelineStages = pipelines.flatMap(normalizePipelineStages);

    return {
      canReadContacts: contactsResult.ok,
      checkedContacts: contactItems.length,
      canReadOpportunities: opportunitiesResult.ok,
      checkedOpportunities: opportunityItems.length,
      canReadTags: tagsResult.ok,
      tagsFound: remoteTags.length,
      canReadPipelines: pipelinesResult.ok,
      pipelinesFound: pipelines.length,
      stagesFound: remotePipelineStages.length,
      remoteTags,
      remotePipelineStages,
      warnings,
      rawPayloadReturned: false,
    };
  }

  async discoverReferenceData(): Promise<GhlReferenceDataResult> {
    const [tagsResult, pipelinesResult] = await Promise.all([
      this.readValidationEndpoint(
        `/locations/${encodeURIComponent(this.config.locationId)}/tags`,
        { method: 'GET' },
      ),
      this.readValidationEndpoint(
        `/opportunities/pipelines?locationId=${encodeURIComponent(this.config.locationId)}`,
        { method: 'GET' },
      ),
    ]);
    const warnings: string[] = [];
    if (!tagsResult.ok) warnings.push(`Tags read failed with status ${tagsResult.status}.`);
    if (!pipelinesResult.ok)
      warnings.push(`Pipeline read failed with status ${pipelinesResult.status}.`);

    const remoteTags = tagsResult.ok
      ? extractItems(tagsResult.body, ['tags', 'items', 'results'])
          .map(normalizeRemoteTag)
          .filter((tag): tag is GhlRemoteTagReference => Boolean(tag))
      : [];
    const pipelines = pipelinesResult.ok
      ? extractItems(pipelinesResult.body, ['pipelines', 'items', 'results'])
      : [];

    return {
      canReadTags: tagsResult.ok,
      canReadPipelines: pipelinesResult.ok,
      remoteTags,
      remotePipelineStages: pipelines.flatMap(normalizePipelineStages),
      warnings,
      rawPayloadReturned: false,
    };
  }

  async pull(limit: number): Promise<GhlPullResult> {
    const [contactsBody, opportunitiesBody] = await Promise.all([
      this.request('/contacts/search', {
        method: 'POST',
        body: JSON.stringify(contactSearchPage(this.config.locationId, limit)),
      }),
      this.request(
        `/opportunities/search?location_id=${encodeURIComponent(this.config.locationId)}&limit=${limit}`,
        {
          method: 'GET',
        },
      ),
    ]);

    const contacts = extractItems(contactsBody, ['contacts', 'items', 'results'])
      .map(normalizeContact)
      .filter((contact): contact is GhlContact => Boolean(contact))
      .slice(0, limit);
    const contactIds = new Set(contacts.map((contact) => contact.id));
    const opportunitySummaries = extractItems(opportunitiesBody, [
      'opportunities',
      'items',
      'results',
    ])
      .map(normalizeOpportunity)
      .filter(
        (opportunity): opportunity is GhlOpportunity =>
          opportunity !== null && contactIds.has(opportunity.contactId),
      );

    const warnings: string[] = [];
    const [fieldDefinitionsResult, opportunityDetailResults, appointmentResults] =
      await Promise.all([
        this.request(
          `/locations/${encodeURIComponent(this.config.locationId)}/customFields?model=opportunity`,
          { method: 'GET' },
        )
          .then((body) =>
            extractItems(body, ['customFields', 'fields', 'items', 'results'])
              .map(normalizeCustomFieldDefinition)
              .filter((field): field is GhlCustomFieldDefinition => Boolean(field)),
          )
          .catch(() => null),
        settleWithConcurrency(opportunitySummaries, READ_CONCURRENCY, (opportunity) =>
          this.request(`/opportunities/${encodeURIComponent(opportunity.id)}`, {
            method: 'GET',
          }),
        ),
        settleWithConcurrency(contacts, READ_CONCURRENCY, (contact) =>
          this.request(`/contacts/${encodeURIComponent(contact.id)}/appointments`, {
            method: 'GET',
          }).then((body) =>
            extractItems(body, ['appointments', 'events', 'items', 'results'])
              .map((item) => normalizeAppointment(item, contact.id))
              .filter((appointment): appointment is GhlAppointment => Boolean(appointment)),
          ),
        ),
      ]);

    if (fieldDefinitionsResult === null) {
      warnings.push(
        'Could not read GoHighLevel opportunity field definitions. Field-id mappings remain available.',
      );
    }
    const definitions = fieldDefinitionsResult ?? [];
    let detailFailures = 0;
    const opportunities = opportunitySummaries.map((summary, index) => {
      const detailResult = opportunityDetailResults[index];
      if (!detailResult || detailResult.status === 'rejected') {
        detailFailures += 1;
        return summary;
      }
      const detail = normalizeOpportunity({
        ...summary,
        ...opportunityDetailRecord(detailResult.value),
        id: summary.id,
        contactId: summary.contactId,
      });
      if (!detail) return summary;
      return {
        ...summary,
        ...detail,
        customFields: addCustomFieldAliases(detail.customFields ?? {}, definitions),
      };
    });
    if (detailFailures > 0) {
      warnings.push(
        `Could not read details for ${detailFailures} GoHighLevel opportunity record(s). Summary data was retained.`,
      );
    }

    const appointments: GhlAppointment[] = [];
    let appointmentFailures = 0;
    appointmentResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        appointments.push(...result.value);
      } else {
        appointmentFailures += 1;
      }
    });
    if (appointmentFailures > 0) {
      warnings.push(
        `Could not read appointments for ${appointmentFailures} GoHighLevel contact(s). Contact and opportunity sync continued.`,
      );
    }

    return { contacts, opportunities, appointments, warnings, rawReturned: false };
  }

  async upsertContact(
    payload: Record<string, unknown>,
  ): Promise<{ ok: boolean; status: number; body: unknown }> {
    const response = await fetch(`${this.config.baseUrl}/contacts/upsert`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({ statusText: response.statusText }));
    return { ok: response.ok, status: response.status, body };
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    for (let attempt = 1; attempt <= READ_MAX_ATTEMPTS; attempt += 1) {
      const response = await fetch(`${this.config.baseUrl}${path}`, {
        ...init,
        headers: {
          ...this.headers(),
          ...(init.headers || {}),
        },
      });
      const body = await response.json().catch(() => ({ statusText: response.statusText }));
      if (response.ok) return body;
      if (!READ_RETRY_STATUSES.has(response.status) || attempt === READ_MAX_ATTEMPTS) {
        throw new ExternalServiceError('GoHighLevel', `API returned ${response.status}`);
      }
      await delay(250 * 2 ** (attempt - 1));
    }
    throw new ExternalServiceError('GoHighLevel', 'API read failed');
  }

  private async readValidationEndpoint(
    path: string,
    init: RequestInit,
  ): Promise<{ ok: boolean; status: number; body: unknown }> {
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: {
        ...this.headers(),
        ...(init.headers || {}),
      },
    });
    const body = await response.json().catch(() => ({ statusText: response.statusText }));
    return { ok: response.ok, status: response.status, body };
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      Version: this.config.version,
      'Content-Type': 'application/json',
    };
  }
}

async function settleWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<Array<PromiseSettledResult<R>>> {
  const results: Array<PromiseSettledResult<R>> = new Array(items.length);
  let cursor = 0;
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index] as T) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return results;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function contactSearchPage(
  locationId: string,
  pageLimit: number,
): {
  locationId: string;
  page: number;
  pageLimit: number;
} {
  return {
    locationId,
    page: 1,
    pageLimit,
  };
}
