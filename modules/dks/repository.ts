import { prisma } from '@shared/database';
import { NotFoundError } from '@shared/errors';
import type { Prisma } from '@prisma/client';
import type {
  CreateDksEntryInput, UpdateDksEntryInput, LinkDecisionToDksInput,
  DksEntrySummary, DecisionDksLinkSummary,
} from './types';

export async function createDksEntry(input: CreateDksEntryInput): Promise<DksEntrySummary> {
  const entry = await prisma.dksEntry.create({
    data: {
      title: input.title,
      description: input.description,
      source: input.source,
      source_type: input.sourceType,
      version: input.version,
      confidence: input.confidence,
      owner: input.owner,
      tags: input.tags,
      summary: input.summary,
      content: input.content as Prisma.InputJsonValue | undefined,
    },
  });
  return mapDksEntry(entry);
}

export async function getDksEntryById(id: string): Promise<DksEntrySummary> {
  const entry = await prisma.dksEntry.findUnique({ where: { id } });
  if (!entry) throw new NotFoundError('DksEntry', id);
  return mapDksEntry(entry);
}

export async function listDksEntries(filters?: { sourceType?: string; owner?: string; tags?: string[] }): Promise<DksEntrySummary[]> {
  const where: Record<string, unknown> = {};
  if (filters?.sourceType) where.source_type = filters.sourceType;
  if (filters?.owner) where.owner = filters.owner;
  if (filters?.tags && filters.tags.length > 0) where.tags = { hasSome: filters.tags };

  const entries = await prisma.dksEntry.findMany({
    where,
    orderBy: { created_at: 'desc' },
  });
  return entries.map(mapDksEntry);
}

export async function updateDksEntry(id: string, input: UpdateDksEntryInput): Promise<DksEntrySummary> {
  const existing = await prisma.dksEntry.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('DksEntry', id);

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.source !== undefined) data.source = input.source;
  if (input.sourceType !== undefined) data.source_type = input.sourceType;
  if (input.version !== undefined) data.version = input.version;
  if (input.confidence !== undefined) data.confidence = input.confidence;
  if (input.freshnessStatus !== undefined) data.freshness_status = input.freshnessStatus;
  if (input.owner !== undefined) data.owner = input.owner;
  if (input.tags !== undefined) data.tags = input.tags;
  if (input.summary !== undefined) data.summary = input.summary;
  if (input.content !== undefined) data.content = input.content as Prisma.InputJsonValue;

  const entry = await prisma.dksEntry.update({
    where: { id },
    data,
  });
  return mapDksEntry(entry);
}

export async function linkDecisionToDks(input: LinkDecisionToDksInput): Promise<DecisionDksLinkSummary> {
  const link = await prisma.decisionDksLink.create({
    data: {
      decision_id: input.decisionId,
      dks_entry_id: input.dksEntryId,
      link_context: input.linkContext,
    },
  });
  return mapDecisionDksLink(link);
}

export async function getDksLinksForDecision(decisionId: string): Promise<DecisionDksLinkSummary[]> {
  const links = await prisma.decisionDksLink.findMany({
    where: { decision_id: decisionId },
    orderBy: { created_at: 'desc' },
  });
  return links.map(mapDecisionDksLink);
}

export async function getDecisionLinksForDks(dksEntryId: string): Promise<DecisionDksLinkSummary[]> {
  const links = await prisma.decisionDksLink.findMany({
    where: { dks_entry_id: dksEntryId },
    orderBy: { created_at: 'desc' },
  });
  return links.map(mapDecisionDksLink);
}

function mapDksEntry(e: Record<string, unknown>): DksEntrySummary {
  return {
    id: e.id as string,
    title: e.title as string,
    description: e.description as string | null,
    source: e.source as string | null,
    sourceType: e.source_type as DksEntrySummary['sourceType'],
    version: e.version as string | null,
    confidence: e.confidence as string,
    lastReviewedAt: e.last_reviewed_at as Date | null,
    freshnessStatus: e.freshness_status as DksEntrySummary['freshnessStatus'],
    owner: e.owner as string | null,
    tags: e.tags as string[],
    summary: e.summary as string | null,
    content: e.content as Record<string, unknown> | null,
    createdAt: e.created_at as Date,
    updatedAt: e.updated_at as Date,
  };
}

function mapDecisionDksLink(l: Record<string, unknown>): DecisionDksLinkSummary {
  return {
    id: l.id as string,
    decisionId: l.decision_id as string,
    dksEntryId: l.dks_entry_id as string,
    linkContext: l.link_context as string,
    createdAt: l.created_at as Date,
  };
}
