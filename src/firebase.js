import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCMUsqoEE7BSIgjLVbsYg4vMdITTGja27k",
  authDomain: "smart-ams-3b6b3.firebaseapp.com",
  projectId: "smart-ams-3b6b3",
  storageBucket: "smart-ams-3b6b3.firebasestorage.app",
  messagingSenderId: "521367846188",
  appId: "1:521367846188:web:46a3f166cc0af844a0c089",
  measurementId: "G-R4PBBLB6Y2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

// ── Enable Firestore offline persistence (IndexedDB cache) ─────────────────
// This lets previously-loaded data render even when the device is offline.
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open — persistence only works in one tab at a time.
    console.warn('[Firestore] Offline persistence unavailable: multiple tabs open.');
  } else if (err.code === 'unimplemented') {
    // Browser doesn't support IndexedDB.
    console.warn('[Firestore] Offline persistence not supported in this browser.');
  }
});

export { app, analytics, db, auth };
