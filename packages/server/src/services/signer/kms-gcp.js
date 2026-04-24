import { importSPKI, exportJWK, compactVerify } from 'jose';
import { logger } from '../../utils/logger.js';

/**
 * Ed25519 signer backed by GCP Cloud KMS.
 *
 * The private key never leaves the KMS — every signature is an RPC. This is
 * the property that makes it appropriate for production: a process dump, a
 * disk image, or a compromised container still can't produce forgeries.
 *
 * Shape:
 *   - `initialize()` fetches the PEM public key once, converts to JWK, caches.
 *   - `signCompact()` and `signJwt()` construct the JWS manually — they
 *     base64url-encode the protected header and payload, send the signing
 *     input to KMS.asymmetricSign, then append the returned signature.
 *     `jose` has no public hook for delegated signing, so we bypass it on
 *     the signer side; on the verify side we use the cached public JWK, and
 *     `jose.compactVerify` works unchanged.
 *
 * Prerequisites for production use:
 *   - The KMS key is an asymmetric signing key with purpose
 *     `ASYMMETRIC_SIGN` and algorithm `EC_SIGN_ED25519`.
 *   - IAM: the service account running this process has
 *     `roles/cloudkms.signerVerifier` on the key (NOT on the keyring).
 *   - Audit logging is on for the key's Cloud KMS asymmetricSign operations.
 *   - Key is flagged non-exportable (the default). Confirm via
 *     `gcloud kms keys describe ... --format='value(purpose)'`.
 *
 * What this class does NOT cover:
 *   - Key rotation. A `kid` rename or a multi-version JWKS is a separate
 *     feature — the signer just uses whatever version is configured.
 *   - Integration tests. `@google-cloud/kms` is mocked in unit tests; real
 *     smoke tests require a live KMS key. Flag this explicitly in any PR
 *     that adopts this signer.
 */
export class KmsGcpSigner {
  /**
   * @param {object} opts
   * @param {string} opts.keyName - Fully-qualified KMS key version name, e.g.
   *   `projects/P/locations/L/keyRings/R/cryptoKeys/K/cryptoKeyVersions/1`.
   * @param {string} opts.kid - `kid` advertised in JWKS and set in JWS headers.
   * @param {import('@google-cloud/kms').KeyManagementServiceClient} [opts.client]
   *   - Optional; defaults to a fresh client using ADC. Injectable for tests.
   */
  constructor({ keyName, kid, client = null }) {
    if (!keyName) throw new Error('KmsGcpSigner requires keyName');
    if (!kid) throw new Error('KmsGcpSigner requires kid');
    this.keyName = keyName;
    this.kid = kid;
    this.client = client;
    this._publicJwk = null;
    this._publicKey = null;
  }

  async initialize() {
    if (!this.client) {
      // Lazy import so `@google-cloud/kms` stays an opt-in dependency.
      const { KeyManagementServiceClient } = await import('@google-cloud/kms');
      this.client = new KeyManagementServiceClient();
    }

    const [publicKeyResponse] = await this.client.getPublicKey({ name: this.keyName });
    const pem = publicKeyResponse.pem;
    if (!pem) throw new Error(`KMS getPublicKey returned no PEM for ${this.keyName}`);

    // Parse SPKI PEM → KeyObject → JWK so we can both verify locally AND
    // publish the JWK via /.well-known/jwks.json.
    this._publicKey = await importSPKI(pem, 'EdDSA', { extractable: true });
    const jwk = await exportJWK(this._publicKey);
    this._publicJwk = { ...jwk, kid: this.kid, alg: 'EdDSA', use: 'sig' };

    logger.info({ kid: this.kid, keyName: this.keyName }, 'KMS signer initialized');
  }

  getPublicKey() { this._assertReady(); return this._publicKey; }
  getPublicJwk() { this._assertReady(); return this._publicJwk; }
  getKeyId()     { this._assertReady(); return this.kid; }

  async signCompact(payload, header = {}) {
    this._assertReady();
    const protectedHeader = { ...header, alg: 'EdDSA', kid: this.kid };
    const headerB64 = base64url(Buffer.from(JSON.stringify(protectedHeader)));
    const payloadB64 = base64url(payload);
    const signingInput = `${headerB64}.${payloadB64}`;

    const signature = await this._sign(Buffer.from(signingInput, 'utf8'));
    return `${signingInput}.${base64url(signature)}`;
  }

  async signJwt(claims) {
    // JWT is a JWS over the JSON-serialized claims set. Reuse signCompact.
    const payload = Buffer.from(JSON.stringify(claims), 'utf8');
    return this.signCompact(payload, { typ: 'JWT' });
  }

  /**
   * RPC to KMS. Returned signature is Ed25519-raw (64 bytes) per the KMS
   * spec for EC_SIGN_ED25519. JWS compact-serialization wants the raw bytes
   * base64url-encoded — no DER wrapping or reformatting needed.
   */
  async _sign(message) {
    const [response] = await this.client.asymmetricSign({
      name: this.keyName,
      data: message,
    });
    if (!response.signature) {
      throw new Error(`KMS asymmetricSign returned no signature for ${this.keyName}`);
    }
    return Buffer.from(response.signature);
  }

  _assertReady() {
    if (!this._publicJwk) {
      throw new Error('KmsGcpSigner.initialize() must be awaited before use');
    }
  }

  /**
   * Sanity check: round-trip a sign+verify against our own cached public key.
   * Called on startup in production to catch misconfigured KMS (wrong key
   * purpose, wrong algorithm, wrong key version) before any real traffic
   * lands. Cheap — one extra RPC at boot, not per request.
   */
  async selfTest() {
    const probe = Buffer.from('realh-kms-selftest', 'utf8');
    const jws = await this.signCompact(probe, { typ: 'realh-selftest' });
    await compactVerify(jws, this._publicKey);
  }
}

function base64url(buf) {
  return Buffer.from(buf).toString('base64url');
}
