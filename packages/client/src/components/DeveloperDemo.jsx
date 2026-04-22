import React, { useState } from 'react';
import { Fingerprint, CheckCircle, AlertCircle, Loader2, Copy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export default function DeveloperDemo() {
  const { userData } = useAuth();
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleAuth = async () => {
    if (!userData?.isVerified || !userData?.humanId) {
      setError('Access Denied: User is not a verified human.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.verifyHuman(userData.humanId);
      if (result.verified) {
        setToken(result.token);
      } else {
        setError('Verification failed. Human ID not found.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const apiBase = import.meta.env.VITE_API_URL || window.location.origin;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Developer Integration</h2>
        <p className="text-slate-400">Test the RealH API and explore integration patterns.</p>
      </div>

      {/* Live test */}
      <div className="glass-panel p-8 rounded-2xl border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-6">Live Test</h3>

        <div className="flex justify-center mb-6">
          <button
            onClick={handleAuth}
            disabled={loading}
            className="group relative px-8 py-4 bg-slate-900 border border-human-neon/30 rounded-xl overflow-hidden hover:border-human-neon transition-all disabled:opacity-50"
          >
            <div className="absolute inset-0 bg-human-neon/5 group-hover:bg-human-neon/10 transition-all" />
            <div className="flex items-center gap-3 relative z-10">
              {loading ? (
                <Loader2 className="w-5 h-5 text-human-neon animate-spin" />
              ) : (
                <div className="p-1 bg-human-neon rounded-full">
                  <Fingerprint className="w-4 h-4 text-slate-950" />
                </div>
              )}
              <span className="text-white font-bold">Verify with RealH</span>
            </div>
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
            <div className="text-sm text-red-400">{error}</div>
          </div>
        )}

        {token && (
          <div className="space-y-4">
            <div className="p-4 bg-human-bio/10 border border-human-bio/20 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-human-bio mt-0.5" />
              <div className="flex-1">
                <div className="font-bold text-human-bio mb-1">Authentication Successful</div>
                <div className="text-sm text-slate-300 mb-3">Signed JWT verification token issued by RealH.</div>
                <div className="text-xs font-mono text-slate-500 break-all bg-black/20 p-3 rounded relative">
                  {token}
                  <button
                    onClick={() => handleCopy(token)}
                    className="absolute top-2 right-2 p-1 hover:bg-white/10 rounded"
                  >
                    <Copy className="w-3 h-3 text-slate-400" />
                  </button>
                </div>
                {copied && <div className="text-xs text-human-bio mt-1">Copied!</div>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* API Reference */}
      <div className="glass-panel p-8 rounded-2xl border border-slate-700 space-y-6">
        <h3 className="text-lg font-bold text-white">API Reference</h3>

        <div className="space-y-4">
          <ApiExample
            method="POST"
            path="/api/v1/verify/human"
            description="Verify a HumanID is a real, verified person"
            curl={`curl -X POST ${apiBase}/api/v1/verify/human \\
  -H "Content-Type: application/json" \\
  -d '{"humanId": "${userData?.humanId || 'YOUR_HUMAN_ID'}"}'`}
          />

          <ApiExample
            method="POST"
            path="/api/v1/verify"
            description="Verify a W3C Verifiable Credential signature"
            curl={`curl -X POST ${apiBase}/api/v1/verify \\
  -H "Content-Type: application/json" \\
  -d '{"credential": { ... }}'`}
          />

          <ApiExample
            method="GET"
            path="/.well-known/jwks.json"
            description="Get the server's public key to verify tokens yourself"
            curl={`curl ${apiBase}/.well-known/jwks.json`}
          />
        </div>
      </div>
    </div>
  );
}

function ApiExample({ method, path, description, curl }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(curl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-950/50 rounded-lg border border-slate-800 overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${method === 'GET' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
            {method}
          </span>
          <span className="font-mono text-sm text-slate-300">{path}</span>
        </div>
        <button onClick={handleCopy} className="text-xs text-slate-500 hover:text-white flex items-center gap-1">
          <Copy className="w-3 h-3" />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="px-4 py-2 text-sm text-slate-400">{description}</div>
      <div className="px-4 py-3 bg-black/30">
        <pre className="text-xs font-mono text-slate-500 whitespace-pre-wrap">{curl}</pre>
      </div>
    </div>
  );
}
