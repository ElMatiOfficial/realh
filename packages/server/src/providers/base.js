/**
 * Abstract base class for identity verification providers.
 *
 * Each provider follows an OAuth2/OIDC-like redirect flow:
 *   1. getAuthorizationUrl() -> redirect user to provider
 *   2. User verifies identity on provider's system
 *   3. Provider redirects back to our callback URL
 *   4. handleCallback() -> process the response
 *
 * To add a new provider:
 *   1. Create a directory under providers/<name>/
 *   2. Export a class extending ProviderAdapter
 *   3. Register it in providers/index.js
 */
export class ProviderAdapter {
  constructor(config) {
    if (new.target === ProviderAdapter) {
      throw new Error('ProviderAdapter is abstract');
    }
    this.config = config;
  }

  /** Unique identifier (e.g., "mock-demo", "eidas-eu") */
  get id() { throw new Error('Not implemented'); }

  /** Human-readable name */
  get displayName() { throw new Error('Not implemented'); }

  /** ISO 3166-1 alpha-2 country code, or "XX" for universal */
  get country() { throw new Error('Not implemented'); }

  /** Short description */
  get description() { throw new Error('Not implemented'); }

  /**
   * Generate the URL to redirect the user to for verification.
   * @param {string} sessionId - Internal session tracking ID
   * @param {string} callbackUrl - URL the provider should redirect back to
   * @returns {Promise<{url: string, state: object}>}
   */
  async getAuthorizationUrl(sessionId, callbackUrl) {
    throw new Error('Not implemented');
  }

  /**
   * Process the callback from the provider.
   * @param {object} params - Query/body parameters from the callback
   * @param {object} sessionState - State saved from getAuthorizationUrl
   * @returns {Promise<{success: boolean, providerSubjectId: string|null, errorCode: string|null, errorMessage: string|null}>}
   */
  async handleCallback(params, sessionState) {
    throw new Error('Not implemented');
  }

  toJSON() {
    return {
      id: this.id,
      name: this.displayName,
      country: this.country,
      description: this.description,
    };
  }
}
