import { prisma } from '@shared/database';
import type { SessionContext } from '@shared/auth';
import { getActiveIntegrationCredential } from '../integration-credentials/service';
import {
  buildCommercialWorkflowState,
  type CommercialWorkflowFacts,
  type CommercialWorkflowState,
  type WorkflowCampaignFact,
} from './workflow-state';

const SOCIAL_PLATFORMS = new Set(['linkedin', 'instagram', 'x', 'twitter', 'facebook', 'threads', 'tiktok', 'youtube']);

export async function getCommercialWorkflowState(
  session: SessionContext,
  campaignId?: string,
): Promise<CommercialWorkflowState> {
  const campaigns = await prisma.contentRequest.findMany({
    orderBy: { created_at: 'desc' },
    take: 100,
    include: {
      content_items: {
        include: {
          draft_versions: { orderBy: { version_no: 'desc' }, take: 1 },
        },
      },
    },
  });
  const socialCampaigns = campaigns.filter(isSocialCampaign);
  const activeCampaigns = uniqueCampaigns(socialCampaigns.filter(campaign => campaign.status !== 'archived'));
  const selectedCampaign = campaignId
    ? socialCampaigns.find(campaign => campaign.id === campaignId) || null
    : activeCampaigns[0] || null;
  const selectedItemIds = selectedCampaign?.content_items.map(item => item.id) || [];

  const [
    approvals,
    packages,
    reports,
    leads,
    provider,
    postizCredential,
  ] = await Promise.all([
    prisma.approval.findMany({
      orderBy: { created_at: 'desc' },
      take: 100,
    }),
    prisma.publishingPackage.findMany({
      orderBy: { created_at: 'desc' },
      take: 100,
    }),
    prisma.campaignPerformanceReport.findMany({
      orderBy: { created_at: 'desc' },
      take: 50,
    }),
    prisma.leadCaptureRecord.findMany({
      orderBy: { created_at: 'desc' },
      take: 100,
    }),
    resolveProviderFact(session.humanUserId),
    getActiveIntegrationCredential('postiz', 'api_key', session.tenantKey),
  ]);

  const selectedApprovals = approvals.filter(approval => {
    if (!selectedCampaign) return false;
    return approval.target_id === selectedCampaign.id || selectedItemIds.includes(approval.target_id);
  });
  const latestApproval = selectedApprovals[0] || null;
  const selectedPackages = packages.filter(pkg => {
    if (!selectedCampaign) return false;
    return pkg.campaign_id === selectedCampaign.id || (pkg.content_item_id ? selectedItemIds.includes(pkg.content_item_id) : false);
  });
  const selectedReports = reports.filter(report => selectedCampaign ? report.campaign_id === selectedCampaign.id : false);
  const selectedLeads = leads.filter(lead => selectedCampaign ? lead.campaign_id === selectedCampaign.id : false);
  const draftCount = selectedCampaign?.content_items.length || 0;
  const scoredDraftCount = selectedCampaign?.content_items.filter(item => item.reach_score > 0).length || 0;

  const metadata = normalizeObject(postizCredential?.metadata);
  const selectedChannel = normalizeObject(metadata.selectedChannel);
  const postizBaseUrl = postizCredential?.secrets.baseUrl || process.env.POSTIZ_SANDBOX_URL || process.env.POSTIZ_BASE_URL || '';
  const postizApiKey = postizCredential?.secrets.apiKey || process.env.POSTIZ_API_KEY || '';
  const postizIntegrationId = postizCredential?.secrets.integrationId || process.env.POSTIZ_SANDBOX_INTEGRATION_ID || '';
  const [postizReachable, postizChannelCount] = await Promise.all([
    checkPostizReachable(postizBaseUrl),
    countPostizChannels(postizBaseUrl, postizApiKey),
  ]);
  const facts: CommercialWorkflowFacts = {
    generatedAt: new Date().toISOString(),
    campaign: selectedCampaign ? toCampaignFact(selectedCampaign) : null,
    provider,
    postiz: {
      serverReachable: postizReachable,
      credentialStatus: postizApiKey ? 'configured' : 'missing',
      integrationIdStatus: postizIntegrationId || selectedChannel.id ? 'configured' : 'missing',
      connectedChannelCount: postizChannelCount,
    },
    safety: {
      externalExecutionEnabled: process.env.EXTERNAL_EXECUTION_ENABLED === 'true',
      m5WriteExecutionEnabled: process.env.M5_WRITE_EXECUTION_ENABLED === 'true',
      demoMode: process.env.DEMO_MODE === 'true',
    },
    counts: {
      activeCampaigns: activeCampaigns.length,
      generatedDrafts: socialCampaigns.reduce((sum, campaign) => sum + campaign.content_items.length, 0),
      scoredDrafts: socialCampaigns.reduce((sum, campaign) => sum + campaign.content_items.filter(item => item.reach_score > 0).length, 0),
      pendingApprovals: approvals.filter(approval => approval.approval_status === 'pending').length,
      approvedApprovals: approvals.filter(approval => approval.approval_status === 'approved').length,
      publishingPackages: packages.length,
      analyticsReports: reports.length,
      capturedLeads: leads.length,
      qualifiedLeads: leads.filter(lead => lead.lead_status === 'qualified').length,
    },
    current: {
      draftCount,
      scoredDraftCount,
      latestApprovalStatus: latestApproval?.approval_status || null,
      packageReady: selectedPackages.length > 0,
      analyticsReports: selectedReports.length,
      leadCount: selectedLeads.length,
    },
  };

  return buildCommercialWorkflowState(facts);
}

