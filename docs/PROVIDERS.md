# Identity provider adapters

A provider adapter is the bridge between RealH's credential machinery and a real-world identity system (eIDAS, Login.gov, a Sumsub-style KYC flow, etc.). The adapter owns **how we learn a user is a real human**; RealH owns **what we do once we know**.

This document describes the contract every adapter must satisfy, how to add a new one, and the assumptions RealH makes about the provider's guarantees.

## The contract

Adapters extend `ProviderAdapter` in [packages/server/src/providers/base.js](../packages/server/src/providers/base.js):

```js
class ProviderAdapter {
  get id()            { /* e.g. "eidas-eu" */ }
  get displayName()   { /* e.g. "eIDAS (EU)" */ }
  get country()       { /* ISO 3166-1 alpha-2, or "XX" for universal */ }
  get description()   { /* one-line summary shown in the picker */ }

  async getAuthorizationUrl(sessionId, callbackUrl) {
    // returns { url, state }
    // `url`   — where we redirect the user to start verification
    // `state` — opaque object we'll get back in handleCallback(sessionState)
  }

  async handleCallback(params, sessionState) {
    // returns {
    //   success: boolean,
    //   providerSubjectId: string | null,  // stable per-user id at this provider
    //   errorCode: string | null,
    //   errorMessage: string | null,
    // }
  }
}
```

RealH treats `providerSubjectId` as the unique human identity within that provider. It is hashed with a server-side secret into the stable public `humanId` before being stored or exposed — the raw provider subject never leaves the database row.

## Flow

1. **Client**: `POST /api/v1/verification/initiate { providerId }` → server creates a session and calls `getAuthorizationUrl(session, callback)`.
2. **Server**: returns the `url`; the browser redirects to it.
3. **Provider**: authenticates the user, redirects back to the callback with its own parameters.
4. **Server**: `GET /api/v1/verification/callback` → invokes `handleCallback(query, sessionState)`.
5. **On success**: the server mints a `humanId`, marks the user verified, and redirects back to the client with a success status. On failure, redirects with an error.

Session state is held in the data layer (`data/memory.js` or `data/firestore.js`) keyed by the `session` value passed in the query string. Adapters do not touch the database directly — everything flows through `verificationService.js`.

## Adding a provider

1. Create `packages/server/src/providers/<name>/index.js`:
   ```js
   import { ProviderAdapter } from '../base.js';

   export class MyProvider extends ProviderAdapter {
     get id()          { return 'my-provider'; }
     get displayName() { return 'My Provider'; }
     get country()     { return 'US'; }
     get description() { return 'Government-issued ID verification.'; }

     async getAuthorizationUrl(sessionId, callbackUrl) {
       // Build a provider-specific URL. Keep sessionId in the `state` parameter
       // so handleCallback can correlate — the CSRF defense is that we only
       // accept callbacks for sessions we opened.
       return {
         url: `https://provider.example/authorize?state=${sessionId}&redirect_uri=${encodeURIComponent(callbackUrl)}`,
         state: { /* anything you want in handleCallback */ },
       };
     }

     async handleCallback(params, sessionState) {
       // Exchange the code for an assertion, verify its signature, extract the
       // stable subject id. Return success or a structured failure.
     }
   }
   ```
2. Register it in [packages/server/src/providers/index.js](../packages/server/src/providers/index.js).
3. Add any provider-specific env vars to [ENVIRONMENT.md](ENVIRONMENT.md) and `.env.example`.
4. Write a unit test covering: successful callback, expired session, forged response, user denial.

## What RealH trusts the provider to guarantee

- **Uniqueness**: `providerSubjectId` is stable per human across sessions. If a provider recycles IDs or gives each session a fresh one, humans collide or multiply — do not use it.
- **Liveness**: the subject was present at verification time (not a stolen bearer assertion). Providers that don't enforce liveness should be labelled as low-assurance in `description`.
- **Integrity of the assertion**: the signature on the provider's response is verified in `handleCallback` before `success` is returned. If the adapter returns `success: true` without checking crypto, the entire chain of trust collapses.

Adapters that cannot meet these guarantees belong in the `mock`-style demo category and MUST set `displayName` to make that obvious (e.g. "Mock (demo only)").

## The shipped mock

[packages/server/src/providers/mock/](../packages/server/src/providers/mock/) is a stand-in that:

- Generates a deterministic `providerSubjectId` per session.
- Hosts its own "Approve / Deny" HTML page at `/api/v1/verification/mock-demo/authorize`.
- Always succeeds on `action=approve`.

It exists so the demo runs without any external dependencies. **It does not prove anything about the user.** `DEMO_MODE=false` should never route traffic to the mock in production — the picker should hide it. If you fork this repo and publish it, either remove the mock or put it behind an env flag.

## Security checklist for new providers

- [ ] Session binding: reject callbacks whose `state` doesn't match an open session.
- [ ] Replay: reject assertions with a `jti` / nonce that has been seen before.
- [ ] Clock skew: reject assertions whose `iat` is in the future or `exp` in the past.
- [ ] TLS pinning or JWKS caching with expiry for the provider's own keys.
- [ ] Error paths go through `success: false` with specific `errorCode` values — never throw raw provider errors to the client.
- [ ] `handleCallback` is idempotent: a retried callback yields the same result without double-issuing verification.
- [ ] No PII written to logs. `providerSubjectId` is pseudonymous; treat it accordingly.
