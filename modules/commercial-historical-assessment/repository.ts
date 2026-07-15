import { Prisma } from '@prisma/client';
import { prisma } from '@shared/database';
import { NotFoundError, ValidationError } from '@shared/errors';
import type {
  AssessmentEvidencePreview,
  AssessmentScopeInput,
  CreateAssessmentRunInput,
  DecideAssessmentFindingInput,
  EvidenceDraft,
  GeneratedAssessment,
  ListAssessmentRunsInput,
} from './types';

const runInclude = {
  revenue_line: { select: { id: true, name: true, revenue_line_type: true } },
  evidence: { orderBy: [{ evidence_type: 'asc' as const }, { created_at: 'asc' as const }] },
  findings: { orderBy: { created_at: 'asc' as const } },
  learning_set: { select: { id: true, title: true, status: true, approved_at: true } },
} satisfies Prisma.CommercialHistoricalAssessmentRunInclude;

export async function previewEvidence(tenantKey: string, scope: AssessmentScopeInput): Promise<AssessmentEvidencePreview> {
  const [tenant, revenueLine, selectedEvents, selectedCampaigns] = await Promise.all([
    prisma.tenant.findUnique({ where: { tenant_key: tenantKey }, select: { default_currency: true } }),
    scope.revenueLineId
      ? prisma.commercialRevenueLine.findFirst({
        where: { id: scope.revenueLineId, tenant_key: tenantKey },
        select: { id: true, name: true },
      })
      : Promise.resolve(null),
    scope.eventIds.length
      ? prisma.commercialEvent.findMany({
        where: { id: { in: scope.eventIds }, tenant_key: tenantKey },
        select: { id: true, status: true },
      })
      : Promise.resolve([]),
    scope.campaignIds.length
      ? prisma.contentRequest.findMany({
        where: { id: { in: scope.campaignIds }, tenant_key: tenantKey },
        select: { id: true },
      })
      : Promise.resolve([]),
  ]);
  if (scope.revenueLineId && !revenueLine) throw new NotFoundError('CommercialRevenueLine', scope.revenueLineId);
  if (selectedEvents.length !== scope.eventIds.length) throw new NotFoundError('CommercialEvent');
  if (selectedEvents.some(event => String(event.status) !== 'completed')) {
    throw new ValidationError('Historical assessment event filters must reference completed events');
  }
  if (selectedCampaigns.length !== scope.campaignIds.length) throw new NotFoundError('Campaign');
  const defaultCurrency = String(tenant?.default_currency) === 'USD' ? 'USD' : 'AED';

  const plans = await prisma.commercialPlan.findMany({
    where: {
      tenant_key: tenantKey,
      ...(scope.revenueLineId ? { revenue_line_id: scope.revenueLineId } : {}),
      ...(scope.eventIds.length ? { linked_event_id: { in: scope.eventIds } } : {}),
      ...(scope.audienceQuery ? { audience: { contains: scope.audienceQuery, mode: 'insensitive' as const } } : {}),
      status: { in: ['active', 'paused', 'completed', 'archived'] },
      OR: [
        { updated_at: { gte: scope.dateFrom, lte: scope.dateTo } },
        { linked_event: { event_date: { gte: scope.dateFrom, lte: scope.dateTo } } },
      ],
    },
    select: {
      id: true,
      title: true,
      status: true,
      stage: true,
      horizon: true,
      objective: true,
      audience: true,
      currency: true,
      budget_target: true,
      revenue_target: true,
      strategy_summary: true,
      action_plan: true,
      updated_at: true,
      linked_event_id: true,
      revenue_line: { select: { name: true, revenue_line_type: true } },
    },
    orderBy: { updated_at: 'desc' },
    take: 200,
  });

  const campaigns = await prisma.contentRequest.findMany({
    where: {
      tenant_key: tenantKey,
      ...(scope.campaignIds.length ? { id: { in: scope.campaignIds } } : {}),
      ...(scope.eventIds.length ? { event_id: { in: scope.eventIds } } : {}),
      ...(scope.audienceQuery ? { audience: { contains: scope.audienceQuery, mode: 'insensitive' as const } } : {}),
      ...(scope.channels.length ? { target_platforms: { hasSome: scope.channels } } : {}),
      updated_at: { gte: scope.dateFrom, lte: scope.dateTo },
    },
    select: {
      id: true,
      objective: true,
      audience: true,
      channel: true,
      target_platforms: true,
      cta: true,
      status: true,
      event_id: true,
      created_at: true,
      updated_at: true,
    },
    orderBy: { updated_at: 'desc' },
    take: 500,
  });

  const planEventIds = plans.map(plan => plan.linked_event_id).filter((id): id is string => Boolean(id));
  const campaignEventIds = campaigns.map(campaign => campaign.event_id).filter((id): id is string => Boolean(id));
  const inferredEventIds = [...new Set([...planEventIds, ...campaignEventIds])];
  const restrictToInferredEvents = Boolean(scope.revenueLineId || scope.campaignIds.length || scope.audienceQuery || scope.channels.length);
  const scopedEventIds = scope.eventIds.length ? scope.eventIds : restrictToInferredEvents ? inferredEventIds : [];
  const events = await prisma.commercialEvent.findMany({
    where: {
      tenant_key: tenantKey,
      status: 'completed',
      event_date: { gte: scope.dateFrom, lte: scope.dateTo },
      ...(scope.eventIds.length || restrictToInferredEvents ? { id: { in: scopedEventIds } } : {}),
      ...(scope.audienceQuery ? { audience: { contains: scope.audienceQuery, mode: 'insensitive' as const } } : {}),
      ...(scope.channels.length ? { selected_channels: { hasSome: scope.channels } } : {}),
    },
    select: {
      id: true,
      name: true,
      event_type: true,
      event_date: true,
      location: true,
      expected_attendance: true,
      planned_budget: true,
      revenue_target: true,
      selected_channels: true,
      offer: true,
      audience: true,
      geography: true,
      fomo_angle: true,
      upsell_plan: true,
    },
    orderBy: { event_date: 'desc' },
    take: 200,
  });
  const eventIds = events.map(event => event.id);

  const [kpis, leads, problems, connectorJobs, assessmentSignals] = await Promise.all([
    eventIds.length
      ? prisma.eventKpiRecord.findMany({
        where: {
          tenant_key: tenantKey,
          event_id: { in: eventIds },
          metric_date: { gte: scope.dateFrom, lte: scope.dateTo },
          ...(scope.channels.length ? { channel: { in: scope.channels } } : {}),
        },
        select: {
          event_id: true,
          source_type: true,
          source_name: true,
          metric_date: true,
          channel: true,
          reach: true,
          impressions: true,
          interactions: true,
          clicks: true,
          form_completions: true,
          leads: true,
          meetings_booked: true,
          meetings_attended: true,
          purchases: true,
          no_shows: true,
          spend: true,
        },
        take: 5000,
      })
      : Promise.resolve([]),
    eventIds.length
      ? prisma.leadCaptureRecord.findMany({
        where: {
          tenant_key: tenantKey,
          event_id: { in: eventIds },
          ...(scope.channels.length ? { channel_attribution: { in: scope.channels } } : {}),
        },
        select: {
          event_id: true,
          lead_status: true,
          lead_temperature: true,
          source_of_truth: true,
          channel_attribution: true,
          purchase_amount: true,
          meeting_outcome: true,
          created_at: true,
        },
        take: 5000,
      })
      : Promise.resolve([]),
    eventIds.length
      ? prisma.eventProblem.findMany({
        where: { tenant_key: tenantKey, event_id: { in: eventIds } },
        select: {
          id: true,
          event_id: true,
          title: true,
          category: true,
          severity: true,
          status: true,
          impact_summary: true,
          recommended_action: true,
          resolution_notes: true,
          created_at: true,
        },
        take: 1000,
      })
      : Promise.resolve([]),
    eventIds.length
      ? prisma.connectorImportJob.findMany({
        where: { tenant_key: tenantKey, event_id: { in: eventIds } },
        select: {
          id: true,
          event_id: true,
          connector_id: true,
          state: true,
          sync_status: true,
          last_dry_run_at: true,
          last_sync_at: true,
        },
        take: 1000,
      })
      : Promise.resolve([]),
    prisma.commercialAssessmentSignal.findMany({
      where: {
        tenant_key: tenantKey,
        created_at: { gte: scope.dateFrom, lte: scope.dateTo },
        ...(scope.revenueLineId ? { revenue_line_id: scope.revenueLineId } : {}),
        ...(plans.length ? { OR: [{ commercial_plan_id: null }, { commercial_plan_id: { in: plans.map(plan => plan.id) } }] } : {}),
      },
      select: {
        id: true,
        title: true,
        source_type: true,
        severity: true,
        finding: true,
        recommended_action: true,
        status: true,
        commercial_plan_id: true,
        created_at: true,
      },
      take: 1000,
    }),
  ]);

  const eventNameById = new Map(events.map(event => [event.id, event.name]));
  const evidence: EvidenceDraft[] = [];

  for (const plan of plans) {
    evidence.push({
      evidenceType: 'commercial_plan',
      sourceObjectType: 'commercial_plan',
      sourceObjectId: plan.id,
      sourceName: plan.title,
      metricKey: 'plan_context',
      metricValue: null,
      metricUnit: String(plan.currency),
      observedAt: plan.updated_at,
      payload: {
        revenueLine: plan.revenue_line.name,
        revenueLineType: String(plan.revenue_line.revenue_line_type),
        status: String(plan.status),
        stage: String(plan.stage),
        horizon: String(plan.horizon),
        objective: plan.objective,
        audience: plan.audience,
        budgetTarget: decimalToNumber(plan.budget_target),
        revenueTarget: decimalToNumber(plan.revenue_target),
        currency: String(plan.currency),
        strategySummary: plan.strategy_summary,
        actionPlan: plan.action_plan,
        linkedEventId: plan.linked_event_id,
      },
    });
  }

  for (const campaign of campaigns) {
    evidence.push({
      evidenceType: 'campaign',
      sourceObjectType: 'content_request',
      sourceObjectId: campaign.id,
      sourceName: campaign.objective,
      metricKey: 'campaign_context',
      metricValue: null,
      metricUnit: null,
      observedAt: campaign.updated_at,
      payload: {
        objective: campaign.objective,
        audience: campaign.audience,
        intakeChannel: campaign.channel,
        targetPlatforms: campaign.target_platforms,
        callToAction: campaign.cta,
        status: String(campaign.status),
        eventId: campaign.event_id,
        createdAt: campaign.created_at,
      },
    });
  }

  for (const event of events) {
    evidence.push({
      evidenceType: 'event',
      sourceObjectType: 'commercial_event',
      sourceObjectId: event.id,
      sourceName: event.name,
      metricKey: 'completed_event_context',
      metricValue: null,
      metricUnit: defaultCurrency,
      observedAt: event.event_date,
      payload: {
        eventType: String(event.event_type),
        location: event.location,
        expectedAttendance: event.expected_attendance,
        plannedBudget: decimalToNumber(event.planned_budget),
        revenueTarget: decimalToNumber(event.revenue_target),
        selectedChannels: event.selected_channels,
        offer: event.offer,
        audience: event.audience,
        geography: event.geography,
        fomoAngle: event.fomo_angle,
        upsellPlan: event.upsell_plan,
        currency: defaultCurrency,
      },
    });
  }

  const kpiGroups = new Map<string, Record<string, unknown>>();
  for (const row of kpis) {
    const key = `${row.event_id}:${row.channel}`;
    const current = kpiGroups.get(key) || {
      eventId: row.event_id,
      channel: row.channel,
      sourceTypes: new Set<string>(),
      sourceNames: new Set<string>(),
      latestDate: row.metric_date,
      reach: 0,
      impressions: 0,
      interactions: 0,
      clicks: 0,
      formCompletions: 0,
      leads: 0,
      meetingsBooked: 0,
      meetingsAttended: 0,
      purchases: 0,
      noShows: 0,
      spend: 0,
    };
    (current.sourceTypes as Set<string>).add(String(row.source_type));
    (current.sourceNames as Set<string>).add(row.source_name);
    if (row.metric_date > (current.latestDate as Date)) current.latestDate = row.metric_date;
    current.reach = Number(current.reach) + row.reach;
    current.impressions = Number(current.impressions) + row.impressions;
    current.interactions = Number(current.interactions) + row.interactions;
    current.clicks = Number(current.clicks) + row.clicks;
    current.formCompletions = Number(current.formCompletions) + row.form_completions;
    current.leads = Number(current.leads) + row.leads;
    current.meetingsBooked = Number(current.meetingsBooked) + row.meetings_booked;
    current.meetingsAttended = Number(current.meetingsAttended) + row.meetings_attended;
    current.purchases = Number(current.purchases) + row.purchases;
    current.noShows = Number(current.noShows) + row.no_shows;
    current.spend = Number(current.spend) + (decimalToNumber(row.spend) || 0);
    kpiGroups.set(key, current);
  }
  for (const [key, group] of kpiGroups) {
    evidence.push({
      evidenceType: 'event_kpi',
      sourceObjectType: 'event_channel_kpis',
      sourceObjectId: key,
      sourceName: `${eventNameById.get(String(group.eventId)) || 'Event'} - ${String(group.channel)}`,
      metricKey: 'channel_performance',
      metricValue: Number(group.spend),
      metricUnit: defaultCurrency,
      observedAt: group.latestDate as Date,
      payload: {
        ...group,
        sourceTypes: [...(group.sourceTypes as Set<string>)],
        sourceNames: [...(group.sourceNames as Set<string>)],
        currency: defaultCurrency,
      },
    });
  }

  const leadGroups = new Map<string, Record<string, unknown>>();
  for (const lead of leads) {
    const eventId = lead.event_id || 'unlinked';
    const current = leadGroups.get(eventId) || {
      total: 0,
      byStatus: {},
      byTemperature: {},
      byChannel: {},
      sourceOfTruth: new Set<string>(),
      knownRevenue: 0,
      meetingsAttended: 0,
      noShows: 0,
      latestObservedAt: lead.created_at,
    };
    current.total = Number(current.total) + 1;
    incrementRecord(current.byStatus as Record<string, number>, String(lead.lead_status || 'unknown'));
    incrementRecord(current.byTemperature as Record<string, number>, String(lead.lead_temperature || 'unknown'));
    incrementRecord(current.byChannel as Record<string, number>, String(lead.channel_attribution || 'unknown'));
    (current.sourceOfTruth as Set<string>).add(String(lead.source_of_truth || 'tanaghum'));
    current.knownRevenue = Number(current.knownRevenue) + (decimalToNumber(lead.purchase_amount) || 0);
    if (String(lead.meeting_outcome).toLowerCase().includes('attended')) current.meetingsAttended = Number(current.meetingsAttended) + 1;
    if (String(lead.lead_status) === 'no_show' || String(lead.meeting_outcome).toLowerCase().includes('no_show')) current.noShows = Number(current.noShows) + 1;
    if (lead.created_at > (current.latestObservedAt as Date)) current.latestObservedAt = lead.created_at;
    leadGroups.set(eventId, current);
  }
  for (const [eventId, group] of leadGroups) {
    evidence.push({
      evidenceType: 'lead_outcome',
      sourceObjectType: 'event_lead_outcomes',
      sourceObjectId: eventId,
      sourceName: eventNameById.get(eventId) || 'Unlinked outcomes',
      metricKey: 'lead_funnel_outcomes',
      metricValue: Number(group.knownRevenue),
      metricUnit: defaultCurrency,
      observedAt: group.latestObservedAt as Date,
      payload: {
        ...group,
        sourceOfTruth: [...(group.sourceOfTruth as Set<string>)],
        currency: defaultCurrency,
      },
    });
  }

  for (const problem of problems) {
    evidence.push({
      evidenceType: 'event_problem',
      sourceObjectType: 'event_problem',
      sourceObjectId: problem.id,
      sourceName: problem.title,
      metricKey: 'barrier_outcome',
      metricValue: null,
      metricUnit: null,
      observedAt: problem.created_at,
      payload: {
        eventId: problem.event_id,
        eventName: eventNameById.get(problem.event_id) || null,
        category: String(problem.category),
        severity: String(problem.severity),
        status: String(problem.status),
        impactSummary: problem.impact_summary,
        recommendedAction: problem.recommended_action,
        resolutionNotes: problem.resolution_notes,
      },
    });
  }

  for (const signal of assessmentSignals) {
    evidence.push({
      evidenceType: 'assessment_signal',
      sourceObjectType: 'commercial_assessment_signal',
      sourceObjectId: signal.id,
      sourceName: signal.title,
      metricKey: 'prior_assessment_signal',
      metricValue: null,
      metricUnit: null,
      observedAt: signal.created_at,
      payload: {
        sourceType: signal.source_type,
        severity: String(signal.severity),
        finding: signal.finding,
        recommendedAction: signal.recommended_action,
        status: String(signal.status),
        commercialPlanId: signal.commercial_plan_id,
      },
    });
  }

  for (const job of connectorJobs) {
    evidence.push({
      evidenceType: 'connector_status',
      sourceObjectType: 'connector_import_job',
      sourceObjectId: job.id,
      sourceName: job.connector_id,
      metricKey: 'connector_data_provenance',
      metricValue: null,
      metricUnit: null,
      observedAt: job.last_sync_at || job.last_dry_run_at,
      payload: {
        eventId: job.event_id,
        connectorId: job.connector_id,
        state: String(job.state),
        syncStatus: String(job.sync_status),
        lastDryRunAt: job.last_dry_run_at,
        lastSyncAt: job.last_sync_at,
      },
    });
  }

  const summary = buildEvidenceSummary(evidence, defaultCurrency);
  const missingData: string[] = [];
  if (!events.length) missingData.push('No completed events were found in this assessment period.');
  if (events.length === 1) missingData.push('Only one completed event is available; cross-event comparison is limited.');
  if (!plans.length) missingData.push('No active or completed commercial plans were found in this assessment period.');
  if (!kpis.length) missingData.push('No verified KPI records were found for the completed events.');
  if (!leads.length) missingData.push('No tenant-scoped lead outcomes were found for the completed events.');
  if (!connectorJobs.some(job => String(job.sync_status) === 'synced')) {
    missingData.push('No completed connector sync evidence was found; available records may be manual or incomplete.');
  }

  return {
    scope: {
      revenueLineId: revenueLine?.id || null,
      revenueLineName: revenueLine?.name || null,
      eventIds: scope.eventIds,
      campaignIds: scope.campaignIds,
      audienceQuery: scope.audienceQuery || null,
      channels: scope.channels,
      dateFrom: scope.dateFrom,
      dateTo: scope.dateTo,
      defaultCurrency,
    },
    summary,
    missingData,
    evidence,
  };
}

