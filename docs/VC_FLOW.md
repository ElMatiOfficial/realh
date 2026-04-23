# Verifiable Credential flow

RealH issues W3C Verifiable Credentials (VCs) v2.0 that bind a content hash to a verified human. Any third party can verify them offline using the public keys at `/.well-known/jwks.json` and the DID document at `/.well-known/did.json`.

This document walks through the lifecycle of a credential from the issuer's and the relying party's perspectives, and describes the exact wire shape.

## Actors

| Actor | Role |
| --- | --- |
| **Subject** | A human registering their work. Authenticated to RealH via Firebase Auth; verified via a provider adapter. |
| **Issuer** | The RealH server. Holds the Ed25519 signing key; exposes JWKS and the DID document. |
| **Holder** | In this design, the subject and the holder are the same principal — the user's dashboard stores the issued credential. |
| **Verifier** | Any relying party (a platform, a publisher, an archive) that wants to check a credential before trusting the claim. |

## End-to-end flow

```
┌──────────┐  1. sign in (Firebase Auth)    ┌──────────┐
│  Subject │ ──────────────────────────────▶ │  RealH   │
│ (browser)│                                 │   API    │
│          │  2. start verification          │          │
│          │ ──────────────────────────────▶ │          │
│          │                                 │          │
│          │  3. redirect to provider        │          │
│          │ ◀────────────────────────────── │          │
│          │                                 │          │
│          │  4. verify identity (eIDAS/…)   │ Identity │
│          │ ──────────────────────────────▶ │ provider │
│          │                                 │          │
│          │  5. callback                    │          │
│          │ ◀────────────────────────────── │          │
│          │                                 │          │
│          │  6. POST /credentials/issue     │          │
│          │     { title, contentHash }      │          │
│          │ ──────────────────────────────▶ │          │
│          │                                 │  sign w/ │
│          │  7. signed VC                   │  Ed25519 │
│          │ ◀────────────────────────────── │  (JWS)   │
└──────────┘                                 └──────────┘

┌──────────┐  8. POST /verify { credential } ┌──────────┐
│ Verifier │ ──────────────────────────────▶ │  RealH   │   (online path — optional)
│          │ ◀────────────────────────────── │          │
└──────────┘

┌──────────┐  8'. GET /.well-known/jwks.json ┌──────────┐
│ Verifier │ ──────────────────────────────▶ │  any host│   (offline path)
│          │     verify JWS locally          │          │
└──────────┘                                 └──────────┘
```

## Credential shape

