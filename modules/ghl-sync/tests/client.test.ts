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
          customFields: [
            { id: 'amount_paid', value: '500' },
            { fieldKey: 'ticket_quantity', field_value: 2 },
          ],
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
    expect(result.contacts[0]?.customFields).toEqual({
      amount_paid: '500',
      ticket_quantity: 2,
    });
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

  it('validates live read access without returning raw GHL payloads', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ contacts: [{ id: 'contact-1' }] }))
      .mockResolvedValueOnce(response({ opportunities: [{ id: 'opp-1', contactId: 'contact-1' }] }))
      .mockResolvedValueOnce(response({ tags: [{ id: 'tag-hot', name: 'Hot Lead' }] }))
      .mockResolvedValueOnce(response({
        pipelines: [{
          id: 'pipe-sales',
          name: 'Sales',
          stages: [{ id: 'stage-booked', name: 'Booked Meeting' }],
        }],
      }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new LeadConnectorClient({
      baseUrl: 'https://services.leadconnectorhq.com',
      apiKey: 'tenant-owned-key',
      locationId: 'loc-1',
      version: '2021-07-28',
    });

    const result = await client.validateReadAccess();

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://services.leadconnectorhq.com/contacts/search', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://services.leadconnectorhq.com/opportunities/search?location_id=loc-1&limit=1', expect.objectContaining({ method: 'GET' }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://services.leadconnectorhq.com/locations/loc-1/tags', expect.objectContaining({ method: 'GET' }));
    expect(fetchMock).toHaveBeenNthCalledWith(4, 'https://services.leadconnectorhq.com/opportunities/pipelines?locationId=loc-1', expect.objectContaining({ method: 'GET' }));
    expect(result.canReadContacts).toBe(true);
    expect(result.canReadOpportunities).toBe(true);
    expect(result.canReadTags).toBe(true);
    expect(result.canReadPipelines).toBe(true);
    expect(result.tagsFound).toBe(1);
    expect(result.stagesFound).toBe(1);
    expect(result.remoteTags).toEqual([{ id: 'tag-hot', name: 'Hot Lead' }]);
    expect(result.remotePipelineStages).toEqual([{ pipelineId: 'pipe-sales', pipelineName: 'Sales', stageId: 'stage-booked', stageName: 'Booked Meeting' }]);
    expect(result.rawPayloadReturned).toBe(false);
    expect(JSON.stringify(result)).not.toContain('tenant-owned-key');
  });

  it('returns granular blockers when some live read surfaces fail', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ contacts: [{ id: 'contact-1' }] }))
      .mockResolvedValueOnce(response({ message: 'forbidden' }, false, 403))
      .mockResolvedValueOnce(response({ tags: [] }))
      .mockResolvedValueOnce(response({ message: 'forbidden' }, false, 403));
    vi.stubGlobal('fetch', fetchMock);

    const client = new LeadConnectorClient({
      baseUrl: 'https://services.leadconnectorhq.com',
      apiKey: 'tenant-owned-key',
      locationId: 'loc-1',
      version: '2021-07-28',
    });

    const result = await client.validateReadAccess();

    expect(result.canReadContacts).toBe(true);
    expect(result.canReadOpportunities).toBe(false);
    expect(result.canReadPipelines).toBe(false);
    expect(result.warnings).toContain('Opportunities read check failed with status 403.');
    expect(result.warnings).toContain('Pipeline read check failed with status 403.');
    expect(result.rawPayloadReturned).toBe(false);
  });
});
