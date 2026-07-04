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
      buildGhlMappingSet([]),
    );

    expect(mapped.leadStatus).toBe('purchased');
    expect(mapped.leadTemperature).toBe('buyer');
    expect(mapped.purchaseAmount).toBe(2500);
  });
});
