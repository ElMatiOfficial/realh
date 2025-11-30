import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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
export const DEMO_MODE = true;

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

export { auth, db };

// --- MOCK BACKEND (FOR DEMO) ---
export const mockDb = {
    users: {},
    assets: []
};

export const mockAuth = {
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
