import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// eslint-disable-next-line no-unused-vars -- Express requires 4-arity to recognize this as an error middleware
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    // Known / handled error: log at `info` (we expected it; routine 4xx).
    logger.info(
      { code: err.code, status: err.status, path: req.originalUrl, method: req.method },
      'handled error'
    );
    return res.status(err.status).json({
      ok: false,
      error: { code: err.code, message: err.message },
    });
  }

  // Unhandled: log at `error` with the full serialized error (pino includes
  // err.name, err.message, and err.stack automatically). The HTTP response
  // itself carries only a generic code — no stack, no inner message.
  logger.error(
    { err, path: req.originalUrl, method: req.method },
    'unhandled error'
  );
  res.status(500).json({
    ok: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
}
