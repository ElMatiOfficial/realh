# RealH

Open-source proof-of-personhood and content provenance tooling. RealH issues and verifies W3C Verifiable Credentials (VCs) that attest a piece of content was registered by a verified human, and exposes a public JWKS + `did:web` document so any relying party can verify issued credentials without trusting RealH at runtime.

> [!WARNING]
> **This is a reference implementation, not a production identity service.**
>
> Before using RealH to issue credentials anyone will actually trust, you must replace the following — the defaults here are for development and have known limitations:
>
> - **A real identity provider.** The shipped mock proves nothing about the user. Production needs a real IdP (eIDAS, Login.gov, Sumsub, etc.) — see [docs/PROVIDERS.md](docs/PROVIDERS.md).
> - **KMS-backed signing keys.** The default file-based key manager keeps private keys on disk. A leaked key lets anyone forge credentials that verify against the public JWKS — critical incident. See [docs/SECURITY_ARCHITECTURE.md](docs/SECURITY_ARCHITECTURE.md) for the adapter template.
> - **Canonical JSON (RFC 8785).** Verification currently uses `JSON.stringify`, which is not deterministic across clients. Two parties re-serializing the same credential may produce different bytes and fail verification. Tracked as a pre-1.0 item.
> - **Revocation.** Once a credential is issued, it stays valid for the lifetime of the issuer key. There is no revocation list or status registry.
>
> Operating a credential-issuing service for real identity verification may carry regulatory and compliance obligations (eIDAS, KYC/AML, GDPR) that this project does not address. Deployers are responsible for meeting them.
>
> RealH is distributed under the Apache License 2.0, which disclaims warranty and limits liability to the extent permitted by law. It is not a substitute for legal counsel.

## What it does

- **Proof-of-personhood**: verifies a user is a real person via a pluggable identity provider, then issues a stable `humanId` and a signed JWT verification token.
- **Content provenance**: given a content hash, issues a W3C VC linking the content to a verified human at a point in time.
- **Self-verifying**: any third party can fetch `/.well-known/jwks.json` and `/.well-known/did.json` to verify RealH-issued credentials offline.

## Quickstart

Requirements: Node.js 20+, npm 10+.

```bash
git clone https://github.com/ElMatiOfficial/realh.git
cd realh
npm install
npm run dev
```

- Server: <http://localhost:3001>
- Client: <http://localhost:5173>
- Health: <http://localhost:3001/health>
- JWKS: <http://localhost:3001/.well-known/jwks.json>

The default `DEMO_MODE=true` runs fully in-memory with a mock identity provider — no Firebase or external services needed.

## Architecture

Monorepo with two npm workspaces:

- [`packages/server`](packages/server/) — Express API. Issues/verifies VCs, exposes JWKS + DID document, authenticates users via Firebase Admin (or a demo bypass in `DEMO_MODE`).
- [`packages/client`](packages/client/) — React + Vite dashboard. Sign-in, start verification, register content, view issued credentials.

Key design boundaries:

- **Provider adapter** ([packages/server/src/providers/base.js](packages/server/src/providers/base.js)) — identity providers implement a single interface. Ship your own by extending `BaseProvider`.
- **Data layer abstraction** ([packages/server/src/data/index.js](packages/server/src/data/index.js)) — `MemoryDataLayer` for demo, `FirestoreDataLayer` for production. Swappable.
- **Key management** ([packages/server/src/services/keyManager.js](packages/server/src/services/keyManager.js)) — file-based for dev. Production must use a KMS (see [docs/SECURITY_ARCHITECTURE.md](docs/SECURITY_ARCHITECTURE.md)).

## Environment

Copy the examples and fill in what you need:

```bash
cp packages/server/.env.example packages/server/.env
cp packages/client/.env.example packages/client/.env
```

Full variable reference: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start server + client in watch mode |
| `npm run dev:server` / `npm run dev:client` | Individual services |
| `npm run build` | Production build of the client |
| `npm run test` | Run server tests (vitest) |
| `npm run lint` | Lint both workspaces |

## Verifying a credential (no SDK)

```bash
# 1. Fetch the issuer's public key
curl https://your-realh-host/.well-known/jwks.json

# 2. Verify a credential via the API
curl -X POST https://your-realh-host/api/v1/verify \
  -H "Content-Type: application/json" \
  -d '{"credential": { ... }}'
```

Or verify offline — the credential's `proof.jws` is a standard EdDSA JWS over the credential payload minus the `proof` field.

## Security

Found a vulnerability? **Please do not open a public issue.** See [SECURITY.md](SECURITY.md) for private reporting.

## Contributing

Bug reports, feature requests, and PRs are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[Apache License 2.0](LICENSE) — including an explicit patent grant.
