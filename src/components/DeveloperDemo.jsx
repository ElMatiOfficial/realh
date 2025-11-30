import React, { useState } from 'react';
import { Fingerprint, CheckCircle } from 'lucide-react';

export default function DeveloperDemo({ user, userData }) {
    const [token, setToken] = useState(null);

    const handleAuth = () => {
        if (!userData?.isVerified) {
            alert("Access Denied: User is not a verified human.");
            return;
        }
        setToken("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." + crypto.randomUUID());
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-2">Developer Integration</h2>
                <p className="text-slate-400">Test the HumanLedger Auth Provider.</p>
            </div>

            <div className="glass-panel p-8 rounded-2xl border border-slate-700">
                <div className="mb-8 p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-sm text-slate-400">
                    <span className="text-purple-400">const</span> <span className="text-blue-400">humanAuth</span> = <span className="text-yellow-400">await</span> HumanLedger.<span className="text-blue-300">authenticate</span>();
                </div>

                <div className="flex justify-center">
                    <button
                        onClick={handleAuth}
                        className="group relative px-8 py-4 bg-slate-900 border border-human-neon/30 rounded-xl overflow-hidden hover:border-human-neon transition-all"
                    >
                        <div className="absolute inset-0 bg-human-neon/5 group-hover:bg-human-neon/10 transition-all" />
                        <div className="flex items-center gap-3 relative z-10">
                            <div className="p-1 bg-human-neon rounded-full">
                                <Fingerprint className="w-4 h-4 text-slate-950" />
                            </div>
                            <span className="text-white font-bold">Log in with HumanLedger</span>
                        </div>
                    </button>
                </div>

                {token && (
                    <div className="mt-8 animate-in fade-in slide-in-from-bottom-4">
                        <div className="p-4 bg-human-bio/10 border border-human-bio/20 rounded-lg flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-human-bio mt-0.5" />
                            <div>
                                <div className="font-bold text-human-bio mb-1">Authentication Successful</div>
                                <div className="text-sm text-slate-300 mb-2">User verified as 99.9% Human.</div>
                                <div className="text-xs font-mono text-slate-500 break-all bg-black/20 p-2 rounded">
                                    {token}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
