import React, { useState } from 'react';
import { CheckCircle, Copy, Download, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';

export default function CredentialViewer({ credential, onClose }) {
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const result = await api.verifyCredential(credential);
      setVerifyResult(result);
    } catch (err) {
      setVerifyResult({ valid: false, error: err.message });
    } finally {
      setVerifying(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(credential, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(credential, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credential-${credential.id?.split(':').pop() || 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-2xl rounded-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-white/10 flex justify-between items-center shrink-0">
          <h3 className="text-xl font-bold text-white">Verifiable Credential</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm">Close</button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {/* Credential subject summary */}
          <div className="space-y-2">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Creator</div>
            <div className="font-mono text-sm text-human-neon">
              {credential.credentialSubject?.creator?.id}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Work</div>
            <div className="text-white font-bold">{credential.credentialSubject?.work?.title}</div>
            <div className="font-mono text-xs text-slate-400">{credential.credentialSubject?.work?.contentHash}</div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Issued</div>
            <div className="text-sm text-slate-300">{credential.validFrom}</div>
          </div>

          {/* Raw JSON */}
          <div className="bg-black/30 p-4 rounded-lg border border-white/5 max-h-60 overflow-y-auto">
            <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap">
              {JSON.stringify(credential, null, 2)}
            </pre>
          </div>

          {/* Verification result */}
          {verifyResult && (
            <div className={`p-4 rounded-lg border flex items-start gap-3 ${verifyResult.valid ? 'bg-human-bio/10 border-human-bio/20' : 'bg-red-500/10 border-red-500/20'}`}>
              {verifyResult.valid ? (
                <CheckCircle className="w-5 h-5 text-human-bio mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
              )}
              <div>
                <div className={`font-bold ${verifyResult.valid ? 'text-human-bio' : 'text-red-400'}`}>
                  {verifyResult.valid ? 'Signature Valid' : 'Verification Failed'}
                </div>
                <div className="text-sm text-slate-400">
                  {verifyResult.valid
                    ? `Issued by ${verifyResult.issuer}`
                    : verifyResult.error}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-white/10 flex gap-3 shrink-0">
          <button onClick={handleVerify} disabled={verifying} className="flex-1 px-4 py-2 bg-human-neon text-slate-950 font-bold rounded-lg hover:bg-cyan-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Verify Signature
          </button>
          <button onClick={handleCopy} className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2">
            <Copy className="w-4 h-4" />
            {copied ? 'Copied!' : 'Copy JSON'}
          </button>
          <button onClick={handleDownload} className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
