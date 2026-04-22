# Deployment

RealH is a two-service app: a stateless Node API and a static React SPA. The API requires persistent signing keys (file-based in demo, KMS in production) and, outside demo mode, a Firestore instance.

## Shape of a production deployment

```
          ┌───────────────┐        ┌──────────────────┐
  user ─▶ │  CDN / nginx  │ ─────▶ │  Static SPA      │  (packages/client)
          └───────────────┘        └──────────────────┘
                 │
                 ▼
          ┌───────────────┐        ┌──────────────────┐
          │  API server   │ ─────▶ │  Firestore       │  (state: users, creds)
          │  (Node 20)    │        └──────────────────┘
          │               │ ─────▶ ┌──────────────────┐
          └───────────────┘        │  KMS (GCP/AWS/…) │  (signing key)
                                   └──────────────────┘
```

The API is stateless once keys live in KMS — scale horizontally behind any load balancer.

## Supported runtimes

- **Docker** — `docker-compose.yml` at the repo root covers the full local stack. Each service has its own Dockerfile under `packages/*/Dockerfile` for standalone builds.
- **Cloud Run / Fly / Render** — build the server image from `packages/server/Dockerfile`; expose port `3001`; wire env vars per [ENVIRONMENT.md](ENVIRONMENT.md).
- **Static hosts for the client** — Cloudflare Pages, Netlify, Vercel, S3+CloudFront, or nginx. `npm run build -w packages/client` emits a plain `dist/`.
- **Node** — `node packages/server/src/index.js` under a process manager (systemd, PM2). Put a reverse proxy in front for TLS.

## Build images

Both Dockerfiles must be built from the **repo root** so npm workspaces resolve.

```bash
# API
docker build -f packages/server/Dockerfile -t realh/server:latest .

# Client (bake the API URL in at build time)
docker build -f packages/client/Dockerfile \
  --build-arg VITE_API_URL=https://api.example.com \
  -t realh/client:latest .
```

## Runtime checklist

Before pointing traffic at a deployment:

- [ ] `DEMO_MODE=false` and Firebase Admin credentials wired via your secret store.
- [ ] `KEY_MANAGER=kms` and a non-exportable Ed25519 key in your KMS (see [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md)).
- [ ] `SERVER_BASE_URL` matches the public URL the API is reachable at — it ends up in every issued credential's `issuer` (`did:web:<host>`).
- [ ] `CORS_ORIGINS` is the explicit allowlist of SPA origins. No wildcards.
- [ ] `JSON_BODY_LIMIT` left at the default (`256kb`) or tighter.
- [ ] TLS terminates in front of the API; `app.set('trust proxy', 1)` in `app.js` assumes a single proxy hop — adjust if you chain more.
- [ ] `/.well-known/jwks.json` and `/.well-known/did.json` are reachable over HTTPS at the root of `did:web:<host>` — relying parties resolve them from there.
- [ ] Rate limits reviewed for your traffic (`packages/server/src/middleware/rateLimit.js`).
- [ ] Logs go somewhere — the default morgan sink is stdout; aggregate it.

## Firestore

In production mode, `packages/server/src/data/firestore.js` handles persistence. You need:

1. A GCP project with Firestore (Native mode) enabled.
2. A service account with `roles/datastore.user`.
3. The service account key provided via `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` (the last one read from a secret store, not disk).

Firestore rules should treat the RealH server as the only writer. Clients authenticate with Firebase Auth but never touch Firestore directly.

## Zero-downtime key rotation

The current file-based key manager loads one key per process. To rotate without downtime:

1. Publish the new public key in `/.well-known/jwks.json` alongside the old one (multi-key JWKS).
2. Switch signing to the new `kid`.
3. Wait for the longest-lived credential's `validFrom` window to age out, or publish revocation metadata.
4. Retire the old key.

The KMS adapter ([kmsKeyManager.js](../packages/server/src/services/kmsKeyManager.js)) is the right place to add multi-key support; track this under a feature issue before production.

## Observability

- `GET /health` returns `{ ok: true, mode }` — wire to your LB health check and uptime monitor.
- Morgan logs requests; pipe to your log stack.
- CodeQL + gitleaks run on every PR via GitHub Actions. `npm audit --audit-level=high` fails CI on new high-severity advisories.

## Rollback

The API is stateless, so rollback is: redeploy the previous image. Credentials already signed by a rolled-back key are still valid (the public JWKS has not changed). Only a key rotation is irreversible — plan for it separately from code rollbacks.
