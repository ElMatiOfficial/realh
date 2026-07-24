import React, { useEffect, useRef, useState } from 'react';
import { KeyRound, Copy, Check, RefreshCw, Loader2, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

// Generator side of live codes: a verified user mints a single-use code and
// says it over whatever channel they're being challenged on. The counterpart
// public page lives at /verify.

function useCountdown(expiresAt) {
  const [secondsLeft, setSecondsLeft] = useState(null);

  useEffect(() => {
    if (!expiresAt) {
      setSecondsLeft(null);
      return undefined;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((new Date(expiresAt) - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [expiresAt]);

  return secondsLeft;
}

export default function LiveCodePanel() {
  const { userData, refreshUser } = useAuth();
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [note, setNote] = useState('');
  const [current, setCurrent] = useState(null); // { code, expiresAt, ttlSeconds, note }
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const copyTimer = useRef(null);

  const secondsLeft = useCountdown(current?.expiresAt);
  const expired = current && secondsLeft === 0;

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const saveName = async (e) => {
    e.preventDefault();
    setError('');
    setSavingName(true);
    try {
      await api.updateProfile({ displayName: nameInput });
      await refreshUser();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingName(false);
    }
  };

  const generate = async () => {
    setError('');
    setGenerating(true);
    setCopied(false);
    try {
      const data = await api.generateLiveCode(note.trim() || undefined);
      setCurrent({ ...data, note: note.trim() });
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(current.code);
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permissions, http) — the code is on screen.
    }
  };

  const verifyUrl = `${window.location.origin}/verify`;

  return (
    <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-human-bio/10 p-2 rounded-lg border border-human-bio/20">
          <KeyRound className="w-5 h-5 text-human-bio" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Live Verification Code</h3>
          <p className="text-sm text-slate-400">
            Prove it&apos;s really you on a call or chat. One use, {current?.ttlSeconds || 120}{' '}
            seconds.
          </p>
        </div>
      </div>

      {error && <div className="my-3 text-sm text-red-400">{error}</div>}

      {!userData?.isVerified ? (
        <p className="mt-4 text-sm text-slate-400">
          Complete identity verification above to start generating live codes.
        </p>
      ) : !userData?.displayName ? (
        <form onSubmit={saveName} className="mt-4 space-y-3">
          <p className="text-sm text-slate-300 flex items-center gap-2">
            <UserRound className="w-4 h-4 text-human-neon" />
            First, set the public name people will see when your code checks out:
          </p>
          <div className="flex gap-3">
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              minLength={2}
              maxLength={60}
              required
              placeholder="e.g. Ana García — CFO, Acme Bank"
              className="flex-1 bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-human-neon outline-none"
            />
            <button
              type="submit"
              disabled={savingName}
              className="px-5 py-2 bg-human-neon text-slate-950 font-bold rounded-lg hover:bg-cyan-400 transition-all disabled:opacity-50"
            >
              {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 space-y-4">
          {!current || expired ? (
            <>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={140}
                placeholder="Optional context, e.g. “Call with Juan about the Q3 transfer”"
                className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:border-human-neon outline-none"
              />
              <button
                onClick={generate}
                disabled={generating}
                className="w-full py-3 bg-human-bio text-slate-950 font-bold rounded-lg hover:bg-emerald-400 transition-all shadow-[0_0_15px_rgba(52,211,153,0.2)] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {expired ? <RefreshCw className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
                    {expired ? 'Code expired — generate a new one' : 'Generate code'}
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="text-center">
              <div className="font-mono text-4xl tracking-[0.2em] text-white bg-slate-950/60 border border-human-bio/30 rounded-xl py-5 select-all">
                {current.code}
              </div>
              <div className="mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-human-bio transition-all duration-300"
                  style={{ width: `${(secondsLeft / current.ttlSeconds) * 100}%` }}
                />
              </div>
              <div className="mt-2 text-sm text-slate-400">
                Valid for <span className="text-human-bio font-bold">{secondsLeft}s</span> · works
                exactly once
              </div>
              <div className="mt-4 flex gap-3 justify-center">
                <button
                  onClick={copy}
                  className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white hover:bg-slate-700 transition-all flex items-center gap-2"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-human-bio" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  {copied ? 'Copied' : 'Copy code'}
                </button>
                <button
                  onClick={generate}
                  disabled={generating}
                  className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white hover:bg-slate-700 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" /> New code
                </button>
              </div>
            </div>
          )}

          <p className="text-xs text-slate-500 border-t border-white/5 pt-3">
            Share the code in any chat or say it on the call. The other person checks it at{' '}
            <span className="text-slate-300 font-mono">{verifyUrl}</span> — tell them to type that
            address themselves, never to follow a link they were sent.
          </p>
        </div>
      )}
    </div>
  );
}
