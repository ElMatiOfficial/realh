import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { generateLiveCode, verifyLiveCode } from '../services/liveCodeService.js';

const generateSchema = z.object({
  note: z.string().trim().max(140).optional(),
});

// Length bounds only — normalization and the strict alphabet check live in
// the service so the route stays a thin shell. 32 accommodates a formatted
// code with generous copy-paste debris.
const verifySchema = z.object({
  code: z.string().min(4).max(32),
});

const router = Router();

// POST /api/v1/live-codes — generate a single-use live code (verified users only)
router.post('/', authenticate, validate(generateSchema), async (req, res, next) => {
  try {
    const result = await generateLiveCode(req.user, { note: req.body.note });
    res.status(201).json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/live-codes/verify — redeem a code. Public, unauthenticated,
// rate-limited (see liveCodeVerifyLimiter in app.js). Every outcome is a 200
// with valid: true|false — a wrong code is a result, not an HTTP error.
router.post('/verify', validate(verifySchema), async (req, res, next) => {
  try {
    const result = await verifyLiveCode(req.body.code);
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
