import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile
} from 'firebase/auth';
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    serverTimestamp
} from 'firebase/firestore';
import {
    ShieldCheck,
    Fingerprint,
    Scan,
    FileText,
    Cpu,
    Lock,
    User,
    LogOut,
    CheckCircle,
    AlertCircle,
    Loader2,
    Plus,
    Search
} from 'lucide-react';

// --- CONFIGURATION ---
// REPLACE WITH YOUR FIREBASE CONFIG TO USE REAL BACKEND
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
    authDomain: "humanledger-poc.firebaseapp.com",
    projectId: "humanledger-poc",
    storageBucket: "humanledger-poc.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};

// TOGGLE THIS TO FALSE TO USE REAL FIREBASE
const DEMO_MODE = true;

// --- FIREBASE INITIALIZATION ---
let auth, db;
if (!DEMO_MODE) {
    try {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
    } catch (e) {
        console.error("Firebase init failed (likely missing config). Falling back to Demo Mode.");
    }
}

// --- MOCK BACKEND (FOR DEMO) ---
const mockDb = {
    users: {},
    assets: []
};

const mockAuth = {
    currentUser: null,
    listeners: [],
    signIn: async (email, password) => {
        const user = Object.values(mockDb.users).find(u => u.email === email);
        if (user) {
            mockAuth.currentUser = { ...user, uid: user.id };
            mockAuth.notify();
            return user;
        }
        throw new Error("User not found");
    },
    signUp: async (email, password) => {
        const uid = 'user_' + Math.random().toString(36).substr(2, 9);
        const newUser = { id: uid, email, isVerified: false, humanId: null, joinedAt: new Date() };
        mockDb.users[uid] = newUser;
        mockAuth.currentUser = { ...newUser, uid };
        mockAuth.notify();
        return { user: { uid, email } };
    },
    signOut: async () => {
        mockAuth.currentUser = null;
        mockAuth.notify();
    },
    onAuthStateChanged: (cb) => {
        mockAuth.listeners.push(cb);
        cb(mockAuth.currentUser);
        return () => { mockAuth.listeners = mockAuth.listeners.filter(l => l !== cb); };
    },
    notify: () => mockAuth.listeners.forEach(cb => cb(mockAuth.currentUser))
};

