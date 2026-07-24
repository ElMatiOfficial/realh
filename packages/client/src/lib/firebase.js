import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';

// When no Firebase project is configured (VITE_FIREBASE_API_KEY unset), the
// client swaps in a localStorage-backed mock of the tiny auth surface this app
// uses. It pairs with the server's DEMO_MODE token handling so `npm run dev`
// works end to end with zero external services — previously the client half of
// demo mode was broken because sign-in always hit real Firebase with a fake
// API key. With a real key set, this file is a thin wrapper over firebase/auth.
export const DEMO_MODE = !import.meta.env.VITE_FIREBASE_API_KEY;

function createDemoAuth() {
  const STORAGE_KEY = 'realh-demo-auth';
  const listeners = new Set();

  function makeUser(email) {
    const uid = 'demo-' + btoa(email).replace(/[^A-Za-z0-9]/g, '').slice(0, 32);
    return {
      uid,
      email,
      async getIdToken() {
        // Matches the server's demo-mode token fallback: base64 JSON claims.
        return btoa(JSON.stringify({ user_id: uid, email }));
      },
    };
  }

  let currentUser = null;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved?.email) currentUser = makeUser(saved.email);
  } catch {
    // Corrupted storage — start signed out.
  }

  const notify = () => listeners.forEach((cb) => cb(currentUser));

  return {
    get currentUser() {
      return currentUser;
    },
    onChange(cb) {
      listeners.add(cb);
      cb(currentUser);
      return () => listeners.delete(cb);
    },
    async signIn(email) {
      currentUser = makeUser(email);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ email }));
      notify();
      return { user: currentUser };
    },
    async signOut() {
      currentUser = null;
      localStorage.removeItem(STORAGE_KEY);
      notify();
    },
  };
}

let auth;
let signIn;
let signUp;
let logOut;
let onAuthChange;

if (DEMO_MODE) {
  const demo = createDemoAuth();
  auth = demo;
  // Any email/password pair works in demo mode; the server auto-creates the
  // account on first authenticated request. Sign-in and sign-up are the same.
  signIn = (email) => demo.signIn(email);
  signUp = (email) => demo.signIn(email);
  logOut = () => demo.signOut();
  onAuthChange = (cb) => demo.onChange(cb);
} else {
  const app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  });
  auth = getAuth(app);
  signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
  signUp = (email, password) => createUserWithEmailAndPassword(auth, email, password);
  logOut = () => auth.signOut();
  onAuthChange = (cb) => onAuthStateChanged(auth, cb);
}

export { auth, signIn, signUp, logOut, onAuthChange };
