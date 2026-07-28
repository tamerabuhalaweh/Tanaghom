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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          contacts: [
            {
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
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        response({
          opportunities: [
            {
              id: 'opp-1',
              contactId: 'contact-1',
              pipelineId: 'pipe-1',
              pipelineStageId: 'stage-1',
              status: 'open',
              monetaryValue: 500,
              customFields: [{ id: 'amount-paid-id', fieldValue: null }],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        response({
          customFields: [
            {
              id: 'amount-paid-id',
              fieldKey: 'opportunity.amount_paid_aed',
              name: 'Amount Paid AED',
            },
            {
              id: 'ticket-quantity-id',
              fieldKey: 'opportunity.ticket_quantity',
              name: 'Ticket Quantity',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        response({
          opportunity: {
            id: 'opp-1',
            contactId: 'contact-1',
            pipelineId: 'pipe-1',
            pipelineStageId: 'stage-1',
            status: 'open',
            monetaryValue: 500,
            customFields: [
              { id: 'amount-paid-id', fieldValueNumber: 400 },
              { id: 'ticket-quantity-id', fieldValueString: '1' },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        response({
          appointments: [
            {
              id: 'appt-1',
              contactId: 'contact-1',
              status: 'confirmed',
              title: 'Discovery Call',
              startTime: '2026-08-01T12:00:00.000Z',
            },
          ],
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const client = new LeadConnectorClient({
      baseUrl: 'https://services.leadconnectorhq.com',
      apiKey: 'tenant-owned-key',
      locationId: 'loc-1',
      version: '2021-07-28',
    });

    const result = await client.pull(25);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://services.leadconnectorhq.com/contacts/search',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ locationId: 'loc-1', page: 1, pageLimit: 25 }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://services.leadconnectorhq.com/opportunities/search?location_id=loc-1&limit=25',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://services.leadconnectorhq.com/locations/loc-1/customFields?model=opportunity',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'https://services.leadconnectorhq.com/opportunities/opp-1',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      'https://services.leadconnectorhq.com/contacts/contact-1/appointments',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.contacts).toHaveLength(1);
    expect(result.contacts[0]?.customFields).toEqual({
      amount_paid: '500',
      ticket_quantity: 2,
    });
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0]?.customFields).toMatchObject({
      'amount-paid-id': 400,
      'opportunity.amount_paid_aed': 400,
      'Amount Paid AED': 400,
      'ticket-quantity-id': '1',
      'opportunity.ticket_quantity': '1',
    });
    expect(result.appointments).toHaveLength(1);
    expect(result.rawReturned).toBe(false);
    expect(result).not.toHaveProperty('body');
  });

  it('continues contact and opportunity sync when appointment lookup fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({ contacts: [{ id: 'contact-1', name: 'CRM Lead', tags: [] }] }),
      )
      .mockResolvedValueOnce(response({ opportunities: [] }))
      .mockResolvedValueOnce(response({ customFields: [] }))
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
    expect(result.warnings).toContain(
      'Could not read appointments for 1 GoHighLevel contact(s). Contact and opportunity sync continued.',
    );
  });

  it('retains opportunity summary data when one detail lookup fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ contacts: [{ id: 'contact-1', tags: [] }] }))
      .mockResolvedValueOnce(
        response({
          opportunities: [
            {
              id: 'opp-1',
              contactId: 'contact-1',
              monetaryValue: 1000,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(response({ customFields: [] }))
      .mockResolvedValueOnce(response({ message: 'unavailable' }, false, 403))
      .mockResolvedValueOnce(response({ appointments: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new LeadConnectorClient({
      baseUrl: 'https://services.leadconnectorhq.com',
      apiKey: 'tenant-owned-key',
      locationId: 'loc-1',
      version: '2021-07-28',
    });

    const result = await client.pull(25);

    expect(result.opportunities).toEqual([
      expect.objectContaining({ id: 'opp-1', contactId: 'contact-1', monetaryValue: 1000 }),
    ]);
    expect(result.warnings).toContain(
      'Could not read details for 1 GoHighLevel opportunity record(s). Summary data was retained.',
    );
    expect(JSON.stringify(result)).not.toContain('tenant-owned-key');
    expect(result.rawReturned).toBe(false);
  });

  it('retries transient read failures before accepting opportunity details', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ contacts: [{ id: 'contact-1', tags: [] }] }))
      .mockResolvedValueOnce(
        response({
          opportunities: [{ id: 'opp-1', contactId: 'contact-1', monetaryValue: 1000 }],
        }),
      )
      .mockResolvedValueOnce(response({ customFields: [] }))
      .mockResolvedValueOnce(response({ message: 'busy' }, false, 429))
      .mockResolvedValueOnce(response({ appointments: [] }))
      .mockResolvedValueOnce(
        response({
          opportunity: {
            id: 'opp-1',
            contactId: 'contact-1',
            monetaryValue: 1000,
            customFields: [{ id: 'paid', fieldValue: '400' }],
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const client = new LeadConnectorClient({
      baseUrl: 'https://services.leadconnectorhq.com',
      apiKey: 'tenant-owned-key',
      locationId: 'loc-1',
      version: '2021-07-28',
    });

    const result = await client.pull(25);

    expect(result.opportunities[0]?.customFields).toEqual({ paid: '400' });
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/opportunities/opp-1')),
    ).toHaveLength(2);
  });

  it('limits parallel opportunity detail reads', async () => {
    let activeDetailReads = 0;
    let maximumDetailReads = 0;
    const opportunities = Array.from({ length: 7 }, (_, index) => ({
      id: `opp-${index + 1}`,
      contactId: 'contact-1',
      monetaryValue: 100 + index,
    }));
    const fetchMock = vi.fn(async (urlInput: string | URL | Request) => {
      const url = String(urlInput);
      if (url.endsWith('/contacts/search')) {
        return response({ contacts: [{ id: 'contact-1', tags: [] }] });
      }
      if (url.includes('/opportunities/search?')) {
        return response({ opportunities });
      }
      if (url.includes('/customFields?model=opportunity')) {
        return response({ customFields: [] });
      }
      if (url.includes('/contacts/contact-1/appointments')) {
        return response({ appointments: [] });
      }
      const opportunity = opportunities.find((item) => url.endsWith(`/opportunities/${item.id}`));
      if (opportunity) {
        activeDetailReads += 1;
        maximumDetailReads = Math.max(maximumDetailReads, activeDetailReads);
        await new Promise((resolve) => setTimeout(resolve, 5));
        activeDetailReads -= 1;
        return response({ opportunity });
      }
      return response({}, false, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new LeadConnectorClient({
      baseUrl: 'https://services.leadconnectorhq.com',
      apiKey: 'tenant-owned-key',
      locationId: 'loc-1',
      version: '2021-07-28',
    });

    const result = await client.pull(25);

    expect(result.opportunities).toHaveLength(7);
    expect(maximumDetailReads).toBeGreaterThan(1);
    expect(maximumDetailReads).toBeLessThanOrEqual(4);
  });

  it('validates live read access without returning raw GHL payloads', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ contacts: [{ id: 'contact-1' }] }))
      .mockResolvedValueOnce(response({ opportunities: [{ id: 'opp-1', contactId: 'contact-1' }] }))
      .mockResolvedValueOnce(response({ tags: [{ id: 'tag-hot', name: 'Hot Lead' }] }))
      .mockResolvedValueOnce(
        response({
          pipelines: [
            {
              id: 'pipe-sales',
              name: 'Sales',
              stages: [{ id: 'stage-booked', name: 'Booked Meeting' }],
            },
          ],
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const client = new LeadConnectorClient({
      baseUrl: 'https://services.leadconnectorhq.com',
      apiKey: 'tenant-owned-key',
      locationId: 'loc-1',
      version: '2021-07-28',
    });

    const result = await client.validateReadAccess();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://services.leadconnectorhq.com/contacts/search',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ locationId: 'loc-1', page: 1, pageLimit: 1 }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://services.leadconnectorhq.com/opportunities/search?location_id=loc-1&limit=1',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://services.leadconnectorhq.com/locations/loc-1/tags',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'https://services.leadconnectorhq.com/opportunities/pipelines?locationId=loc-1',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.canReadContacts).toBe(true);
    expect(result.canReadOpportunities).toBe(true);
    expect(result.canReadTags).toBe(true);
    expect(result.canReadPipelines).toBe(true);
    expect(result.tagsFound).toBe(1);
    expect(result.stagesFound).toBe(1);
    expect(result.remoteTags).toEqual([{ id: 'tag-hot', name: 'Hot Lead' }]);
    expect(result.remotePipelineStages).toEqual([
      {
        pipelineId: 'pipe-sales',
        pipelineName: 'Sales',
        stageId: 'stage-booked',
        stageName: 'Booked Meeting',
      },
    ]);
    expect(result.rawPayloadReturned).toBe(false);
    expect(JSON.stringify(result)).not.toContain('tenant-owned-key');
  });

  it('discovers only sanitized tag and pipeline-stage references for mapping choices', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          tags: [
            { id: 'tag-1', name: 'Meeting Booked', contacts: [{ email: 'hidden@example.com' }] },
          ],
        }),
      )
      .mockResolvedValueOnce(
        response({
          pipelines: [
            {
              id: 'pipe-1',
              name: 'Marketing Pipeline',
              stages: [
                { id: 'stage-1', name: 'Sale', opportunityValue: 1000 },
                { id: 'stage-2', name: 'No Show' },
              ],
            },
          ],
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const client = new LeadConnectorClient({
      baseUrl: 'https://services.leadconnectorhq.com',
      apiKey: 'secret-token',
      locationId: 'loc-1',
      version: '2021-07-28',
    });

    const result = await client.discoverReferenceData();

    expect(result).toEqual({
      canReadTags: true,
      canReadPipelines: true,
      remoteTags: [{ id: 'tag-1', name: 'Meeting Booked' }],
      remotePipelineStages: [
        {
          pipelineId: 'pipe-1',
          pipelineName: 'Marketing Pipeline',
          stageId: 'stage-1',
          stageName: 'Sale',
        },
        {
          pipelineId: 'pipe-1',
          pipelineName: 'Marketing Pipeline',
          stageId: 'stage-2',
          stageName: 'No Show',
        },
      ],
      warnings: [],
      rawPayloadReturned: false,
    });
    expect(JSON.stringify(result)).not.toContain('hidden@example.com');
    expect(JSON.stringify(result)).not.toContain('secret-token');
  });

  it('returns granular blockers when some live read surfaces fail', async () => {
    const fetchMock = vi
      .fn()
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

  it('uses HighLevel page and pageLimit fields for the connection acceptance search', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ contacts: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new LeadConnectorClient({
      baseUrl: 'https://services.leadconnectorhq.com',
      apiKey: 'tenant-owned-key',
      locationId: 'loc-1',
      version: '2021-07-28',
    });

    await client.testConnection();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://services.leadconnectorhq.com/contacts/search',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ locationId: 'loc-1', page: 1, pageLimit: 1 }),
      }),
    );
    expect(fetchMock.mock.calls[0]?.[1]?.body).not.toContain('skip');
  });
});
