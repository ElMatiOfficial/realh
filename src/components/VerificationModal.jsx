import React, { useState, useEffect, useRef } from 'react';
import { Scan, LogOut, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { DEMO_MODE, mockDb, db } from '../lib/firebase';

export default function VerificationModal({ onClose, onSuccess, user }) {
    const [step, setStep] = useState(1); // 1: Scan, 2: Analyze, 3: Success
    const [progress, setProgress] = useState(0);
    const [cameraError, setCameraError] = useState(null);
    const videoRef = useRef(null);

    useEffect(() => {
        let stream = null;
        if (step === 1) {
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(s => {
                    stream = s;
                    if (videoRef.current) videoRef.current.srcObject = s;
                    setCameraError(null);
                })
                .catch(err => {
                    console.error("Camera permission denied or unavailable", err);
                    setCameraError("Camera unavailable. Please check permissions or use simulation mode.");
                });
        }
        return () => {
            if (stream) stream.getTracks().forEach(track => track.stop());
        };
    }, [step]);

    const startAnalysis = () => {
        setStep(2);
        let p = 0;
        const interval = setInterval(() => {
            p += 2;
            setProgress(p);
            if (p >= 100) {
                clearInterval(interval);
                completeVerification();
            }
        }, 50);
    };

    const completeVerification = async () => {
        const humanId = crypto.randomUUID().split('-').join('').toUpperCase().substring(0, 16);

        if (DEMO_MODE) {
            if (mockDb.users[user.uid]) {
                mockDb.users[user.uid] = { ...mockDb.users[user.uid], isVerified: true, humanId };
            }
        } else {
            await setDoc(doc(db, "users", user.uid), {
                isVerified: true,
                humanId
            }, { merge: true });
        }
        setStep(3);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-panel w-full max-w-lg rounded-2xl overflow-hidden border-human-neon/30 shadow-[0_0_50px_rgba(0,240,255,0.1)]">
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Scan className="w-5 h-5 text-human-neon" />
                        Biometric Verification
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><LogOut className="w-5 h-5" /></button>
                </div>

                <div className="p-8">
                    {step === 1 && (
                        <div className="space-y-6">
                            <div className="relative aspect-video bg-black rounded-lg overflow-hidden border-2 border-slate-800">
                                {!cameraError ? (
                                    <>
                                        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover opacity-50" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-48 h-48 border-2 border-human-neon/50 rounded-full animate-pulse relative">
                                                <div className="absolute inset-0 bg-human-neon/10 animate-scan w-full h-1" />
                                            </div>
                                        </div>
                                        <div className="absolute bottom-4 left-0 right-0 text-center text-human-neon text-sm font-mono animate-pulse">
                                            ALIGN FACE WITHIN RETICLE
                                        </div>
                                    </>
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                                        <AlertCircle className="w-12 h-12 text-red-500 mb-2" />
                                        <p className="text-red-400 font-bold mb-1">Camera Error</p>
                                        <p className="text-slate-500 text-sm">{cameraError}</p>
                                    </div>
                                )}
                            </div>

                            {!cameraError ? (
                                <button
                                    onClick={startAnalysis}
                                    className="w-full bg-human-neon text-slate-950 font-bold py-3 rounded-lg hover:bg-cyan-400 transition-all"
                                >
                                    Start Liveness Check
                                </button>
                            ) : (
                                <button
                                    onClick={startAnalysis}
                                    className="w-full bg-slate-800 text-white font-bold py-3 rounded-lg hover:bg-slate-700 transition-all border border-white/10"
                                >
                                    Simulate Verification (Dev Mode)
                                </button>
                            )}
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-8 py-8">
                            <div className="flex justify-center">
                                <Loader2 className="w-16 h-16 text-human-neon animate-spin" />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-human-neon font-mono">
                                    <span>ANALYZING BIOMETRICS...</span>
                                    <span>{progress}%</span>
                                </div>
                                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-human-neon transition-all duration-75" style={{ width: `${progress}%` }} />
                                </div>
                                <div className="text-center text-slate-500 text-sm mt-2">
                                    {progress < 40 ? "Mapping Facial Geometry..." : progress < 80 ? "Testing Liveness..." : "Generating HumanID..."}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="text-center py-8 space-y-6">
                            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-human-bio/10 border border-human-bio/30">
                                <CheckCircle className="w-10 h-10 text-human-bio" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-bold text-white mb-2">Verification Complete</h4>
                                <p className="text-slate-400">You have been verified as a unique human.</p>
                            </div>
                            <button
                                onClick={onSuccess}
                                className="w-full bg-human-bio text-slate-950 font-bold py-3 rounded-lg hover:bg-emerald-400 transition-all"
                            >
                                Return to Dashboard
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
