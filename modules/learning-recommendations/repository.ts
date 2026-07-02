import { prisma } from '@shared/database';
import { NotFoundError } from '@shared/errors';
import type { LearningRecommendation, ConfidenceLevel } from './types';

interface EventData {
  event: Record<string, unknown>;
  kpiRecords: Record<string, unknown>[];
  leads: Record<string, unknown>[];
  problems: Record<string, unknown>[];
  campaigns: Record<string, unknown>[];
  packages: Record<string, unknown>[];
  emailPlans: Record<string, unknown>[];
  whatsappPlans: Record<string, unknown>[];
  upsellPlans: Record<string, unknown>[];
  contentReqs: Record<string, unknown>[];
  salesTasks: Record<string, unknown>[];
  dataCompletenessWarnings: string[];
}

export async function generateRecommendations(tenantKey: string, eventId: string): Promise<{
  eventId: string;
  eventName: string;
  generatedAt: string;
  recommendations: LearningRecommendation[];
  dataCompletenessWarnings: string[];
}> {
  const event = await prisma.commercialEvent.findFirst({
    where: { id: eventId, tenant_key: tenantKey },
    include: { owner: { select: { id: true, name: true } } },
  });
  if (!event) throw new NotFoundError('CommercialEvent', eventId);

  const [kpiRecords, leads, problems, campaigns, packages, emailPlans, whatsappPlans, upsellPlans, contentReqs, salesTasks] = await Promise.all([
    prisma.eventKpiRecord.findMany({ where: { tenant_key: tenantKey, event_id: eventId } }),
    prisma.leadCaptureRecord.findMany({
      where: { tenant_key: tenantKey, event_id: eventId },
      select: {
        id: true, lead_status: true, lead_temperature: true,
        audience_source: true, channel_attribution: true,
        purchase_amount: true, purchase_date: true,
        follow_up_date: true, meeting_date: true, meeting_type: true,
        lead_name_placeholder: true, created_at: true,
      },
    }),
    prisma.eventProblem.findMany({
      where: { tenant_key: tenantKey, event_id: eventId },
      orderBy: [{ severity: 'asc' }, { created_at: 'desc' }],
    }),
    prisma.contentRequest.findMany({
      where: { tenant_key: tenantKey, event_id: eventId },
      select: { id: true, raw_message: true, status: true, target_platforms: true, created_at: true },
    }),
    prisma.publishingPackage.findMany({
      where: { tenant_key: tenantKey, event_id: eventId },
      select: { id: true, package_status: true, package_type: true, created_at: true },
    }),
    prisma.eventEmailPlan.findMany({ where: { tenant_key: tenantKey, event_id: eventId } }),
    prisma.eventWhatsappPlan.findMany({ where: { tenant_key: tenantKey, event_id: eventId } }),
    prisma.eventUpsellPlan.findMany({ where: { tenant_key: tenantKey, event_id: eventId } }),
    prisma.eventContentRequirement.findMany({ where: { tenant_key: tenantKey, event_id: eventId } }),
    prisma.eventSalesTask.findMany({ where: { tenant_key: tenantKey, event_id: eventId } }),
  ]);

  const dataCompletenessWarnings: string[] = [];
  if (kpiRecords.length === 0) dataCompletenessWarnings.push('No KPI records available — budget and spend analysis limited');
  if (leads.length === 0) dataCompletenessWarnings.push('No lead records available — funnel and conversion analysis unavailable');
  if (campaigns.length === 0) dataCompletenessWarnings.push('No campaign records available — channel performance analysis limited');

  const eventData: EventData = {
    event, kpiRecords, leads, problems, campaigns, packages,
    emailPlans, whatsappPlans, upsellPlans, contentReqs, salesTasks,
    dataCompletenessWarnings,
  };

  const recommendations: LearningRecommendation[] = [];
  let recId = 1;

  const noShowRecs = evaluateNoShowRate(eventData, recId);
  recommendations.push(...noShowRecs.recommendations);
  recId = noShowRecs.nextId;

  const budgetRecs = evaluateBudgetEfficiency(eventData, recId);
  recommendations.push(...budgetRecs.recommendations);
  recId = budgetRecs.nextId;

  const followUpRecs = evaluateFollowUpTasks(eventData, recId);
  recommendations.push(...followUpRecs.recommendations);
  recId = followUpRecs.nextId;

  const contentRecs = evaluateContentDelays(eventData, recId);
  recommendations.push(...contentRecs.recommendations);
  recId = contentRecs.nextId;

  const channelRecs = evaluateChannelPerformance(eventData, recId);
  recommendations.push(...channelRecs.recommendations);
  recId = channelRecs.nextId;

  return {
    eventId: event.id as string,
    eventName: event.name as string,
    generatedAt: new Date().toISOString(),
    recommendations,
    dataCompletenessWarnings,
  };
}

