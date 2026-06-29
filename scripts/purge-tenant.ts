import { prisma, disconnectDatabase } from '../shared/database';
import {
  buildTenantPurgeEvaluation,
  readTenantExportEvidence,
  tenantPurgeConfirmationPhrase,
} from '../modules/tenant-admin/lifecycle';

interface ParsedArgs {
  tenantKey: string;
  execute: boolean;
  dryRun: boolean;
  confirmation?: string;
}

interface TenantPurgeState {
  tenantStatus: string;
  activeUsers: number;
  activeMemberships: number;
  activeCredentials: number;
  activeSubscriptions: number;
  pendingApprovals: number;
  pendingPackages: number;
  exportGenerated: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = new Map<string, string | true>();
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [rawKey, ...rawValue] = arg.substring(2).split('=');
    args.set(rawKey, rawValue.length > 0 ? rawValue.join('=') : true);
  }
  const tenantKey = args.get('tenant-key');
  if (!tenantKey || tenantKey === true) {
    throw new Error('Missing required argument: --tenant-key=<tenant_key>');
  }
  const execute = args.has('execute');
  return {
    tenantKey,
    execute,
    dryRun: !execute,
    confirmation: typeof args.get('confirm') === 'string' ? args.get('confirm') as string : undefined,
  };
}