async function resolveProviderFact(userId: string): Promise<CommercialWorkflowFacts['provider']> {
  const agentRep = await prisma.agentRep.findUnique({ where: { user_id: userId } });
  const metadata = normalizeObject(agentRep?.metadata);
  const selected = metadata.llmProvider === 'openai' || metadata.llmProvider === 'claude' || metadata.llmProvider === 'deepseek'
    ? metadata.llmProvider
    : 'mock';
  if (selected === 'mock') {
    const mockReady = process.env.ALLOW_MOCK_LLM === 'true' || process.env.NODE_ENV === 'test';
    return {
      ready: mockReady,
      label: mockReady ? 'Mock provider allowed by deployment flag' : 'Connect OpenAI or Claude',
      provider: 'mock',
      credentialStatus: mockReady ? 'configured' : 'missing',
    };
  }

  const credential = await prisma.llmProviderCredential.findUnique({
    where: {
      owner_user_id_provider: {
        owner_user_id: userId,
        provider: selected,
      },
    },
  });
  const ready = Boolean(credential?.is_active);
  return {
    ready,
    label: ready ? `${selected} / ${credential?.model || 'model configured'}` : `${selected} credential missing`,
    provider: selected,
    credentialStatus: ready ? 'configured' : 'missing',
  };
}

function isSocialCampaign(campaign: { channel: string; target_platforms: string[] }): boolean {
  if (campaign.channel === 'social_media') return true;
  return campaign.target_platforms.some(platform => SOCIAL_PLATFORMS.has(platform.toLowerCase()));
}

function uniqueCampaigns<T extends { raw_message: string; objective: string; audience: string | null }>(campaigns: T[]): T[] {
  return campaigns.filter((campaign, index, allCampaigns) => {
    const key = [
      campaign.raw_message || '',
      campaign.objective || '',
      campaign.audience || '',
    ].join('|').toLowerCase();
    return allCampaigns.findIndex(item => [
      item.raw_message || '',
      item.objective || '',
      item.audience || '',
    ].join('|').toLowerCase() === key) === index;
  });
}

function toCampaignFact(campaign: {
  id: string;
  raw_message: string;
  objective: string;
  status: string;
  risk_category: string;
  target_platforms: string[];
}): WorkflowCampaignFact {
  return {
    id: campaign.id,
    title: campaignTitle(campaign.raw_message, campaign.objective),
    objective: campaignObjective(campaign.objective, campaign.raw_message),
    status: campaign.status,
    riskCategory: campaign.risk_category,
    platforms: campaign.target_platforms,
  };
}

function campaignTitle(rawMessage: string, objective: string): string {
  const match = `${objective}\n${rawMessage}`.match(/Campaign:\s*([^\n]+)/i);
  if (match?.[1]) return match[1].trim();
  return rawMessage.split('\n')[0]?.trim() || objective.split('\n')[0]?.trim() || 'Commercial/Social campaign';
}

function campaignObjective(objective: string, rawMessage: string): string {
  const match = `${objective}\n${rawMessage}`.match(/Objective:\s*([^\n]+)/i);
  if (match?.[1]) return match[1].trim();
  return objective.split('\n')[0]?.trim() || rawMessage.split('\n')[0]?.trim() || 'Campaign objective pending';
}

function normalizeObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

async function checkPostizReachable(baseUrl: string): Promise<boolean> {
  if (!baseUrl) return false;
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/auth/login`, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(2500),
    });
    return response.status < 500;
  } catch {
    return false;
  }
}

async function countPostizChannels(baseUrl: string, apiKey: string): Promise<number> {
  if (!baseUrl || !apiKey) return 0;
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/public/v1/integrations`, {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) return 0;
    const body = await response.json().catch(() => []);
    return Array.isArray(body) ? body.length : 0;
  } catch {
    return 0;
  }
}
