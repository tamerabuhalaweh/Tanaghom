import { Request, Response } from 'express';
import { AppError, ValidationError } from '@shared/errors';
import { logger } from '@shared/logging';

export function errorHandler(err: Error, _req: Request, res: Response, _next: unknown): void {
  if (err instanceof AppError) {
    logger.warn(
      { statusCode: err.statusCode, code: err.code, message: err.message },
      'Application error',
    );
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err instanceof ValidationError && err.fields ? { fields: err.fields } : {}),
      },
    });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
