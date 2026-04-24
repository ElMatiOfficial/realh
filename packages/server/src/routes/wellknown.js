import { Router } from 'express';
import { getPublicJwk } from '../services/signer/index.js';

const router = Router();

// GET /.well-known/jwks.json — public key for credential verification
router.get('/jwks.json', (req, res) => {
  const jwk = getPublicJwk();
  res.json({
    keys: [jwk],
  });
});

// GET /.well-known/did.json — DID document for the server
router.get('/did.json', (req, res) => {
  const hostname = req.hostname || 'localhost';
  const did = `did:web:${hostname}`;
  const jwk = getPublicJwk();

  res.json({
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/ed25519-2020/v1',
    ],
    id: did,
    verificationMethod: [{
      id: `${did}#key-1`,
      type: 'Ed25519VerificationKey2020',
      controller: did,
      publicKeyJwk: jwk,
    }],
    authentication: [`${did}#key-1`],
    assertionMethod: [`${did}#key-1`],
  });
});

export default router;
