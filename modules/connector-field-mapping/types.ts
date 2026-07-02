import { z } from 'zod';

export const MAPPING_TARGET_TYPES = ['event_kpi_record'] as const;
export type MappingTargetType = (typeof MAPPING_TARGET_TYPES)[number];

export const MAPPING_VALIDATION_STATUSES = ['valid', 'invalid', 'untested'] as const;
export type MappingValidationStatus = (typeof MAPPING_VALIDATION_STATUSES)[number];

export const KPI_FIELD_NAMES = [
  'metricDate', 'channel', 'reach', 'impressions', 'interactions', 'clicks',
  'formCompletions', 'leads', 'meetingsBooked', 'meetingsAttended',
  'purchases', 'noShows', 'spend', 'notes',
] as const;

export const REQUIRED_KPI_FIELDS = ['metricDate', 'channel'] as const;

export const NUMERIC_KPI_FIELDS = [
  'reach', 'impressions', 'interactions', 'clicks',
  'formCompletions', 'leads', 'meetingsBooked', 'meetingsAttended',
  'purchases', 'noShows', 'spend',
] as const;

export const fieldMappingEntrySchema = z.object({
  sourceField: z.string().min(1, 'Source field is required').max(200),
  targetField: z.string().min(1, 'Target field is required').max(200),
  defaultValue: z.string().max(500).optional(),
});

export const createFieldMappingSchema = z.object({
  connectorId: z.string().min(1).max(100),
  eventId: z.string().uuid().optional(),
  displayName: z.string().min(1).max(200),
  targetType: z.enum(MAPPING_TARGET_TYPES).optional(),
  fieldMappings: z.array(fieldMappingEntrySchema).min(1, 'At least one field mapping required'),
});

export const updateFieldMappingSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  targetType: z.enum(MAPPING_TARGET_TYPES).optional(),
  fieldMappings: z.array(fieldMappingEntrySchema).optional(),
});

export type FieldMappingEntry = z.infer<typeof fieldMappingEntrySchema>;
export type CreateFieldMappingInput = z.infer<typeof createFieldMappingSchema>;
export type UpdateFieldMappingInput = z.infer<typeof updateFieldMappingSchema>;

export interface FieldMappingSummary {
  id: string;
  tenantKey: string;
  connectorId: string;
  eventId: string | null;
  displayName: string;
  targetType: MappingTargetType;
  fieldMappings: FieldMappingEntry[];
  validationStatus: MappingValidationStatus;
  validationErrors: string[] | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MappingValidationResult {
  valid: boolean;
  errors: string[];
  missingRequired: string[];
  unknownTargetFields: string[];
}
