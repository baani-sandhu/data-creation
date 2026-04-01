import {
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  setPersistence,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import type { AuthError } from "firebase/auth";
import { auth } from "./firebase";

let persistencePromise: Promise<void> | null = null;

const ensureLocalPersistence = () => {
  if (!persistencePromise) {
    persistencePromise = setPersistence(auth, browserLocalPersistence);
  }
  return persistencePromise;
};

export const getFirebaseAuthErrorMessage = (error: unknown, fallback: string) => {
  const code = typeof error === "object" && error !== null && "code" in error
    ? (error as AuthError).code
    : "";

  switch (code) {
    case "auth/wrong-password":
      return "Incorrect password";
    case "auth/user-not-found":
      return "No account found with this email";
    case "auth/email-already-in-use":
      return "An account with this email already exists";
    case "auth/weak-password":
      return "Password must be at least 6 characters";
    case "auth/popup-blocked":
      return "Popup was blocked. Please allow popups for this site";
    case "auth/network-request-failed":
      return "Network error. Check your connection";
    default:
      return fallback;
  }
};

export const signInWithGoogle = async () => {
  await ensureLocalPersistence();
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
};

export const signInWithEmail = async (email: string, password: string) => {
  await ensureLocalPersistence();
  return signInWithEmailAndPassword(auth, email, password);
};

export const signUpWithEmail = async (email: string, password: string) => {
  await ensureLocalPersistence();
  return createUserWithEmailAndPassword(auth, email, password);
};

export const signOut = () => {
  return firebaseSignOut(auth);
};

export const getIdToken = async () => {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken(false);
};
