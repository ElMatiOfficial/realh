import { MemoryDataLayer } from './memory.js';

let dataLayer = null;

export async function initializeDataLayer(config) {
  if (config.demoMode) {
    dataLayer = new MemoryDataLayer();
  } else {
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
  }
  return dataLayer;
}

export function getDataLayer() {
  if (!dataLayer) throw new Error('Data layer not initialized');
  return dataLayer;
}
