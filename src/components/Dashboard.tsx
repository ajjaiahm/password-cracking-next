"use client";

import React from 'react';
import { useProgress } from '@/context/ProgressContext';
import { LAB_DATA } from '@/data/labs';
import { 
  X, 
  Zap, 
  Trophy, 
  Award, 
  Terminal, 
  Lock, 
  Search, 
  FileText, 
  ShieldAlert 
} from 'lucide-react';

export function Dashboard({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { data } = useProgress();

  if (!isOpen) return null;

  const totalLabs = LAB_DATA.reduce((sum, track) => sum + track.labs.length, 0);

  // Dynamic Lucide-React Icon lookup for credentials audit badges
  const renderBadgeIcon = (iconName: string) => {
    switch (iconName) {
      case 'Search':
        return <Search className="w-6 h-6 text-gray-300" />;
      case 'FileText':
        return <FileText className="w-6 h-6 text-gray-300" />;
      case 'Terminal':
        return <Terminal className="w-6 h-6 text-gray-300" />;
      case 'ShieldAlert':
        return <ShieldAlert className="w-6 h-6 text-gray-300" />;
      default:
        return <Award className="w-6 h-6 text-gray-300" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div 
        className="glass-panel w-full max-w-4xl max-h-[90vh] flex flex-col rounded overflow-hidden relative border-border-primary bg-bg-panel text-text-primary"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-border-primary flex justify-between items-center bg-bg-secondary/40">
          <h2 className="text-sm font-mono font-bold tracking-widest text-text-secondary flex items-center gap-2">
            <Trophy className="w-4 h-4 text-text-muted" /> SYSTEM AUDITING PROFILE
          </h2>
          <button 
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-bg-card border border-border-primary p-4 rounded flex flex-col items-center justify-center text-center shadow-sm">
              <Zap className="w-5 h-5 text-text-muted mb-2" />
              <div className="text-2xl font-mono font-bold text-text-primary">{data.xp}</div>
              <div className="text-[9px] text-text-muted font-mono uppercase tracking-widest mt-1">Audit Score</div>
            </div>
            <div className="bg-bg-card border border-border-primary p-4 rounded flex flex-col items-center justify-center text-center shadow-sm">
              <Trophy className="w-5 h-5 text-text-muted mb-2" />
              <div className="text-2xl font-mono font-bold text-accent-blue">{data.coins}</div>
              <div className="text-[9px] text-text-muted font-mono uppercase tracking-widest mt-1">Coins Earned</div>
            </div>
            <div className="bg-bg-card border border-border-primary p-4 rounded flex flex-col items-center justify-center text-center shadow-sm">
              <Trophy className="w-5 h-5 text-text-muted mb-2" />
              <div className="text-2xl font-mono font-bold text-text-primary">{data.completedLabs.length}/{totalLabs}</div>
              <div className="text-[9px] text-text-muted font-mono uppercase tracking-widest mt-1">Audits Complete</div>
            </div>
            <div className="bg-bg-card border border-border-primary p-4 rounded flex flex-col items-center justify-center text-center shadow-sm">
              <Award className="w-5 h-5 text-text-muted mb-2" />
              <div className="text-2xl font-mono font-bold text-text-primary">{data.earnedBadges.length}/{totalLabs}</div>
              <div className="text-[9px] text-text-muted font-mono uppercase tracking-widest mt-1">Credentials Earned</div>
            </div>
            <div className="bg-bg-card border border-border-primary p-4 rounded flex flex-col items-center justify-center text-center shadow-sm">
              <Terminal className="w-5 h-5 text-text-muted mb-2" />
              <div className="text-2xl font-mono font-bold text-text-primary">{data.commandsRun || 0}</div>
              <div className="text-[9px] text-text-muted font-mono uppercase tracking-widest mt-1">Queries Ran</div>
            </div>
          </div>

          {/* Earned Audits Certifications Grid */}
          <div>
            <h3 className="text-xs font-mono font-bold mb-4 uppercase tracking-wider text-text-muted">Security Clearance Credentials</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {LAB_DATA.map(track => 
                track.labs.map(lab => {
                  const isEarned = data.completedLabs.includes(lab.id);
                  return (
                    <div 
                      key={lab.id} 
                      className={`
                        flex flex-col items-center justify-center p-5 rounded border text-center transition-all duration-200
                        ${isEarned 
                          ? 'bg-bg-card border-border-primary shadow-md' 
                          : 'bg-bg-card/50 border-border-primary/50 opacity-50 grayscale'
                        }
                      `}
                    >
                      <div className="w-12 h-12 rounded border border-border-primary flex items-center justify-center bg-bg-secondary mb-3">
                        {isEarned ? renderBadgeIcon(lab.badgeIcon) : <Lock className="w-4 h-4 text-text-muted" />}
                      </div>
                      <div className="text-[11px] font-mono text-text-primary font-bold leading-tight mb-1">{lab.badgeName}</div>
                      <div className="text-[9px] text-text-muted uppercase tracking-widest">{isEarned ? 'Cleared' : 'Locked'}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
