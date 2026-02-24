import { config } from './config.js';
import { initializeKeys } from './services/keyManager.js';
import { initializeDataLayer } from './data/index.js';
import { initializeProviders } from './providers/index.js';
import { createApp } from './app.js';

async function main() {
  console.log(`Starting HumanLedger API server (${config.demoMode ? 'DEMO' : 'PRODUCTION'} mode)...`);

  // Initialize subsystems
  await initializeKeys(process.env.KEYS_DIR || 'keys');
  await initializeDataLayer(config);
  initializeProviders(config);

  // Create and start Express app
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`HumanLedger API running at ${config.serverBaseUrl}`);
    console.log(`  Mode:       ${config.demoMode ? 'DEMO (in-memory)' : 'PRODUCTION (Firebase)'}`);
    console.log(`  JWKS:       ${config.serverBaseUrl}/.well-known/jwks.json`);
    console.log(`  DID:        ${config.serverBaseUrl}/.well-known/did.json`);
    console.log(`  Health:     ${config.serverBaseUrl}/health`);
  });
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
