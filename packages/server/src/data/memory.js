export class MemoryDataLayer {
  constructor() {
    this.users = new Map();
    this.verificationSessions = new Map();
    this.credentials = new Map();
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
}
