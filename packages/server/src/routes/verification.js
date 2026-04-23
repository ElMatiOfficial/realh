import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import {
  getAvailableProviders,
  initiateVerification,
  completeVerification,
} from '../services/verificationService.js';

const initiateSchema = z.object({
  providerId: z.string().min(1).max(64),
});

const router = Router();

// GET /api/v1/verification/providers — list available providers
router.get('/providers', authenticate, (req, res) => {
  res.json({
    ok: true,
    data: { providers: getAvailableProviders() },
  });
});

// POST /api/v1/verification/initiate — start verification with a provider
router.post('/initiate', authenticate, validate(initiateSchema), async (req, res, next) => {
  try {
    const { providerId } = req.body;
    const result = await initiateVerification(req.uid, providerId, config.serverBaseUrl);
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/verification/status — check current verification status
router.get('/status', authenticate, async (req, res) => {
  const user = req.user;
  res.json({
    ok: true,
    data: {
      isVerified: user.isVerified,
      humanId: user.humanId,
      verifiedAt: user.verifiedAt,
      provider: user.verificationProvider,
    },
  });
});

// GET /api/v1/verification/mock-demo/authorize — mock provider's authorization page.
//
// Security hardening (see #SECURITY_REVIEW_2026-04):
//   - Gated on DEMO_MODE. In production the mock provider must not be
//     reachable; returning 404 here makes that contract enforceable from the
//     outside.
//   - The session ID is strictly format-validated against the shape emitted
//     by initiateVerification() ('vs_' + 32 hex chars). Rejects anything
//     injected via the query string.
//   - The callback URL is no longer trusted from the query string; it's built
//     from config.serverBaseUrl. Previously a caller could pass
//     ?callback=https://attacker.example and harvest the session on the
//     Approve click — classic open redirect.
//   - The session is URL-encoded into the href as defense-in-depth even
//     though format-validation already constrains it to URL-safe chars.
const SESSION_RE = /^vs_[a-f0-9]{32}$/;

router.get('/mock-demo/authorize', (req, res) => {
  if (!config.demoMode) {
    return res.status(404).send('Not Found');
  }

  const { session } = req.query;
  if (typeof session !== 'string' || !SESSION_RE.test(session)) {
    return res.status(400).send('Invalid session identifier');
  }

  const callbackUrl = `${config.serverBaseUrl}/api/v1/verification/callback`;
  const denyHref = `${callbackUrl}?session=${encodeURIComponent(session)}&action=deny`;
  const approveHref = `${callbackUrl}?session=${encodeURIComponent(session)}&action=approve`;

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>RealH - Identity Verification</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .card { background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 48px; max-width: 440px; text-align: center; }
        h1 { font-size: 24px; margin-bottom: 8px; }
        .subtitle { color: #94a3b8; margin-bottom: 32px; }
        .badge { display: inline-block; background: rgba(0, 240, 255, 0.1); border: 1px solid rgba(0, 240, 255, 0.3); color: #00f0ff; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 24px; }
        .info { background: rgba(0,0,0,0.3); border-radius: 8px; padding: 16px; margin-bottom: 32px; text-align: left; font-size: 14px; color: #94a3b8; }
        .info strong { color: #e2e8f0; }
        .actions { display: flex; gap: 12px; }
        .btn { flex: 1; padding: 14px; border: none; border-radius: 10px; font-size: 16px; font-weight: 700; cursor: pointer; }
        .btn-approve { background: #00f0ff; color: #0f172a; }
        .btn-approve:hover { background: #22d3ee; }
        .btn-deny { background: transparent; color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); }
        .btn-deny:hover { background: rgba(255,255,255,0.05); }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge">DEMO PROVIDER</div>
        <h1>Identity Verification</h1>
        <p class="subtitle">RealH is requesting to verify your identity.</p>
        <div class="info">
          <p><strong>What happens next:</strong></p>
          <p>In production, this page would be hosted by your country's identity provider (e.g., eIDAS, Login.gov). You would verify using your government ID.</p>
          <br>
          <p>For this demo, click <strong>Approve</strong> to simulate a successful verification.</p>
        </div>
        <div class="actions">
          <a href="${denyHref}" class="btn btn-deny">Deny</a>
          <a href="${approveHref}" class="btn btn-approve">Approve</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

// GET /api/v1/verification/callback — handle provider callback.
//
// The failure branches emit a short, allow-listed error *code* rather than a
// free-form message. Raw error strings from providers or exceptions shouldn't
// be reflected into a browser URL: they can leak stack fragments, internal
// identifiers, or PII through browser history, referrer headers, and any
// client-side logging. The client is expected to map these codes to
// user-facing text.
const REDIRECT_ERROR_CODES = new Set([
  'user_denied',
  'session_expired',
  'session_invalid',
  'provider_error',
  'verification_failed',
  'internal_error',
]);

function safeErrorCode(code) {
  const normalized = String(code || '').toLowerCase();
  return REDIRECT_ERROR_CODES.has(normalized) ? normalized : 'verification_failed';
}

router.get('/callback', async (req, res) => {
  const { session, action } = req.query;
  let redirectUrl;
  try {
    const result = await completeVerification(session, { action });
    if (result.success) {
      const humanId = encodeURIComponent(result.humanId);
      redirectUrl = `${config.clientBaseUrl}/verification/complete?status=success&humanId=${humanId}`;
    } else {
      // Provider-supplied error code, mapped to the allow-list.
      const code = safeErrorCode(result.errorCode);
      redirectUrl = `${config.clientBaseUrl}/verification/complete?status=failed&code=${code}`;
    }
  } catch (err) {
    // Log server-side for operators; never surface err.message to the browser.
    logger.error({ err, session }, 'verification callback failed');
    const code = err?.code ? safeErrorCode(err.code.toLowerCase()) : 'internal_error';
    redirectUrl = `${config.clientBaseUrl}/verification/complete?status=failed&code=${code}`;
  }
  res.redirect(redirectUrl);
});

export default router;
