import React, { useState, useEffect } from 'react';
import { Scan, LogOut, Loader2, CheckCircle, Shield } from 'lucide-react';
import { api } from '../lib/api';

export default function VerificationFlow({ onClose, onSuccess }) {
  const [step, setStep] = useState('providers'); // providers | loading | redirecting
  const [providers, setProviders] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getProviders()
      .then((data) => {
        setProviders(data.providers);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleSelectProvider = async (providerId) => {
    setStep('loading');
    setError(null);
    try {
      const result = await api.initiateVerification(providerId);
      setStep('redirecting');
      // Redirect to the provider's authorization page
      window.location.href = result.redirectUrl;
    } catch (err) {
      setError(err.message);
      setStep('providers');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-lg rounded-2xl overflow-hidden border-human-neon/30 shadow-[0_0_50px_rgba(0,240,255,0.1)]">
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Scan className="w-5 h-5 text-human-neon" />
            Identity Verification
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {step === 'providers' && (
            <div className="space-y-6">
              <p className="text-slate-400 text-sm">
                Select an identity verification provider. You will be redirected to verify your identity through a trusted third-party service.
              </p>

              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 text-human-neon animate-spin" />
                </div>
              ) : (
                <div className="space-y-3">
                  {providers.map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => handleSelectProvider(provider.id)}
                      className="w-full p-4 glass-card rounded-xl text-left flex items-center gap-4 hover:border-human-neon/30 transition-all"
                    >
                      <div className="bg-human-neon/10 p-3 rounded-lg border border-human-neon/20">
                        <Shield className="w-6 h-6 text-human-neon" />
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-white">{provider.name}</div>
                        <div className="text-sm text-slate-400">{provider.description}</div>
                      </div>
                      <div className="text-xs font-mono text-slate-500 bg-slate-800 px-2 py-1 rounded">
                        {provider.country}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'loading' && (
            <div className="flex flex-col items-center py-12 space-y-4">
              <Loader2 className="w-12 h-12 text-human-neon animate-spin" />
              <p className="text-slate-400">Preparing verification...</p>
            </div>
          )}

          {step === 'redirecting' && (
            <div className="flex flex-col items-center py-12 space-y-4">
              <Loader2 className="w-12 h-12 text-human-neon animate-spin" />
              <p className="text-slate-400">Redirecting to identity provider...</p>
              <p className="text-xs text-slate-500">If you are not redirected, please try again.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
