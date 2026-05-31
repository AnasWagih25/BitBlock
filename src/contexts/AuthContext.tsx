import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc, getDoc, getDocFromServer, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "../lib/firebase";
import type { CustomLimits } from "../lib/plans";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userRole: string;
  isAdmin: boolean;
  customLimits: CustomLimits | null;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (updates: { displayName?: string; photoURL?: string }) => Promise<void>;
  refreshUserMeta: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('user');
  const [customLimits, setCustomLimits] = useState<CustomLimits | null>(null);
  const authReadSeq = useRef(0);

  const isAdmin = userRole === 'admin';

  const fetchUserMeta = async (uid: string) => {
    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) {
        const data = snap.data();
        setUserRole(data.role || 'user');
        setCustomLimits(data.customLimits || null);
        return data;
      }
    } catch {
      // fallback
    }
    return null;
  };

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      const seq = ++authReadSeq.current;
      if (u) {
        // Fetch the absolute source of truth from Firestore to bypass Auth provider name overwrites 
        getDocFromServer(doc(db, "users", u.uid)).then(snap => {
          if (!active || seq !== authReadSeq.current) return;
          const data = snap.exists() ? snap.data() : null;
          const dbName = data?.displayName ?? null;
          const dbPhoto = data?.photoURL ?? null;
          if (data) {
            setUserRole(data.role || 'user');
            setCustomLimits(data.customLimits || null);
          }
          setUser({ uid: u.uid, email: u.email, displayName: dbName || u.displayName, photoURL: dbPhoto || u.photoURL } as User);
          setLoading(false);
        }).catch(() => {
          if (!active || seq !== authReadSeq.current) return;
          setUser({ uid: u.uid, email: u.email, displayName: u.displayName, photoURL: u.photoURL } as User);
          setLoading(false);
        });
      } else {
        if (!active || seq !== authReadSeq.current) return;
        setUser(null);
        setUserRole('user');
        setCustomLimits(null);
        setLoading(false);
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const createUserDoc = async (u: User) => {
    const ref = doc(db, "users", u.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: u.uid,
        email: u.email || `guest_${u.uid.substring(0,8)}@guest.local`,
        displayName: u.displayName || "BitBuilder",
        photoURL: u.photoURL || null,
        createdAt: serverTimestamp(),
        projectCount: 0,
        publishedBlocks: 0,
        role: "user",
        plan: "free",
        planStartedAt: serverTimestamp(),
      });
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    await createUserDoc(cred.user);
  };

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    await createUserDoc(cred.user);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const updateUserProfile = async (updates: { displayName?: string; photoURL?: string }) => {
    if (!auth.currentUser) return;
    
    // Safely update Firebase Auth state (runs seamlessly without firing destructive refresh)
    await updateProfile(auth.currentUser, updates);
    
    // Explicitly set a pure JavaScript object forcing React to recognize the state change instantly.
    setUser(prev => prev ? { ...prev, ...updates } as User : null);
  };

  const refreshUserMeta = async () => {
    if (!user?.uid) return;
    await fetchUserMeta(user.uid);
  };

  return (
    <AuthContext.Provider value={{ user, loading, userRole, isAdmin, customLimits, signUp, signIn, signInWithGoogle, signOut, resetPassword, updateUserProfile, refreshUserMeta }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
