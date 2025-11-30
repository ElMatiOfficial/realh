import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';

import { DEMO_MODE, mockAuth, auth, mockDb, db } from './lib/firebase';
import Navbar from './components/Navbar';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import AssetRegistry from './components/AssetRegistry';
import DeveloperDemo from './components/DeveloperDemo';

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
                <AuthScreen />
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
