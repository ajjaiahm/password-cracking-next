"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { LAB_DATA, Lab, Track, LabSection } from '@/data/labs';
import { useProgress } from './ProgressContext';

interface LabContextType {
  activeTrackId: string | null;
  activeLabId: string | null;
  activeLab: Lab | null;
  currentSectionIndex: number;
  expectedCommand: string | null;
  expectedSection: LabSection | null;
  
  loadLab: (trackId: string, labId: string) => void;
  loadNextLab: () => void;
  nextSection: () => void;
  prevSection: () => void;
  jumpToSection: (index: number) => void;
  setExpectedContext: (command: string, section: LabSection | null) => void;
  onCommandExecutedSuccess: () => void;
}

const LabContext = createContext<LabContextType | undefined>(undefined);

export function LabProvider({ children }: { children: React.ReactNode }) {
  const { isLabLocked, getCurrentSection, setCurrentSection, isSectionCompleted, completeSection } = useProgress();
  
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [activeLabId, setActiveLabId] = useState<string | null>(null);
  const [activeLab, setActiveLab] = useState<Lab | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState<number>(0);
  
  // Terminal expectations
  const [expectedCommand, setExpectedCommand] = useState<string | null>(null);
  const [expectedSection, setExpectedSection] = useState<LabSection | null>(null);

  // Sync with progress context
  useEffect(() => {
    if (activeLabId) {
      setCurrentSectionIndex(getCurrentSection(activeLabId));
    }
  }, [activeLabId, getCurrentSection]);

  const loadLab = (trackId: string, labId: string) => {
    const track = LAB_DATA.find(t => t.id === trackId);
    if (!track) return;
    
    const labIndex = track.labs.findIndex(l => l.id === labId);
    if (labIndex === -1) return;
    
    if (isLabLocked(trackId, labIndex)) {
      alert('Review previous module criteria before initiating this audit.');
      return;
    }
    
    setActiveTrackId(trackId);
    setActiveLabId(labId);
    setActiveLab(track.labs[labIndex]);
    setCurrentSectionIndex(getCurrentSection(labId));
    setExpectedCommand(null);
    setExpectedSection(null);
  };

  const markCurrentSectionComplete = async () => {
    if (activeLabId && !isSectionCompleted(activeLabId, currentSectionIndex)) {
      await completeSection(activeLabId, currentSectionIndex);
    }
  };

  const nextSection = async () => {
    if (!activeLab) return;
    
    if (currentSectionIndex < activeLab.sections.length - 1) {
      const currentSec = activeLab.sections[currentSectionIndex];
      const requiresCompletion = ['command', 'challenge', 'quiz'].includes(currentSec.type);
      
      if (requiresCompletion && !isSectionCompleted(activeLabId!, currentSectionIndex)) {
        alert('Complete current step criteria to unlock next phase.');
        return;
      }
      
      if (!requiresCompletion) {
        await markCurrentSectionComplete();
      }
      
      await setCurrentSection(activeLabId!, currentSectionIndex + 1);
    }
  };

  const prevSection = async () => {
    if (currentSectionIndex > 0) {
      await setCurrentSection(activeLabId!, currentSectionIndex - 1);
    }
  };

  const jumpToSection = async (index: number) => {
    if (!activeLab || index === currentSectionIndex) return;
    
    const canJump = index <= currentSectionIndex || isSectionCompleted(activeLabId!, index - 1);
    
    if (canJump) {
      await setCurrentSection(activeLabId!, index);
    } else {
      alert('Cannot bypass validation benchmarks.');
    }
  };

  const setExpectedContext = (command: string, section: LabSection | null) => {
    setExpectedCommand(command);
    setExpectedSection(section);
  };

  const onCommandExecutedSuccess = async () => {
    await markCurrentSectionComplete();
    setExpectedCommand(null);
    setExpectedSection(null);
  };

  const loadNextLab = () => {
    if (!activeTrackId || !activeLabId) return;

    const trackIdx = LAB_DATA.findIndex(t => t.id === activeTrackId);
    if (trackIdx === -1) return;

    const track = LAB_DATA[trackIdx];
    const labIdx = track.labs.findIndex(l => l.id === activeLabId);

    // Next lab in same track
    if (labIdx < track.labs.length - 1) {
      const nextLab = track.labs[labIdx + 1];
      setActiveTrackId(track.id);
      setActiveLabId(nextLab.id);
      setActiveLab(nextLab);
      setCurrentSectionIndex(0);
      setExpectedCommand(null);
      setExpectedSection(null);
      return;
    }

    // First lab of next track
    if (trackIdx < LAB_DATA.length - 1) {
      const nextTrack = LAB_DATA[trackIdx + 1];
      if (nextTrack.labs.length > 0) {
        const nextLab = nextTrack.labs[0];
        setActiveTrackId(nextTrack.id);
        setActiveLabId(nextLab.id);
        setActiveLab(nextLab);
        setCurrentSectionIndex(0);
        setExpectedCommand(null);
        setExpectedSection(null);
        return;
      }
    }

    // All labs completed — return to dashboard
    setActiveLab(null);
    setActiveLabId(null);
    setActiveTrackId(null);
  };

  return (
    <LabContext.Provider value={{
      activeTrackId, activeLabId, activeLab, currentSectionIndex,
      expectedCommand, expectedSection,
      loadLab, loadNextLab, nextSection, prevSection, jumpToSection,
      setExpectedContext, onCommandExecutedSuccess
    }}>
      {children}
    </LabContext.Provider>
  );
}

export const useLab = () => {
  const context = useContext(LabContext);
  if (context === undefined) {
    throw new Error('useLab must be used within a LabProvider');
  }
  return context;
};
