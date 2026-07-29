import { ExternalServiceError } from '@shared/errors';
import type { GhlProviderResult } from './types';

export interface GhlOperationsClientConfig {
  baseUrl: string;
  apiKey: string;
  locationId: string;
  version: string;
}

export interface GhlOpportunityFieldReference {
  id: string;
  key: string | null;
  name: string;
  dataType: string;
  picklistOptions: string[];
}

export interface GhlOperationsReferenceData {
  tags: Array<{ id: string; name: string }>;
  pipelines: Array<{
    id: string;
    name: string;
    stages: Array<{ id: string; name: string }>;
  }>;
  calendars: Array<{ id: string; name: string }>;
  opportunityFields: GhlOpportunityFieldReference[];
  warnings: string[];
}

export interface GhlOperationsClient {
  upsertContact(payload: Record<string, unknown>): Promise<GhlProviderResult>;
  addTags(contactId: string, tags: string[]): Promise<GhlProviderResult>;
  removeTags(contactId: string, tags: string[]): Promise<GhlProviderResult>;
  createOpportunity(payload: Record<string, unknown>): Promise<GhlProviderResult>;
  updateOpportunity(id: string, payload: Record<string, unknown>): Promise<GhlProviderResult>;
  createAppointment(payload: Record<string, unknown>): Promise<GhlProviderResult>;
  updateAppointment(id: string, payload: Record<string, unknown>): Promise<GhlProviderResult>;
  sendWhatsApp(payload: Record<string, unknown>): Promise<GhlProviderResult>;
  getContact(id: string): Promise<GhlProviderResult>;
  getOpportunity(id: string): Promise<GhlProviderResult>;
  getAppointment(id: string): Promise<GhlProviderResult>;
  referenceData(): Promise<GhlOperationsReferenceData>;
}

export class HighLevelOperationsClient implements GhlOperationsClient {
  private readonly baseUrl: string;

  constructor(private readonly config: GhlOperationsClientConfig) {
    this.baseUrl = validateGhlBaseUrl(config.baseUrl);
  }

  upsertContact(payload: Record<string, unknown>): Promise<GhlProviderResult> {
    return this.write('/contacts/upsert', 'POST', payload);
  }

  addTags(contactId: string, tags: string[]): Promise<GhlProviderResult> {
    return this.write(`/contacts/${encodeURIComponent(contactId)}/tags`, 'POST', { tags });
  }

  removeTags(contactId: string, tags: string[]): Promise<GhlProviderResult> {
    return this.write(`/contacts/${encodeURIComponent(contactId)}/tags`, 'DELETE', { tags });
  }

  createOpportunity(payload: Record<string, unknown>): Promise<GhlProviderResult> {
    return this.write('/opportunities/', 'POST', payload);
  }

  updateOpportunity(id: string, payload: Record<string, unknown>): Promise<GhlProviderResult> {
    return this.write(`/opportunities/${encodeURIComponent(id)}`, 'PUT', payload);
  }

  createAppointment(payload: Record<string, unknown>): Promise<GhlProviderResult> {
    return this.write('/calendars/events/appointments', 'POST', payload);
  }

  updateAppointment(id: string, payload: Record<string, unknown>): Promise<GhlProviderResult> {
    return this.write(`/calendars/events/appointments/${encodeURIComponent(id)}`, 'PUT', payload);
  }

  sendWhatsApp(payload: Record<string, unknown>): Promise<GhlProviderResult> {
    return this.write('/conversations/messages', 'POST', payload);
  }

  getContact(id: string): Promise<GhlProviderResult> {
    return this.read(`/contacts/${encodeURIComponent(id)}`);
  }

  getOpportunity(id: string): Promise<GhlProviderResult> {
    return this.read(`/opportunities/${encodeURIComponent(id)}`);
  }

  getAppointment(id: string): Promise<GhlProviderResult> {
    return this.read(`/calendars/events/appointments/${encodeURIComponent(id)}`);
  }

