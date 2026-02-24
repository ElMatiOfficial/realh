import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import verificationRoutes from './routes/verification.js';
import credentialRoutes from './routes/credentials.js';
import wellknownRoutes from './routes/wellknown.js';

export function createApp() {
  const app = express();

  // Global middleware
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.clientBaseUrl, credentials: true }));
  app.use(morgan('dev'));
  app.use(express.json());

  // Rate limiting
  app.use('/api/', apiLimiter);

  // Well-known endpoints (public, no auth)
  app.use('/.well-known', wellknownRoutes);

  // API routes
  app.use('/api/v1', authRoutes);
  app.use('/api/v1/verification', verificationRoutes);
  app.use('/api/v1/credentials', credentialRoutes);

  // Public verification endpoints (mounted at /api/v1)
  // These are already in credentialRoutes as /verify and /verify/human

  // Health check
  app.get('/health', (req, res) => {
    res.json({ ok: true, mode: config.demoMode ? 'demo' : 'production' });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
