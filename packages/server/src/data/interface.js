// Data-layer contract.
//
// Every persistence backend (Memory, Firestore, Postgres, ...) must implement
// the same method set so route code never branches on which backend is active.
// Adding a new backend = implement this interface and register it in
// initializeDataLayer(). Extending the interface = update the typedef below,
// add the method to every implementation, and add a test.
//
// See packages/server/src/data/memory.js for the reference implementation.

/**
 * @typedef {object} UserRecord
 * @property {string} id                            Stable account ID (Firebase UID or equivalent).
 * @property {string} email                         User-provided email; not verified by the server.
 * @property {boolean} isVerified                   True once identity verification succeeded.
 * @property {string|null} humanId                  Public opaque handle; null until verified.
 * @property {string|null} verifiedAt               ISO-8601 timestamp of successful verification.
 * @property {string|null} verificationProvider     Provider ID that issued the verification.
 * @property {number} credentialCount               Monotonic count of credentials issued to this user.
 * @property {string} joinedAt                      ISO-8601 timestamp of first auth.
 */

/**
 * @typedef {object} VerificationSessionRecord
 * @property {string} sessionId                     Opaque ID emitted by verificationService.
 * @property {string} userId                        Account ID the session belongs to.
 * @property {string} providerId                    Provider adapter ID.
 * @property {object} state                         Provider-specific opaque state object.
 * @property {'pending'|'completed'|'failed'} status
 * @property {string} createdAt
 * @property {string} expiresAt
 * @property {string} [completedAt]
 */

/**
 * @typedef {object} CredentialRecord
 * @property {string} credentialId
 * @property {string} userId
 * @property {string} humanId
 * @property {string} title
 * @property {string} description
 * @property {string} contentHash                   'sha256:<64 hex>' form.
 * @property {string} contentType                   IANA media type.
 * @property {string} issuedAt
 * @property {object} credential                    Full W3C VC JSON (signed).
 */

/**
 * @typedef {object} DataLayer
 *
 * Users
 * @property {(uid: string) => Promise<UserRecord | null>} getUser
 * @property {(uid: string, data: Omit<UserRecord, 'id'>) => Promise<void>} createUser
 * @property {(uid: string, data: Partial<UserRecord>) => Promise<void>} updateUser
 * @property {(humanId: string) => Promise<UserRecord | null>} findVerifiedUserByHumanId
 *   Returns a user whose humanId matches and isVerified is true. null otherwise.
 *   Used by the public /verify/human endpoint; must be implemented by every backend.
 *
 * Verification sessions
 * @property {(sessionId: string, data: Omit<VerificationSessionRecord, 'sessionId'>) => Promise<void>} createVerificationSession
 * @property {(sessionId: string) => Promise<VerificationSessionRecord | null>} getVerificationSession
 * @property {(sessionId: string, data: Partial<VerificationSessionRecord>) => Promise<void>} updateVerificationSession
 * @property {(sessionId: string) => Promise<void>} deleteVerificationSession
 *
 * Credentials
 * @property {(credentialId: string, data: Omit<CredentialRecord, 'credentialId'>) => Promise<void>} createCredential
 * @property {(credentialId: string) => Promise<CredentialRecord | null>} getCredential
 * @property {(userId: string) => Promise<CredentialRecord[]>} listCredentialsByUser
 */

// This file is types-only. No runtime exports.
export {};
