import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { getDataLayer } from '../data/index.js';

const router = Router();

// GET /api/v1/me — returns the authenticated user's profile
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = req.user;
    res.json({
      ok: true,
      data: {
        humanId: user.humanId,
        isVerified: user.isVerified,
        verifiedAt: user.verifiedAt,
        verificationProvider: user.verificationProvider,
        credentialCount: user.credentialCount || 0,
        joinedAt: user.joinedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
