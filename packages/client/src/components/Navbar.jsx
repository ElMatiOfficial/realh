import React from 'react';
import { Fingerprint, Cpu, FileText, Lock, LogOut } from 'lucide-react';
import { logOut } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ setView, currentView }) {
  const { user, userData } = useAuth();

  return (
    <nav className="glass-panel sticky top-0 z-50 border-b border-white/10 px-6 py-4 flex justify-between items-center">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('dashboard')}>
        <div className="bg-human-neon/10 p-2 rounded-lg border border-human-neon/20">
          <Fingerprint className="w-6 h-6 text-human-neon" />
        </div>
        <h1 className="text-xl font-bold tracking-wider text-white">HUMAN<span className="text-human-neon">LEDGER</span></h1>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex gap-1 bg-slate-900/50 p-1 rounded-lg border border-white/5">
          <NavBtn active={currentView === 'dashboard'} onClick={() => setView('dashboard')} icon={Cpu} label="Dashboard" />
          <NavBtn active={currentView === 'registry'} onClick={() => setView('registry')} icon={FileText} label="Registry" />
          <NavBtn active={currentView === 'demo'} onClick={() => setView('demo')} icon={Lock} label="Dev Demo" />
        </div>

        <div className="flex items-center gap-4 pl-6 border-l border-white/10">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium text-white">{user?.email}</div>
            <div className={`text-xs ${userData?.isVerified ? 'text-human-bio' : 'text-slate-400'}`}>
              {userData?.isVerified ? 'VERIFIED HUMAN' : 'UNVERIFIED ID'}
            </div>
          </div>
          <button onClick={logOut} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}

function NavBtn({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${active
        ? 'bg-human-neon/10 text-human-neon shadow-[0_0_10px_rgba(0,240,255,0.1)]'
        : 'text-slate-400 hover:text-white hover:bg-white/5'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