function evaluateNoShowRate(data: EventData, startId: number): { recommendations: LearningRecommendation[]; nextId: number } {
  const recommendations: LearningRecommendation[] = [];
  let id = startId;

  let meetingsBooked = 0;
  let noShows = 0;
  for (const l of data.leads) {
    if (l.meeting_date || l.lead_status === 'meeting_booked') meetingsBooked++;
    if (l.lead_status === 'no_show') noShows++;
  }
  for (const k of data.kpiRecords) {
    meetingsBooked += Number(k.meetings_booked) || 0;
    noShows += Number(k.no_shows) || 0;
  }

  const noShowRate = meetingsBooked > 0 ? noShows / meetingsBooked : 0;

  if (noShowRate > 0.2 && meetingsBooked > 0) {
    const confidence: ConfidenceLevel = meetingsBooked >= 10 ? 'high' : meetingsBooked >= 5 ? 'medium' : 'low';
    const missingWarnings: string[] = [];
    if (meetingsBooked < 10) missingWarnings.push('Low sample size — no-show rate may not be statistically reliable');

    recommendations.push({
      id: `rec-${id++}`,
      category: 'no_show',
      priority: 'high',
      title: 'High no-show rate detected',
      recommendation: 'Implement no-show recovery workflow: send reminder 24h before meeting, offer rescheduling, and follow up within 2 hours of missed meetings.',
      rationale: `No-show rate is ${(noShowRate * 100).toFixed(1)}% (${noShows} of ${meetingsBooked} meetings), exceeding the 20% threshold. Each no-show represents lost conversion opportunity and wasted sales effort.`,
      evidenceSummary: `${noShows} no-shows out of ${meetingsBooked} booked meetings (${(noShowRate * 100).toFixed(1)}% rate)`,
      sourceMetrics: { meetingsBooked, noShows, noShowRate: Math.round(noShowRate * 100) },
      sourceSections: ['leadFunnel', 'salesOutcomes'],
      confidence,
      missingDataWarnings: missingWarnings,
      suggestedOwnerRole: 'sales_manager',
      nextAction: 'Set up automated meeting reminders and no-show follow-up sequences',
    });
  }

  return { recommendations, nextId: id };
}

function evaluateBudgetEfficiency(data: EventData, startId: number): { recommendations: LearningRecommendation[]; nextId: number } {
  const recommendations: LearningRecommendation[] = [];
  let id = startId;

  let knownSpend = 0;
  for (const k of data.kpiRecords) knownSpend += k.spend ? Number(k.spend) : 0;
  const plannedBudget = data.event.planned_budget ? Number(data.event.planned_budget) : null;

  let purchases = 0;
  for (const l of data.leads) {
    if (l.lead_status === 'purchased' || l.purchase_date) purchases++;
  }
  for (const k of data.kpiRecords) {
    purchases += Number(k.purchases) || 0;
  }

  if (plannedBudget && plannedBudget > 0) {
    const spendRatio = knownSpend / plannedBudget;
    const missingWarnings: string[] = [];
    if (data.kpiRecords.length === 0) missingWarnings.push('No KPI spend data — budget analysis based on planned budget only');

    if (spendRatio > 0.5 && purchases < 5) {
      const confidence: ConfidenceLevel = data.kpiRecords.length > 0 && data.leads.length > 0 ? 'high' : data.kpiRecords.length > 0 || data.leads.length > 0 ? 'medium' : 'low';
      recommendations.push({
        id: `rec-${id++}`,
        category: 'budget',
        priority: 'high',
        title: 'Budget utilization high but low conversion',
        recommendation: 'Review channel allocation and targeting. Consider reallocating budget from underperforming channels to those with proven lead-to-purchase conversion.',
        rationale: `${(spendRatio * 100).toFixed(0)}% of budget spent (${knownSpend} of ${plannedBudget}) but only ${purchases} purchases recorded. This suggests spend efficiency issues.`,
        evidenceSummary: `Budget spent: ${knownSpend}/${plannedBudget} (${(spendRatio * 100).toFixed(0)}%), Purchases: ${purchases}`,
        sourceMetrics: { plannedBudget, knownSpend, spendRatio: Math.round(spendRatio * 100), purchases },
        sourceSections: ['budget', 'salesOutcomes'],
        confidence,
        missingDataWarnings: missingWarnings,
        suggestedOwnerRole: 'marketing_manager',
        nextAction: 'Audit channel performance and reallocate budget to highest-converting channels',
      });
    }
  }

  return { recommendations, nextId: id };
}

