import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { config } from '../config.js';
import {
  getAvailableProviders,
  initiateVerification,
  completeVerification,
} from '../services/verificationService.js';
import { getDataLayer } from '../data/index.js';

const router = Router();

// GET /api/v1/verification/providers — list available providers
router.get('/providers', authenticate, (req, res) => {
  res.json({
    ok: true,
    data: { providers: getAvailableProviders() },
  });
});

// POST /api/v1/verification/initiate — start verification with a provider
router.post('/initiate', authenticate, async (req, res, next) => {
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

// GET /api/v1/verification/mock-demo/authorize — mock provider's authorization page
router.get('/mock-demo/authorize', (req, res) => {
  const { session, callback } = req.query;
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>HumanLedger - Identity Verification</title>
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
        <p class="subtitle">HumanLedger is requesting to verify your identity.</p>
        <div class="info">
          <p><strong>What happens next:</strong></p>
          <p>In production, this page would be hosted by your country's identity provider (e.g., eIDAS, Login.gov). You would verify using your government ID.</p>
          <br>
          <p>For this demo, click <strong>Approve</strong> to simulate a successful verification.</p>
        </div>
        <div class="actions">
          <a href="${callback}?session=${session}&action=deny" class="btn btn-deny">Deny</a>
          <a href="${callback}?session=${session}&action=approve" class="btn btn-approve">Approve</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

// GET /api/v1/verification/callback — handle provider callback
router.get('/callback', async (req, res, next) => {
  try {
    const { session, action } = req.query;
    const result = await completeVerification(session, { action });

    if (result.success) {
      res.redirect(`${config.clientBaseUrl}/verification/complete?status=success&humanId=${result.humanId}`);
    } else {
      res.redirect(`${config.clientBaseUrl}/verification/complete?status=failed&error=${encodeURIComponent(result.error || 'Verification failed')}`);
    }
  } catch (err) {
    res.redirect(`${config.clientBaseUrl}/verification/complete?status=failed&error=${encodeURIComponent(err.message)}`);
  }
});

export default router;
