import { validateOrThrow } from '@shared/validation';
import {
  createDisciplineRecordSchema,
  listDisciplineRecordsQuerySchema,
  updateDisciplineRecordSchema,
} from './types';

export function validateCreateDisciplineRecord(data: unknown) {
  return validateOrThrow(createDisciplineRecordSchema, data);
}

export function validateUpdateDisciplineRecord(data: unknown) {
  return validateOrThrow(updateDisciplineRecordSchema, data);
}

export function validateListDisciplineRecordsQuery(data: unknown) {
  return validateOrThrow(listDisciplineRecordsQuerySchema, data);
}