function evaluateFollowUpTasks(data: EventData, startId: number): { recommendations: LearningRecommendation[]; nextId: number } {
  const recommendations: LearningRecommendation[] = [];
  let id = startId;

  const openFollowUps: Array<{ type: string; id: string; dueDate: Date | null }> = [];
  for (const l of data.leads) {
    if (l.follow_up_date && l.lead_status !== 'purchased' && l.lead_status !== 'lost') {
      openFollowUps.push({ type: 'lead_follow_up', id: l.id as string, dueDate: l.follow_up_date as Date });
    }
  }
  for (const t of data.salesTasks) {
    if (t.status !== 'completed') {
      openFollowUps.push({ type: 'sales_task', id: t.id as string, dueDate: t.due_date as Date | null });
    }
  }

  const overdueFollowUps = openFollowUps.filter(f => f.dueDate && f.dueDate < new Date());

  if (openFollowUps.length > 0) {
    const confidence: ConfidenceLevel = openFollowUps.length >= 5 ? 'high' : openFollowUps.length >= 2 ? 'medium' : 'low';
    const missingWarnings: string[] = [];
    if (data.leads.length === 0) missingWarnings.push('No lead data — follow-up analysis based on tasks only');

    recommendations.push({
      id: `rec-${id++}`,
      category: 'follow_up',
      priority: overdueFollowUps.length > 0 ? 'high' : 'medium',
      title: `${openFollowUps.length} open follow-up tasks${overdueFollowUps.length > 0 ? ` (${overdueFollowUps.length} overdue)` : ''}`,
      recommendation: 'Establish and enforce follow-up SLA: all leads must be contacted within 48 hours of inquiry, and follow-up tasks must be completed within 72 hours.',
      rationale: `${openFollowUps.length} follow-up tasks remain open${overdueFollowUps.length > 0 ? `, with ${overdueFollowUps.length} overdue` : ''}. Delayed follow-up reduces conversion probability significantly.`,
      evidenceSummary: `${openFollowUps.length} open tasks, ${overdueFollowUps.length} overdue`,
      sourceMetrics: { openFollowUps: openFollowUps.length, overdueFollowUps: overdueFollowUps.length },
      sourceSections: ['openFollowUps', 'salesTasks'],
      confidence,
      missingDataWarnings: missingWarnings,
      suggestedOwnerRole: 'sales_manager',
      nextAction: 'Review and complete overdue follow-ups, then set up automated SLA tracking',
    });
  }

  return { recommendations, nextId: id };
}

function evaluateContentDelays(data: EventData, startId: number): { recommendations: LearningRecommendation[]; nextId: number } {
  const recommendations: LearningRecommendation[] = [];
  let id = startId;

  // EventContentRequirement active statuses (not yet delivered)
  // pending, in_progress, blocked are active; ready and delivered are done
  const activeStatuses = ['pending', 'in_progress', 'blocked'];

  const activeReqs = data.contentReqs.filter(c => activeStatuses.includes(c.status as string));

  // Only recommend if there are active items with overdue due dates
  if (activeReqs.length > 0) {
    const now = new Date();
    const overdueReqs = activeReqs.filter(c => {
      if (!c.due_date) return false;
      const due = c.due_date instanceof Date ? c.due_date : new Date(c.due_date as string);
      return due < now;
    });

    // Only recommend if there are overdue items
    if (overdueReqs.length > 0) {
      const confidence: ConfidenceLevel = overdueReqs.length >= 3 ? 'high' : overdueReqs.length >= 1 ? 'medium' : 'low';
      const missingWarnings: string[] = [];
      if (data.contentReqs.length === 0) missingWarnings.push('No content requirements recorded');

      recommendations.push({
        id: `rec-${id++}`,
        category: 'content',
        priority: overdueReqs.length >= 3 ? 'high' : 'medium',
        title: `${overdueReqs.length} content requirements past due date`,
        recommendation: 'Set earlier content deadlines with buffer time. Content should be ready at least 1 week before campaign launch to allow for review and revisions.',
        rationale: `${overdueReqs.length} content requirements have passed their due dates without being delivered. Content delays directly impact campaign launch timing.`,
        evidenceSummary: `${overdueReqs.length} overdue content requirements, ${activeReqs.length - overdueReqs.length} active but not yet overdue`,
        sourceMetrics: { overdueContent: overdueReqs.length, totalActive: activeReqs.length },
        sourceSections: ['contentRequirements'],
        confidence,
        missingDataWarnings: missingWarnings,
        suggestedOwnerRole: 'social_media_manager',
        nextAction: 'Review overdue content pipeline and set earlier deadlines with buffer for next event',
      });
    }
  }

  return { recommendations, nextId: id };
}