export async function createAssessmentRun(
  tenantKey: string,
  userId: string,
  input: CreateAssessmentRunInput,
  preview: AssessmentEvidencePreview,
) {
  return prisma.$transaction(async tx => {
    const run = await tx.commercialHistoricalAssessmentRun.create({
      data: {
        tenant_key: tenantKey,
        revenue_line_id: input.revenueLineId ?? null,
        event_ids: input.eventIds,
        campaign_ids: input.campaignIds,
        audience_query: input.audienceQuery ?? null,
        channels: input.channels,
        title: input.title,
        date_from: input.dateFrom,
        date_to: input.dateTo,
        status: 'evidence_ready',
        evidence_summary: toJson(preview.summary),
        missing_data: toJson(preview.missingData),
        requested_by_user_id: userId,
      },
    });
    if (preview.evidence.length) {
      await tx.commercialHistoricalAssessmentEvidence.createMany({
        data: preview.evidence.map(item => ({
          tenant_key: tenantKey,
          assessment_run_id: run.id,
          evidence_type: item.evidenceType,
          source_object_type: item.sourceObjectType,
          source_object_id: item.sourceObjectId,
          source_name: item.sourceName,
          metric_key: item.metricKey,
          metric_value: item.metricValue == null ? null : new Prisma.Decimal(item.metricValue),
          metric_unit: item.metricUnit,
          observed_at: item.observedAt,
          payload: toJson(item.payload),
        })),
      });
    }
    await createAudit(tx, {
      action: 'historical_assessment_evidence_snapshotted',
      userId,
      targetObjectType: 'commercial_historical_assessment_run',
      targetObjectId: run.id,
      reason: `Immutable evidence snapshot created with ${preview.evidence.length} record(s)`,
      afterState: { evidenceCount: preview.evidence.length, missingData: preview.missingData },
    });
    return tx.commercialHistoricalAssessmentRun.findUniqueOrThrow({ where: { id: run.id }, include: runInclude });
  });
}

