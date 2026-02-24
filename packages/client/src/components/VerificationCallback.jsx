import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function VerificationCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const status = searchParams.get('status');
  const humanId = searchParams.get('humanId');
  const error = searchParams.get('error');

  useEffect(() => {
    if (status === 'success') {
      refreshUser();
    }
  }, [status]);

  const handleReturn = () => {
    navigate('/');
  };

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-panel max-w-md w-full p-8 rounded-2xl text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-human-bio/10 border border-human-bio/30">
            <CheckCircle className="w-10 h-10 text-human-bio" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Verification Complete</h2>
            <p className="text-slate-400">You have been verified as a unique human.</p>
          </div>
          {humanId && (
            <div className="bg-black/30 p-4 rounded-lg border border-white/5">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Your Human ID</div>
              <div className="font-mono text-lg text-human-neon">{humanId}</div>
            </div>
          )}
          <button
            onClick={handleReturn}
            className="w-full bg-human-bio text-slate-950 font-bold py-3 rounded-lg hover:bg-emerald-400 transition-all"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-panel max-w-md w-full p-8 rounded-2xl text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Verification Failed</h2>
            <p className="text-slate-400">{error || 'An error occurred during verification.'}</p>
          </div>
          <button
            onClick={handleReturn}
            className="w-full bg-slate-800 text-white font-bold py-3 rounded-lg hover:bg-slate-700 transition-all border border-white/10"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Loader2 className="w-8 h-8 text-human-neon animate-spin" />
    </div>
  );
}
