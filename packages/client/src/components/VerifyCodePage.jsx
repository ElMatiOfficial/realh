import React, { useState } from 'react';
import {
  Fingerprint,
  ShieldCheck,
  ShieldX,
  Clock,
  AlertTriangle,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { api } from '../lib/api';

// Public verifier page — the trust anchor of the live-code flow. Deliberately
// works with no account and no auth: the employee who just got a suspicious
// "CEO" call types the address themselves and checks the code here. All the
// negative states are designed to be as loud as the positive one; an
// already-used code is the signature of a replay attempt and says so.

function timeAgo(iso) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000));
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
}

const FAILURE_CONTENT = {
  invalid: {
    icon: ShieldX,
    tone: 'red',
    title: 'Code not recognized',
    body: 'This code does not exist or is mistyped. Treat the person as UNVERIFIED. Ask them to read it again — if they cannot produce a working code, assume you are not talking to who they claim to be.',
  },
  expired: {
    icon: Clock,
    tone: 'amber',
    title: 'Code expired',
    body: 'This code was real but its window has passed. Ask the person to generate a fresh one right now — a real account holder can do that in seconds.',
  },
  already_used: {
    icon: AlertTriangle,
    tone: 'red',
    title: 'Code already used',
    body: 'Someone verified this code before you. That is exactly what a replayed, stolen code looks like. Do NOT trust it. Ask for a brand-new code generated while you watch.',
  },
};

const TONE_STYLES = {
  red: 'border-red-500/30 bg-red-500/5 text-red-400',
  amber: 'border-amber-500/30 bg-amber-500/5 text-amber-400',
};

export default function VerifyCodePage() {
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setChecking(true);
    try {
      setResult(await api.verifyLiveCode(code));
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  };

  const reset = () => {
    setResult(null);
    setCode('');
    setError('');
  };

  const failure = result && !result.valid ? FAILURE_CONTENT[result.reason] : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-human-neon/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-human-bio/5 rounded-full blur-[100px]" />
      </div>

      <header className="relative z-10 px-6 py-4 flex items-center gap-3">
        <div className="bg-human-neon/10 p-2 rounded-lg border border-human-neon/20">
          <Fingerprint className="w-6 h-6 text-human-neon" />
        </div>
        <a href="/" className="text-xl font-bold tracking-wider text-white">
          REAL<span className="text-human-neon">H</span>
        </a>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="glass-panel p-8 rounded-2xl">
            <h1 className="text-2xl font-bold text-white mb-2">Verify a live code</h1>
            <p className="text-slate-400 text-sm mb-6">
              Someone claims to be a real, verified person? Ask them for their RealH code and check
              it here. A genuine code works exactly once and only for a couple of minutes.
            </p>

            {!result ? (
              <form onSubmit={submit} className="space-y-4">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX"
                  maxLength={16}
                  required
                  autoFocus
                  className="w-full text-center font-mono text-3xl tracking-[0.2em] bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-4 text-white placeholder:text-slate-700 focus:border-human-neon focus:ring-1 focus:ring-human-neon outline-none transition-all"
                />
                {error && <div className="text-sm text-red-400">{error}</div>}
                <button
                  type="submit"
                  disabled={checking || code.replace(/[\s-]/g, '').length < 4}
                  className="w-full bg-human-neon text-slate-950 font-bold py-3 rounded-lg hover:bg-cyan-400 transition-all shadow-[0_0_20px_rgba(0,240,255,0.3)] disabled:opacity-50"
                >
                  {checking ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Check code'}
                </button>
              </form>
            ) : result.valid ? (
              <div className="border border-human-bio/30 bg-human-bio/5 rounded-xl p-6 text-center">
                <ShieldCheck className="w-12 h-12 text-human-bio mx-auto mb-3" />
                <div className="text-human-bio font-bold text-lg mb-4">
                  VERIFIED — this code is genuine
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {result.person.displayName || 'Verified account'}
                </div>
                <div className="font-mono text-xs text-slate-400 mb-4">
                  Human ID {result.person.humanId}
                </div>
                <dl className="text-sm text-slate-300 space-y-1 text-left bg-slate-950/40 rounded-lg p-4">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Code generated</dt>
                    <dd>{timeAgo(result.generatedAt)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Identity verified since</dt>
                    <dd>{new Date(result.person.verifiedAt).toLocaleDateString()}</dd>
                  </div>
                  {result.note && (
                    <div className="pt-2 border-t border-white/5">
                      <dt className="text-slate-500 mb-1">They said this code is for:</dt>
                      <dd className="text-white">“{result.note}”</dd>
                    </div>
                  )}
                </dl>
                <p className="text-xs text-slate-500 mt-4">
                  This code is now used up. If the same code is offered to anyone again, it will be
                  rejected.
                </p>
              </div>
            ) : (
              <div className={`border rounded-xl p-6 text-center ${TONE_STYLES[failure.tone]}`}>
                <failure.icon className="w-12 h-12 mx-auto mb-3" />
                <div className="font-bold text-lg mb-2">{failure.title}</div>
                <p className="text-sm text-slate-300">{failure.body}</p>
                {result.usedAt && (
                  <p className="text-xs text-slate-500 mt-3">First used {timeAgo(result.usedAt)}.</p>
                )}
              </div>
            )}

            {result && (
              <button
                onClick={reset}
                className="mt-4 w-full py-2 text-sm text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Verify another code
              </button>
            )}
          </div>

          <p className="text-xs text-slate-600 text-center mt-4 px-6">
            Only trust this page if you typed the address into your browser yourself. Never follow a
            verification link someone sent you — a scammer can fake a page that looks like this one.
          </p>
        </div>
      </main>
    </div>
  );
}
