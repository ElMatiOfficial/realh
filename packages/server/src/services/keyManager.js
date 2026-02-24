import { generateKeyPair, exportJWK, importJWK } from 'jose';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const KEY_ID = 'humanledger-key-1';
const ALG = 'EdDSA';

let privateKey = null;
let publicKey = null;
let publicJwk = null;

export async function initializeKeys(keysDir) {
  const dir = path.resolve(keysDir || 'keys');
  const privatePath = path.join(dir, 'private.jwk.json');
  const publicPath = path.join(dir, 'public.jwk.json');

  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  if (existsSync(privatePath) && existsSync(publicPath)) {
    const privJwk = JSON.parse(await readFile(privatePath, 'utf-8'));
    const pubJwk = JSON.parse(await readFile(publicPath, 'utf-8'));
    privateKey = await importJWK(privJwk, ALG);
    publicKey = await importJWK(pubJwk, ALG);
    publicJwk = pubJwk;
    console.log('Loaded existing Ed25519 key pair');
  } else {
    const pair = await generateKeyPair(ALG, { crv: 'Ed25519' });
    const privJwk = { ...await exportJWK(pair.privateKey), kid: KEY_ID, alg: ALG, use: 'sig' };
    const pubJwk = { ...await exportJWK(pair.publicKey), kid: KEY_ID, alg: ALG, use: 'sig' };

    await writeFile(privatePath, JSON.stringify(privJwk, null, 2));
    await writeFile(publicPath, JSON.stringify(pubJwk, null, 2));

    privateKey = pair.privateKey;
    publicKey = pair.publicKey;
    publicJwk = pubJwk;
    console.log('Generated new Ed25519 key pair');
  }
}

export function getPrivateKey() { return privateKey; }
export function getPublicKey() { return publicKey; }
export function getPublicJwk() { return publicJwk; }
export function getKeyId() { return KEY_ID; }