function evaluateChannelPerformance(data: EventData, startId: number): { recommendations: LearningRecommendation[]; nextId: number } {
  const recommendations: LearningRecommendation[] = [];
  let id = startId;

  const channelMap: Record<string, { leads: number; purchases: number; spend: number }> = {};
  for (const l of data.leads) {
    const ch = (l.channel_attribution as string) || 'unknown';
    channelMap[ch] = channelMap[ch] || { leads: 0, purchases: 0, spend: 0 };
    channelMap[ch].leads++;
    if (l.lead_status === 'purchased' || l.purchase_date) channelMap[ch].purchases++;
  }
  for (const k of data.kpiRecords) {
    const ch = (k.channel as string) || 'unknown';
    channelMap[ch] = channelMap[ch] || { leads: 0, purchases: 0, spend: 0 };
    channelMap[ch].leads += Number(k.leads) || 0;
    channelMap[ch].purchases += Number(k.purchases) || 0;
    channelMap[ch].spend += k.spend ? Number(k.spend) : 0;
  }

  const channels = Object.entries(channelMap).filter(([, d]) => d.leads > 0);
  if (channels.length < 2) return { recommendations, nextId: id };

  const channelConversions = channels.map(([channel, d]) => ({
    channel,
    ...d,
    conversionRate: d.leads > 0 ? d.purchases / d.leads : 0,
  }));

  channelConversions.sort((a, b) => b.conversionRate - a.conversionRate);
  const best = channelConversions[0];
  const worst = channelConversions[channelConversions.length - 1];

  if (best.conversionRate > 0 && worst.conversionRate < best.conversionRate * 0.5 && best.leads >= 3) {
    const confidence: ConfidenceLevel = best.leads >= 10 && worst.leads >= 10 ? 'high' : best.leads >= 5 ? 'medium' : 'low';
    const missingWarnings: string[] = [];
    if (best.leads < 10) missingWarnings.push(`Low sample size for ${best.channel} (${best.leads} leads)`);
    if (worst.leads < 10) missingWarnings.push(`Low sample size for ${worst.channel} (${worst.leads} leads)`);

    recommendations.push({
      id: `rec-${id++}`,
      category: 'channel',
      priority: 'medium',
      title: `${best.channel} outperforms ${worst.channel} significantly`,
      recommendation: `Consider shifting budget from ${worst.channel} to ${best.channel}. ${best.channel} has a ${(best.conversionRate * 100).toFixed(1)}% conversion rate vs ${worst.channel}'s ${(worst.conversionRate * 100).toFixed(1)}%.`,
      rationale: `${best.channel} converts at ${(best.conversionRate * 100).toFixed(1)}% (${best.purchases}/${best.leads}) while ${worst.channel} converts at ${(worst.conversionRate * 100).toFixed(1)}% (${worst.purchases}/${worst.leads}).`,
      evidenceSummary: `${best.channel}: ${best.purchases} purchases from ${best.leads} leads, ${worst.channel}: ${worst.purchases} purchases from ${worst.leads} leads`,
      sourceMetrics: {
        bestChannelLeads: best.leads,
        bestChannelPurchases: best.purchases,
        bestChannelRate: Math.round(best.conversionRate * 100),
        worstChannelLeads: worst.leads,
        worstChannelPurchases: worst.purchases,
        worstChannelRate: Math.round(worst.conversionRate * 100),
      },
      sourceSections: ['channelPerformance'],
      confidence,
      missingDataWarnings: missingWarnings,
      suggestedOwnerRole: 'marketing_manager',
      nextAction: `Analyze ${best.channel} strategy and replicate successful patterns in ${worst.channel}`,
    });
  }

  return { recommendations, nextId: id };
}
