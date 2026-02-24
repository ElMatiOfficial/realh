import { getFirestore } from 'firebase-admin/firestore';

export class FirestoreDataLayer {
  constructor(firebaseApp) {
    this.db = getFirestore(firebaseApp);
  }

  async getUser(uid) {
    const snap = await this.db.collection('users').doc(uid).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  }

  async createUser(uid, data) {
    await this.db.collection('users').doc(uid).set(data);
  }

  async updateUser(uid, data) {
    await this.db.collection('users').doc(uid).update(data);
  }

  async createVerificationSession(sessionId, data) {
    await this.db.collection('verificationSessions').doc(sessionId).set(data);
  }

  async getVerificationSession(sessionId) {
    const snap = await this.db.collection('verificationSessions').doc(sessionId).get();
    return snap.exists ? { sessionId: snap.id, ...snap.data() } : null;
  }

  async updateVerificationSession(sessionId, data) {
    await this.db.collection('verificationSessions').doc(sessionId).update(data);
  }

  async deleteVerificationSession(sessionId) {
    await this.db.collection('verificationSessions').doc(sessionId).delete();
  }

  async createCredential(credentialId, data) {
    await this.db.collection('credentials').doc(credentialId).set(data);
  }

  async getCredential(credentialId) {
    const snap = await this.db.collection('credentials').doc(credentialId).get();
    return snap.exists ? { credentialId: snap.id, ...snap.data() } : null;
  }

  async listCredentialsByUser(userId) {
    const snap = await this.db.collection('credentials').where('userId', '==', userId).get();
    return snap.docs.map(d => ({ credentialId: d.id, ...d.data() }));
  }
}
