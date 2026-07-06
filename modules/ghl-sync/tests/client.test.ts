import { afterEach, describe, expect, it, vi } from 'vitest';
import { LeadConnectorClient } from '../client';

function response(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
  } as Response;
}

describe('LeadConnectorClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pulls contacts, opportunities, and per-contact appointments without returning raw payloads', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({
        contacts: [{
          id: 'contact-1',
          name: 'CRM Lead',
          email: 'lead@example.com',
          phone: '+971500000000',
          source: 'GHL Form',
          tags: ['Hot'],
        }],
      }))
      .mockResolvedValueOnce(response({
        opportunities: [{
          id: 'opp-1',
          contactId: 'contact-1',
          pipelineId: 'pipe-1',
          pipelineStageId: 'stage-1',
          status: 'open',
          monetaryValue: 500,
        }],
      }))
      .mockResolvedValueOnce(response({
        appointments: [{
          id: 'appt-1',
          contactId: 'contact-1',
          status: 'confirmed',
          title: 'Discovery Call',
          startTime: '2026-08-01T12:00:00.000Z',
        }],
      }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new LeadConnectorClient({
      baseUrl: 'https://services.leadconnectorhq.com',
      apiKey: 'tenant-owned-key',
      locationId: 'loc-1',
      version: '2021-07-28',
    });

    const result = await client.pull(25);

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://services.leadconnectorhq.com/contacts/search', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://services.leadconnectorhq.com/opportunities/search?location_id=loc-1&limit=25', expect.objectContaining({ method: 'GET' }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://services.leadconnectorhq.com/contacts/contact-1/appointments', expect.objectContaining({ method: 'GET' }));
    expect(result.contacts).toHaveLength(1);
    expect(result.opportunities).toHaveLength(1);
    expect(result.appointments).toHaveLength(1);
    expect(result.rawReturned).toBe(false);
    expect(result).not.toHaveProperty('body');
  });

  it('continues contact and opportunity sync when appointment lookup fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ contacts: [{ id: 'contact-1', name: 'CRM Lead', tags: [] }] }))
      .mockResolvedValueOnce(response({ opportunities: [] }))
      .mockResolvedValueOnce(response({ message: 'appointments unavailable' }, false, 403));
    vi.stubGlobal('fetch', fetchMock);

    const client = new LeadConnectorClient({
      baseUrl: 'https://services.leadconnectorhq.com',
      apiKey: 'tenant-owned-key',
      locationId: 'loc-1',
      version: '2021-07-28',
    });

    const result = await client.pull(25);

    expect(result.contacts).toHaveLength(1);
    expect(result.opportunities).toEqual([]);
    expect(result.appointments).toEqual([]);
    expect(result.warnings[0]).toContain('Could not read appointments');
  });
});
