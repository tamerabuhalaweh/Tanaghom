import { describe, expect, it } from 'vitest';
import { buildGhlMappingSet, mapGhlLead } from '../mapper';

describe('GHL lead mapper', () => {
  it('maps GHL tags and stages to Tanaghum status and temperature using configured mappings', () => {
    const mappings = buildGhlMappingSet([
      {
        validation_status: 'valid',
        field_mappings: {
          mappingType: 'tag',
          ghlTagId: 'tag-hot',
          ghlTagName: 'Hot Lead',
          internalTag: 'hot',
          direction: 'inbound',
        },
      },
      {
        validation_status: 'valid',
        field_mappings: {
          mappingType: 'pipeline',
          ghlPipelineId: 'pipe-1',
          ghlPipelineName: 'Sales',
          ghlStageId: 'stage-meeting',
          ghlStageName: 'Meeting Booked',
          internalStage: 'meeting_booked',
        },
      },
    ]);

    const mapped = mapGhlLead(
      {
        id: 'contact-1',
        name: 'Amro Prospect',
        email: 'buyer@example.com',
        phone: '+971500000000',
        source: 'GHL Form',
        tags: ['Hot Lead'],
      },
      [{
        id: 'opp-1',
        contactId: 'contact-1',
        pipelineId: 'pipe-1',
        stageId: 'stage-meeting',
        status: 'open',
        monetaryValue: 1200,
      }],
      [],
      mappings,
    );

    expect(mapped.leadStatus).toBe('meeting_booked');
    expect(mapped.leadTemperature).toBe('hot');
    expect(mapped.ghlContactId).toBe('contact-1');
    expect(mapped.ghlOpportunityId).toBe('opp-1');
    expect(mapped.syncFingerprint).toHaveLength(64);
  });

  it('treats won opportunities as purchased buyer leads', () => {
    const mapped = mapGhlLead(
      { id: 'contact-2', name: 'Buyer', tags: [] },
      [{ id: 'opp-2', contactId: 'contact-2', status: 'won', monetaryValue: 2500 }],
      [],
      buildGhlMappingSet([]),
    );

    expect(mapped.leadStatus).toBe('purchased');
    expect(mapped.leadTemperature).toBe('buyer');
    expect(mapped.purchaseAmount).toBe(2500);
  });

  it('maps booked GHL appointments into meeting-booked leads when no purchase outcome exists', () => {
    const mapped = mapGhlLead(
      { id: 'contact-3', name: 'Booked Lead', tags: [] },
      [],
      [{
        id: 'appt-1',
        contactId: 'contact-3',
        status: 'confirmed',
        title: 'Discovery Call',
        startTime: '2026-08-01T10:00:00.000Z',
      }],
      buildGhlMappingSet([]),
    );

    expect(mapped.leadStatus).toBe('meeting_booked');
    expect(mapped.leadTemperature).toBe('warm');
    expect(mapped.meetingDate?.toISOString()).toBe('2026-08-01T10:00:00.000Z');
    expect(mapped.meetingType).toBe('Discovery Call');
    expect(mapped.meetingOutcome).toBeNull();
  });

  it('maps GHL no-show appointments into no-show leads', () => {
    const mapped = mapGhlLead(
      { id: 'contact-4', name: 'No Show Lead', tags: ['Hot'] },
      [],
      [{
        id: 'appt-2',
        contactId: 'contact-4',
        status: 'no_show',
        title: 'Enrollment Call',
        startTime: '2026-08-02T10:00:00.000Z',
      }],
      buildGhlMappingSet([
        {
          validation_status: 'valid',
          field_mappings: { mappingType: 'tag', ghlTagName: 'Hot', internalTag: 'hot' },
        },
      ]),
    );

    expect(mapped.leadStatus).toBe('no_show');
    expect(mapped.leadTemperature).toBe('hot');
    expect(mapped.meetingOutcome).toBe('no_show');
  });
});
