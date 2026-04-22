/**
 * KMS-backed key manager — adapter template.
 *
 * The default `keyManager.js` reads / writes an Ed25519 private key to the local
 * filesystem, which is appropriate for development but NOT for production. A
 * leaked signing key lets an attacker forge credentials that verify against the
 * public JWKS — it is a critical incident.
 *
 * In production, the private key should never leave the KMS. This module
 * defines the same public surface as `keyManager.js` so it can be swapped in
 * without touching call sites. The private key is represented as a KMS handle;
 * signing is delegated to the KMS; only the public JWK ever sits in process
 * memory.
 *
 * Implementation sketch (pick one):
 *
 *   GCP KMS (ed25519 asymmetric signing key):
 *     import {KeyManagementServiceClient} from '@google-cloud/kms';
 *     const client = new KeyManagementServiceClient();
 *     const keyName = client.cryptoKeyVersionPath(project, location, keyring, key, version);
 *     // sign: client.asymmetricSign({name: keyName, data})
 *     // publicKey: client.getPublicKey({name: keyName}) -> PEM -> JWK
 *
 *   AWS KMS (ed25519 asymmetric, SIGN_VERIFY):
 *     import {KMSClient, SignCommand, GetPublicKeyCommand} from '@aws-sdk/client-kms';
 *     // sign: new SignCommand({KeyId, Message, MessageType:'RAW', SigningAlgorithm:'ECDSA_...'})
 *     // Note: AWS KMS Ed25519 support varies by region — confirm before choosing.
 *
 *   HashiCorp Vault Transit:
 *     POST /v1/transit/sign/<name> { input: base64(data) }
 *     GET  /v1/transit/keys/<name> -> raw public key -> JWK
 *
 * The `jose` library accepts a custom sign/verify callback via its JWS APIs —
 * that is how you bridge KMS signing into the existing credential service
 * without changing anything else.
 *
 * To wire this in:
 *   1. Set `KEY_MANAGER=kms` and the KMS-specific env vars.
 *   2. Have the startup code import from here instead of `./keyManager.js`
 *      (or route through `./keys/index.js` if you add a factory).
 *   3. Audit: confirm the KMS key is non-exportable, has tight IAM, and is
 *      logged to an append-only audit trail.
 */

const ALG = 'EdDSA';

let publicJwk = null;
let keyId = null;

/**
 * Initialize the KMS-backed manager. Reads the KMS key handle from env,
 * fetches the public JWK once, and caches it.
 *
 * Required env (example, adapt per provider):
 *   KMS_PROVIDER=gcp|aws|vault
 *   KMS_KEY_ID=<provider-specific identifier>
 *   KMS_KEY_KID=<kid to advertise in JWKS, e.g. realh-key-1>
 */
export async function initializeKeys() {
  throw new Error(
    'KmsKeyManager is an adapter template. Implement initializeKeys() for your KMS provider ' +
    'before enabling KEY_MANAGER=kms. See packages/server/src/services/kmsKeyManager.js for notes.'
  );
}

/**
 * The private key is intentionally NOT returned. The KMS never releases it.
 * Callers that need to sign should use `sign()` below instead.
 */
export function getPrivateKey() {
  throw new Error(
    'KMS-backed keys cannot be exported. Use sign() to produce a signature; do not call getPrivateKey().'
  );
}

export function getPublicKey() {
  if (!publicJwk) throw new Error('kmsKeyManager not initialized');
  return publicJwk;
}

export function getPublicJwk() {
  if (!publicJwk) throw new Error('kmsKeyManager not initialized');
  return publicJwk;
}

export function getKeyId() {
  if (!keyId) throw new Error('kmsKeyManager not initialized');
  return keyId;
}

/**
 * Sign raw bytes with the KMS-held private key.
 * Return value MUST be the raw signature bytes; the JWS layer (in
 * `credentialService.js` via `jose`) wraps them into a compact JWS.
 *
 * @param {Uint8Array} data
 * @returns {Promise<Uint8Array>}
 */
export async function sign(_data) {
  throw new Error('sign() not implemented — provide a KMS binding.');
}

export const algorithm = ALG;
