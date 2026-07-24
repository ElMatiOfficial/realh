/**
 * In-memory implementation of the DataLayer interface (see ./interface.js).
 * Process-local; resets on restart. DEMO_MODE default.
 *
 * @implements {import('./interface.js').DataLayer}
 */
export class MemoryDataLayer {
  constructor() {
    this.users = new Map();
    this.verificationSessions = new Map();
    this.credentials = new Map();
    this.liveCodes = new Map();
  }

  // Users
  async getUser(uid) {
    return this.users.get(uid) || null;
  }

  async createUser(uid, data) {
    this.users.set(uid, { id: uid, ...data });
  }

  async updateUser(uid, data) {
    const user = this.users.get(uid);
    if (user) {
      this.users.set(uid, { ...user, ...data });
    }
  }

  async findVerifiedUserByHumanId(humanId) {
    for (const user of this.users.values()) {
      if (user.humanId === humanId && user.isVerified) return user;
    }
    return null;
  }

  // Verification Sessions
  async createVerificationSession(sessionId, data) {
    this.verificationSessions.set(sessionId, { sessionId, ...data });
  }

  async getVerificationSession(sessionId) {
    return this.verificationSessions.get(sessionId) || null;
  }

  async updateVerificationSession(sessionId, data) {
    const session = this.verificationSessions.get(sessionId);
    if (session) {
      this.verificationSessions.set(sessionId, { ...session, ...data });
    }
  }

  async deleteVerificationSession(sessionId) {
    this.verificationSessions.delete(sessionId);
  }

  // Credentials
  async createCredential(credentialId, data) {
    this.credentials.set(credentialId, { credentialId, ...data });
  }

  async getCredential(credentialId) {
    return this.credentials.get(credentialId) || null;
  }

  async listCredentialsByUser(userId) {
    return Array.from(this.credentials.values()).filter(c => c.userId === userId);
  }

  // Live codes
  async createLiveCode(codeId, data) {
    this.liveCodes.set(codeId, { codeId, ...data });
  }

  async consumeLiveCode(codeId, now) {
    // Single-threaded Map access is inherently atomic here; the transaction
    // requirement in the interface is for the networked backends.
    const record = this.liveCodes.get(codeId);
    if (!record) return { outcome: 'not_found' };
    if (record.status === 'used') return { outcome: 'used', record };
    if (new Date(record.expiresAt) <= now) return { outcome: 'expired', record };

    const consumed = { ...record, status: 'used', usedAt: now.toISOString() };
    this.liveCodes.set(codeId, consumed);
    return { outcome: 'consumed', record: consumed };
  }
}
