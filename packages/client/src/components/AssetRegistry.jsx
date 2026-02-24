import React, { useState, useEffect } from 'react';
import { Plus, AlertCircle, FileText, Loader2, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, hashContent } from '../lib/api';
import CredentialViewer from './CredentialViewer';

export default function AssetRegistry() {
  const { userData, refreshUser } = useAuth();
  const [credentials, setCredentials] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCredentials();
  }, []);

  const fetchCredentials = async () => {
    try {
      const data = await api.listCredentials();
      setCredentials(data.credentials || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (assetData) => {
    try {
      await api.issueCredential(assetData);
      setShowForm(false);
      await fetchCredentials();
      await refreshUser();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Credential Registry</h2>
          <p className="text-slate-400">Certify your creative works with verifiable credentials.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={!userData?.isVerified}
          className="px-4 py-2 bg-human-neon text-slate-950 font-bold rounded-lg hover:bg-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Issue New Credential
        </button>
      </div>

      {!userData?.isVerified && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400 flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          Identity verification required to issue credentials.
        </div>
      )}

      {showForm && (
        <AssetForm onClose={() => setShowForm(false)} onSubmit={handleCreate} />
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-human-neon animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {credentials.map((cred) => (
            <CredentialCard key={cred.credentialId} credential={cred} />
          ))}
          {credentials.length === 0 && !showForm && (
            <div className="col-span-2 py-12 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl">
              No credentials issued yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AssetForm({ onClose, onSubmit }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [hash, setHash] = useState('');
  const [calculating, setCalculating] = useState(false);

  const generateHash = async () => {
    if (!title || !content) return;
    setCalculating(true);
    try {
      const computed = await hashContent(title + '\n' + content);
      setHash(computed);
    } catch {
      // fallback should never happen since Web Crypto is widely supported
    } finally {
      setCalculating(false);
    }
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border-human-neon/20 mb-8">
      <h3 className="text-lg font-bold text-white mb-4">Issue New Credential</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Work Title</label>
          <input
            className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-human-neon outline-none"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Content / Description</label>
          <textarea
            className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-human-neon outline-none h-24"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={generateHash}
            disabled={!title || !content}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Compute SHA-256'}
          </button>
          {hash && (
            <div className="font-mono text-xs text-human-neon break-all">
              sha256:{hash}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
          <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white">
            Cancel
          </button>
          <button
            onClick={() => onSubmit({ title, contentHash: hash, contentType: 'text/plain', description: content })}
            disabled={!hash}
            className="px-6 py-2 bg-human-neon text-slate-950 font-bold rounded-lg hover:bg-cyan-400 disabled:opacity-50"
          >
            Issue Certificate
          </button>
        </div>
      </div>
    </div>
  );
}

function CredentialCard({ credential }) {
  const [viewingFull, setViewingFull] = useState(false);
  const [fullCredential, setFullCredential] = useState(null);

  const handleView = async () => {
    try {
      const data = await api.getCredential(credential.credentialId);
      setFullCredential(data.credential);
      setViewingFull(true);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <>
      <div className="glass-card p-0 rounded-xl overflow-hidden group relative">
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-human-neon to-transparent" />
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-slate-900/50 p-2 rounded-lg border border-white/10">
              <FileText className="w-6 h-6 text-human-neon" />
            </div>
            <div className="text-xs font-mono text-slate-500">
              {new Date(credential.issuedAt).toLocaleDateString()}
            </div>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">{credential.title}</h3>

          <div className="bg-black/30 p-3 rounded-lg border border-white/5 mb-4">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Content Hash</div>
            <div className="font-mono text-xs text-human-neon truncate">sha256:{credential.contentHash}</div>
          </div>

          <button
            onClick={handleView}
            className="w-full px-3 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors text-sm flex items-center justify-center gap-2"
          >
            <Eye className="w-4 h-4" />
            View Credential
          </button>
        </div>

        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center backdrop-blur-[1px]">
          <div className="border-2 border-human-neon/50 px-4 py-2 rounded text-human-neon font-bold tracking-widest transform -rotate-12">
            HUMAN CERTIFIED
          </div>
        </div>
      </div>

      {viewingFull && fullCredential && (
        <CredentialViewer
          credential={fullCredential}
          onClose={() => setViewingFull(false)}
        />
      )}
    </>
  );
}
