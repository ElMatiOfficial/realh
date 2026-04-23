import { randomBytes } from 'crypto';
import { ProviderAdapter } from '../base.js';

export class MockProvider extends ProviderAdapter {
  get id() { return 'mock-demo'; }
  get displayName() { return 'Demo Provider (Development)'; }
  get country() { return 'XX'; }
  get description() { return 'Simulated verification for development and testing. Automatically approves all requests.'; }

  async getAuthorizationUrl(sessionId, _callbackUrl) {
    // The mock's authorize page now hardcodes its callback from
    // config.serverBaseUrl and refuses to trust a callback passed in the
    // query string (that used to be an open-redirect vector). The
    // `callbackUrl` argument is still declared on the adapter interface
    // for real providers; ignored here.
    const url = `${this.config.serverBaseUrl}/api/v1/verification/mock-demo/authorize?session=${encodeURIComponent(sessionId)}`;
    return {
      url,
      state: { sessionId, initiatedAt: Date.now() },
    };
  }

  async handleCallback(params, sessionState) {
    if (params.action === 'approve') {
      return {
        success: true,
        // 8 random bytes → 16 hex chars → 64 bits of entropy. Keeps the same
        // display width as the original truncated-UUID form but without the
        // entropy loss from dropping half a UUIDv4.
        providerSubjectId: 'mock_' + randomBytes(8).toString('hex'),
        errorCode: null,
        errorMessage: null,
      };
    }
    return {
      success: false,
      providerSubjectId: null,
      errorCode: 'USER_DENIED',
      errorMessage: 'User declined verification in demo provider',
    };
  }
}
