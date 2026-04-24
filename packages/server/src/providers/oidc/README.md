# OIDC provider adapter

Generic [OpenID Connect](https://openid.net/connect/) adapter. Wire it to any standards-compliant IdP — Google, Auth0, Cognito, Okta, Keycloak, Login.gov, Azure AD — with a small config block.

## What you get

- Authorization-code flow with `state` (CSRF defense) and `nonce` (replay defense).
- ID token signature verification against the provider's JWKS (cached 10 minutes).
- Standard claim checks: `iss`, `aud`, `exp`.
- Stable subject ID as `<iss>|<sub>` — unique across providers.
- Rejects common failure modes with structured error codes suitable for the redirect sanitization in [routes/verification.js](../../routes/verification.js).

## What you have to provide

Per provider, five values — four from the provider's `/.well-known/openid-configuration` endpoint, one from their developer console.

```js
import { OidcProvider } from './oidc/index.js';

const googleProvider = new OidcProvider(appConfig, {
  id: 'oidc-google',
  displayName: 'Sign in with Google',
  country: 'XX',
  description: 'Google OAuth 2.0 / OpenID Connect',
  issuer: 'https://accounts.google.com',
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
  clientId: process.env.OIDC_GOOGLE_CLIENT_ID,
  clientSecret: process.env.OIDC_GOOGLE_CLIENT_SECRET,
  // scopes: ['openid'], // default; add 'email' or 'profile' if you need them
});
```

Register it in [providers/index.js](../index.js) alongside `MockProvider`:

```js
providers.push(googleProvider);
```

Then set the `redirect_uri` in the provider's console to `<SERVER_BASE_URL>/api/v1/verification/callback`.

## Ready-to-copy configs

### Google

Get `clientId` / `clientSecret` from <https://console.cloud.google.com/apis/credentials>. OAuth client type = "Web application".

```js
{
  id: 'oidc-google',
  displayName: 'Sign in with Google',
  country: 'XX',
  description: 'Google OAuth 2.0 / OpenID Connect',
  issuer: 'https://accounts.google.com',
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
  clientId: process.env.OIDC_GOOGLE_CLIENT_ID,
  clientSecret: process.env.OIDC_GOOGLE_CLIENT_SECRET,
}
```

### Auth0

Replace `<TENANT>` with your tenant domain (e.g. `acme.us.auth0.com`).

```js
{
  id: 'oidc-auth0',
  displayName: 'Sign in with Auth0',
  country: 'XX',
  description: 'Auth0-managed identity',
  issuer: 'https://<TENANT>/',
  authorizationEndpoint: 'https://<TENANT>/authorize',
  tokenEndpoint: 'https://<TENANT>/oauth/token',
  jwksUri: 'https://<TENANT>/.well-known/jwks.json',
  clientId: process.env.OIDC_AUTH0_CLIENT_ID,
  clientSecret: process.env.OIDC_AUTH0_CLIENT_SECRET,
}
```

### Login.gov

Requires a proof-of-identity IAL/AAL level in your application; see <https://developers.login.gov>.

```js
{
  id: 'oidc-logingov',
  displayName: 'Sign in with Login.gov',
  country: 'US',
  description: 'US government identity verification',
  issuer: 'https://secure.login.gov',
  authorizationEndpoint: 'https://secure.login.gov/openid_connect/authorize',
  tokenEndpoint: 'https://secure.login.gov/api/openid_connect/token',
  jwksUri: 'https://secure.login.gov/api/openid_connect/certs',
  clientId: process.env.OIDC_LOGINGOV_CLIENT_ID,
  clientSecret: process.env.OIDC_LOGINGOV_CLIENT_SECRET,
}
```

## What this adapter does NOT handle

- **PKCE.** Targets confidential clients (server-side, with `client_secret`). For public clients (SPA, mobile) fork and add `code_challenge` / `code_verifier`.
- **Userinfo endpoint.** The ID token already carries the identifier we need.
- **Refresh tokens.** RealH issues one credential per verification; we don't need to keep the session alive.
- **Dynamic client registration.** Configure the client statically in the provider's console.

## Security checklist when adding a new provider

See the generic checklist in [docs/PROVIDERS.md](../../../../../docs/PROVIDERS.md#security-checklist-for-new-providers). Items already covered by this adapter's logic:

- Session binding (`state` = our sessionId)
- Replay defense (`nonce` per authorization request)
- Clock skew (enforced by `jose.jwtVerify` via `exp`, `iat`)
- JWKS caching with expiry (`createRemoteJWKSet` defaults)
- Structured error codes (no raw provider strings bubble to the browser)
- Idempotent callback (repeated codes fail at the token endpoint; `handleCallback` doesn't retain state)

Items you still have to verify per provider:

- **IAL/AAL / assurance level** the IdP actually delivers. An OIDC endpoint that wraps a weak email-link flow does not prove the user is a real person.
- **Scope of the `sub` claim.** Some providers scope `sub` per-application (Google `sub` is stable per-project-per-user, not global). The `<iss>|<sub>` prefix handles the cross-issuer case; within one issuer you still need to understand the stability guarantee.
