import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { getDataLayer } from '../data/index.js';

// The display name is shown verbatim to third parties on the public live-code
// verify page, so it gets the strictest input treatment in the codebase:
// trimmed, length-bounded, and stripped of control/format characters (which
// cover RTL-override and zero-width spoofing tricks).
const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .transform((s) => s.replace(/[\p{Cc}\p{Cf}]/gu, ''))
    .refine((s) => s.length >= 2, { message: 'Display name too short after sanitization' }),
});

function profilePayload(user) {
  return {
    displayName: user.displayName || null,
    humanId: user.humanId,
    isVerified: user.isVerified,
    verifiedAt: user.verifiedAt,
    verificationProvider: user.verificationProvider,
    credentialCount: user.credentialCount || 0,
    joinedAt: user.joinedAt,
  };
}

const router = Router();

// GET /api/v1/me — returns the authenticated user's profile
router.get('/me', authenticate, async (req, res, next) => {
  try {
    res.json({ ok: true, data: profilePayload(req.user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/me/profile — update the public display name
router.post('/me/profile', authenticate, validate(profileSchema), async (req, res, next) => {
  try {
    const db = getDataLayer();
    await db.updateUser(req.uid, { displayName: req.body.displayName });
    const user = await db.getUser(req.uid);
    res.json({ ok: true, data: profilePayload(user) });
  } catch (err) {
    next(err);
  }
});

export default router;
