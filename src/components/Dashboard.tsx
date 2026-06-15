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
        return <Search className="w-6 h-6 text-zinc-300" />;
      case 'FileText':
        return <FileText className="w-6 h-6 text-zinc-300" />;
      case 'Terminal':
        return <Terminal className="w-6 h-6 text-zinc-300" />;
      case 'ShieldAlert':
        return <ShieldAlert className="w-6 h-6 text-zinc-300" />;
      default:
        return <Award className="w-6 h-6 text-zinc-300" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
      <div 
        className="glass-panel w-full max-w-4xl max-h-[90vh] flex flex-col rounded overflow-hidden relative border-zinc-800 bg-zinc-900 text-zinc-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/40">
          <h2 className="text-sm font-mono font-bold tracking-widest text-zinc-300 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-zinc-400" /> SYSTEM AUDITING PROFILE
          </h2>
          <button 
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-zinc-950 border border-zinc-800/80 p-4 rounded flex flex-col items-center justify-center text-center">
              <Zap className="w-5 h-5 text-zinc-400 mb-2" />
              <div className="text-2xl font-mono font-bold text-zinc-100">{data.xp}</div>
              <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest mt-1">Audit Score</div>
            </div>
            <div className="bg-zinc-950 border border-zinc-800/80 p-4 rounded flex flex-col items-center justify-center text-center">
              <Trophy className="w-5 h-5 text-zinc-400 mb-2" />
              <div className="text-2xl font-mono font-bold text-amber-500">{data.coins}</div>
              <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest mt-1">Coins Earned</div>
            </div>
            <div className="bg-zinc-950 border border-zinc-800/80 p-4 rounded flex flex-col items-center justify-center text-center">
              <Trophy className="w-5 h-5 text-zinc-400 mb-2" />
              <div className="text-2xl font-mono font-bold text-zinc-100">{data.completedLabs.length}/{totalLabs}</div>
              <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest mt-1">Audits Complete</div>
            </div>
            <div className="bg-zinc-950 border border-zinc-800/80 p-4 rounded flex flex-col items-center justify-center text-center">
              <Award className="w-5 h-5 text-zinc-400 mb-2" />
              <div className="text-2xl font-mono font-bold text-zinc-100">{data.earnedBadges.length}/{totalLabs}</div>
              <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest mt-1">Credentials Earned</div>
            </div>
            <div className="bg-zinc-950 border border-zinc-800/80 p-4 rounded flex flex-col items-center justify-center text-center">
              <Terminal className="w-5 h-5 text-zinc-400 mb-2" />
              <div className="text-2xl font-mono font-bold text-zinc-100">{data.commandsRun || 0}</div>
              <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest mt-1">Queries Ran</div>
            </div>
          </div>

          {/* Earned Audits Certifications Grid */}
          <div>
            <h3 className="text-xs font-mono font-bold mb-4 uppercase tracking-wider text-zinc-400">Security Clearance Credentials</h3>
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
                          ? 'bg-zinc-950/40 border-zinc-700 shadow-md' 
                          : 'bg-zinc-950/10 border-zinc-800/50 opacity-40 grayscale'
                        }
                      `}
                    >
                      <div className="w-12 h-12 rounded border border-zinc-800 flex items-center justify-center bg-zinc-950/80 mb-3">
                        {isEarned ? renderBadgeIcon(lab.badgeIcon) : <Lock className="w-4 h-4 text-zinc-700" />}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-300 font-bold leading-tight mb-1">{lab.badgeName}</div>
                      <div className="text-[9px] text-zinc-500 uppercase tracking-widest">{isEarned ? 'Cleared' : 'Locked'}</div>
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
