import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import { apiLimiter, verifyLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import verificationRoutes from './routes/verification.js';
import credentialRoutes from './routes/credentials.js';
import wellknownRoutes from './routes/wellknown.js';

export function createApp() {
  const app = express();

  // Trust the first proxy in front of us (Cloud Run, nginx, Cloudflare, etc.)
  // so req.ip and rate-limit keys reflect the real client, not the load balancer.
  app.set('trust proxy', 1);

  // Security headers. CSP is tuned for this app:
  //   - the demo /api/v1/verification/mock-demo/authorize route serves inline <style>,
  //     so style-src allows 'unsafe-inline'. Script-src is strict ('self').
  //   - default-src 'none' forces every resource type to be opted in explicitly.
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
  }));

  // CORS: explicit allowlist from config. Rejects credentialed requests from
  // origins that aren't in the list. No wildcard, ever. The comparison is
  // against URL-normalized origins (see config.js) — not raw string equality —
  // to defeat suffix tricks like "http://localhost:3001.attacker.com".
  app.use(cors({
    origin(origin, cb) {
      // Allow same-origin / non-browser callers (curl, server-to-server) which send no Origin.
      if (!origin) return cb(null, true);
      try {
        const normalized = new URL(origin).origin;
        if (config.corsOriginsNormalized.has(normalized)) return cb(null, true);
      } catch {
        // Unparseable Origin header — fall through to reject.
      }
      return cb(new Error(`CORS: origin "${origin}" not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    maxAge: 600,
  }));

  app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
  app.use(express.json({ limit: config.jsonBodyLimit }));

  // Blanket limiter for the whole API surface.
  app.use('/api/', apiLimiter);

  // Well-known endpoints (public, no auth).
  app.use('/.well-known', wellknownRoutes);

  // Public verification endpoints are the highest-value abuse target — they're
  // unauthenticated and touch the signing key indirectly. Tighter per-minute
  // limiter in addition to the general one above.
  app.use('/api/v1/verify', verifyLimiter);

  // API routes.
  app.use('/api/v1', authRoutes);
  app.use('/api/v1/verification', verificationRoutes);
  app.use('/api/v1/credentials', credentialRoutes);

  // Health check.
  app.get('/health', (req, res) => {
    res.json({ ok: true, mode: config.demoMode ? 'demo' : 'production' });
  });

  // Error handler (must be last).
  app.use(errorHandler);

  return app;
}
