# RealH Roadmap

What's between the current pre-0.1 state and a 1.0 that's responsibly deployable. Items are grouped by release target; within each group they're roughly ordered by how much they block everything else.

This is a living document. If you disagree with an ordering or want something on the list, open a Discussion or an issue.

## 0.2.0 — "safe to deploy behind a real provider"

- [x] ~~**KMS adapter wired to GCP Cloud KMS.**~~ Landed in [packages/server/src/services/signer/kms-gcp.js](packages/server/src/services/signer/kms-gcp.js). Unit-tested with a mocked client; production use still requires a live smoke test against a real non-exportable Ed25519 key. AWS and Vault ports follow the same shape — see [docs/SECURITY_ARCHITECTURE.md](docs/SECURITY_ARCHITECTURE.md#kms-production).
- [ ] **Worked OIDC provider example.** Alongside the existing mock, add `providers/oidc-template/` — a concrete adapter against a generic OIDC IdP (Auth0, Google, Cognito). Handles session binding, replay defense, and clock skew. This is the single biggest adoption multiplier per security review.
- [ ] **Data-layer interface formalized.** JSDoc `@typedef` on [packages/server/src/data/index.js](packages/server/src/data/index.js). Add a `PostgresDataLayer` skeleton (schema, connection, stub implementations) to prove the interface is implementable outside Firestore.
- [ ] **firebase-admin major bump** to clear the moderate-severity transitive CVE chain (uuid, `@google-cloud/firestore`, `@tootallnate/once`). Currently under the CI `high+` gate but visible under plain `npm audit`.

## 1.0 — "interoperable + externally reviewed"

- [ ] **RFC 8785 JCS canonicalization** in credential sign/verify. Today the proof advertises `realh-eddsa-jws-v1` to be honest about the non-standard canonicalization; flipping to JCS lets us flip the label back to `eddsa-jcs-2022` and interoperate with conforming verifiers. Pre-1.0 blocker for any interop claim.
- [ ] **Revocation.** A credential status registry — either a status list (W3C VC Bitstring Status List) or a simple online revocation endpoint. Without this, a credential stays valid for the lifetime of its issuer key.
- [ ] **Zero-downtime key rotation.** Multi-key JWKS + `kid`-based routing in the signer. The design is sketched in [docs/SECURITY_ARCHITECTURE.md](docs/SECURITY_ARCHITECTURE.md#rotation); needs an implementation.
- [ ] **External security review.** At least one reviewer outside the original maintainer walking `keyManager`, `credentialService`, `authenticate`, and the well-known routes. Before 1.0.
- [ ] **Coverage gate in CI.** `vitest --coverage` with a minimum threshold; fail PRs that drop coverage on the security-sensitive modules.

## Explicitly not on the roadmap

- **Operating a hosted credential-issuing service at realh.org or similar.** RealH is reference code; the maintainers do not run an endpoint. If that ever changes it will be a separate project with its own governance.
- **Compliance certification** (eIDAS Levels of Assurance, NIST 800-63 IAL/AAL, SOC 2) — operators are responsible for meeting whatever regime applies to them. The code is one ingredient of a compliant deployment, not the whole recipe.
- **Mobile SDKs.** The client is a web SPA. Native mobile verifier libraries would be a separate project.
- **Decentralized-storage issuance** (IPFS, Ceramic, etc.). `did:web` is intentional — TLS + DNS, no blockchain, no third-party directory.

## How to help

- **Try to deploy it.** If the docs in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) don't get you to a working instance, open an issue with where you got stuck — that's the most valuable feedback pre-1.0.
- **Write a provider adapter** against whichever IdP you need; PRs welcome. The OIDC template above will land first to give you a shape to copy.
- **Review.** Especially if you have security-engineering background: read the four security-sensitive files listed in [CONTRIBUTING.md](CONTRIBUTING.md#security-sensitive-changes) and tell us what we missed.