Issued credentials follow [W3C VC Data Model 2.0](https://www.w3.org/TR/vc-data-model-2.0/):

```json
{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://realh.org/ns/v1"
  ],
  "id": "urn:realh:credential:4f3a6b7c-…",
  "type": ["VerifiableCredential", "HumanCreationCertificate"],
  "issuer": "did:web:api.example.com",
  "validFrom": "2026-04-22T15:30:00.000Z",
  "credentialSubject": {
    "type": "HumanCreatedWork",
    "creator": {
      "type": "VerifiedHuman",
      "id": "urn:realh:human:abc123"
    },
    "work": {
      "title": "Essay on attention",
      "contentHash": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "contentType": "text/markdown",
      "registeredAt": "2026-04-22T15:30:00.000Z"
    }
  },
  "proof": {
    "type": "DataIntegrityProof",
    "cryptosuite": "realh-eddsa-jws-v1",
    "verificationMethod": "did:web:api.example.com#key-1",
    "created": "2026-04-22T15:30:00.000Z",
    "proofPurpose": "assertionMethod",
    "jws": "eyJhbGciOiJFZERTQSIs…"
  }
}
```

Key fields:

- **`issuer`** — the `did:web` for the RealH host. Resolves to `https://<host>/.well-known/did.json`.
- **`credentialSubject.creator.id`** — the stable `humanId` assigned at verification time. Opaque to third parties; does not leak PII.
- **`credentialSubject.work.contentHash`** — SHA-256 of the registered content, lowercase hex, prefixed with `sha256:`.
- **`proof.jws`** — a compact EdDSA JWS over the JSON-serialized credential **minus the `proof` field**. The `kid` in the JWS header matches one entry in `/.well-known/jwks.json`.

## Issuer resolution

Given a credential's `issuer` (`did:web:example.com`):

1. Construct the DID document URL: `https://example.com/.well-known/did.json`.
2. Fetch it. Confirm `id` equals the `issuer` value.
3. Look up the `verificationMethod` entry whose `id` matches `proof.verificationMethod`.
4. Pull the `publicKeyJwk` from that method.
5. Separately fetch `https://example.com/.well-known/jwks.json` and confirm the key with matching `kid` is present (defense-in-depth: the DID doc and JWKS must agree).

`did:web` is used because it piggybacks on TLS and DNS — no blockchain, no third-party directory, no runtime dependency on RealH once the key material is cached.

## Verifying a credential

### Online (verifier trusts the issuer host for the check)

```bash
curl -X POST https://api.example.com/api/v1/verify \
  -H "Content-Type: application/json" \
  -d '{"credential": { ... }}'
```

Response:

```json
{
  "ok": true,
  "data": {
    "valid": true,
    "issuer": "did:web:api.example.com",
    "issuedAt": "2026-04-22T15:30:00.000Z",
    "credentialId": "urn:realh:credential:4f3a6b7c-…",
    "subject": { "type": "HumanCreatedWork", "…": "…" }
  }
}
```

### Offline (no runtime trust in the issuer host)

1. Fetch `/.well-known/jwks.json` **once** (cache it; pin it in your build if you want stronger guarantees).
2. Extract `proof.jws` from the credential.
3. Verify the compact JWS with the key whose `kid` matches the JWS header.
4. Strip `proof` from the original credential JSON; compare to the JWS payload. Mismatch → tampered.

Pseudocode (using `jose`):

```js
import { compactVerify, importJWK } from 'jose';

const jwks = await fetch('https://api.example.com/.well-known/jwks.json').then(r => r.json());
const key = await importJWK(jwks.keys[0], 'EdDSA');
const { payload } = await compactVerify(credential.proof.jws, key);
const signed = JSON.parse(new TextDecoder().decode(payload));
const { proof, ...rest } = credential;
const tampered = JSON.stringify(signed) !== JSON.stringify(rest);
```

## Human-verification tokens

For relying parties that just need "is this a real person?" without the full credential:

```
POST /api/v1/verify/human { "humanId": "abc123" }

→ { "verified": true, "token": "eyJhbGciOiJFZERTQSIs…", "expiresAt": "..." }
```

The `token` is a standard JWT signed with the same Ed25519 key. `sub` is `urn:realh:human:<humanId>`; `iss` is the DID. Verify with `jose.jwtVerify` and the JWKS.

## Known limitations (pre-1.0)

- **Cryptosuite is non-standard.** The proof carries `cryptosuite: 'realh-eddsa-jws-v1'` rather than the W3C `eddsa-jcs-2022`, because we serialize with `JSON.stringify` instead of RFC 8785 JCS. Using the W3C label while not actually doing JCS would be a false claim that breaks interop with conforming verifiers, so we use an honestly-non-standard label until JCS is implemented. The repo's own verifier explicitly rejects any other cryptosuite name to prevent silent confusion.
- **Canonicalization is `JSON.stringify`.** Two parties re-serializing the same credential may produce different byte sequences and fail verification (key ordering, whitespace, Unicode escapes). Adopting JCS + switching the cryptosuite label to `eddsa-jcs-2022` is the pre-1.0 migration path.
- No revocation. If a human's verification is later invalidated, issued credentials remain signed. A revocation list or status registry is future work.
- No linked-data proofs (LDP) — only JWS. This is intentional for simplicity; LDP support is a separate adapter if demand appears.
