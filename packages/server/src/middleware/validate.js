import { AppError } from '../utils/errors.js';

/**
 * Validate `req[source]` (default `body`) against a Zod schema. On success,
 * the parsed value (with default fields populated, unknown keys stripped if the
 * schema uses `.strict()`) replaces `req[source]`. On failure, emits a 400
 * with an `INVALID_INPUT` code and a concise per-field message.
 *
 * Keeps route handlers free of ad-hoc validation and ensures parsed data is
 * the only thing downstream code sees — no "did I check this field yet?" drift
 * as the schema evolves.
 */
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const flat = result.error.flatten();
      const fieldErrors = Object.entries(flat.fieldErrors)
        .map(([k, v]) => `${k}: ${v.join(', ')}`)
        .join('; ');
      const formErrors = flat.formErrors?.join('; ') || '';
      const message = [fieldErrors, formErrors].filter(Boolean).join('; ') || 'Invalid input';
      return next(new AppError('INVALID_INPUT', message, 400));
    }
    req[source] = result.data;
    next();
  };
}
