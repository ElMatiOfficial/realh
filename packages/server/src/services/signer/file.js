import { generateKeyPair, exportJWK, importJWK, CompactSign, SignJWT } from 'jose';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { logger } from '../../utils/logger.js';

const ALG = 'EdDSA';
const DEFAULT_KEY_ID = 'realh-key-1';

/**
 * File-backed Ed25519 signer. Auto-generates a keypair on first boot and
 * persists it under `keysDir`. Suitable for local development and CI.
 *
 * NOT for production — private keys on disk are a standing liability.
 * Production deployments should use KmsGcpSigner (or equivalent) from
 * kms-gcp.js so the private key never leaves the KMS.
 */
export class FileSigner {
  /**
   * @param {object} opts
   * @param {string} opts.keysDir - Directory the JWK files live in.
   * @param {string} [opts.keyId] - kid to use when generating a new pair.
   *   Ignored when loading an existing pair (the on-disk kid wins).
   */
  constructor({ keysDir, keyId = DEFAULT_KEY_ID }) {
    this.keysDir = path.resolve(keysDir);
    this.defaultKeyId = keyId;
    this._privateKey = null;
    this._publicKey = null;
    this._publicJwk = null;
    this._kid = null;
  }

  async initialize() {
    const privPath = path.join(this.keysDir, 'private.jwk.json');
    const pubPath = path.join(this.keysDir, 'public.jwk.json');

    if (!existsSync(this.keysDir)) await mkdir(this.keysDir, { recursive: true });

    if (existsSync(privPath) && existsSync(pubPath)) {
      const privJwk = JSON.parse(await readFile(privPath, 'utf-8'));
      const pubJwk = JSON.parse(await readFile(pubPath, 'utf-8'));
      this._privateKey = await importJWK(privJwk, ALG);
      this._publicKey = await importJWK(pubJwk, ALG);
      this._publicJwk = pubJwk;
      this._kid = pubJwk.kid;
      logger.info({ kid: this._kid }, 'loaded existing Ed25519 key pair');
      return;
    }

    const pair = await generateKeyPair(ALG, { crv: 'Ed25519' });
    const privJwk = {
      ...(await exportJWK(pair.privateKey)),
      kid: this.defaultKeyId,
      alg: ALG,
      use: 'sig',
    };
    const pubJwk = {
      ...(await exportJWK(pair.publicKey)),
      kid: this.defaultKeyId,
      alg: ALG,
      use: 'sig',
    };
    await writeFile(privPath, JSON.stringify(privJwk, null, 2));
    await writeFile(pubPath, JSON.stringify(pubJwk, null, 2));
    this._privateKey = pair.privateKey;
    this._publicKey = pair.publicKey;
    this._publicJwk = pubJwk;
    this._kid = this.defaultKeyId;
    logger.info({ kid: this._kid, path: this.keysDir }, 'generated new Ed25519 key pair');
  }

  getPublicKey() { this._assertReady(); return this._publicKey; }
  getPublicJwk() { this._assertReady(); return this._publicJwk; }
  getKeyId()     { this._assertReady(); return this._kid; }

  /**
   * Sign `payload` (Uint8Array) as a compact JWS. The protected header's
   * `alg` and `kid` are set automatically and cannot be overridden — those
   * fields describe what the signer actually is, not what the caller asks
   * for.
   */
  async signCompact(payload, header = {}) {
    this._assertReady();
    const protectedHeader = { ...header, alg: ALG, kid: this._kid };
    return new CompactSign(payload)
      .setProtectedHeader(protectedHeader)
      .sign(this._privateKey);
  }

  /**
   * Sign a JWT claims object. `iat` and `exp` are enforced by the caller
   * (see credentialService) — this stays a thin wrapper.
   */
  async signJwt(claims) {
    this._assertReady();
    const builder = new SignJWT(claims)
      .setProtectedHeader({ alg: ALG, kid: this._kid });
    return builder.sign(this._privateKey);
  }

  _assertReady() {
    if (!this._publicKey) {
      throw new Error('FileSigner.initialize() must be awaited before use');
    }
  }
}
