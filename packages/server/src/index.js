import { config } from './config.js';
import { initializeKeys } from './services/keyManager.js';
import { initializeDataLayer } from './data/index.js';
import { initializeProviders } from './providers/index.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

async function main() {
  logger.info({ mode: config.demoMode ? 'demo' : 'production' }, 'RealH API starting');

  await initializeKeys(process.env.KEYS_DIR || 'keys');
  await initializeDataLayer(config);
  initializeProviders(config);

  const app = createApp();
  app.listen(config.port, () => {
    logger.info(
      {
        url: config.serverBaseUrl,
        mode: config.demoMode ? 'demo' : 'production',
        jwks: `${config.serverBaseUrl}/.well-known/jwks.json`,
        did: `${config.serverBaseUrl}/.well-known/did.json`,
        health: `${config.serverBaseUrl}/health`,
      },
      'RealH API listening'
    );
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'failed to start server');
  process.exit(1);
});
