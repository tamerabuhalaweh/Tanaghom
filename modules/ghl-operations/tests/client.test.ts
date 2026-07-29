import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractProviderIds, HighLevelOperationsClient, validateGhlBaseUrl } from '../client';

function response(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
  } as Response;
}

describe('HighLevel governed operations client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the official contact, opportunity, appointment and WhatsApp routes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ id: 'accepted' }, true, 201));
    vi.stubGlobal('fetch', fetchMock);
    const client = new HighLevelOperationsClient({
      baseUrl: 'https://services.leadconnectorhq.com',
      apiKey: 'private-token',
      locationId: 'location-1',
      version: 'v3',
    });

    await client.upsertContact({ locationId: 'location-1', email: 'buyer@example.com' });
    await client.addTags('contact-1', ['buyer']);
    await client.removeTags('contact-1', ['cold']);
    await client.createOpportunity({ locationId: 'location-1', contactId: 'contact-1' });
    await client.updateOpportunity('opportunity-1', { status: 'won' });
    await client.createAppointment({ calendarId: 'calendar-1', contactId: 'contact-1' });
    await client.updateAppointment('appointment-1', { appointmentStatus: 'showed' });
    await client.sendWhatsApp({ type: 'WhatsApp', contactId: 'contact-1', message: 'Hello' });

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      'https://services.leadconnectorhq.com/contacts/upsert',
      'https://services.leadconnectorhq.com/contacts/contact-1/tags',
      'https://services.leadconnectorhq.com/contacts/contact-1/tags',
      'https://services.leadconnectorhq.com/opportunities/',
      'https://services.leadconnectorhq.com/opportunities/opportunity-1',
      'https://services.leadconnectorhq.com/calendars/events/appointments',
      'https://services.leadconnectorhq.com/calendars/events/appointments/appointment-1',
      'https://services.leadconnectorhq.com/conversations/messages',
    ]);
    expect(
      fetchMock.mock.calls.every(([, init]) =>
        String(
          (init as RequestInit).headers &&
            ((init as RequestInit).headers as Record<string, string>).Authorization,
        ).includes('private-token'),
      ),
    ).toBe(true);
    expect(
      fetchMock.mock.calls.every(
        ([, init]) => ((init as RequestInit).headers as Record<string, string>).Version === 'v3',
      ),
    ).toBe(true);
    expect(
      fetchMock.mock.calls.every(([, init]) => (init as RequestInit).redirect === 'error'),
    ).toBe(true);
  });

  it('returns only sanitized reference choices', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          tags: [
            {
              id: 'tag-1',
              name: 'Buyer',
              contacts: [{ email: 'must-not-leak@example.com' }],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        response({
          pipelines: [
            {
              id: 'pipeline-1',
              name: 'Marketing Pipeline',
              stages: [{ id: 'stage-1', name: 'Sale', monetaryValue: 5000 }],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        response({
          calendars: [
            {
              id: 'calendar-1',
              name: 'Sales Calendar',
              users: [{ email: 'must-not-leak@example.com' }],
            },
          ],
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const client = new HighLevelOperationsClient({
      baseUrl: 'https://services.leadconnectorhq.com',
      apiKey: 'private-token',
      locationId: 'location-1',
      version: 'v3',
    });

    const result = await client.referenceData();

    expect(result).toEqual({
      tags: [{ id: 'tag-1', name: 'Buyer' }],
      pipelines: [
        {
          id: 'pipeline-1',
          name: 'Marketing Pipeline',
          stages: [{ id: 'stage-1', name: 'Sale' }],
        },
      ],
      calendars: [{ id: 'calendar-1', name: 'Sales Calendar' }],
      warnings: [],
    });
    expect(JSON.stringify(result)).not.toContain('must-not-leak@example.com');
    expect(JSON.stringify(result)).not.toContain('private-token');
  });

  it('extracts provider references without exposing the raw payload', () => {
    expect(
      extractProviderIds({
        contact: { id: 'contact-1', email: 'hidden@example.com' },
        opportunity: { id: 'opportunity-1', monetaryValue: 2000 },
        messageId: 'message-1',
      }),
    ).toEqual({
      objectId: 'opportunity-1',
      contactId: 'contact-1',
      opportunityId: 'opportunity-1',
      appointmentId: null,
      messageId: 'message-1',
    });
  });

  it('pins CRM operations to the official HTTPS API host', () => {
    expect(validateGhlBaseUrl('https://services.leadconnectorhq.com')).toBe(
      'https://services.leadconnectorhq.com',
    );
    for (const value of [
      'http://services.leadconnectorhq.com',
      'https://services.leadconnectorhq.com.evil.example',
      'https://user:pass@services.leadconnectorhq.com',
      'https://services.leadconnectorhq.com/internal',
      'http://127.0.0.1:3000',
    ]) {
      expect(() => validateGhlBaseUrl(value)).toThrow();
    }
  });
});
