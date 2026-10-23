/*
 * Firebase config for online play (Google sign-in, cloud save, leaderboard, rooms). See docs/ONLINE_SETUP.md.
 * Copied from Firebase console → Project settings → Your apps → Web app (project "heoconclu").
 * These values identify the project; they are not secrets (access is guarded by firestore.rules).
 * Set it to null to make the game fully offline again.
 */
window.HC_FIREBASE = {
  apiKey: "AIzaSyBtMw2HaRrRt-6Pdo26fFJKkYntAByRJLo",
  authDomain: "heoconclu.firebaseapp.com",
  projectId: "heoconclu",
  storageBucket: "heoconclu.firebasestorage.app",
  messagingSenderId: "755773777154",
  appId: "1:755773777154:web:e244b1d4d131b5e9710e1b",
  measurementId: "G-SGF3JXSV5R"
};
