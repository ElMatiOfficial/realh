import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OidcProvider } from './index.js';

// Unit tests for the OIDC adapter. Mocks `fetch` and `jose.jwtVerify` to
// exercise the callback state machine without hitting a real IdP.
//
// The goal is to catch regressions in the security-relevant branches:
// user-denied, missing code, token-exchange failure, id_token missing,
// signature failure, nonce mismatch, and the happy path.

vi.mock('jose', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    // createRemoteJWKSet never hits the network in tests — just needs to be
    // a truthy object the provider can pass to jwtVerify.
    createRemoteJWKSet: vi.fn(() => ({ _jwks: 'mock' })),
    jwtVerify: vi.fn(),
  };
});

const { jwtVerify } = await import('jose');

function makeProvider() {
  return new OidcProvider(
    { serverBaseUrl: 'http://localhost:3001' },
    {
      id: 'oidc-test',
      displayName: 'Test OIDC',
      country: 'XX',
      description: 'unit-test provider',
      issuer: 'https://issuer.test',
      authorizationEndpoint: 'https://issuer.test/auth',
      tokenEndpoint: 'https://issuer.test/token',
      jwksUri: 'https://issuer.test/jwks',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      scopes: ['openid', 'email'],
    }
  );
}

describe('OidcProvider.getAuthorizationUrl', () => {
  it('builds a spec-compliant authorization URL with state + nonce', async () => {
    const provider = makeProvider();
    const { url, state } = await provider.getAuthorizationUrl(
      'vs_abc123',
      'http://localhost:3001/api/v1/verification/callback'
    );

    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://issuer.test/auth');
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.searchParams.get('client_id')).toBe('test-client-id');
    expect(u.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3001/api/v1/verification/callback'
    );
    expect(u.searchParams.get('scope')).toBe('openid email');
    expect(u.searchParams.get('state')).toBe('vs_abc123');
    // Nonce is random per-request; just assert it's present and long-ish.
    const nonce = u.searchParams.get('nonce');
    expect(nonce).toMatch(/^[a-f0-9]{32}$/);
    expect(state.nonce).toBe(nonce);
    expect(state.callbackUrl).toBe('http://localhost:3001/api/v1/verification/callback');
  });
});

describe('OidcProvider.handleCallback', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: jwtVerify returns a valid payload with matching nonce.
    jwtVerify.mockResolvedValue({
      payload: {
        iss: 'https://issuer.test',
        sub: 'user-42',
        aud: 'test-client-id',
        nonce: 'matching-nonce',
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    });
  });

  it('returns USER_DENIED when the provider reports an error', async () => {
    const provider = makeProvider();
    const result = await provider.handleCallback(
      { error: 'access_denied', error_description: 'user declined' },
      { nonce: 'matching-nonce', callbackUrl: 'http://localhost:3001/cb' }
    );
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('USER_DENIED');
  });

  it('returns PROVIDER_ERROR when authorization code is missing', async () => {
    const provider = makeProvider();
    const result = await provider.handleCallback(
      {},
      { nonce: 'matching-nonce', callbackUrl: 'http://localhost:3001/cb' }
    );
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('PROVIDER_ERROR');
    expect(result.errorMessage).toMatch(/authorization code/i);
  });

  it('returns PROVIDER_ERROR when token endpoint returns non-2xx', async () => {
    const provider = makeProvider();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({}),
    });
    const result = await provider.handleCallback(
      { code: 'abc' },
      { nonce: 'matching-nonce', callbackUrl: 'http://localhost:3001/cb' }
    );
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('PROVIDER_ERROR');
    expect(result.errorMessage).toMatch(/HTTP 400/);
  });

  it('returns PROVIDER_ERROR when ID token is missing from token response', async () => {
    const provider = makeProvider();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'at' }), // no id_token
    });
    const result = await provider.handleCallback(
      { code: 'abc' },
      { nonce: 'matching-nonce', callbackUrl: 'http://localhost:3001/cb' }
    );
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('PROVIDER_ERROR');
    expect(result.errorMessage).toMatch(/id_token/i);
  });

  it('returns PROVIDER_ERROR when ID token signature verification fails', async () => {
    const provider = makeProvider();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id_token: 'forged.token.here' }),
    });
    jwtVerify.mockRejectedValueOnce(new Error('signature verification failed'));
    const result = await provider.handleCallback(
      { code: 'abc' },
      { nonce: 'matching-nonce', callbackUrl: 'http://localhost:3001/cb' }
    );
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('PROVIDER_ERROR');
  });

  it('returns PROVIDER_ERROR when the nonce does not match (replay defense)', async () => {
    const provider = makeProvider();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id_token: 'ok.token.here' }),
    });
    jwtVerify.mockResolvedValueOnce({
      payload: {
        iss: 'https://issuer.test',
        sub: 'user-42',
        nonce: 'stale-nonce',
      },
    });
    const result = await provider.handleCallback(
      { code: 'abc' },
      { nonce: 'different-nonce', callbackUrl: 'http://localhost:3001/cb' }
    );
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('PROVIDER_ERROR');
    expect(result.errorMessage).toMatch(/nonce/i);
  });

  it('returns success and a prefixed subject ID on the happy path', async () => {
    const provider = makeProvider();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id_token: 'ok.token.here' }),
    });
    // Default mock returns matching nonce.
    const result = await provider.handleCallback(
      { code: 'abc' },
      { nonce: 'matching-nonce', callbackUrl: 'http://localhost:3001/cb' }
    );
    expect(result.success).toBe(true);
    expect(result.providerSubjectId).toBe('https://issuer.test|user-42');
    expect(result.errorCode).toBeNull();
  });
});
