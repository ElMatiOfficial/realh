import { auth } from './firebase';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  const token = await auth.currentUser?.getIdToken();

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await res.json();
  if (!data.ok) throw new Error(data.error?.message || 'API error');
  return data.data;
}

export const api = {
  // User profile
  getMe: () => request('/api/v1/me'),

  // Verification
  getProviders: () => request('/api/v1/verification/providers'),
  initiateVerification: (providerId) =>
    request('/api/v1/verification/initiate', {
      method: 'POST',
      body: JSON.stringify({ providerId }),
    }),
  getVerificationStatus: () => request('/api/v1/verification/status'),

  // Credentials
  issueCredential: (data) =>
    request('/api/v1/credentials/issue', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  listCredentials: () => request('/api/v1/credentials'),
  getCredential: (id) => request(`/api/v1/credentials/${encodeURIComponent(id)}`),

  // Public verification
  verifyCredential: (credential) =>
    request('/api/v1/verify', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    }),
  verifyHuman: (humanId) =>
    request('/api/v1/verify/human', {
      method: 'POST',
      body: JSON.stringify({ humanId }),
    }),
};

export async function hashContent(content) {
  const data = new TextEncoder().encode(content);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
