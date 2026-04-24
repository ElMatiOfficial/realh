# Security architecture

RealH issues cryptographically signed credentials that third parties verify offline. That makes the system's security posture dominated by two questions:

1. **Can the signing key leak?**
2. **Can an unauthorized caller get a credential issued?**

Everything else is secondary. This document describes how each layer answers those questions, and where the production-hardening gaps are relative to the demo.

## Threat model

| Threat | Mitigation | Residual risk |
| --- | --- | --- |
| Signing key exfiltration from disk | `KEY_MANAGER=kms` keeps the key non-exportable in a cloud KMS. In demo, the key is on disk under `packages/server/keys/` — gitignored and never committed. | Demo-mode hosts must not be used in production. Enforced by docs + deploy checklist. |
| Signing key exfiltration from memory | KMS adapter never pulls the private key into Node memory; signing is an RPC. File-based manager holds the key in process memory. | File-based in production is explicitly unsupported. |
| Forgery via weak crypto | Ed25519 (EdDSA) via `jose`. 128-bit security margin; deterministic signatures. | Algorithm change requires a versioned JWKS and a migration plan. |
| Issuing a credential to an un-verified human | Server enforces `user.isVerified` in `routes/credentials.js#/issue`. Verification is driven by the provider adapter; the mock provider is marked as non-production. | Weak identity providers are the weakest link — document this in [PROVIDERS.md](PROVIDERS.md). |
| Tamper with credential post-issuance | Signature covers the full credential payload minus `proof`. `verifyCredential()` re-serializes and compares. | Deterministic canonicalization is JSON-stringify-based — adopt JCS (RFC 8785) before 1.0. |
| Replay of a human-verification JWT | `issueHumanVerificationToken()` sets a 1-hour `exp` and a distinct `sub` (`urn:realh:human:<id>`). | Tokens are bearer — relying parties must validate `aud`/`iss` as they see fit. |
| DoS against the verify endpoint | `verifyLimiter` (30 req/min) in addition to the global `apiLimiter` (100 req / 15 min). `JSON_BODY_LIMIT` caps payload size. | Distributed abuse needs upstream rate limiting (Cloudflare, Cloud Armor). |
| Auth bypass | `authenticate` middleware rejects missing/invalid bearer tokens; Firebase Admin verifies the token signature and `aud`. Demo mode accepts an obviously-demo prefix. | Demo token path must never be reachable in production. `DEMO_MODE=false` disables it. |
| Cross-origin credential exfiltration | Strict CORS allowlist (`config.corsOrigins`); `credentials: true` only for listed origins; `*` rejected. | Misconfiguration — keep `CORS_ORIGINS` under review in PRs touching env. |
| Cross-site scripting in the issuer UI | Helmet CSP: `default-src 'none'`, strict `script-src 'self'`, `frame-ancestors 'none'`. `style-src` allows `'unsafe-inline'` only because the demo authorize page uses inline `<style>`. | The demo `mock-demo/authorize` page is not used in production; production providers host their own UI. |
| Dependency CVEs | `npm audit --audit-level=high` in CI; Dependabot weekly; `jose` and `firebase-admin` major bumps held for manual review. | Zero-days between weekly runs — accept, compensated by CodeQL + gitleaks. |
| Supply-chain: malicious package | Lockfile committed; new top-level deps require discussion (see [CONTRIBUTING.md](../CONTRIBUTING.md)). | Transitive deps not individually reviewed — standard ecosystem risk. |

## Key management

### File-based (demo only)

`packages/server/src/services/keyManager.js` auto-generates an Ed25519 keypair in `packages/server/keys/` on first boot. Acceptable for local dev and CI. **Never in production.** The directory is `.gitignore`d; the `.gitleaks.toml` has an extra rule for private JWKs.

### KMS (production)

`packages/server/src/services/signer/kms-gcp.js` is a working GCP Cloud KMS signer. To enable:

```bash
KEY_MANAGER=kms
KMS_PROVIDER=gcp
KMS_KEY_ID=projects/<P>/locations/<L>/keyRings/<R>/cryptoKeys/<K>/cryptoKeyVersions/<N>
KMS_KEY_KID=realh-key-1     # optional; advertised in JWKS
```

Prerequisites on the GCP side:

- KMS key purpose `ASYMMETRIC_SIGN` with algorithm `EC_SIGN_ED25519`.
- Service account running this process has `roles/cloudkms.signerVerifier` on the key (not the keyring).
- Audit logging enabled for the key's asymmetricSign operations.
- Install the optional dep: `npm install @google-cloud/kms -w packages/server`.

On startup the signer fetches the KMS public key once (PEM → JWK), caches it, runs a sign-and-verify self-test against the cached public key, and throws on mismatch. The private key never leaves the KMS; every signature is an RPC.

**Other KMS providers** (AWS, Vault) follow the same shape. Port `kms-gcp.js` to `kms-aws.js` / `kms-vault.js` and register in `signer/index.js`. The unit tests demonstrate how to mock the client for offline CI.

Properties all KMS signers must preserve:

- Private key never leaves the KMS. No `getPrivateKey()` API exists.
- `getPublicJwk()` returns the same shape the file-based signer does, so `/.well-known/jwks.json` is unchanged.
- `kid` is stable across restarts — otherwise previously-issued credentials stop verifying.
- `alg` and `kid` in signed headers are enforced by the signer, not the caller — defense against a bug that lets a caller pretend to sign with a different algorithm.

### Rotation

Plan rotation as a scheduled operation, not an emergency one. The high-level flow:

1. Create a new KMS key version.
2. Publish both the old and the new public keys in JWKS (multi-key array).
3. Flip signing to the new `kid`.
4. After the maximum credential validity window, drop the old key from JWKS.

## Network posture

- TLS terminates at a proxy in front of the API (Cloudflare / Cloud Run / nginx). `app.set('trust proxy', 1)` honors `X-Forwarded-For` from one hop.
- Rate limits key off `req.ip`, so a misconfigured proxy that forwards the load balancer's IP will collapse all clients into a single bucket. Verify this in staging.
- CORS is an allowlist; the `Origin` header is checked per-request and unknown origins are rejected with a 500-range error at the middleware layer (before the route runs).

## Input validation

- Credential hashes are validated against `isValidSha256` before issuance.
- JSON body size is capped via `JSON_BODY_LIMIT`.
- Route handlers return structured errors via `AppError` subclasses; unexpected errors collapse to a generic `INTERNAL_ERROR` 500 with no stack in the response.

Audit gap: the `/verify` endpoint accepts an arbitrary credential JSON. Enforcement is `verifyCredential()` re-running the crypto check. If you add fields that influence business logic (trust levels, revocation), validate their shape explicitly.

## Reporting vulnerabilities

See [SECURITY.md](../SECURITY.md). Key-exposure paths (filesystem, logs, error messages, insecure defaults) are treated as critical regardless of how they surface.