async function collectTenantPurgeState(tenantKey: string): Promise<TenantPurgeState> {
  const tenant = await prisma.tenant.findUnique({ where: { tenant_key: tenantKey } });
  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantKey}`);
  }
  const [activeUsers, activeMemberships, activeCredentials, activeSubscriptions, pendingApprovals, pendingPackages] = await Promise.all([
    prisma.user.count({ where: { tenant_key: tenantKey, is_active: true } }),
    prisma.tenantMembership.count({ where: { tenant_key: tenantKey, is_active: true } }),
    prisma.integrationCredential.count({ where: { tenant_key: tenantKey, is_active: true } }),
    prisma.tenantSubscription.count({ where: { tenant_key: tenantKey, is_current: true, status: { in: ['trialing', 'active', 'past_due'] } } }),
    prisma.approval.count({ where: { tenant_key: tenantKey, approval_status: { in: ['pending', 'escalated'] } } }),
    prisma.publishingPackage.count({ where: { tenant_key: tenantKey, package_status: { in: ['draft', 'validating', 'ready_for_future_execution'] } } }),
  ]);
  return {
    tenantStatus: tenant.status,
    activeUsers,
    activeMemberships,
    activeCredentials,
    activeSubscriptions,
    pendingApprovals,
    pendingPackages,
    exportGenerated: Boolean(readTenantExportEvidence(tenantKey)),
  };
}

async function collectPurgePlanCounts(tenantKey: string) {
  const [userIds, contentItemIds, leadIds, packageIds, subscriptionIds] = await Promise.all([
    prisma.user.findMany({ where: { tenant_key: tenantKey }, select: { id: true } }).then(records => records.map(record => record.id)),
    prisma.contentItem.findMany({ where: { tenant_key: tenantKey }, select: { id: true } }).then(records => records.map(record => record.id)),
    prisma.leadCaptureRecord.findMany({ where: { tenant_key: tenantKey }, select: { id: true } }).then(records => records.map(record => record.id)),
    prisma.publishingPackage.findMany({ where: { tenant_key: tenantKey }, select: { id: true } }).then(records => records.map(record => record.id)),
    prisma.tenantSubscription.findMany({ where: { tenant_key: tenantKey }, select: { id: true } }).then(records => records.map(record => record.id)),
  ]);

  const [
    users,
    memberships,
    agentReps,
    llmCredentials,
    mfaFactors,
    mfaRecoveryCodes,
    onboardingTokens,
    integrationCredentials,
    socialConnections,
    oauthStates,
    langGraphWorkflows,
    commercialWorkflowRuns,
    commercialWorkflowSteps,
    commercialWorkflowEvents,
    contentRequests,
    contentItems,
    draftVersions,
    approvalEvents,
    scheduleEvents,
    approvals,
    publishingPackages,
    publishingPackageItems,
    publishingTargets,
    publishingReadinessChecks,
    publishingManifests,
    publishingExecutionRequests,
    postizPublishingJobs,
    analyticsIngestionRequests,
    analyticsSnapshots,
    campaignPerformanceReports,
    leadCaptureRecords,
    leadSourceAttributions,
    conversionIntents,
    crmHandoffRequests,
    whatsAppHandoffRequests,
    conversionSequencePlans,
    tenantSubscriptions,
    tenantSubscriptionEvents,
  ] = await Promise.all([
    prisma.user.count({ where: { tenant_key: tenantKey } }),
    prisma.tenantMembership.count({ where: { tenant_key: tenantKey } }),
    prisma.agentRep.count({ where: { user_id: { in: userIds } } }),
    prisma.llmProviderCredential.count({ where: { owner_user_id: { in: userIds } } }),
    prisma.userMfaFactor.count({ where: { user_id: { in: userIds } } }),
    prisma.userMfaRecoveryCode.count({ where: { user_id: { in: userIds } } }),
    prisma.userOnboardingToken.count({ where: { user_id: { in: userIds } } }),
    prisma.integrationCredential.count({ where: { tenant_key: tenantKey } }),
    prisma.socialAccountConnection.count({ where: { tenant_key: tenantKey } }),
    prisma.oAuthConnectionState.count({ where: { tenant_key: tenantKey } }),
    prisma.langGraphWorkflow.count({ where: { tenant_key: tenantKey } }),
    prisma.commercialWorkflowRun.count({ where: { tenant_key: tenantKey } }),
    prisma.commercialWorkflowStep.count({ where: { run: { tenant_key: tenantKey } } }),
    prisma.commercialWorkflowRunEvent.count({ where: { run: { tenant_key: tenantKey } } }),
    prisma.contentRequest.count({ where: { tenant_key: tenantKey } }),
    prisma.contentItem.count({ where: { tenant_key: tenantKey } }),
    prisma.draftVersion.count({ where: { content_item_id: { in: contentItemIds } } }),
    prisma.approvalEvent.count({ where: { content_item_id: { in: contentItemIds } } }),
    prisma.scheduleEvent.count({ where: { content_item_id: { in: contentItemIds } } }),
    prisma.approval.count({ where: { tenant_key: tenantKey } }),
    prisma.publishingPackage.count({ where: { tenant_key: tenantKey } }),
    prisma.publishingPackageItem.count({ where: { publishing_package_id: { in: packageIds } } }),
    prisma.publishingTarget.count({ where: { publishing_package_id: { in: packageIds } } }),
    prisma.publishingReadinessCheck.count({ where: { publishing_package_id: { in: packageIds } } }),
    prisma.publishingManifest.count({ where: { publishing_package_id: { in: packageIds } } }),
    prisma.publishingExecutionRequest.count({ where: { publishing_package_id: { in: packageIds } } }),
    prisma.postizPublishingJob.count({ where: { publishing_package_id: { in: packageIds } } }),
    prisma.analyticsIngestionRequest.count({ where: { tenant_key: tenantKey } }),
    prisma.analyticsSnapshot.count({ where: { tenant_key: tenantKey } }),
    prisma.campaignPerformanceReport.count({ where: { tenant_key: tenantKey } }),
    prisma.leadCaptureRecord.count({ where: { tenant_key: tenantKey } }),
    prisma.leadSourceAttribution.count({ where: { lead_capture_record_id: { in: leadIds } } }),
    prisma.conversionIntent.count({ where: { lead_capture_record_id: { in: leadIds } } }),
    prisma.crmHandoffRequest.count({ where: { lead_capture_record_id: { in: leadIds } } }),
    prisma.whatsAppHandoffRequest.count({ where: { lead_capture_record_id: { in: leadIds } } }),
    prisma.conversionSequencePlan.count({ where: { lead_capture_record_id: { in: leadIds } } }),
    prisma.tenantSubscription.count({ where: { tenant_key: tenantKey } }),
    prisma.tenantSubscriptionEvent.count({ where: { subscription_id: { in: subscriptionIds } } }),
  ]);

  return {
    ids: {
      userIds,
      contentItemIds,
      leadIds,
      packageIds,
      subscriptionIds,
    },
    counts: {
      usersToAnonymize: users,
      membershipsToDelete: memberships,
      agentRepsToAnonymize: agentReps,
      llmCredentialsToDelete: llmCredentials,
      mfaFactorsToDelete: mfaFactors,
      mfaRecoveryCodesToDelete: mfaRecoveryCodes,
      onboardingTokensToDelete: onboardingTokens,
      integrationCredentialsToDelete: integrationCredentials,
      socialConnectionsToDelete: socialConnections,
      oauthStatesToDelete: oauthStates,
      langGraphWorkflowsToDelete: langGraphWorkflows,
      commercialWorkflowRunsToDelete: commercialWorkflowRuns,
      commercialWorkflowStepsToCascadeDelete: commercialWorkflowSteps,
      commercialWorkflowEventsToCascadeDelete: commercialWorkflowEvents,
      contentRequestsToDelete: contentRequests,
      contentItemsToDelete: contentItems,
      draftVersionsToDelete: draftVersions,
      approvalEventsToDelete: approvalEvents,
      scheduleEventsToDelete: scheduleEvents,
      approvalsToRedact: approvals,
      publishingPackagesToDelete: publishingPackages,
      publishingPackageItemsToDelete: publishingPackageItems,
      publishingTargetsToDelete: publishingTargets,
      publishingReadinessChecksToDelete: publishingReadinessChecks,
      publishingManifestsToDelete: publishingManifests,
      publishingExecutionRequestsToDelete: publishingExecutionRequests,
      postizPublishingJobsToDelete: postizPublishingJobs,
      analyticsIngestionRequestsToDelete: analyticsIngestionRequests,
      analyticsSnapshotsToDelete: analyticsSnapshots,
      campaignPerformanceReportsToDelete: campaignPerformanceReports,
      leadCaptureRecordsToDelete: leadCaptureRecords,
      leadSourceAttributionsToDelete: leadSourceAttributions,
      conversionIntentsToDelete: conversionIntents,
      crmHandoffRequestsToDelete: crmHandoffRequests,
      whatsAppHandoffRequestsToDelete: whatsAppHandoffRequests,
      conversionSequencePlansToDelete: conversionSequencePlans,
      tenantSubscriptionsToDelete: tenantSubscriptions,
      tenantSubscriptionEventsToDelete: tenantSubscriptionEvents,
    },
  };
}

async function executePurge(tenantKey: string, plan: Awaited<ReturnType<typeof collectPurgePlanCounts>>) {
  const purgedAt = new Date().toISOString();
  await prisma.$transaction(async tx => {
    await tx.integrationCredential.deleteMany({ where: { tenant_key: tenantKey } });
    await tx.socialAccountConnection.deleteMany({ where: { tenant_key: tenantKey } });
    await tx.oAuthConnectionState.deleteMany({ where: { tenant_key: tenantKey } });
    await tx.langGraphWorkflow.deleteMany({ where: { tenant_key: tenantKey } });
    await tx.tenantSubscriptionEvent.deleteMany({ where: { subscription_id: { in: plan.ids.subscriptionIds } } });
    await tx.tenantSubscription.deleteMany({ where: { tenant_key: tenantKey } });

    await tx.llmProviderCredential.deleteMany({ where: { owner_user_id: { in: plan.ids.userIds } } });
    await tx.userMfaRecoveryCode.deleteMany({ where: { user_id: { in: plan.ids.userIds } } });
    await tx.userMfaFactor.deleteMany({ where: { user_id: { in: plan.ids.userIds } } });
    await tx.userOnboardingToken.deleteMany({ where: { user_id: { in: plan.ids.userIds } } });

    await tx.crmHandoffRequest.deleteMany({ where: { lead_capture_record_id: { in: plan.ids.leadIds } } });
    await tx.whatsAppHandoffRequest.deleteMany({ where: { lead_capture_record_id: { in: plan.ids.leadIds } } });
    await tx.conversionSequencePlan.deleteMany({ where: { lead_capture_record_id: { in: plan.ids.leadIds } } });
    await tx.conversionIntent.deleteMany({ where: { lead_capture_record_id: { in: plan.ids.leadIds } } });
    await tx.leadSourceAttribution.deleteMany({ where: { lead_capture_record_id: { in: plan.ids.leadIds } } });
    await tx.leadCaptureRecord.deleteMany({ where: { tenant_key: tenantKey } });

    await tx.postizPublishingJob.deleteMany({ where: { publishing_package_id: { in: plan.ids.packageIds } } });
    await tx.publishingExecutionRequest.deleteMany({ where: { publishing_package_id: { in: plan.ids.packageIds } } });
    await tx.publishingManifest.deleteMany({ where: { publishing_package_id: { in: plan.ids.packageIds } } });
    await tx.publishingReadinessCheck.deleteMany({ where: { publishing_package_id: { in: plan.ids.packageIds } } });
    await tx.publishingTarget.deleteMany({ where: { publishing_package_id: { in: plan.ids.packageIds } } });
    await tx.publishingPackageItem.deleteMany({ where: { publishing_package_id: { in: plan.ids.packageIds } } });
    await tx.publishingPackage.deleteMany({ where: { tenant_key: tenantKey } });

    await tx.analyticsSnapshot.deleteMany({ where: { tenant_key: tenantKey } });
    await tx.analyticsIngestionRequest.deleteMany({ where: { tenant_key: tenantKey } });
    await tx.campaignPerformanceReport.deleteMany({ where: { tenant_key: tenantKey } });

    await tx.commercialWorkflowRun.deleteMany({ where: { tenant_key: tenantKey } });

    await tx.draftVersion.deleteMany({ where: { content_item_id: { in: plan.ids.contentItemIds } } });
    await tx.approvalEvent.deleteMany({ where: { content_item_id: { in: plan.ids.contentItemIds } } });
    await tx.scheduleEvent.deleteMany({ where: { content_item_id: { in: plan.ids.contentItemIds } } });
    await tx.contentItem.deleteMany({ where: { tenant_key: tenantKey } });
    await tx.contentRequest.deleteMany({ where: { tenant_key: tenantKey } });

    await tx.approval.updateMany({
      where: { tenant_key: tenantKey },
      data: {
        comment: '[redacted by tenant purge]',
        rationale: '[redacted by tenant purge]',
      },
    });
    await tx.agentRep.updateMany({
      where: { user_id: { in: plan.ids.userIds } },
      data: {
        name: 'Purged profile',
        permissions_context: {},
        metadata: { purgedAt },
        status: 'inactive',
      },
    });
    await tx.tenantMembership.deleteMany({ where: { tenant_key: tenantKey } });
    for (const userId of plan.ids.userIds) {
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `purged+${userId}@tanaghum.invalid`,
          name: 'Purged User',
          password_hash: 'purged',
          is_active: false,
        },
      });
    }
    await tx.tenant.update({
      where: { tenant_key: tenantKey },
      data: {
        name: `Purged tenant ${tenantKey}`,
        status: 'archived',
      },
    });
  }, { timeout: 30000 });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = await collectTenantPurgeState(args.tenantKey);
  const evaluation = buildTenantPurgeEvaluation({
    tenantKey: args.tenantKey,
    dryRun: args.dryRun,
    purgeEnabled: process.env.TENANT_PURGE_ENABLED === 'true',
    confirmation: args.confirmation,
    ...state,
  });
  const plan = await collectPurgePlanCounts(args.tenantKey);

  if (!args.execute) {
    console.log(JSON.stringify({
      mode: 'dry_run',
      evaluation,
      plan: plan.counts,
      executeCommand: `TENANT_PURGE_ENABLED=true npm run tenant:purge -- --tenant-key=${args.tenantKey} --execute --confirm=${tenantPurgeConfirmationPhrase(args.tenantKey)}`,
    }, null, 2));
    return;
  }

  if (!evaluation.canExecute) {
    console.error(JSON.stringify({
      mode: 'execute_blocked',
      evaluation,
      plan: plan.counts,
    }, null, 2));
    process.exitCode = 2;
    return;
  }

  await executePurge(args.tenantKey, plan);
  console.log(JSON.stringify({
    mode: 'executed',
    tenantKey: args.tenantKey,
    executionMode: evaluation.supportedExecutionMode,
    plan: plan.counts,
    auditPolicy: evaluation.policy,
  }, null, 2));
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
