import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const getEnv = (viteKey: string, legacyKey: string) =>
  import.meta.env[viteKey] ?? import.meta.env[legacyKey];

const firebaseConfig = {
  apiKey: getEnv("VITE_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: getEnv("VITE_FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  appId: getEnv("VITE_FIREBASE_APP_ID", "NEXT_PUBLIC_FIREBASE_APP_ID"),
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
