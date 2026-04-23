import { randomBytes } from 'crypto';
import { ProviderAdapter } from '../base.js';

export class MockProvider extends ProviderAdapter {
  get id() { return 'mock-demo'; }
  get displayName() { return 'Demo Provider (Development)'; }
  get country() { return 'XX'; }
  get description() { return 'Simulated verification for development and testing. Automatically approves all requests.'; }

  async getAuthorizationUrl(sessionId, callbackUrl) {
    const url = `${this.config.serverBaseUrl}/api/v1/verification/mock-demo/authorize?session=${sessionId}&callback=${encodeURIComponent(callbackUrl)}`;
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
