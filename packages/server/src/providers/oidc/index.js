import { randomBytes } from 'crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ProviderAdapter } from '../base.js';
import { logger } from '../../utils/logger.js';

/**
 * Generic OpenID Connect provider adapter.
 *
 * Use this as the base for any standards-compliant OIDC IdP — Google, Auth0,
 * Cognito, Okta, Keycloak, Login.gov, etc. Subclass it with a small config
 * block (issuer URL, client ID/secret, scopes) or instantiate it directly.
 *
 * What it does right (the security-sensitive parts that every real
 * implementation must get right):
 *
 *   - CSRF defense via the `state` parameter, bound to our internal session ID.
 *     verificationService passes us the session; we set it as `state`; we
 *     verify the returned `state` matches on callback.
 *
 *   - Replay defense via `nonce`. Random per authorization request, stored in
 *     sessionState, and matched against the ID token's `nonce` claim.
 *
 *   - ID token signature verification against the provider's public JWKS.
 *     `jose.createRemoteJWKSet` caches keys for 10 minutes by default.
 *
 *   - Standard claims: `iss` must match the configured issuer; `aud` must
 *     include our clientId; `exp` must be in the future (jose enforces this).
 *
 *   - Stable subject identifier as `<iss>|<sub>`. The OIDC spec guarantees
 *     `sub` is stable per user per issuer, but not across issuers — so we
 *     prefix to disambiguate.
 *
 * What it deliberately does NOT do:
 *
 *   - PKCE. This adapter targets server-side confidential clients, which use
 *     `client_secret`. For public clients (browser SPA, mobile) fork this and
 *     add `code_challenge` / `code_verifier`.
 *
 *   - Userinfo endpoint. The ID token already has the identifier we need;
 *     calling /userinfo buys nothing here and costs a round-trip.
 *
 *   - Refresh tokens. RealH issues one credential per verification; we never
 *     need the access token again.
 */
export class OidcProvider extends ProviderAdapter {
  /**
   * @param {object} appConfig - Top-level app config (from config.js).
   * @param {object} providerConfig
   * @param {string} providerConfig.id             Unique adapter ID (e.g. "oidc-google").
   * @param {string} providerConfig.displayName
   * @param {string} providerConfig.country        ISO 3166-1 alpha-2 or "XX".
   * @param {string} providerConfig.description
   * @param {string} providerConfig.issuer         e.g. "https://accounts.google.com"
   * @param {string} providerConfig.authorizationEndpoint
   * @param {string} providerConfig.tokenEndpoint
   * @param {string} providerConfig.jwksUri
   * @param {string} providerConfig.clientId
   * @param {string} providerConfig.clientSecret
   * @param {string[]} [providerConfig.scopes]     defaults to ['openid']
   */
  constructor(appConfig, providerConfig) {
    super(appConfig);
    const required = [
      'id', 'displayName', 'country', 'description',
      'issuer', 'authorizationEndpoint', 'tokenEndpoint', 'jwksUri',
      'clientId', 'clientSecret',
    ];
    for (const k of required) {
      if (!providerConfig[k]) {
        throw new Error(`OidcProvider config missing required field '${k}'`);
      }
    }
    this.providerConfig = {
      scopes: ['openid'],
      ...providerConfig,
    };
    // createRemoteJWKSet caches keys across requests; create once per adapter.
    this._jwks = createRemoteJWKSet(new URL(this.providerConfig.jwksUri));
  }

  get id() { return this.providerConfig.id; }
  get displayName() { return this.providerConfig.displayName; }
  get country() { return this.providerConfig.country; }
  get description() { return this.providerConfig.description; }

  async getAuthorizationUrl(sessionId, callbackUrl) {
    const nonce = randomBytes(16).toString('hex');

    const url = new URL(this.providerConfig.authorizationEndpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.providerConfig.clientId);
    url.searchParams.set('redirect_uri', callbackUrl);
    url.searchParams.set('scope', this.providerConfig.scopes.join(' '));
    url.searchParams.set('state', sessionId);
    url.searchParams.set('nonce', nonce);

    return {
      url: url.toString(),
      // Session state retained by verificationService so handleCallback can
      // verify nonce and reuse the exact callback URL in the token exchange.
      state: { nonce, callbackUrl },
    };
  }

  async handleCallback(params, sessionState) {
    // Step 1: user-visible error from the provider.
    if (params.error) {
      logger.info(
        { error: params.error, error_description: params.error_description },
        'oidc provider returned error on callback'
      );
      return fail('USER_DENIED', `Provider returned error: ${params.error}`);
    }

    if (!params.code || typeof params.code !== 'string') {
      return fail('PROVIDER_ERROR', 'Missing authorization code on callback');
    }

    // Step 2: exchange the authorization code for an ID token.
    let tokenResponse;
    try {
      tokenResponse = await fetch(this.providerConfig.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: params.code,
          redirect_uri: sessionState.callbackUrl,
          client_id: this.providerConfig.clientId,
          client_secret: this.providerConfig.clientSecret,
        }),
      });
    } catch (err) {
      logger.error({ err, provider: this.id }, 'oidc token endpoint network failure');
      return fail('PROVIDER_ERROR', 'Token exchange request failed');
    }

    if (!tokenResponse.ok) {
      logger.info(
        { status: tokenResponse.status, provider: this.id },
        'oidc token exchange rejected'
      );
      return fail('PROVIDER_ERROR', `Token exchange failed (HTTP ${tokenResponse.status})`);
    }

    let tokenData;
    try {
      tokenData = await tokenResponse.json();
    } catch {
      return fail('PROVIDER_ERROR', 'Token response was not valid JSON');
    }

    const idToken = tokenData.id_token;
    if (!idToken || typeof idToken !== 'string') {
      return fail('PROVIDER_ERROR', 'Token response missing id_token');
    }

    // Step 3: verify the ID token. `jose.jwtVerify` checks the signature
    // against the cached JWKS and enforces `iss`, `aud`, and `exp`.
    let payload;
    try {
      ({ payload } = await jwtVerify(idToken, this._jwks, {
        issuer: this.providerConfig.issuer,
        audience: this.providerConfig.clientId,
      }));
    } catch (err) {
      logger.warn({ err: err.message, provider: this.id }, 'oidc id_token verification failed');
      return fail('PROVIDER_ERROR', 'ID token signature or claim verification failed');
    }

    // Step 4: nonce check. jwtVerify can't do this — it's app-level state.
    if (payload.nonce !== sessionState.nonce) {
      logger.warn({ provider: this.id }, 'oidc nonce mismatch — possible replay');
      return fail('PROVIDER_ERROR', 'Nonce mismatch');
    }

    if (!payload.sub) {
      return fail('PROVIDER_ERROR', 'ID token missing required `sub` claim');
    }

    // Step 5: build the stable subject ID. `<iss>|<sub>` is unique across
    // providers; verificationService then hashes this into our opaque humanId.
    return {
      success: true,
      providerSubjectId: `${payload.iss}|${payload.sub}`,
      errorCode: null,
      errorMessage: null,
    };
  }
}

function fail(errorCode, errorMessage) {
  return {
    success: false,
    providerSubjectId: null,
    errorCode,
    errorMessage,
  };
}
