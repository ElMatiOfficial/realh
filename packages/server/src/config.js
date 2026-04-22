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
