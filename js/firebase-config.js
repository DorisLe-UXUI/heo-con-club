/*
 * Firebase config for online play (Google sign-in, cloud save, leaderboard, rooms). See docs/ONLINE_SETUP.md.
 * Paste the "firebaseConfig" object from Firebase console → Project settings → Your apps → Web app here.
 * These values identify the project; they are not secrets (access is guarded by firestore.rules).
 * While this is null the game runs fully offline.
 */
window.HC_FIREBASE = null;
/* Example:
window.HC_FIREBASE = {
  apiKey: "AIza...",
  authDomain: "heo-con-club.firebaseapp.com",
  projectId: "heo-con-club",
  storageBucket: "heo-con-club.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
*/