  async referenceData() {
    const [tagsResult, pipelinesResult, calendarsResult, opportunityFieldsResult] =
      await Promise.all([
        this.read(`/locations/${encodeURIComponent(this.config.locationId)}/tags`),
        this.read(
          `/opportunities/pipelines?locationId=${encodeURIComponent(this.config.locationId)}`,
        ),
        this.read(`/calendars/?locationId=${encodeURIComponent(this.config.locationId)}`),
        this.read(
          `/locations/${encodeURIComponent(this.config.locationId)}/customFields?model=opportunity`,
        ),
      ]);
    const warnings: string[] = [];
    if (!tagsResult.ok) warnings.push(`GHL tags are unavailable (HTTP ${tagsResult.status}).`);
    if (!pipelinesResult.ok)
      warnings.push(`GHL pipelines are unavailable (HTTP ${pipelinesResult.status}).`);
    if (!calendarsResult.ok)
      warnings.push(`GHL calendars are unavailable (HTTP ${calendarsResult.status}).`);
    if (!opportunityFieldsResult.ok)
      warnings.push(
        `GHL opportunity fields are unavailable (HTTP ${opportunityFieldsResult.status}).`,
      );
    return {
      tags: extractArray(tagsResult.body, ['tags'])
        .map((value) => {
          const record = asRecord(value);
          const id = firstString([record.id, record.tagId]);
          const name = firstString([record.name, record.tagName]);
          return id && name ? { id, name } : null;
        })
        .filter((value): value is { id: string; name: string } => Boolean(value)),
      pipelines: extractArray(pipelinesResult.body, ['pipelines'])
        .map((value) => {
          const record = asRecord(value);
          const id = firstString([record.id, record.pipelineId]);
          const name = firstString([record.name, record.pipelineName]);
          if (!id || !name) return null;
          const stages = extractArray(record, ['stages'])
            .map((stageValue) => {
              const stage = asRecord(stageValue);
              const stageId = firstString([stage.id, stage.stageId]);
              const stageName = firstString([stage.name, stage.stageName]);
              return stageId && stageName ? { id: stageId, name: stageName } : null;
            })
            .filter((stage): stage is { id: string; name: string } => Boolean(stage));
          return { id, name, stages };
        })
        .filter(
          (
            value,
          ): value is {
            id: string;
            name: string;
            stages: Array<{ id: string; name: string }>;
          } => Boolean(value),
        ),
      calendars: extractArray(calendarsResult.body, ['calendars'])
        .map((value) => {
          const record = asRecord(value);
          const id = firstString([record.id, record.calendarId]);
          const name = firstString([record.name, record.calendarName]);
          return id && name ? { id, name } : null;
        })
        .filter((value): value is { id: string; name: string } => Boolean(value)),
      opportunityFields: extractArray(opportunityFieldsResult.body, [
        'customFields',
        'fields',
        'items',
        'results',
      ])
        .map((value) => {
          const record = asRecord(value);
          const id = firstString([record.id, record._id, record.fieldId]);
          const name = firstString([record.name, record.label]);
          if (!id || !name) return null;
          return {
            id,
            key: firstString([record.fieldKey, record.field_key, record.key]),
            name,
            dataType: firstString([record.dataType, record.data_type, record.type]) || 'UNKNOWN',
            picklistOptions: Array.isArray(record.picklistOptions)
              ? record.picklistOptions
                  .map((option) => (typeof option === 'string' ? option.trim() : ''))
                  .filter(Boolean)
              : [],
          };
        })
        .filter((value): value is GhlOpportunityFieldReference => Boolean(value)),
      warnings,
    };
  }

  private async write(
    path: string,
    method: 'POST' | 'PUT' | 'DELETE',
    payload: Record<string, unknown>,
  ): Promise<GhlProviderResult> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        redirect: 'error',
        headers: this.headers(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });
      const body = await response.json().catch(() => ({ statusText: response.statusText }));
      return { ok: response.ok, status: response.status, body };
    } catch (error) {
      throw new ExternalServiceError(
        'GoHighLevel',
        error instanceof Error ? error.message : 'External write failed',
      );
    }
  }

  private async read(path: string): Promise<GhlProviderResult> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'GET',
        redirect: 'error',
        headers: this.headers(),
        signal: AbortSignal.timeout(10_000),
      });
      const body = await response.json().catch(() => ({ statusText: response.statusText }));
      return { ok: response.ok, status: response.status, body };
    } catch (error) {
      throw new ExternalServiceError(
        'GoHighLevel',
        error instanceof Error ? error.message : 'Provider read-back failed',
      );
    }
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      Version: this.config.version,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }
}

export function validateGhlBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ExternalServiceError('GoHighLevel', 'Invalid provider base URL');
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname.toLowerCase() !== 'services.leadconnectorhq.com' ||
    url.username ||
    url.password ||
    (url.pathname !== '/' && url.pathname !== '')
  ) {
    throw new ExternalServiceError(
      'GoHighLevel',
      'Provider base URL must be https://services.leadconnectorhq.com',
    );
  }
  return 'https://services.leadconnectorhq.com';
}

export function extractProviderIds(body: unknown): {
  objectId: string | null;
  contactId: string | null;
  opportunityId: string | null;
  appointmentId: string | null;
  messageId: string | null;
} {
  const root = asRecord(body);
  const contact = asRecord(root.contact);
  const opportunity = asRecord(root.opportunity);
  const appointment = asRecord(root.appointment || root.event);
  const contactId = firstString([contact.id, root.contactId]);
  const opportunityId = firstString([opportunity.id, root.opportunityId]);
  const appointmentId = firstString([
    appointment.id,
    appointment.appointmentId,
    root.appointmentId,
    root.eventId,
  ]);
  const messageId = firstString([root.messageId]);
  return {
    objectId: opportunityId || appointmentId || messageId || contactId || firstString([root.id]),
    contactId,
    opportunityId,
    appointmentId,
    messageId,
  };
}

export function isGhlWhatsAppDnd(body: unknown): boolean {
  const root = asRecord(body);
  const contact = Object.keys(asRecord(root.contact)).length ? asRecord(root.contact) : root;
  if (contact.dnd === true) return true;
  const whatsapp = asRecord(asRecord(contact.dndSettings).WhatsApp);
  const status = firstString([whatsapp.status])?.toLowerCase();
  return status === 'active' || status === 'permanent';
}

export function summarizeGhlProviderError(body: unknown): string | null {
  const root = asRecord(body);
  const candidates = [
    ...asStringMessages(root.message),
    ...asStringMessages(root.error),
    ...asStringMessages(root.statusText),
  ];
  const summary = candidates.map((value) => value.replace(/\s+/g, ' ').trim()).find(Boolean);
  return summary ? summary.slice(0, 500) : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringMessages(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return [];
}

function firstString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function extractArray(value: unknown, keys: string[]): unknown[] {
  const root = asRecord(value);
  for (const key of keys) {
    if (Array.isArray(root[key])) return root[key] as unknown[];
  }
  const data = asRecord(root.data);
  for (const key of keys) {
    if (Array.isArray(data[key])) return data[key] as unknown[];
  }
  return [];
}