// --- APP COMPONENT ---
export default function App() {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('dashboard'); // dashboard, registry, demo

    // Auth State Listener
    useEffect(() => {
        const authInstance = DEMO_MODE ? mockAuth : auth;
        if (!authInstance) return;

        const unsubscribe = authInstance.onAuthStateChanged(async (u) => {
            setUser(u);
            if (u) {
                await fetchUserData(u.uid);
            } else {
                setUserData(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const fetchUserData = async (uid) => {
        if (DEMO_MODE) {
            setUserData(mockDb.users[uid]);
            return;
        }
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            setUserData(docSnap.data());
        }
    };

    if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-human-neon"><Loader2 className="animate-spin w-8 h-8" /></div>;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-human-neon/30">
            {/* Background Ambience */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-human-neon/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-human-bio/5 rounded-full blur-[100px]" />
            </div>

            {!user ? (
                <AuthScreen onLogin={() => { }} />
            ) : (
                <div className="relative z-10 flex flex-col min-h-screen">
                    <Navbar user={user} userData={userData} setView={setView} currentView={view} />
                    <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
                        {view === 'dashboard' && <Dashboard user={user} userData={userData} refreshUser={() => fetchUserData(user.uid)} />}
                        {view === 'registry' && <AssetRegistry user={user} userData={userData} />}
                        {view === 'demo' && <DeveloperDemo user={user} userData={userData} />}
                    </main>
                </div>
            )}
        </div>
    );
}

// --- SUB-COMPONENTS ---

function Navbar({ user, userData, setView, currentView }) {
    const handleLogout = () => {
        const authInstance = DEMO_MODE ? mockAuth : auth;
        authInstance.signOut();
    };

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
                        <div className="text-sm font-medium text-white">{user.email}</div>
                        <div className={`text-xs ${userData?.isVerified ? 'text-human-bio' : 'text-slate-400'}`}>
                            {userData?.isVerified ? 'VERIFIED HUMAN' : 'UNVERIFIED ID'}
                        </div>
                    </div>
                    <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white">
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

function AuthScreen() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const authInstance = DEMO_MODE ? mockAuth : auth;

        try {
            if (isLogin) {
                await authInstance.signIn(email, password);
            } else {
                const res = await authInstance.signUp(email, password);
                // Create user doc
                if (!DEMO_MODE) {
                    await setDoc(doc(db, "users", res.user.uid), {
                        email,
                        isVerified: false,
                        humanId: null,
                        joinedAt: serverTimestamp()
                    });
                }
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="glass-panel w-full max-w-md p-8 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-human-neon to-human-bio" />

                <div className="mb-8 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-human-neon/10 mb-4 border border-human-neon/20">
                        <Fingerprint className="w-8 h-8 text-human-neon" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">HumanLedger Access</h2>
                    <p className="text-slate-400">Secure Identity & Asset Verification</p>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" /> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-human-neon focus:ring-1 focus:ring-human-neon outline-none transition-all"
                            placeholder="name@example.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-human-neon focus:ring-1 focus:ring-human-neon outline-none transition-all"
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-human-neon text-slate-950 font-bold py-3 rounded-lg hover:bg-cyan-400 transition-all shadow-[0_0_20px_rgba(0,240,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (isLogin ? 'Authenticate' : 'Initialize Identity')}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-sm text-slate-400 hover:text-human-neon transition-colors"
                    >
                        {isLogin ? "Need an identity? Register" : "Already verified? Login"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Dashboard({ user, userData, refreshUser }) {
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

function VerificationModal({ onClose, onSuccess, user }) {
    const [step, setStep] = useState(1); // 1: Scan, 2: Analyze, 3: Success
    const [progress, setProgress] = useState(0);
    const videoRef = useRef(null);

    useEffect(() => {
        if (step === 1) {
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(stream => {
                    if (videoRef.current) videoRef.current.srcObject = stream;
                })
                .catch(err => console.log("Camera permission denied or unavailable", err));
        }
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
            mockDb.users[user.uid] = { ...mockDb.users[user.uid], isVerified: true, humanId };
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
                                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover opacity-50" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-48 h-48 border-2 border-human-neon/50 rounded-full animate-pulse relative">
                                        <div className="absolute inset-0 bg-human-neon/10 animate-scan w-full h-1" />
                                    </div>
                                </div>
                                <div className="absolute bottom-4 left-0 right-0 text-center text-human-neon text-sm font-mono animate-pulse">
                                    ALIGN FACE WITHIN RETICLE
                                </div>
                            </div>
                            <button
                                onClick={startAnalysis}
                                className="w-full bg-human-neon text-slate-950 font-bold py-3 rounded-lg hover:bg-cyan-400 transition-all"
                            >
                                Start Liveness Check
                            </button>
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

function AssetRegistry({ user, userData }) {
    const [assets, setAssets] = useState([]);
    const [showForm, setShowForm] = useState(false);

    useEffect(() => {
        fetchAssets();
    }, []);

    const fetchAssets = async () => {
        if (DEMO_MODE) {
            setAssets(mockDb.assets.filter(a => a.ownerId === user.uid));
            return;
        }
        const q = query(collection(db, "assets"), where("ownerId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        setAssets(querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    };

    const handleCreate = async (assetData) => {
        const newAsset = {
            ownerId: user.uid,
            ...assetData,
            createdAt: new Date().toISOString()
        };

        if (DEMO_MODE) {
            mockDb.assets.push({ id: 'asset_' + Date.now(), ...newAsset });
        } else {
            await addDoc(collection(db, "assets"), newAsset);
        }
        setShowForm(false);
        fetchAssets();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">Creative Patent Registry</h2>
                    <p className="text-slate-400">Immutable proof of human creation.</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    disabled={!userData?.isVerified}
                    className="px-4 py-2 bg-human-neon text-slate-950 font-bold rounded-lg hover:bg-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" /> Register New Asset
                </button>
            </div>

            {!userData?.isVerified && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5" />
                    Verification required to register assets.
                </div>
            )}

            {showForm && (
                <AssetForm onClose={() => setShowForm(false)} onSubmit={handleCreate} />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {assets.map(asset => (
                    <AssetCard key={asset.id} asset={asset} ownerName={userData?.email} />
                ))}
                {assets.length === 0 && !showForm && (
                    <div className="col-span-2 py-12 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl">
                        No assets registered yet.
                    </div>
                )}
            </div>
        </div>
    );
}

function AssetForm({ onClose, onSubmit }) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [hash, setHash] = useState('');
    const [calculating, setCalculating] = useState(false);

    const generateHash = () => {
        if (!title || !content) return;
        setCalculating(true);
        setTimeout(() => {
            // Simple mock hash for visual purposes
            const mockHash = Array.from(title + content).reduce((acc, char) => acc + char.charCodeAt(0), 0).toString(16)
                + 'x' + Math.random().toString(36).substring(2);
            setHash('SHA256-' + mockHash.toUpperCase().padEnd(64, '0'));
            setCalculating(false);
        }, 1500);
    };

    return (
        <div className="glass-panel p-6 rounded-2xl border-human-neon/20 mb-8 animate-in fade-in slide-in-from-top-4">
            <h3 className="text-lg font-bold text-white mb-4">Register New Asset</h3>
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Asset Title</label>
                    <input
                        className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-human-neon outline-none"
                        value={title} onChange={e => setTitle(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Content / Description</label>
                    <textarea
                        className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-human-neon outline-none h-24"
                        value={content} onChange={e => setContent(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={generateHash}
                        disabled={!title || !content}
                        className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                        {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate Hash'}
                    </button>
                    {hash && <div className="font-mono text-xs text-human-neon break-all">{hash}</div>}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                    <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
                    <button
                        onClick={() => onSubmit({ title, description: content, hash, type: 'text' })}
                        disabled={!hash}
                        className="px-6 py-2 bg-human-neon text-slate-950 font-bold rounded-lg hover:bg-cyan-400 disabled:opacity-50"
                    >
                        Mint Certificate
                    </button>
                </div>
            </div>
        </div>
    );
}

function AssetCard({ asset, ownerName }) {
    return (
        <div className="glass-card p-0 rounded-xl overflow-hidden group relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-human-neon to-transparent" />
            <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div className="bg-slate-900/50 p-2 rounded-lg border border-white/10">
                        <FileText className="w-6 h-6 text-human-neon" />
                    </div>
                    <div className="text-xs font-mono text-slate-500">{new Date(asset.createdAt).toLocaleDateString()}</div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{asset.title}</h3>
                <p className="text-sm text-slate-400 mb-4 line-clamp-2">{asset.description}</p>

                <div className="bg-black/30 p-3 rounded-lg border border-white/5">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Asset Hash</div>
                    <div className="font-mono text-xs text-human-neon truncate">{asset.hash}</div>
                </div>
            </div>

            {/* Certificate Overlay Effect */}
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center backdrop-blur-[1px]">
                <div className="border-2 border-human-neon/50 px-4 py-2 rounded text-human-neon font-bold tracking-widest transform -rotate-12">
                    HUMAN CERTIFIED
                </div>
            </div>
        </div>
    );
}

function DeveloperDemo({ user, userData }) {
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
