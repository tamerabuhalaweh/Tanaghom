import { z } from 'zod';

export const csvRowSchema = z.record(z.string(), z.string());

export const csvDryRunSchema = z.object({
  mappingId: z.string().uuid('Invalid mapping ID'),
  eventId: z.string().uuid('Invalid event ID'),
  rows: z.array(csvRowSchema).min(1, 'At least one row required').max(10000, 'Maximum 10000 rows per import'),
});

export const csvApproveImportSchema = z.object({
  mappingId: z.string().uuid('Invalid mapping ID'),
  eventId: z.string().uuid('Invalid event ID'),
  notes: z.string().max(2000).optional(),
});

export type CsvRow = z.infer<typeof csvRowSchema>;
export type CsvDryRunInput = z.infer<typeof csvDryRunSchema>;
export type CsvApproveImportInput = z.infer<typeof csvApproveImportSchema>;

export interface CsvDryRunResult {
  mappingId: string;
  eventId: string;
  mappingUpdatedAt: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  kpiRows: Array<{
    metricDate: string;
    channel: string;
    reach: number;
    impressions: number;
    interactions: number;
    clicks: number;
    formCompletions: number;
    leads: number;
    meetingsBooked: number;
    meetingsAttended: number;
    purchases: number;
    noShows: number;
    spend: number;
    notes: string | null;
  }>;
  validationErrors: Array<{
    row: number;
    field: string;
    error: string;
  }>;
  warnings: string[];
}

export interface CsvImportResult {
  mappingId: string;
  eventId: string;
  imported: {
    kpiRecords: number;
  };
  auditRecordId: string;
}
