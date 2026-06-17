"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { LAB_DATA, Lab, Track } from '@/data/labs';
import { useAuth } from './AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface DailyChallengeData {
  id: string;
  type: 'hashcat' | 'john' | 'hydra' | 'wireshark';
  title: string;
  scenario: string;
  dummyData: Array<{ label: string; value: string }>;
  correctAnswer: string;
  reward: number;
  hints: string[];
  hintLevel: number;
  generatedAt: number;
  completed: boolean;
  completedAt?: number;
}

export const CHALLENGE_REWARDS: Record<string, number> = {
  hashcat: 20,
  john: 30,
  hydra: 40,
  wireshark: 40,
};

interface Badge {
  id: string;
  icon: string;
  name: string;
  date: string;
}

interface LabState {
  currentSection: number;
  completedSections: number[];
}

export const NEW_USER_COINS = 100;

interface ProgressData {
  xp: number;
  coins: number;
  commandsRun: number;
  completedLabs: string[];
  earnedBadges: Badge[];
  labState: Record<string, LabState>;
  dailyChallenges: Record<string, DailyChallengeData>; // keyed by tool type
  dailyChallengeDay: number; // midnight timestamp of current challenge day
  challengesSolved: number;
}

interface ProgressContextType {
  data: ProgressData;
  loading: boolean;
  addXp: (amount: number, reason: string) => Promise<void>;
  addCoins: (amount: number, reason: string) => Promise<void>;
  deductCoins: (amount: number, reason: string) => Promise<boolean>;
  incrementCommandCount: () => Promise<void>;
  getCurrentSection: (labId: string) => number;
  setCurrentSection: (labId: string, sectionIndex: number) => Promise<void>;
  isSectionCompleted: (labId: string, sectionIndex: number) => boolean;
  completeSection: (labId: string, sectionIndex: number) => Promise<void>;
  isLabCompleted: (labId: string) => boolean;
  completeLab: (labId: string, lab: Lab) => Promise<void>;
  isLabLocked: (trackId: string, labIndex: number) => boolean;
  getRank: () => string;
  resetProgress: () => Promise<void>;
  setDailyChallenge: (challenge: DailyChallengeData) => Promise<void>;
  completeDailyChallenge: (type: string) => Promise<void>;
  advanceHintInChallenge: (type: string, free?: boolean) => Promise<boolean>;
  getDailyChallenge: (type: string) => DailyChallengeData | null;
  getDailyChallengeDayStart: () => number;
}

const getTodayMidnight = (): number => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const defaultData: ProgressData = {
  xp: 0,
  coins: 0,
  commandsRun: 0,
  completedLabs: [],
  earnedBadges: [],
  labState: {},
  dailyChallenges: {},
  dailyChallengeDay: getTodayMidnight(),
  challengesSolved: 0
};

