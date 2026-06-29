import type { Prisma } from '@prisma/client';

export const DEFAULT_PRODUCTION_PLAN_KEY = 'commercial_social_production';

export const DEFAULT_PRODUCTION_ENTITLEMENTS = {
  maxUsers: 25,
  maxCampaigns: 500,
  aiProviderCredentials: true,
  postizSandboxScheduling: true,
  postizLiveScheduling: 'requires_customer_channel_and_authorization',
  socialOAuth: 'customer_configured',
  goHighLevel: 'customer_configured',
  smartLabsVoice: 'customer_configured',
  whatsApp: 'customer_configured',
  telegram: 'customer_configured',
  mfaRequiredForAdmins: true,
  tenantExport: true,
  tenantPurgeReview: true,
  auditRetention: 'preserve',
} satisfies Record<string, unknown>;

const ACTIVE_STATUSES = new Set(['trialing', 'active']);

export interface SubscriptionHealthInput {
  tenantStatus: string;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: Date | string | null;
  entitlements?: unknown;
  entitlementOverrides?: unknown;
}

export function normalizeEntitlements(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function mergeEntitlements(base: unknown, override: unknown): Record<string, unknown> {
  return {
    ...normalizeEntitlements(base),
    ...normalizeEntitlements(override),
  };
}

export function buildSubscriptionHealth(input: SubscriptionHealthInput) {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const status = input.subscriptionStatus || 'missing';
  const periodEnd = input.currentPeriodEnd ? new Date(input.currentPeriodEnd) : null;
  const periodExpired = periodEnd ? periodEnd.getTime() < Date.now() : false;

  if (input.tenantStatus !== 'active') {
    blockers.push(`Tenant is ${input.tenantStatus}.`);
  }
  if (!ACTIVE_STATUSES.has(status)) {
    blockers.push(status === 'missing' ? 'No current tenant subscription is configured.' : `Subscription is ${status}.`);
  }
  if (periodExpired) {
    blockers.push('Current subscription period has expired.');
  }
  if (status === 'trialing' && !periodEnd) {
    warnings.push('Trial subscription has no trial/current period end date.');
  }

  const entitlements = mergeEntitlements(input.entitlements, input.entitlementOverrides);

  return {
    serviceAccess: blockers.length === 0,
    status,
    periodExpired,
    blockers,
    warnings,
    entitlements,
    productionPaymentProvider: 'not_configured',
    billingCollection: 'external_or_manual_until_payment_provider_connected',
  };
}

export function sanitizeSubscriptionEventState(value: unknown): Prisma.InputJsonValue {
  if (!value || typeof value !== 'object') return {};
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
