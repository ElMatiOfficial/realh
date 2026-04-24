// Public signer API for the rest of the app.
//
// All signing goes through this module. Credential issuance, JWT minting, and
// JWKS publication all call these exports — the backend (file vs. KMS) is a
// deployment decision, not a code-path decision.
//
// Environment knobs:
//   KEY_MANAGER        'file' (default) | 'kms'
//   KEYS_DIR           file backend: directory for the JWK pair         (default: 'keys')
//   KMS_PROVIDER       kms backend: 'gcp' (only option supported today)
//   KMS_KEY_ID         kms backend: fully-qualified KMS key version name
//   KMS_KEY_KID        kms backend: 'kid' to advertise (default: 'realh-key-1')

import { FileSigner } from './file.js';
import { KmsGcpSigner } from './kms-gcp.js';

let signer = null;

/**
 * Initialize the signer based on env config. Call once at startup.
 */
export async function initializeSigner({ keysDir = 'keys' } = {}) {
  const backend = process.env.KEY_MANAGER || 'file';

  if (backend === 'kms') {
    const provider = process.env.KMS_PROVIDER || 'gcp';
    if (provider !== 'gcp') {
      throw new Error(`KMS_PROVIDER='${provider}' not implemented. Only 'gcp' is supported today.`);
    }
    const keyName = process.env.KMS_KEY_ID;
    const kid = process.env.KMS_KEY_KID || 'realh-key-1';
    if (!keyName) {
      throw new Error('KEY_MANAGER=kms requires KMS_KEY_ID (fully-qualified KMS key version name)');
    }
    signer = new KmsGcpSigner({ keyName, kid });
    await signer.initialize();
    await signer.selfTest(); // catch misconfigured key + wrong algorithm at boot
    return signer;
  }

  if (backend !== 'file') {
    throw new Error(`Unknown KEY_MANAGER='${backend}'. Expected 'file' or 'kms'.`);
  }

  signer = new FileSigner({ keysDir });
  await signer.initialize();
  return signer;
}

/**
 * For tests and alternative bootstrappers.
 */
export function setSigner(customSigner) {
  signer = customSigner;
}

function _get() {
  if (!signer) throw new Error('Signer not initialized — call initializeSigner() at startup');
  return signer;
}

// Delegators. Module-level functions are the consumer-facing surface.
export function getPublicKey()  { return _get().getPublicKey(); }
export function getPublicJwk()  { return _get().getPublicJwk(); }
export function getKeyId()      { return _get().getKeyId(); }
export function signCompact(payload, header) { return _get().signCompact(payload, header); }
export function signJwt(claims) { return _get().signJwt(claims); }
