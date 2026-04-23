import 'dotenv/config';

const clientBaseUrl = process.env.CLIENT_BASE_URL || 'http://localhost:5173';

// CORS_ORIGINS is an optional comma-separated allowlist (e.g. "https://app.example.com,https://admin.example.com").
// If unset, we fall back to CLIENT_BASE_URL so single-origin deployments keep working.
// We never accept "*" with credentials: a spec violation that many browsers reject anyway.
const corsOrigins = (process.env.CORS_ORIGINS || clientBaseUrl)
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  demoMode: process.env.DEMO_MODE !== 'false',
  serverBaseUrl: process.env.SERVER_BASE_URL || 'http://localhost:3001',
  clientBaseUrl,
  corsOrigins,
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || '256kb',
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || 'realh-poc',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
};

// Refuse to boot with DEMO_MODE active in a production environment.
// Demo mode accepts a bearer token that starts with "demo_" without any
// cryptographic verification — harmless for local dev, catastrophic if an
// operator ships a prod deployment with DEMO_MODE=true unset from the default.
// Fail loudly at import time so it surfaces in startup logs, not after the
// server starts serving unauthenticated requests.
if (config.nodeEnv === 'production' && config.demoMode) {
  console.error(
    [
      '',
      'FATAL: DEMO_MODE=true while NODE_ENV=production.',
      '',
      'Demo mode uses a mock identity provider and accepts demo bearer tokens',
      'without cryptographic verification. It must never run in production.',
      '',
      'Fix:',
      '  - Set DEMO_MODE=false (and provide real Firebase + provider config), or',
      '  - Set NODE_ENV=development if this is actually a dev/demo deployment.',
      '',
    ].join('\n')
  );
  process.exit(1);
}
