import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

const env = import.meta.env;

const isPlaceholderFirebaseValue = (value: unknown): boolean => {
  if (!value || typeof value !== "string") return true;
  const normalized = value.trim().toLowerCase();
  return (
    normalized.includes("your-api-key") ||
    normalized.includes("your-project-id") ||
    normalized.includes("your-app-id") ||
    normalized.includes("placeholder")
  );
};

const getFirebaseEnv = (value: unknown, fallback: string): string =>
  isPlaceholderFirebaseValue(value) ? fallback : String(value);

const firebaseConfig = {
  apiKey: getFirebaseEnv(env.VITE_FIREBASE_API_KEY, "AIzaSyBNNSRE2_nMFegDv79zOSprn-vsyx8X2Sg"),
  authDomain: getFirebaseEnv(env.VITE_FIREBASE_AUTH_DOMAIN, "bitblock-d8758.firebaseapp.com"),
  projectId: getFirebaseEnv(env.VITE_FIREBASE_PROJECT_ID, "bitblock-d8758"),
  storageBucket: getFirebaseEnv(env.VITE_FIREBASE_STORAGE_BUCKET, "bitblock-d8758.firebasestorage.app"),
  messagingSenderId: getFirebaseEnv(env.VITE_FIREBASE_MESSAGING_SENDER_ID, "409440684176"),
  appId: getFirebaseEnv(env.VITE_FIREBASE_APP_ID, "1:409440684176:web:3edd820e0998f8b6c53015"),
  measurementId: getFirebaseEnv(env.VITE_FIREBASE_MEASUREMENT_ID, "G-E346HHTRSX"),
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({ prompt: "select_account" });

export default app;
