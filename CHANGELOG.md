# Changelog

All notable changes to RealH are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Once we cut 0.1.0 this project will adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Pre-1.0 work toward making the repo safe to flip public and usable by adopters beyond the original maintainer. No version tagged yet.

### Added

- Credential round-trip + tamper + forgery tests (6 tests in the initial batch, later 8) — first tests in the repo.
- Coverage gate via `@vitest/coverage-v8`: per-file thresholds on `credentialService.js` (95% lines/statements) and `keyManager.js` (75% lines/statements). CI uploads the full HTML report as an artifact for 14 days.
- [docs/decisions/001-jcs-canonicalization.md](docs/decisions/001-jcs-canonicalization.md) — ADR capturing the "implement JCS before 1.0" decision and why we ship `realh-eddsa-jws-v1` in the meantime instead of lying about the standard label.
- `pino` structured logging with redaction for auth headers, cookies, private keys, and passwords. Replaces ad-hoc `console.error` / `console.log`.
- Zod validation at every mutating public route boundary (`/credentials/issue`, `/verify`, `/verify/human`, `/verification/initiate`) via a shared `validate()` middleware.
- Optional `audience` field on `POST /api/v1/verify/human`, surfaced as the JWT's `aud` claim.
- [firestore.rules](firestore.rules) + [firebase.json](firebase.json) — default-deny for client-SDK access; the server's firebase-admin bypasses rules as designed.
- `DEMO_MODE` refuse-to-boot kill switch when `NODE_ENV=production`.
- README `[!WARNING]` + `[!CAUTION]` callouts for the production gaps and the `DEMO_MODE` bearer-token bypass.
- HumanLedger → RealH migration note in the README Quickstart.
- [docs/QUICKSTART_DEMO.md](docs/QUICKSTART_DEMO.md) — end-to-end walkthrough from `git clone` to verifying your first credential.
- [packages/server/src/data/interface.js](packages/server/src/data/interface.js) formalizing the `DataLayer` contract as JSDoc `@typedef`s. Existing `MemoryDataLayer` and `FirestoreDataLayer` annotated with `@implements`; a new `PostgresDataLayer` skeleton implements the full surface against a schema at [packages/server/src/data/postgres.schema.sql](packages/server/src/data/postgres.schema.sql). Selected at runtime via `DATA_LAYER=memory|firestore|postgres`.
- `findVerifiedUserByHumanId(humanId)` on every backend. Fixes a latent bug where `POST /api/v1/verify/human` reached into `db.users.values()` — a MemoryDataLayer-only detail — and silently returned `verified: false` in production Firestore deployments.
- Test coverage for the new data-layer method (3 cases): memory.test.js exercises match, isVerified=false, and missing-humanId paths.
- **Worked OIDC provider adapter** at [packages/server/src/providers/oidc/](packages/server/src/providers/oidc/). Generic authorization-code flow with state + nonce, ID token signature verification against JWKS, standard claim checks (iss/aud/exp), stable `<iss>|<sub>` subject ID. Ready-to-copy configs for Google, Auth0, and Login.gov in the adapter's README. 8 unit tests cover the authorization-URL shape and every error-path branch of the callback state machine.
- Pre-public security surface: Apache-2.0 license, CODE_OF_CONDUCT, SECURITY.md with Private Vulnerability Reporting, PR + issue templates, Dependabot config, gitleaks action + config, CI workflow (test / build / lint / audit / gitleaks).

### Changed

- Credential proof `cryptosuite` label: `eddsa-jcs-2022` → `realh-eddsa-jws-v1`. We serialize with `JSON.stringify`, not RFC 8785 JCS, so claiming the standard suite was a false statement in the proof. The verifier now rejects any credential whose cryptosuite isn't the honest label. Flipping back is contingent on implementing JCS (see ROADMAP).
- CORS origin comparison now uses `new URL().origin` normalization instead of raw string equality.
- Session IDs (`vs_<32 hex>`) and mock provider subject IDs use `randomBytes` instead of truncated UUIDs (no entropy loss).
- CI `npm audit` now exits 0 at `--audit-level=high`; was red before on undici → firebase chain (fixed by firebase client bump) and `protobufjs` critical (fixed by a root `overrides: { protobufjs: "7.5.5" }`).
- `firebase-admin` bumped `^12.0.0 → ^13.8.0` (major).
- Root `overrides` extended with `uuid: ^14.0.0` (clears GHSA-w5hq-g745-h8pq in the firebase-admin transitive chain) and `esbuild: ^0.25.0` (clears GHSA-67mh-4wv8-2f99 in the vitest transitive chain). Total vuln count went from 22 (8 high + 1 critical) at the start of the pre-public work to 11 (0 high + 0 critical, 3 moderate + 8 low).
- Repo renamed on GitHub: `ElMatiOfficial/human-poc` → `ElMatiOfficial/realh`.
- Product name reconciled across package names, docs, and generated credential DIDs.

### Fixed

- **Open redirect + HTML injection on `/api/v1/verification/mock-demo/authorize`.** The route interpolated the `callback` and `session` query params directly into the HTML response. A crafted `callback` URL could siphon verified sessions to an attacker host on Approve click. Fix: gate the route on `DEMO_MODE`, validate `session` against the strict `vs_<hex32>` format, and hardcode the callback URL from `config.serverBaseUrl`.
- **Stack-trace leakage via `console.error`** in the error handler. Now via pino; HTTP responses unchanged (still generic `INTERNAL_ERROR`).
- **`protobufjs` critical (GHSA-xq3m-2v4x-88gg)** — pinned to 7.5.5 via root `overrides`.
- **25,290 tracked files in `node_modules/`** from an early commit before `.gitignore` covered it. Removed from the index (history blobs retained; project-audited as containing no secrets).

### Security

- Vulnerability reporting: [GitHub Private Vulnerability Reporting](https://github.com/ElMatiOfficial/realh/security/advisories/new). See [SECURITY.md](SECURITY.md).
- Two rounds of internal security review shaped this release. Outstanding items (JCS, KMS wiring, revocation, OIDC example) are captured in [ROADMAP.md](ROADMAP.md).

## [0.1.0] — not yet released

The first tagged release will happen when the Unreleased section above has been reviewed end-to-end and the KMS adapter has at least unit tests against a real KMS client library.
