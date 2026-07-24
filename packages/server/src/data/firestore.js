import { getFirestore } from 'firebase-admin/firestore';

/**
 * Firestore implementation of the DataLayer interface (see ./interface.js).
 * Used when DEMO_MODE=false. All writes go through firebase-admin, which
 * bypasses the client-facing rules in firestore.rules.
 *
 * @implements {import('./interface.js').DataLayer}
 */
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

  async findVerifiedUserByHumanId(humanId) {
    // Requires a composite index on (humanId asc, isVerified asc). Firestore
    // emits a console hint with the exact index URL on first query if missing.
    const snap = await this.db
      .collection('users')
      .where('humanId', '==', humanId)
      .where('isVerified', '==', true)
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
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

  async createLiveCode(codeId, data) {
    await this.db.collection('liveCodes').doc(codeId).set(data);
  }

  async consumeLiveCode(codeId, now) {
    // runTransaction gives the read-check-write the atomicity the interface
    // demands: Firestore retries the closure on contention, so of two racing
    // verifications one sees status 'active' and the other sees 'used'.
    const ref = this.db.collection('liveCodes').doc(codeId);
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { outcome: 'not_found' };
      const record = { codeId: snap.id, ...snap.data() };
      if (record.status === 'used') return { outcome: 'used', record };
      if (new Date(record.expiresAt) <= now) return { outcome: 'expired', record };

      const usedAt = now.toISOString();
      tx.update(ref, { status: 'used', usedAt });
      return { outcome: 'consumed', record: { ...record, status: 'used', usedAt } };
    });
  }
}
