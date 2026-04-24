# Environment variables

All runtime configuration is read from environment variables. The server loads `.env` via `dotenv` at startup; the client reads `VITE_*` variables at build time.

Copy `packages/server/.env.example` and `packages/client/.env.example`, then edit. Never commit a real `.env`.

## Server (`packages/server/.env`)

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3001` | HTTP port the API binds to. |
| `NODE_ENV` | `development` | `development` / `production`. Controls log format. |
| `SERVER_BASE_URL` | `http://localhost:3001` | Public URL of this server. Used in issued credentials and JWT issuers. |
| `CLIENT_BASE_URL` | `http://localhost:5173` | Public URL of the client. Used for CORS fallback and redirect targets. |
| `CORS_ORIGINS` | — | Comma-separated allowlist of browser origins. Overrides `CLIENT_BASE_URL` when set. `*` is rejected. |
| `JSON_BODY_LIMIT` | `256kb` | Maximum request body size. Credentials are small; keep this tight. |
| `DEMO_MODE` | `true` | When `true`, uses in-memory data and a mock identity provider. Set to `false` to enable Firebase. |
| `KEYS_DIR` | `keys` | Directory the file-based key manager reads/writes Ed25519 JWKs from. |
| `KEY_MANAGER` | `file` | `file` or `kms`. `kms` requires implementing the adapter in `packages/server/src/services/kmsKeyManager.js`. |
| `DATA_LAYER` | `firestore` | Persistence backend when `DEMO_MODE=false`. One of `memory`, `firestore`, `postgres`. |
| `DATABASE_URL` | — | Postgres connection string. Required when `DATA_LAYER=postgres`. Example: `postgres://user:pass@host:5432/realh?sslmode=require`. |
| `KMS_PROVIDER` | — | `gcp` / `aws` / `vault`. Only read when `KEY_MANAGER=kms`. |
| `KMS_KEY_ID` | — | Provider-specific key identifier. |
| `KMS_KEY_KID` | `realh-key-1` | `kid` advertised in JWKS and used in credential headers. |

### Firebase (only when `DEMO_MODE=false`)

| Variable | Default | Description |
| --- | --- | --- |
| `FIREBASE_PROJECT_ID` | `realh-poc` | GCP project hosting Firebase / Firestore. |
| `FIREBASE_CLIENT_EMAIL` | — | Service account email. |
| `FIREBASE_PRIVATE_KEY` | — | Service account private key. `\n` sequences are unescaped at load time. Store the key itself in a secret manager, not plain `.env`. |

## Client (`packages/client/.env`)

Vite exposes only variables prefixed with `VITE_` to the bundle. They are **compile-time** values baked into the build.

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:3001` | Base URL the SPA calls for API requests. |
| `VITE_FIREBASE_API_KEY` | — | Firebase Web API key. |
| `VITE_FIREBASE_AUTH_DOMAIN` | — | Firebase Auth domain. |
| `VITE_FIREBASE_PROJECT_ID` | — | Firebase project ID. |

> The Firebase Web API key is not a secret — it identifies the project to the browser SDK. Firestore security rules are what actually enforce access.

## Precedence

1. Process environment (e.g. set by your orchestrator / CI).
2. `.env.local` (gitignored; for local overrides).
3. `.env` (gitignored; default per environment).
4. `.env.example` is a **template only**; the app never reads it.

## Secret handling

- `FIREBASE_PRIVATE_KEY` and any KMS credentials should come from your platform's secret store (GCP Secret Manager, AWS Secrets Manager, Vault, GitHub Actions secrets), **not** a file on disk.
- The `.gitignore` blocks `.env`, `*.pem`, `*.key`, `credentials*.json`, `service-account*.json`, and `packages/server/keys/`. The `.gitleaks.toml` + the `gitleaks` GitHub Action catch regressions.
- The pre-commit hook in `.husky/pre-commit` runs `gitleaks protect --staged` locally when `gitleaks` is installed.
