import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { getDataLayer } from '../data/index.js';
import {
  issueCredential,
  verifyCredential,
  issueHumanVerificationToken,
} from '../services/credentialService.js';
import { isValidSha256 } from '../services/hashService.js';
import { ForbiddenError, AppError, NotFoundError } from '../utils/errors.js';

const router = Router();

// POST /api/v1/credentials/issue — issue a W3C VC for a creative work
router.post('/issue', authenticate, async (req, res, next) => {
  try {
    const user = req.user;
    if (!user.isVerified) {
      throw new ForbiddenError();
    }

    const { title, contentHash, contentType, description } = req.body;
    if (!title || !contentHash) {
      throw new AppError('INVALID_INPUT', 'title and contentHash are required');
    }
    if (!isValidSha256(contentHash)) {
      throw new AppError('INVALID_HASH', 'contentHash must be a valid SHA-256 hex string (64 characters)');
    }

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
router.post('/verify', async (req, res, next) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      throw new AppError('INVALID_INPUT', 'credential is required in request body');
    }
    const result = await verifyCredential(credential);
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/verify/human — public: check if a humanId is verified
router.post('/verify/human', async (req, res, next) => {
  try {
    const { humanId } = req.body;
    if (!humanId) {
      throw new AppError('INVALID_INPUT', 'humanId is required');
    }

    const db = getDataLayer();
    // Search for user with this humanId
    // For MemoryDataLayer, iterate; for Firestore, use a query
    let found = null;
    if (db.users) {
      // Memory data layer
      for (const user of db.users.values()) {
        if (user.humanId === humanId && user.isVerified) {
          found = user;
          break;
        }
      }
    }

    if (!found) {
      return res.json({
        ok: true,
        data: { verified: false, token: null, expiresAt: null },
      });
    }

    const hostname = req.hostname || 'localhost';
    const token = await issueHumanVerificationToken(humanId, hostname);
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
