import { ExternalServiceError } from '@shared/errors';
import type { GhlContact, GhlOpportunity, GhlPullResult } from './types';

export interface GhlClientConfig {
  baseUrl: string;
  apiKey: string;
  locationId: string;
  version: string;
}

export interface GhlClient {
  pull(limit: number): Promise<GhlPullResult>;
  upsertContact(payload: Record<string, unknown>): Promise<{ ok: boolean; status: number; body: unknown }>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
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
    if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) return Number(value);
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

function normalizeContact(input: unknown): GhlContact | null {
  const record = asRecord(input);
  const id = firstString(record, ['id', 'contactId', '_id']);
  if (!id) return null;
  const tags = asArray(record.tags)
    .map(tag => typeof tag === 'string' ? tag : firstString(asRecord(tag), ['name', 'id']))
    .filter((tag): tag is string => Boolean(tag));
  return {
    id,
    firstName: firstString(record, ['firstName', 'first_name']),
    lastName: firstString(record, ['lastName', 'last_name']),
    name: firstString(record, ['name', 'fullName', 'full_name']),
    email: firstString(record, ['email']),
    phone: firstString(record, ['phone']),
    source: firstString(record, ['source']),
    tags,
  };
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
  };
}

export class LeadConnectorClient implements GhlClient {
  constructor(private readonly config: GhlClientConfig) {}

  async pull(limit: number): Promise<GhlPullResult> {
    const [contactsBody, opportunitiesBody] = await Promise.all([
      this.request('/contacts/search', {
        method: 'POST',
        body: JSON.stringify({
          locationId: this.config.locationId,
          page: 1,
          pageLimit: limit,
        }),
      }),
      this.request(`/opportunities/search?location_id=${encodeURIComponent(this.config.locationId)}&limit=${limit}`, {
        method: 'GET',
      }),
    ]);

    const contacts = extractItems(contactsBody, ['contacts', 'items', 'results'])
      .map(normalizeContact)
      .filter((contact): contact is GhlContact => Boolean(contact))
      .slice(0, limit);
    const contactIds = new Set(contacts.map(contact => contact.id));
    const opportunities = extractItems(opportunitiesBody, ['opportunities', 'items', 'results'])
      .map(normalizeOpportunity)
      .filter((opportunity): opportunity is GhlOpportunity => opportunity !== null && contactIds.has(opportunity.contactId));

    return { contacts, opportunities, rawReturned: false };
  }

  async upsertContact(payload: Record<string, unknown>): Promise<{ ok: boolean; status: number; body: unknown }> {
    const response = await fetch(`${this.config.baseUrl}/contacts/upsert`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({ statusText: response.statusText }));
    return { ok: response.ok, status: response.status, body };
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: {
        ...this.headers(),
        ...(init.headers || {}),
      },
    });
    const body = await response.json().catch(() => ({ statusText: response.statusText }));
    if (!response.ok) {
      throw new ExternalServiceError('GoHighLevel', `API returned ${response.status}`);
    }
    return body;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      Version: this.config.version,
      'Content-Type': 'application/json',
    };
  }
}