const newUserData: ProgressData = {
  ...defaultData,
  coins: NEW_USER_COINS,
};

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const { user, isMockMode } = useAuth();
  const [data, setData] = useState<ProgressData>(defaultData);
  const [loading, setLoading] = useState(true);

  // Sync with Firestore or LocalStorage on user login / logout
  useEffect(() => {
    if (!user) {
      setData(defaultData);
      setLoading(false);
      return;
    }

    const loadProgress = async () => {
      setLoading(true);
      if (isMockMode) {
        // Load simulated progress from LocalStorage
        const saved = localStorage.getItem(`password_lab_progress_mock_${user.uid}`);
        if (saved) {
          try {
            setData(JSON.parse(saved));
          } catch (e) {
            console.error("Failed to parse simulated progress", e);
            setData(defaultData);
          }
        } else {
          localStorage.setItem(`password_lab_progress_mock_${user.uid}`, JSON.stringify(newUserData));
          setData(newUserData);
        }
        setLoading(false);
      } else {
        // Load live Firebase Firestore progress
        try {
          const docRef = doc(db, 'users', user.uid, 'progress', 'state');
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setData(docSnap.data() as ProgressData);
          } else {
            await setDoc(docRef, newUserData);
            setData(newUserData);
          }
        } catch (err) {
          console.error("Failed to load progress from database", err);
        } finally {
          setLoading(false);
        }
      }
    };

    loadProgress();
  }, [user, isMockMode]);

  const saveData = async (newData: ProgressData) => {
    setData(newData);
    if (user) {
      if (isMockMode) {
        localStorage.setItem(`password_lab_progress_mock_${user.uid}`, JSON.stringify(newData));
      } else {
        try {
          const docRef = doc(db, 'users', user.uid, 'progress', 'state');
          await setDoc(docRef, newData);
        } catch (err) {
          console.error("Failed to save progress to database", err);
        }
      }
    }
  };

  const addXp = async (amount: number, reason: string) => {
    const newData = { ...data, xp: (data.xp || 0) + amount };
    await saveData(newData);
  };

  const addCoins = async (amount: number, reason: string) => {
    const currentCoins = data.coins || 0;
    const newData = { ...data, coins: currentCoins + amount };
    await saveData(newData);
  };

  const deductCoins = async (amount: number, reason: string): Promise<boolean> => {
    const currentCoins = data.coins || 0;
    if (currentCoins >= amount) {
      const newData = { ...data, coins: currentCoins - amount };
      await saveData(newData);
      return true;
    }
    return false;
  };

  const incrementCommandCount = async () => {
    const newData = { ...data, commandsRun: (data.commandsRun || 0) + 1 };
    await saveData(newData);
  };

  const getLabState = (labId: string) => {
    return data.labState[labId] || { currentSection: 0, completedSections: [] };
  };

  const getCurrentSection = (labId: string) => {
    return getLabState(labId).currentSection;
  };

  const setCurrentSection = async (labId: string, sectionIndex: number) => {
    const existing = getLabState(labId);
    const newData: ProgressData = {
      ...data,
      labState: {
        ...data.labState,
        [labId]: { ...existing, currentSection: sectionIndex }
      }
    };
    await saveData(newData);
  };

  const isSectionCompleted = (labId: string, sectionIndex: number) => {
    return getLabState(labId).completedSections.includes(sectionIndex);
  };

  const completeSection = async (labId: string, sectionIndex: number) => {
    const existing = getLabState(labId);
    if (existing.completedSections.includes(sectionIndex)) return;
    const newData: ProgressData = {
      ...data,
      labState: {
        ...data.labState,
        [labId]: {
          ...existing,
          completedSections: [...existing.completedSections, sectionIndex]
        }
      }
    };
    await saveData(newData);
  };

  const isLabCompleted = (labId: string) => {
    return data.completedLabs.includes(labId);
  };

  const completeLab = async (labId: string, lab: Lab) => {
    if (isLabCompleted(labId)) return;
    const newData: ProgressData = {
      ...data,
      completedLabs: [...data.completedLabs, labId],
      xp: data.xp + lab.xp,
      earnedBadges: [
        ...data.earnedBadges,
        { id: labId, icon: lab.badgeIcon, name: lab.badgeName, date: new Date().toISOString() }
      ]
    };
    await saveData(newData);
  };

  const isLabLocked = (trackId: string, labIndex: number) => {
    if (labIndex === 0) return false;
    const track = LAB_DATA.find(t => t.id === trackId);
    if (!track) return true;
    const prevLabId = track.labs[labIndex - 1].id;
    return !isLabCompleted(prevLabId);
  };

  const getRank = () => {
    const xp = data.xp;
    if (xp < 200) return "Associate Security Analyst";
    if (xp < 500) return "Incident Responder";
    if (xp < 1000) return "Security Engineer";
    if (xp < 2000) return "Security Risk Auditor";
    if (xp < 3500) return "Senior Penetration Tester";
    return "Principal Security Architect";
  };

  const resetProgress = async () => {
    if (confirm("Are you sure you want to reset ALL progress?")) {
      await saveData(defaultData);
      window.location.reload();
    }
  };

  const getDailyChallengeDayStart = (): number => {
    const today = getTodayMidnight();
    if (data.dailyChallengeDay < today) {
      return today;
    }
    return data.dailyChallengeDay;
  };

  const getDailyChallenge = (type: string): DailyChallengeData | null => {
    const today = getTodayMidnight();
    if (data.dailyChallengeDay < today) {
      return null;
    }
    return data.dailyChallenges[type] || null;
  };

  const setDailyChallenge = async (challenge: DailyChallengeData) => {
    const today = getTodayMidnight();
    let currentChallenges = data.dailyChallenges;
    if (data.dailyChallengeDay < today) {
      currentChallenges = {};
    }
    const newData = {
      ...data,
      dailyChallenges: {
        ...currentChallenges,
        [challenge.type]: challenge,
      },
      dailyChallengeDay: today,
    };
    await saveData(newData);
  };

  const completeDailyChallenge = async (type: string) => {
    const dc = data.dailyChallenges[type];
    if (!dc || dc.completed) return;
    const currentCoins = data.coins || 0;
    const updated = {
      ...dc,
      completed: true,
      completedAt: Date.now(),
    };
    const newData = {
      ...data,
      dailyChallenges: {
        ...data.dailyChallenges,
        [type]: updated,
      },
      coins: currentCoins + dc.reward,
      challengesSolved: (data.challengesSolved || 0) + 1,
    };
    await saveData(newData);
  };

  const advanceHintInChallenge = async (type: string, free?: boolean): Promise<boolean> => {
    const dc = data.dailyChallenges[type];
    if (!dc) return false;
    const currentCoins = data.coins || 0;
    const cost = Math.floor(dc.reward / 2);
    if (!free && currentCoins < cost) return false;
    if (dc.hintLevel >= dc.hints.length) return false;
    const updated = { ...dc, hintLevel: dc.hintLevel + 1 };
    const newData = {
      ...data,
      dailyChallenges: {
        ...data.dailyChallenges,
        [type]: updated,
      },
      coins: free ? currentCoins : currentCoins - cost,
    };
    await saveData(newData);
    return true;
  };

  return (
    <ProgressContext.Provider value={{
      data, loading, addXp, addCoins, deductCoins, incrementCommandCount, getCurrentSection, setCurrentSection,
      isSectionCompleted, completeLab, isLabLocked,
      getRank, resetProgress, isLabCompleted, completeSection,
      setDailyChallenge, completeDailyChallenge, advanceHintInChallenge,
      getDailyChallenge, getDailyChallengeDayStart,
    }}>
      {children}
    </ProgressContext.Provider>
  );
}

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (context === undefined) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
};
