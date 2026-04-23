# Changelog

All notable changes to RealH are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Once we cut 0.1.0 this project will adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Pre-1.0 work toward making the repo safe to flip public and usable by adopters beyond the original maintainer. No version tagged yet.

### Added

- Credential round-trip + tamper + forgery tests (6 tests in the initial batch, later 8) — first tests in the repo.
- `pino` structured logging with redaction for auth headers, cookies, private keys, and passwords. Replaces ad-hoc `console.error` / `console.log`.
- Zod validation at every mutating public route boundary (`/credentials/issue`, `/verify`, `/verify/human`, `/verification/initiate`) via a shared `validate()` middleware.
- Optional `audience` field on `POST /api/v1/verify/human`, surfaced as the JWT's `aud` claim.
- [firestore.rules](firestore.rules) + [firebase.json](firebase.json) — default-deny for client-SDK access; the server's firebase-admin bypasses rules as designed.
- `DEMO_MODE` refuse-to-boot kill switch when `NODE_ENV=production`.
- README `[!WARNING]` + `[!CAUTION]` callouts for the production gaps and the `DEMO_MODE` bearer-token bypass.
- HumanLedger → RealH migration note in the README Quickstart.
- [docs/QUICKSTART_DEMO.md](docs/QUICKSTART_DEMO.md) — end-to-end walkthrough from `git clone` to verifying your first credential.
- Pre-public security surface: Apache-2.0 license, CODE_OF_CONDUCT, SECURITY.md with Private Vulnerability Reporting, PR + issue templates, Dependabot config, gitleaks action + config, CI workflow (test / build / lint / audit / gitleaks).

### Changed

- Credential proof `cryptosuite` label: `eddsa-jcs-2022` → `realh-eddsa-jws-v1`. We serialize with `JSON.stringify`, not RFC 8785 JCS, so claiming the standard suite was a false statement in the proof. The verifier now rejects any credential whose cryptosuite isn't the honest label. Flipping back is contingent on implementing JCS (see ROADMAP).
- CORS origin comparison now uses `new URL().origin` normalization instead of raw string equality.
- Session IDs (`vs_<32 hex>`) and mock provider subject IDs use `randomBytes` instead of truncated UUIDs (no entropy loss).
- CI `npm audit` now exits 0 at `--audit-level=high`; was red before on undici → firebase chain (fixed by firebase client bump) and `protobufjs` critical (fixed by a root `overrides: { protobufjs: "7.5.5" }`).
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