export async function listAssessmentRuns(tenantKey: string, filters: ListAssessmentRunsInput) {
  return prisma.commercialHistoricalAssessmentRun.findMany({
    where: {
      tenant_key: tenantKey,
      ...(filters.revenueLineId ? { revenue_line_id: filters.revenueLineId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: {
      revenue_line: { select: { id: true, name: true, revenue_line_type: true } },
      _count: { select: { evidence: true, findings: true } },
      learning_set: { select: { id: true, title: true, status: true, approved_at: true } },
    },
    orderBy: { created_at: 'desc' },
    take: 100,
  });
}

export async function getAssessmentRun(tenantKey: string, id: string) {
  const run = await prisma.commercialHistoricalAssessmentRun.findFirst({
    where: { id, tenant_key: tenantKey },
    include: runInclude,
  });
  if (!run) throw new NotFoundError('CommercialHistoricalAssessmentRun', id);
  return run;
}

export async function startGeneration(tenantKey: string, id: string) {
  const run = await getAssessmentRun(tenantKey, id);
  if (!['evidence_ready', 'failed'].includes(String(run.status))) {
    throw new ValidationError('Only evidence-ready or failed assessments can be generated');
  }
  if (!run.evidence.length) throw new ValidationError('No historical evidence is available for AI analysis');
  return prisma.commercialHistoricalAssessmentRun.update({
    where: { id },
    data: { status: 'generating', failure_reason: null },
    include: runInclude,
  });
}

export async function saveGeneratedFindings(
  tenantKey: string,
  userId: string,
  id: string,
  generated: GeneratedAssessment,
  provider: { type: string; model: string | null },
) {
  return prisma.$transaction(async tx => {
    const run = await tx.commercialHistoricalAssessmentRun.findFirst({
      where: { id, tenant_key: tenantKey },
      include: { evidence: { select: { id: true } } },
    });
    if (!run) throw new NotFoundError('CommercialHistoricalAssessmentRun', id);
    const allowedEvidenceIds = new Set(run.evidence.map(item => item.id));
    for (const finding of generated.findings) {
      if (finding.evidenceIds.some(evidenceId => !allowedEvidenceIds.has(evidenceId))) {
        throw new ValidationError('AI finding referenced evidence outside this assessment snapshot');
      }
    }
    await tx.commercialHistoricalAssessmentFinding.deleteMany({
      where: { assessment_run_id: id, tenant_key: tenantKey, decision: 'pending' },
    });
    await tx.commercialHistoricalAssessmentFinding.createMany({
      data: generated.findings.map(finding => ({
        tenant_key: tenantKey,
        assessment_run_id: id,
        finding_type: finding.type,
        title: finding.title,
        summary: finding.summary,
        recommendation: finding.recommendation,
        confidence: new Prisma.Decimal(finding.confidence),
        evidence_ids: finding.evidenceIds,
      })),
    });
    await tx.commercialHistoricalAssessmentRun.update({
      where: { id },
      data: {
        status: 'generated',
        provider_type: provider.type,
        provider_model: provider.model,
        generated_at: new Date(),
        failure_reason: null,
      },
    });
    await createAudit(tx, {
      action: 'historical_assessment_ai_generated',
      userId,
      targetObjectType: 'commercial_historical_assessment_run',
      targetObjectId: id,
      reason: `AI generated ${generated.findings.length} evidence-backed finding(s)`,
      afterState: { provider: provider.type, model: provider.model, findingCount: generated.findings.length },
    });
    return tx.commercialHistoricalAssessmentRun.findUniqueOrThrow({ where: { id }, include: runInclude });
  });
}

export async function markGenerationFailed(tenantKey: string, id: string, reason: string) {
  await prisma.commercialHistoricalAssessmentRun.updateMany({
    where: { id, tenant_key: tenantKey },
    data: { status: 'failed', failure_reason: reason.slice(0, 1000) },
  });
}

export async function decideFinding(
  tenantKey: string,
  userId: string,
  findingId: string,
  input: DecideAssessmentFindingInput,
) {
  return prisma.$transaction(async tx => {
    const finding = await tx.commercialHistoricalAssessmentFinding.findFirst({
      where: { id: findingId, tenant_key: tenantKey },
      include: { assessment_run: { select: { id: true, title: true, status: true } } },
    });
    if (!finding) throw new NotFoundError('CommercialHistoricalAssessmentFinding', findingId);
    if (!['generated', 'approved'].includes(String(finding.assessment_run.status))) {
      throw new ValidationError('Assessment findings can be reviewed only after AI generation completes');
    }

    let learningSetId: string | null = null;
    if (input.decision === 'approved') {
      const learningSet = await tx.commercialLearningSet.upsert({
        where: { assessment_run_id: finding.assessment_run.id },
        update: { status: 'active', approved_by_user_id: userId, approved_at: new Date() },
        create: {
          tenant_key: tenantKey,
          assessment_run_id: finding.assessment_run.id,
          title: `${finding.assessment_run.title} - approved learning`,
          approved_by_user_id: userId,
        },
      });
      learningSetId = learningSet.id;
    }

    await tx.commercialHistoricalAssessmentFinding.update({
      where: { id: findingId },
      data: {
        decision: input.decision,
        decision_reason: input.reason ?? null,
        decided_by_user_id: userId,
        decided_at: new Date(),
        learning_set_id: learningSetId,
      },
    });

    const remaining = await tx.commercialHistoricalAssessmentFinding.count({
      where: { assessment_run_id: finding.assessment_run.id, decision: 'pending' },
    });
    if (remaining === 0) {
      const approvedFindings = await tx.commercialHistoricalAssessmentFinding.count({
        where: { assessment_run_id: finding.assessment_run.id, decision: 'approved' },
      });
      if (approvedFindings === 0) {
        await tx.commercialLearningSet.updateMany({
          where: { assessment_run_id: finding.assessment_run.id },
          data: { status: 'archived' },
        });
      }
      await tx.commercialHistoricalAssessmentRun.update({
        where: { id: finding.assessment_run.id },
        data: approvedFindings > 0
          ? { status: 'approved', approved_at: new Date() }
          : { status: 'archived', approved_at: null },
      });
    }
    await createAudit(tx, {
      action: `historical_assessment_finding_${input.decision}`,
      userId,
      targetObjectType: 'commercial_historical_assessment_finding',
      targetObjectId: findingId,
      reason: input.reason || `Finding ${input.decision} by authorized reviewer`,
      afterState: { decision: input.decision, learningSetId },
    });
    return tx.commercialHistoricalAssessmentRun.findUniqueOrThrow({
      where: { id: finding.assessment_run.id },
      include: runInclude,
    });
  });
}

export async function listLearningSets(tenantKey: string) {
  return prisma.commercialLearningSet.findMany({
    where: { tenant_key: tenantKey, status: 'active' },
    include: {
      assessment_run: { select: { id: true, title: true, date_from: true, date_to: true, revenue_line_id: true } },
      findings: {
        where: { decision: 'approved' },
        orderBy: { created_at: 'asc' },
      },
    },
    orderBy: { approved_at: 'desc' },
    take: 100,
  });
}

export function serializeAssessment<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, item) => {
    if (item instanceof Prisma.Decimal) return item.toNumber();
    return item;
  })) as T;
}

