// Postgres implementation of the DataLayer interface (see ./interface.js).
//
// Status: reference skeleton. The SQL is written against the schema in
// postgres.schema.sql and should work as-is, but RealH's CI only exercises
// MemoryDataLayer today. Before pointing production traffic at this backend:
//   1. Run packages/server/src/data/postgres.schema.sql against a real DB.
//   2. Wire DATA_LAYER=postgres + DATABASE_URL env vars (see initializeDataLayer).
//   3. Write integration tests against a throwaway Postgres — vitest +
//      testcontainers-node works well. Until those tests exist, treat this
//      file as "reviewed but not yet battle-tested".
//
// `pg` is an optional peer dependency; only install it if you intend to use
// this backend. A lazy import in initializeDataLayer keeps non-Postgres
// deployments from paying the install cost.

/**
 * @implements {import('./interface.js').DataLayer}
 */
export class PostgresDataLayer {
  /**
   * @param {import('pg').Pool} pool - Initialized pg.Pool from the caller.
   *   Wiring the pool outside this class means callers own connection-string
   *   handling, SSL config, and teardown.
   */
  constructor(pool) {
    if (!pool) throw new Error('PostgresDataLayer requires a pg.Pool');
    this.pool = pool;
  }

  // ---------- Users ----------

  async getUser(uid) {
    const { rows } = await this.pool.query(
      `SELECT id, email, is_verified AS "isVerified",
              human_id AS "humanId",
              verified_at AS "verifiedAt",
              verification_provider AS "verificationProvider",
              credential_count AS "credentialCount",
              joined_at AS "joinedAt"
       FROM users WHERE id = $1`,
      [uid]
    );
    return rows[0] ?? null;
  }

  async createUser(uid, data) {
    await this.pool.query(
      `INSERT INTO users (
         id, email, is_verified, human_id, verified_at,
         verification_provider, credential_count, joined_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        uid,
        data.email,
        data.isVerified ?? false,
        data.humanId ?? null,
        data.verifiedAt ?? null,
        data.verificationProvider ?? null,
        data.credentialCount ?? 0,
        data.joinedAt ?? new Date().toISOString(),
      ]
    );
  }

  async updateUser(uid, data) {
    // Build a dynamic SET clause over whatever fields were provided. Keeps
    // the API shape matching MemoryDataLayer.updateUser (Object.assign-style
    // partial update) without an ORM.
    const map = {
      email: 'email',
      isVerified: 'is_verified',
      humanId: 'human_id',
      verifiedAt: 'verified_at',
      verificationProvider: 'verification_provider',
      credentialCount: 'credential_count',
    };
    const sets = [];
    const values = [];
    for (const [k, column] of Object.entries(map)) {
      if (Object.prototype.hasOwnProperty.call(data, k)) {
        values.push(data[k]);
        sets.push(`${column} = $${values.length}`);
      }
    }
    if (sets.length === 0) return;
    values.push(uid);
    await this.pool.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${values.length}`,
      values
    );
  }

  async findVerifiedUserByHumanId(humanId) {
    const { rows } = await this.pool.query(
      `SELECT id, email, is_verified AS "isVerified",
              human_id AS "humanId",
              verified_at AS "verifiedAt",
              verification_provider AS "verificationProvider",
              credential_count AS "credentialCount",
              joined_at AS "joinedAt"
       FROM users
       WHERE human_id = $1 AND is_verified = TRUE
       LIMIT 1`,
      [humanId]
    );
    return rows[0] ?? null;
  }

  // ---------- Verification sessions ----------

  async createVerificationSession(sessionId, data) {
    await this.pool.query(
      `INSERT INTO verification_sessions (
         session_id, user_id, provider_id, state, status, created_at, expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        sessionId,
        data.userId,
        data.providerId,
        JSON.stringify(data.state),
        data.status,
        data.createdAt,
        data.expiresAt,
      ]
    );
  }

  async getVerificationSession(sessionId) {
    const { rows } = await this.pool.query(
      `SELECT session_id AS "sessionId",
              user_id AS "userId",
              provider_id AS "providerId",
              state, status,
              created_at AS "createdAt",
              expires_at AS "expiresAt",
              completed_at AS "completedAt"
       FROM verification_sessions WHERE session_id = $1`,
      [sessionId]
    );
    return rows[0] ?? null;
  }

  async updateVerificationSession(sessionId, data) {
    const map = {
      status: 'status',
      completedAt: 'completed_at',
    };
    const sets = [];
    const values = [];
    for (const [k, column] of Object.entries(map)) {
      if (Object.prototype.hasOwnProperty.call(data, k)) {
        values.push(data[k]);
        sets.push(`${column} = $${values.length}`);
      }
    }
    if (sets.length === 0) return;
    values.push(sessionId);
    await this.pool.query(
      `UPDATE verification_sessions SET ${sets.join(', ')} WHERE session_id = $${values.length}`,
      values
    );
  }

  async deleteVerificationSession(sessionId) {
    await this.pool.query(
      `DELETE FROM verification_sessions WHERE session_id = $1`,
      [sessionId]
    );
  }

  // ---------- Credentials ----------

  async createCredential(credentialId, data) {
    await this.pool.query(
      `INSERT INTO credentials (
         credential_id, user_id, human_id, title, description,
         content_hash, content_type, issued_at, credential
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        credentialId,
        data.userId,
        data.humanId,
        data.title,
        data.description ?? '',
        data.contentHash,
        data.contentType,
        data.issuedAt,
        JSON.stringify(data.credential),
      ]
    );
  }

  async getCredential(credentialId) {
    const { rows } = await this.pool.query(
      `SELECT credential_id AS "credentialId",
              user_id AS "userId",
              human_id AS "humanId",
              title, description,
              content_hash AS "contentHash",
              content_type AS "contentType",
              issued_at AS "issuedAt",
              credential
       FROM credentials WHERE credential_id = $1`,
      [credentialId]
    );
    return rows[0] ?? null;
  }

  async listCredentialsByUser(userId) {
    const { rows } = await this.pool.query(
      `SELECT credential_id AS "credentialId",
              user_id AS "userId",
              human_id AS "humanId",
              title, description,
              content_hash AS "contentHash",
              content_type AS "contentType",
              issued_at AS "issuedAt",
              credential
       FROM credentials WHERE user_id = $1
       ORDER BY issued_at DESC`,
      [userId]
    );
    return rows;
  }
}
