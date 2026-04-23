# Quickstart — 2-minute demo

End-to-end walkthrough: clone → verified human → issued credential → verified credential. Everything runs locally against the in-memory data layer and the mock identity provider. No Firebase, no KMS, no external services.

If you want to deploy RealH to real users instead of poking at it, stop here and read [docs/DEPLOYMENT.md](DEPLOYMENT.md) — the flow below is not safe for production.

## Prerequisites

- Node.js 20+, npm 10+
- A modern browser
- One open terminal

## 1. Clone and install

```bash
git clone https://github.com/ElMatiOfficial/realh.git
cd realh
npm install
```

First install pulls ~600 packages and takes about a minute.

## 2. Start the stack

```bash
npm run dev
```

This launches both workspaces in parallel:

- Server on <http://localhost:3001>
- Client on <http://localhost:5173>

On first boot, the server auto-generates an Ed25519 key pair under `packages/server/keys/` (ignored by git). You should see a log line like:

```
generated new Ed25519 key pair  kid=realh-key-1  path=keys
```

Sanity-check it's alive:

```bash
curl http://localhost:3001/health
# → {"ok":true,"mode":"demo"}

curl http://localhost:3001/.well-known/jwks.json
# → {"keys":[{"kty":"OKP","crv":"Ed25519","x":"...","kid":"realh-key-1","alg":"EdDSA","use":"sig"}]}
```

## 3. Sign in

Open <http://localhost:5173> in a browser. Sign in with any email on the dev form. In `DEMO_MODE=true` (the default), the server accepts demo-prefixed bearer tokens and auto-provisions the user — no real Firebase account needed.

## 4. Complete identity verification

On the dashboard, click **Verify identity** → pick **Demo Provider (Development)**. The browser redirects to the mock authorization page at `/api/v1/verification/mock-demo/authorize`.

Click **Approve**. The mock provider "verifies" you unconditionally (it's a demo — it proves nothing about you). You're redirected back to the dashboard, now showing:

- Verified: ✅
- `humanId`: a 16-char opaque identifier

This `humanId` is the stable public handle for your verified identity. It's what ends up in credentials.

## 5. Issue your first credential

On the dashboard, **Register content**. Enter:

- **Title**: anything ("My first work")
- **Content hash**: any valid SHA-256 hex (64 chars, `0-9a-f`). If you don't have one handy:
    ```bash
    echo -n "hello, world" | sha256sum
    # → 09ca7e4eaa6e8ae9c7d261167129184883644d07dfba7cbfbc4c8a2e08360d5b  -
    ```
- **Content type** (optional): `text/plain`

Click **Issue**. You get back a signed W3C Verifiable Credential — a JSON object with `credentialSubject`, `issuer`, `proof.jws`, etc. Copy the full JSON; you'll need it in the next step.

## 6. Verify the credential

### Round-trip via the API

In your terminal:

```bash
curl -X POST http://localhost:3001/api/v1/verify \
  -H "Content-Type: application/json" \
  -d '{"credential": <paste the credential JSON here>}'
```

Expected response:

```json
{
  "ok": true,
  "data": {
    "valid": true,
    "issuer": "did:web:localhost",
    "issuedAt": "2026-04-23T...",
    "credentialId": "urn:realh:credential:...",
    "subject": { "type": "HumanCreatedWork", "...": "..." }
  }
}
```

### Catch a tamper attempt

Edit one field of the credential — change `credentialSubject.work.title` to something else. Re-submit:

```bash
curl -X POST http://localhost:3001/api/v1/verify \
  -H "Content-Type: application/json" \
  -d '{"credential": <tampered JSON>}'
```

Now you get:

```json
{
  "ok": true,
  "data": { "valid": false, "error": "Credential content has been tampered with" }
}
```

### Verify offline (no RealH trust at runtime)

Fetch JWKS once, then verify locally with any JOSE library:

```js
import { compactVerify, importJWK } from 'jose';

const { keys } = await fetch('http://localhost:3001/.well-known/jwks.json').then(r => r.json());
const key = await importJWK(keys[0], 'EdDSA');
const { payload } = await compactVerify(credential.proof.jws, key);
// payload is the credential JSON minus the proof field; compare against credential to detect tampering
```

## What just happened

1. Your browser session got a verified `humanId` from the mock provider.
2. The server signed a credential binding that `humanId` to your content hash using its Ed25519 private key.
3. The credential can be verified by anyone who fetches the server's public JWKS — no runtime trust in the server is required after that initial fetch.

## What this demo does NOT do

- **Prove you're human.** The mock provider approves unconditionally. A real deployment needs a real IdP (eIDAS, Login.gov, Sumsub) — see [docs/PROVIDERS.md](PROVIDERS.md).
- **Persist anything past server restart.** In-memory data layer is reset each boot. The firebase-admin-backed data layer is the production alternative — see [docs/DEPLOYMENT.md](DEPLOYMENT.md).
- **Protect the signing key.** Private keys live on disk. Production needs a KMS — see [docs/SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md).
- **Interop with W3C-standard verifiers.** The proof's cryptosuite label is `realh-eddsa-jws-v1`, deliberately non-standard while we serialize with `JSON.stringify` instead of RFC 8785 JCS. See [ROADMAP.md](../ROADMAP.md).

## Next steps

- Work through [docs/VC_FLOW.md](VC_FLOW.md) to understand the wire format end to end.
- Read [docs/SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) before making changes in `packages/server/src/services/` or thinking about deploying.
- If you're evaluating for production: [docs/DEPLOYMENT.md](DEPLOYMENT.md) + [ROADMAP.md](../ROADMAP.md) tell you what's ready and what isn't.
