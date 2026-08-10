import { initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile } from "firebase/auth";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const firebaseEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
const app = firebaseEnabled ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

export async function signInWithGoogle() {
  if (!auth) throw new Error("Firebase não foi configurado.");
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export async function signInWithEmail(email, password) {
  if (!auth) throw new Error("Firebase não foi configurado.");
  return signInWithEmailAndPassword(auth, email, password);
}

export async function createAccountWithEmail(name, email, password) {
  if (!auth) throw new Error("Firebase não foi configurado.");
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (name) await updateProfile(credential.user, { displayName: name });
  return credential;
}

export async function signOutFromGoogle() {
  if (auth) await signOut(auth);
}

export async function loadCloudState(uid) {
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? snapshot.data().state : null;
}

export async function saveCloudState(uid, state) {
  await setDoc(doc(db, "users", uid), { state, updatedAt: serverTimestamp() }, { merge: true });
}
