import { randomBytes } from 'crypto';
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

  // 16 random bytes → 32 hex chars → 128 bits of entropy. Previous version
  // truncated a UUIDv4 to 24 hex chars, discarding ~40 bits of randomness and
  // leaving the session space collision-prone under load.
  const sessionId = 'vs_' + randomBytes(16).toString('hex');
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

    // Return the provider-supplied errorCode (if any) so the route layer can
    // map it to an allow-listed redirect code. `errorMessage` stays internal
    // and is not propagated to the client.
    return {
      success: false,
      errorCode: result.errorCode || null,
      errorMessage: result.errorMessage || null,
    };
  }
}
