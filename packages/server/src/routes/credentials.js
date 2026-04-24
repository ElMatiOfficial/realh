import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { getDataLayer } from '../data/index.js';
import {
  issueCredential,
  verifyCredential,
  issueHumanVerificationToken,
} from '../services/credentialService.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';

// Input schemas. Shape of each must match what the handler destructures below;
// keeping them colocated with the routes makes drift between declared inputs
// and consumed fields cheap to catch in review.
const issueSchema = z.object({
  title: z.string().min(1).max(1000),
  contentHash: z.string().regex(/^[a-fA-F0-9]{64}$/, 'must be 64 hex chars (SHA-256)'),
  contentType: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
});

const verifyCredentialSchema = z.object({
  credential: z.object({}).passthrough(), // full shape validated by verifyCredential()
});

const verifyHumanSchema = z.object({
  humanId: z.string().min(1).max(128),
  audience: z.union([z.string().min(1).max(512), z.array(z.string().min(1).max(512)).max(10)]).optional(),
});

const router = Router();

// POST /api/v1/credentials/issue — issue a W3C VC for a creative work
router.post('/issue', authenticate, validate(issueSchema), async (req, res, next) => {
  try {
    const user = req.user;
    if (!user.isVerified) {
      throw new ForbiddenError();
    }

    const { title, contentHash, contentType, description } = req.body;
    const hostname = req.hostname || 'localhost';
    const { credential, credentialId } = await issueCredential({
      humanId: user.humanId,
      title,
      contentHash,
      contentType,
      hostname,
    });

    // Store credential record
    const db = getDataLayer();
    await db.createCredential(credentialId, {
      userId: req.uid,
      humanId: user.humanId,
      title,
      description: description || '',
      contentHash,
      contentType: contentType || 'application/octet-stream',
      issuedAt: new Date().toISOString(),
      credential,
    });

    // Increment credential count
    await db.updateUser(req.uid, {
      credentialCount: (user.credentialCount || 0) + 1,
    });

    res.json({ ok: true, data: { credential, credentialId } });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/credentials — list user's credentials
router.get('/', authenticate, async (req, res, next) => {
  try {
    const db = getDataLayer();
    const credentials = await db.listCredentialsByUser(req.uid);
    res.json({
      ok: true,
      data: {
        credentials: credentials.map(c => ({
          credentialId: c.credentialId,
          title: c.title,
          contentHash: c.contentHash,
          issuedAt: c.issuedAt,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/credentials/:credentialId — get full credential
router.get('/:credentialId', authenticate, async (req, res, next) => {
  try {
    const db = getDataLayer();
    const record = await db.getCredential(req.params.credentialId);
    if (!record || record.userId !== req.uid) {
      throw new NotFoundError('Credential not found');
    }
    res.json({ ok: true, data: { credential: record.credential } });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/verify — public: verify a W3C VC
router.post('/verify', validate(verifyCredentialSchema), async (req, res, next) => {
  try {
    const { credential } = req.body;
    const result = await verifyCredential(credential);
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/verify/human — public: check if a humanId is verified.
// Optional `audience` in the body scopes the JWT's `aud` claim to a specific
// relying party; omitting it yields an audience-less token that any RP would
// accept (not recommended in production).
router.post('/verify/human', validate(verifyHumanSchema), async (req, res, next) => {
  try {
    const { humanId, audience } = req.body;

    const db = getDataLayer();
    const found = await db.findVerifiedUserByHumanId(humanId);

    if (!found) {
      return res.json({
        ok: true,
        data: { verified: false, token: null, expiresAt: null },
      });
    }

    const hostname = req.hostname || 'localhost';
    const token = await issueHumanVerificationToken(humanId, hostname, audience);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    res.json({
      ok: true,
      data: { verified: true, token, expiresAt },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