function buildEvidenceSummary(evidence: EvidenceDraft[], defaultCurrency: 'AED' | 'USD'): Record<string, unknown> {
  const sourceCounts: Record<string, number> = {};
  const eventIds = new Set<string>();
  const planIds = new Set<string>();
  const channels = new Set<string>();
  const outcomes = {
    reach: 0,
    impressions: 0,
    interactions: 0,
    clicks: 0,
    formCompletions: 0,
    leads: 0,
    meetingsBooked: 0,
    meetingsAttended: 0,
    purchases: 0,
    noShows: 0,
    knownSpend: 0,
    knownRevenue: 0,
  };
  const targetsByCurrency: Record<string, { budgetTarget: number; revenueTarget: number; plans: number }> = {};
  const eventComparisonById = new Map<string, {
    eventId: string;
    eventName: string;
    eventDate: string | null;
    currency: 'AED' | 'USD';
    reach: number;
    leads: number;
    purchases: number;
    knownSpend: number;
    knownRevenue: number;
    meetingsBooked: number;
    noShows: number;
  }>();

  const eventComparison = (eventId: string) => {
    const current = eventComparisonById.get(eventId);
    if (current) return current;
    const created = {
      eventId,
      eventName: 'Completed event',
      eventDate: null,
      currency: defaultCurrency,
      reach: 0,
      leads: 0,
      purchases: 0,
      knownSpend: 0,
      knownRevenue: 0,
      meetingsBooked: 0,
      noShows: 0,
    };
    eventComparisonById.set(eventId, created);
    return created;
  };

  for (const item of evidence) {
    sourceCounts[item.evidenceType] = (sourceCounts[item.evidenceType] || 0) + 1;
    if (item.evidenceType === 'event') {
      eventIds.add(item.sourceObjectId);
      const comparison = eventComparison(item.sourceObjectId);
      comparison.eventName = item.sourceName || 'Completed event';
      comparison.eventDate = item.observedAt?.toISOString() || null;
      comparison.currency = String(item.payload.currency) === 'USD' ? 'USD' : defaultCurrency;
    }
    if (item.evidenceType === 'commercial_plan') {
      planIds.add(item.sourceObjectId);
      const currency = String(item.payload.currency || defaultCurrency);
      const current = targetsByCurrency[currency] || { budgetTarget: 0, revenueTarget: 0, plans: 0 };
      current.budgetTarget += Number(item.payload.budgetTarget || 0);
      current.revenueTarget += Number(item.payload.revenueTarget || 0);
      current.plans += 1;
      targetsByCurrency[currency] = current;
    }
    if (item.evidenceType === 'event_kpi') {
      channels.add(String(item.payload.channel || 'unknown'));
      for (const key of ['reach', 'impressions', 'interactions', 'clicks', 'formCompletions', 'leads', 'meetingsBooked', 'meetingsAttended', 'purchases', 'noShows'] as const) {
        outcomes[key] += Number(item.payload[key] || 0);
      }
      outcomes.knownSpend += Number(item.payload.spend || 0);
      const eventId = String(item.payload.eventId || '').trim();
      if (eventId) {
        const comparison = eventComparison(eventId);
        comparison.reach += Number(item.payload.reach || 0);
        comparison.leads += Number(item.payload.leads || 0);
        comparison.purchases += Number(item.payload.purchases || 0);
        comparison.knownSpend += Number(item.payload.spend || 0);
        comparison.meetingsBooked += Number(item.payload.meetingsBooked || 0);
        comparison.noShows += Number(item.payload.noShows || 0);
      }
    }
    if (item.evidenceType === 'lead_outcome') {
      outcomes.knownRevenue += Number(item.payload.knownRevenue || 0);
      const eventId = item.sourceObjectId;
      if (eventId !== 'unlinked') {
        const comparison = eventComparison(eventId);
        comparison.leads = Math.max(comparison.leads, Number(item.payload.total || 0));
        comparison.knownRevenue += Number(item.payload.knownRevenue || 0);
        comparison.purchases = Math.max(
          comparison.purchases,
          Number((item.payload.byStatus as Record<string, unknown> | undefined)?.purchased || 0),
        );
        comparison.noShows = Math.max(comparison.noShows, Number(item.payload.noShows || 0));
      }
    }
  }

  return {
    schemaVersion: 'commercial-historical-evidence.v1',
    evidenceCount: evidence.length,
    completedEvents: eventIds.size,
    commercialPlans: planIds.size,
    comparisonReady: eventIds.size >= 2 || planIds.size >= 2,
    sourceCounts,
    channels: [...channels].sort(),
    targetsByCurrency,
    operatingActuals: { currency: defaultCurrency, ...outcomes },
    eventComparison: [...eventComparisonById.values()]
      .filter(item => eventIds.has(item.eventId))
      .sort((left, right) => String(right.eventDate || '').localeCompare(String(left.eventDate || ''))),
  };
}

function incrementRecord(record: Record<string, number>, key: string) {
  record[key] = (record[key] || 0) + 1;
}

function decimalToNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === 'object' && value && 'toNumber' in value && typeof value.toNumber === 'function') {
    const parsed = value.toNumber();
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

async function createAudit(
  tx: Prisma.TransactionClient,
  input: {
    action: string;
    userId: string;
    targetObjectType: string;
    targetObjectId: string;
    reason: string;
    afterState?: unknown;
  },
) {
  await tx.auditRecord.create({
    data: {
      audit_type: 'commercial_historical_assessment',
      action: input.action,
      result: 'success',
      human_user_id: input.userId,
      target_object_type: input.targetObjectType,
      target_object_id: input.targetObjectId,
      source_module: 'commercial-historical-assessment',
      reason: input.reason,
      after_state: input.afterState == null ? Prisma.JsonNull : toJson(input.afterState),
    },
  });
}
