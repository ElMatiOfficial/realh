import React, { useState } from 'react';
import { ShieldCheck, CheckCircle, AlertCircle, Scan, FileText } from 'lucide-react';
import VerificationModal from './VerificationModal';

export default function Dashboard({ user, userData, refreshUser }) {
    const [showVerifyModal, setShowVerifyModal] = useState(false);

    return (
        <div className="space-y-8">
            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-2">Identity Dashboard</h2>
                    <p className="text-slate-400">Manage your biometric status and assets.</p>
                </div>
                {userData?.isVerified && (
                    <div className="glass-card px-4 py-2 rounded-full border-human-bio/30 bg-human-bio/5 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-human-bio animate-pulse" />
                        <span className="text-human-bio text-sm font-medium">System Active</span>
                    </div>
                )}
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Identity Card */}
                <div className="glass-panel p-6 rounded-2xl md:col-span-2 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-32 bg-human-neon/5 rounded-full blur-3xl group-hover:bg-human-neon/10 transition-all" />

                    <div className="flex justify-between items-start mb-8 relative z-10">
                        <div>
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Human ID</div>
                            <div className="font-mono text-2xl text-white tracking-wider">
                                {userData?.humanId || 'NOT ASSIGNED'}
                            </div>
                        </div>
                        <ShieldCheck className={`w-10 h-10 ${userData?.isVerified ? 'text-human-bio' : 'text-slate-600'}`} />
                    </div>

                    <div className="flex items-center gap-4 relative z-10">
                        <div className={`px-4 py-2 rounded-lg border ${userData?.isVerified ? 'bg-human-bio/10 border-human-bio/30 text-human-bio' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                            <div className="flex items-center gap-2 font-bold">
                                {userData?.isVerified ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                {userData?.isVerified ? 'VERIFIED HUMAN' : 'UNVERIFIED ENTITY'}
                            </div>
                        </div>
                        {!userData?.isVerified && (
                            <button
                                onClick={() => setShowVerifyModal(true)}
                                className="px-6 py-2 bg-human-neon text-slate-950 font-bold rounded-lg hover:bg-cyan-400 transition-all shadow-[0_0_15px_rgba(0,240,255,0.2)] flex items-center gap-2"
                            >
                                <Scan className="w-4 h-4" />
                                Initiate Verification
                            </button>
                        )}
                    </div>
                </div>

                {/* Stats Card */}
                <div className="glass-panel p-6 rounded-2xl flex flex-col justify-center items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 border border-slate-700">
                        <FileText className="w-8 h-8 text-slate-400" />
                    </div>
                    <div className="text-3xl font-bold text-white mb-1">0</div>
                    <div className="text-sm text-slate-400">Registered Assets</div>
                </div>
            </div>

            {showVerifyModal && (
                <VerificationModal
                    onClose={() => setShowVerifyModal(false)}
                    onSuccess={() => {
                        refreshUser();
                        setShowVerifyModal(false);
                    }}
                    user={user}
                />
            )}
        </div>
    );
}
