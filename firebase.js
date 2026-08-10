import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyApqDWOa4StjEFdTbFTJ2uK9_29fQhLaYQ",
  authDomain: "minhasfinancas-2026.firebaseapp.com",
  projectId: "minhasfinancas-2026",
  storageBucket: "minhasfinancas-2026.firebasestorage.app",
  messagingSenderId: "888630123994",
  appId: "1:888630123994:web:3853dd85e0c99b94fe34e3",
  measurementId: "G-279G59BC9W"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export async function signInWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    alert("ERRO NO LOGIN: " + error.code + "\n\n" + error.message);
    console.error("Erro ao autenticar com Google:", error);
    throw error;
  }
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
