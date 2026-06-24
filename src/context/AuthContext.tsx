"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updatePassword,
  User
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

// ── Login lockout constants ────────────────────────────────────────────────
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/** localStorage key for mock-mode lockout tracking */
const getLockoutKey = (email: string) =>
  `pcl_lockout_${email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

/** Firestore doc id for live-mode lockout tracking */
const getAttemptDocId = (email: string) =>
  email.toLowerCase().replace(/[^a-z0-9]/g, '_');
// ──────────────────────────────────────────────────────────────────────────

interface UserProfile {
  uid: string;
  email: string;
  name: string;
  securityInterest: string;
  experienceLevel: string;
  onboardingComplete: boolean;
  isAdmin?: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  isMockMode: boolean;
  login: (email: string, password: string) => Promise<void>;
  // Step 1: sends verification email, no account created yet
  initiateEmailVerification: (email: string) => Promise<void>;
  // Step 2: after clicking the link, complete setup with username + password
  completeAccountSetup: (email: string, password: string, name: string, tempUid?: string, tempPwd?: string) => Promise<void>;
  checkSetupLinkValid: (uid: string) => Promise<boolean>;
  checkNameUnique: (name: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  saveOnboarding: (interest: string, experience: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to check if Firebase is using default mock keys
const checkIsMockMode = () => {
  return (
    !process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY.includes('mock')
  );
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMockMode, setIsMockMode] = useState(true);

  useEffect(() => {
    const mockMode = checkIsMockMode();
    setIsMockMode(mockMode);

    if (mockMode) {
      // Load simulated session from localStorage
      const activeSession = localStorage.getItem('password_lab_mock_session');
      if (activeSession) {
        try {
          const mockUser = JSON.parse(activeSession);
          setUser(mockUser);
          
          const profileData = localStorage.getItem(`password_lab_mock_profile_${mockUser.uid}`);
          if (profileData) {
            setProfile(JSON.parse(profileData));
          }
        } catch (e) {
          console.error("Failed to parse mock session", e);
        }
      }
      setLoading(false);
    } else {
      // Connect to Live Firebase Auth
      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        // Ignore the automatic login from createUserWithEmailAndPassword during signup
        if (localStorage.getItem('pcl_registration_in_progress') === 'true') {
          return;
        }
        // Also ignore if the user matches the pending verify UID (until they complete setup)
        if (currentUser && currentUser.uid === localStorage.getItem('pcl_pending_verify_uid')) {
          return;
        }

        setUser(currentUser);
        if (currentUser) {
          try {
            const docRef = doc(db, 'users', currentUser.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              setProfile(docSnap.data() as UserProfile);
            } else {
              setProfile(null);
            }
          } catch (err) {
            console.error("Error fetching user profile:", err);
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);

    if (isMockMode) {
      // ── Mock mode: localStorage lockout ────────────────────────────────
      const lockoutKey = getLockoutKey(email);
      const raw = localStorage.getItem(lockoutKey);
      const lockout = raw ? JSON.parse(raw) : { count: 0, lockedUntil: 0 };

      if (lockout.lockedUntil && Date.now() < lockout.lockedUntil) {
        setLoading(false);
        throw new Error(`ACCOUNT_LOCKED:${lockout.lockedUntil}`);
      }

      const storedUsers = localStorage.getItem('password_lab_mock_users');
      const usersList: any[] = storedUsers ? JSON.parse(storedUsers) : [];
      const match = usersList.find((u: any) => u.email.toLowerCase() === email.toLowerCase());

      if (!match || match.password !== password) {
        const newCount = lockout.count + 1;
        const lockedUntil = newCount >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOCKOUT_DURATION_MS : 0;
        localStorage.setItem(lockoutKey, JSON.stringify({ count: newCount, lockedUntil }));
        setLoading(false);
        if (lockedUntil) throw new Error(`ACCOUNT_LOCKED:${lockedUntil}`);
        throw new Error(`INVALID_CREDENTIALS:${MAX_LOGIN_ATTEMPTS - newCount}`);
      }

      // Success: clear lockout record
      localStorage.removeItem(lockoutKey);
      const mockSession = { uid: match.uid, email: match.email };
      localStorage.setItem('password_lab_mock_session', JSON.stringify(mockSession));
      setUser(mockSession);
      const profileData = localStorage.getItem(`password_lab_mock_profile_${match.uid}`);
      if (profileData) setProfile(JSON.parse(profileData));
      setLoading(false);

    } else {
      // ── Live Firebase: Firestore lockout ───────────────────────────────
      const attemptRef = doc(db, 'loginAttempts', getAttemptDocId(email));

      // 1. Check existing lockout before attempting auth
      try {
        const snap = await getDoc(attemptRef);
        if (snap.exists()) {
          const { lockedUntil } = snap.data();
          if (lockedUntil && Date.now() < lockedUntil) {
            setLoading(false);
            throw new Error(`ACCOUNT_LOCKED:${lockedUntil}`);
          }
        }
      } catch (e: any) {
        if (e.message?.startsWith('ACCOUNT_LOCKED')) { setLoading(false); throw e; }
        // Firestore read error — continue and let Firebase auth decide
      }

      // 2. Attempt Firebase authentication
      try {
        await signInWithEmailAndPassword(auth, email, password);
        // Success: asynchronously clear attempt counter
        setDoc(attemptRef, { count: 0, lockedUntil: 0, email: email.toLowerCase() }).catch(() => {});
      } catch (authError: any) {
        setLoading(false);
        // Record the failed attempt and apply lockout if threshold reached
        try {
          const snap = await getDoc(attemptRef);
          const current = snap.exists() ? snap.data() : { count: 0 };
          const newCount = (current.count || 0) + 1;
          const lockedUntil = newCount >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOCKOUT_DURATION_MS : 0;
          await setDoc(attemptRef, { count: newCount, lockedUntil, email: email.toLowerCase() });
          if (lockedUntil) throw new Error(`ACCOUNT_LOCKED:${lockedUntil}`);
          throw new Error(`INVALID_CREDENTIALS:${MAX_LOGIN_ATTEMPTS - newCount}`);
        } catch (inner: any) {
          if (inner.message?.startsWith('ACCOUNT_LOCKED') || inner.message?.startsWith('INVALID_CREDENTIALS')) {
            throw inner;
          }
        }
        throw authError;
      }
    }
  };

  const checkNameUnique = async (name: string): Promise<boolean> => {
    if (isMockMode) {
      const storedUsers = localStorage.getItem('password_lab_mock_users');
      const usersList = storedUsers ? JSON.parse(storedUsers) : [];
      return !usersList.some((u: any) => u.name?.toLowerCase() === name.toLowerCase());
    }
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      for (const docSnap of usersSnap.docs) {
        const data = docSnap.data();
        if (data.name?.toLowerCase() === name.toLowerCase()) return false;
      }
      return true;
    } catch {
      return true;
    }
  };

  const checkSetupLinkValid = async (uid: string): Promise<boolean> => {
    if (!uid) return false;
    if (isMockMode) {
      const storedUsers = localStorage.getItem('password_lab_mock_users');
      const usersList = storedUsers ? JSON.parse(storedUsers) : [];
      return !usersList.some((u: any) => u.uid === uid);
    }
    try {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      return !snap.exists(); // If it doesn't exist, link is still valid
    } catch {
      return true; // Fallback to let the form submission handle errors
    }
  };

  const initiateEmailVerification = async (email: string) => {
    if (isMockMode) {
      localStorage.setItem('pcl_pending_verify_email', email);
      return;
    }

    const tempPassword = Math.random().toString(36).slice(-12) + 'Aa1!';
    let cred;

    // Set flag to prevent onAuthStateChanged from redirecting user into workspace
    localStorage.setItem('pcl_registration_in_progress', 'true');

    try {
      cred = await createUserWithEmailAndPassword(auth, email, tempPassword);
      // Immediately store the pending verify UID so the listener can also ignore this specific user
      localStorage.setItem('pcl_pending_verify_uid', cred.user.uid);
    } catch (error: any) {
      localStorage.removeItem('pcl_registration_in_progress');
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('An account with this email already exists. Please log in instead.');
      }
      if (error.code === 'auth/operation-not-allowed') {
        throw new Error('Email/Password authentication is not enabled. Please contact the administrator.');
      }
      throw error;
    }

    let emailSent = false;

    try {
      await sendEmailVerification(cred.user, {
        url: `${window.location.origin}/#/setup?email=${encodeURIComponent(email)}&uid=${cred.user.uid}&t=${encodeURIComponent(tempPassword)}`,
        handleCodeInApp: false,
      });
      emailSent = true;
    } catch (error: any) {
      if (error.code === 'auth/unauthorized-continue-uri' || error.message?.includes('unauthorized-continue-uri')) {
        const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com`;
        const fallbackUrl = `https://${authDomain}/#/setup?email=${encodeURIComponent(email)}&uid=${cred.user.uid}&t=${encodeURIComponent(tempPassword)}`;

        console.warn("Domain not allowlisted. Retrying with fallback domain:", fallbackUrl);

        try {
          await sendEmailVerification(cred.user, {
            url: fallbackUrl,
            handleCodeInApp: false,
          });
          emailSent = true;
        } catch (fallbackError: any) {
          console.warn("Fallback email send also failed — will proceed without email verification:", fallbackError.message);
        }
      } else {
        console.warn("Email send failed — will proceed without email verification:", error.message);
      }
    }

    localStorage.setItem('pcl_pending_verify_email', email);
    localStorage.setItem('pcl_pending_verify_uid', cred.user.uid);
    localStorage.setItem('pcl_pending_verify_tmp_pwd', tempPassword);
    await signOut(auth);
    
    // Cleanup registration flag after sign out
    localStorage.removeItem('pcl_registration_in_progress');

    if (!emailSent) {
      throw new Error('VERIFICATION_EMAIL_FAILED');
    }
  };

  // Step 2: Complete account setup after email link is clicked
  const completeAccountSetup = async (email: string, password: string, name: string, tempUid?: string, tempPwd?: string) => {
    // Validate uniqueness
    const isUnique = await checkNameUnique(name);
    if (!isUnique) throw new Error('This username is already taken. Please choose another.');

    if (isMockMode) {
      const storedUsers = localStorage.getItem('password_lab_mock_users');
      let usersList = storedUsers ? JSON.parse(storedUsers) : [];
      if (usersList.some((u: any) => u.email.toLowerCase() === email.toLowerCase())) {
        throw new Error('Account with this email already exists.');
      }
      const uid = 'mock_uid_' + Math.random().toString(36).substring(2, 11);
      const isFirstUser = usersList.length === 0;
      usersList.push({ uid, email, password, name });
      localStorage.setItem('password_lab_mock_users', JSON.stringify(usersList));
      const newProfile: UserProfile = {
        uid, email, name,
        securityInterest: '',
        experienceLevel: '',
        onboardingComplete: false,
        isAdmin: isFirstUser,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem(`password_lab_mock_profile_${uid}`, JSON.stringify(newProfile));
      localStorage.removeItem('pcl_pending_verify_email');
      return;
    }

    // Live Firebase: sign in with temp credentials, update password, save profile
    const tmpPwd = tempPwd || localStorage.getItem('pcl_pending_verify_tmp_pwd');
    const uid = tempUid || localStorage.getItem('pcl_pending_verify_uid');
    if (!tmpPwd || !uid) throw new Error('Verification session expired or link is invalid. Please restart registration.');

    try {
      // Check if this is the first user
      const usersSnap = await getDocs(collection(db, 'users'));
      const isFirstUser = usersSnap.empty;

      const cred = await signInWithEmailAndPassword(auth, email, tmpPwd);
      await updatePassword(cred.user, password);
      // Save profile to Firestore
      const userRef = doc(db, 'users', uid);
      const newProfile: UserProfile = {
        uid,
        email,
        name,
        securityInterest: '',
        experienceLevel: '',
        onboardingComplete: false,
        isAdmin: isFirstUser,
        createdAt: new Date().toISOString()
      };
      await setDoc(userRef, newProfile);
      // Sign out so user logs in fresh
      await signOut(auth);
      // Clean up
      localStorage.removeItem('pcl_pending_verify_email');
      localStorage.removeItem('pcl_pending_verify_uid');
      localStorage.removeItem('pcl_pending_verify_tmp_pwd');
    } catch (error: any) {
      throw error;
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    // Legacy wrapper for mock mode — kept for compatibility
    await completeAccountSetup(email, password, name);
  };

  const logout = async () => {
    setLoading(true);
    if (isMockMode) {
      localStorage.removeItem('password_lab_mock_session');
      setUser(null);
      setProfile(null);
      setLoading(false);
    } else {
      await signOut(auth);
      setUser(null);
      setProfile(null);
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    if (isMockMode) {
      // Simulate Password Reset
      console.log(`[Mock Mode] Password reset triggered for: ${email}`);
    } else {
      await sendPasswordResetEmail(auth, email);
    }
  };

  const saveOnboarding = async (interest: string, experience: string) => {
    if (!user) throw new Error("No user authenticated");
    
    setLoading(true);
    const updatedData = {
      securityInterest: interest,
      experienceLevel: experience,
      onboardingComplete: true
    };

    if (isMockMode) {
      const currentProfile = profile ? { ...profile, ...updatedData } : null;
      if (currentProfile) {
        localStorage.setItem(`password_lab_mock_profile_${user.uid}`, JSON.stringify(currentProfile));
        setProfile(currentProfile);
      }
      setLoading(false);
    } else {
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, updatedData);
        setProfile(prev => prev ? { ...prev, ...updatedData } : null);
      } catch (error) {
        console.error("Failed to save onboarding questions", error);
        throw error;
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <AuthContext.Provider value={{
      user, profile, loading, isMockMode, login, initiateEmailVerification,
      completeAccountSetup, checkSetupLinkValid, checkNameUnique, signup, logout, resetPassword, saveOnboarding
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
