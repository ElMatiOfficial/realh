import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import AssetRegistry from './components/AssetRegistry';
import DeveloperDemo from './components/DeveloperDemo';
import VerificationCallback from './components/VerificationCallback';

function AppLayout() {
  const { user, userData, loading } = useAuth();
  const [view, setView] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-human-neon">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-human-neon/30">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-human-neon/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-human-bio/5 rounded-full blur-[100px]" />
      </div>

      {!user ? (
        <AuthScreen />
      ) : (
        <div className="relative z-10 flex flex-col min-h-screen">
          <Navbar setView={setView} currentView={view} />
          <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
            {view === 'dashboard' && <Dashboard />}
            {view === 'registry' && <AssetRegistry />}
            {view === 'demo' && <DeveloperDemo />}
          </main>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/verification/complete" element={<VerificationCallback />} />
      <Route path="*" element={<AppLayout />} />
    </Routes>
  );
}
