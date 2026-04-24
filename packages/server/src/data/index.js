import { MemoryDataLayer } from './memory.js';

/** @type {import('./interface.js').DataLayer|null} */
let dataLayer = null;

/**
 * Resolve which data-layer backend to instantiate. Precedence:
 *
 *   1. DEMO_MODE=true            → MemoryDataLayer (unconditional, for dev).
 *   2. DATA_LAYER env var        → explicit backend selection in production.
 *   3. default                   → FirestoreDataLayer (backwards-compatible).
 *
 * The two non-memory backends are lazily imported so non-Postgres deployments
 * don't pay for `pg`, and vice versa for firebase-admin.
 */
export async function initializeDataLayer(config) {
  if (config.demoMode) {
    dataLayer = new MemoryDataLayer();
    return dataLayer;
  }

  const backend = process.env.DATA_LAYER || 'firestore';

  if (backend === 'memory') {
    dataLayer = new MemoryDataLayer();
  } else if (backend === 'postgres') {
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Adopters who need TLS / pool size / idle timeout tuning should set
      // those via a custom pool in a bootstrap script and register the
      // PostgresDataLayer directly rather than letting this factory build
      // the pool.
    });
    const { PostgresDataLayer } = await import('./postgres.js');
    dataLayer = new PostgresDataLayer(pool);
  } else if (backend === 'firestore') {
    const admin = await import('firebase-admin');
    const app = admin.default.initializeApp({
      credential: admin.default.credential.cert({
        projectId: config.firebase.projectId,
        clientEmail: config.firebase.clientEmail,
        privateKey: config.firebase.privateKey,
      }),
    });
    const { FirestoreDataLayer } = await import('./firestore.js');
    dataLayer = new FirestoreDataLayer(app);
  } else {
    throw new Error(
      `Unknown DATA_LAYER '${backend}'. Expected one of: memory, firestore, postgres.`
    );
  }

  return dataLayer;
}

/**
 * @returns {import('./interface.js').DataLayer}
 */
export function getDataLayer() {
  if (!dataLayer) throw new Error('Data layer not initialized');
  return dataLayer;
}
