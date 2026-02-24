import { randomUUID } from 'crypto';
import { getDataLayer } from '../data/index.js';
import { getProvider, listProviders } from '../providers/index.js';
import { generateHumanId } from '../utils/humanId.js';
import { AppError, NotFoundError } from '../utils/errors.js';

export function getAvailableProviders() {
  return listProviders();
}

export async function initiateVerification(uid, providerId, serverBaseUrl) {
  const provider = getProvider(providerId);
  if (!provider) {
    throw new NotFoundError(`Provider '${providerId}' not found`);
  }

  const sessionId = 'vs_' + randomUUID().replace(/-/g, '').substring(0, 24);
  const callbackUrl = `${serverBaseUrl}/api/v1/verification/callback`;

  const { url, state } = await provider.getAuthorizationUrl(sessionId, callbackUrl);

  const db = getDataLayer();
  await db.createVerificationSession(sessionId, {
    userId: uid,
    providerId,
    state,
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  });

  return {
    sessionId,
    redirectUrl: url,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };
}

export async function completeVerification(sessionId, params) {
  const db = getDataLayer();
  const session = await db.getVerificationSession(sessionId);

  if (!session) {
    throw new NotFoundError('Verification session not found or expired');
  }
  if (session.status !== 'pending') {
    throw new AppError('SESSION_ALREADY_PROCESSED', 'This session has already been processed');
  }
  if (new Date(session.expiresAt) < new Date()) {
    throw new AppError('SESSION_EXPIRED', 'Verification session has expired');
  }

  const provider = getProvider(session.providerId);
  if (!provider) {
    throw new NotFoundError(`Provider '${session.providerId}' not found`);
  }

  const result = await provider.handleCallback(params, session.state);

  if (result.success) {
    const humanId = generateHumanId();

    await db.updateUser(session.userId, {
      isVerified: true,
      humanId,
      verifiedAt: new Date().toISOString(),
      verificationProvider: session.providerId,
    });

    await db.updateVerificationSession(sessionId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });

    return { success: true, humanId };
  } else {
    await db.updateVerificationSession(sessionId, {
      status: 'failed',
      completedAt: new Date().toISOString(),
    });

    return { success: false, error: result.errorMessage };
  }
}
