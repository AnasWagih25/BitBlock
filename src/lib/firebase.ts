import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBNNSRE2_nMFegDv79zOSprn-vsyx8X2Sg",
  authDomain: "bitblock-d8758.firebaseapp.com",
  projectId: "bitblock-d8758",
  storageBucket: "bitblock-d8758.firebasestorage.app",
  messagingSenderId: "409440684176",
  appId: "1:409440684176:web:3edd820e0998f8b6c53015",
  measurementId: "G-E346HHTRSX",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({ prompt: "select_account" });

export default app;
