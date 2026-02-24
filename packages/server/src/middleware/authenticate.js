import { config } from '../config.js';
import { getDataLayer } from '../data/index.js';
import { UnauthorizedError } from '../utils/errors.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];
    let uid, email;

    if (config.demoMode) {
      // In demo mode, token format is "demo_<uid>" or we decode a simple base64
      if (token.startsWith('demo_')) {
        uid = token;
        email = 'demo@humanledger.dev';
      } else {
        // Try to parse as JSON base64 (from Firebase client SDK mock)
        try {
          const payload = JSON.parse(Buffer.from(token.split('.')[1] || token, 'base64').toString());
          uid = payload.user_id || payload.sub || payload.uid;
          email = payload.email;
        } catch {
          throw new UnauthorizedError('Invalid demo token');
        }
      }
    } else {
      // Real Firebase Admin SDK token verification
      const admin = await import('firebase-admin');
      const decoded = await admin.default.auth().verifyIdToken(token);
      uid = decoded.uid;
      email = decoded.email;
    }

    if (!uid) {
      throw new UnauthorizedError('Could not extract user ID from token');
    }

    // Ensure user exists in data layer (auto-create on first request)
    const db = getDataLayer();
    let user = await db.getUser(uid);
    if (!user) {
      await db.createUser(uid, {
        email: email || 'unknown',
        isVerified: false,
        humanId: null,
        verifiedAt: null,
        verificationProvider: null,
        credentialCount: 0,
        joinedAt: new Date().toISOString(),
      });
      user = await db.getUser(uid);
    }

    req.user = user;
    req.uid = uid;
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      next(err);
    } else {
      next(new UnauthorizedError(err.message));
    }
  }
}
