# ADR 001 — JSON canonicalization for credential proofs

- **Status:** Accepted
- **Date:** 2026-04-24
- **Deciders:** RealH maintainers

## Context

A W3C Verifiable Credential's `proof.jws` signs a byte sequence derived from the credential JSON. For two parties (issuer and verifier) to agree on whether a signature is valid, they must both produce identical bytes from the same logical JSON document.

RealH currently serializes with JavaScript's `JSON.stringify`. That is not a canonical form:

- Key order is insertion-order (object-property-creation-order), not sorted.
- Unicode escapes vary (`é` vs. `é`).
- Number formatting varies (`1.0` vs `1`).
- Whitespace and line endings are implementation-defined.

Two systems that re-serialize the same credential can produce different bytes and either reject valid credentials or, worse, fail to detect tampering that happens to survive a re-encoding round trip.

**[RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) — JSON Canonicalization Scheme (JCS)** is the IETF standard for deterministic JSON serialization. It sorts keys, normalizes numbers per IEEE 754, and uses a fixed Unicode escape policy. The W3C data-integrity cryptosuite `eddsa-jcs-2022` explicitly requires JCS.

## Decision

**RealH will implement JCS before tagging 1.0.**

The current proof therefore declares `cryptosuite: 'realh-eddsa-jws-v1'` — a deliberately non-standard label — rather than the W3C standard `eddsa-jcs-2022`. This is the honest option: using the W3C label while not actually canonicalizing would be a **false claim inside the cryptographic proof**, causing conforming verifiers to accept or reject based on rules we are not following.

The verifier in this repo enforces the label match: it rejects any credential whose `cryptosuite` isn't `realh-eddsa-jws-v1`, so a mislabeled proof cannot slip through.

When JCS is wired in (using the [`canonicalize`](https://www.npmjs.com/package/canonicalize) npm package or an equivalent RFC 8785 implementation):

1. `issueCredential` switches to JCS for the signed bytes.
2. `verifyCredential` uses JCS to re-canonicalize before comparison.
3. `proof.cryptosuite` flips from `realh-eddsa-jws-v1` back to `eddsa-jcs-2022`.
4. The cryptosuite guard relaxes to accept `eddsa-jcs-2022`, with a transitional period that also accepts `realh-eddsa-jws-v1` for any credentials issued before the cutover.
5. A migration note ships in CHANGELOG.md naming the cutover commit.

## Alternatives considered

1. **Claim `eddsa-jcs-2022` now, use `JSON.stringify` internally.** The label is then a lie that works on our own ecosystem and breaks silently with anyone else. Rejected — see "honesty" rationale above.
2. **Declare JCS a permanent non-goal.** RealH would remain forever non-interoperable with the broader VC ecosystem. Rejected — the whole point of a public JWKS + `did:web` is that any relying party can verify; that's only useful if "any" includes verifiers built by people who didn't clone this repo.
3. **Use a different W3C cryptosuite with weaker canonicalization requirements (e.g. `JsonWebSignature2020`).** `JsonWebSignature2020` has its own canonicalization via URDNA2015 over JSON-LD, which is even more demanding. Rejected as strictly worse than JCS for our shape.

## Consequences

- **Short-term:** RealH-issued credentials verify only with RealH-aware code (or anyone willing to replicate our `JSON.stringify` + verifier-label check). This is an accepted cost of publishing something honest instead of something wrong.
- **Long-term:** The migration is a single well-scoped PR. The cryptosuite guard in `verifyCredential` and the issuing path in `issueCredential` are the only two places to change. Tests in `credentialService.test.js` encode the current label as a regression check; they get updated in the cutover PR.
- **User-facing docs** ([README](../../README.md#status), [docs/VC_FLOW.md](../VC_FLOW.md#known-limitations-pre-10), [ROADMAP.md](../../ROADMAP.md#10--interoperable--externally-reviewed)) already flag this limitation prominently.

## References

- W3C Verifiable Credential Data Integrity 1.0: <https://www.w3.org/TR/vc-data-integrity/>
- `eddsa-jcs-2022` cryptosuite: <https://www.w3.org/TR/vc-di-eddsa/#eddsa-jcs-2022>
- RFC 8785 (JCS): <https://www.rfc-editor.org/rfc/rfc8785>
- `canonicalize` npm package: <https://github.com/erdtman/canonicalize>
