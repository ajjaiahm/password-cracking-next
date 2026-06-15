"use client";

import React from 'react';
import { useProgress } from '@/context/ProgressContext';
import { useLab } from '@/context/LabContext';
import { useAuth } from '@/context/AuthContext';
import { LAB_DATA } from '@/data/labs';
import { 
  Shield, 
  X, 
  LayoutDashboard, 
  LogOut, 
  BookOpen, 
  Cpu, 
  Globe, 
  Lock, 
  CheckCircle2, 
  BookOpenCheck,
  Search,
  Terminal,
  ShieldAlert,
  Trophy,
  Sparkles
} from 'lucide-react';

export function Sidebar({ isMobileOpen, setIsMobileOpen, openDashboard, openLeaderboard, openDailyChallenge }: { 
  isMobileOpen: boolean, 
  setIsMobileOpen: (v: boolean) => void, 
  openDashboard: () => void,
  openLeaderboard: () => void,
  openDailyChallenge: () => void
}) {
  const { data, isLabCompleted, isLabLocked, getRank } = useProgress();
  const { activeLabId, loadLab } = useLab();
  const { user, logout } = useAuth();

  const totalLabs = LAB_DATA.reduce((sum, track) => sum + track.labs.length, 0);
  const completedCount = data.completedLabs.length;
  
  // Calculate rank progress bar
  let fillPct = 0;
  const xp = data.xp;
  if (xp < 200) fillPct = (xp / 200) * 100;
  else if (xp < 500) fillPct = ((xp - 200) / 300) * 100;
  else if (xp < 1000) fillPct = ((xp - 500) / 500) * 100;
  else if (xp < 2000) fillPct = ((xp - 1000) / 1000) * 100;
  else if (xp < 3500) fillPct = ((xp - 2000) / 1500) * 100;
  else fillPct = 100;

  // Resolve track icons dynamically from labs data
  const renderTrackIcon = (iconName: string) => {
    const cls = "w-4 h-4 shrink-0";
    switch (iconName) {
      case 'BookOpen':    return <BookOpen className={cls} />;
      case 'Cpu':         return <Cpu className={cls} />;
      case 'Globe':       return <Globe className={cls} />;
      case 'Search':      return <Search className={cls} />;
      case 'Terminal':    return <Terminal className={cls} />;
      case 'ShieldAlert': return <ShieldAlert className={cls} />;
      default:            return <Shield className={cls} />;
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/70 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-full bg-zinc-900/95 border-r border-zinc-800
        transform transition-transform duration-200 ease-in-out
        flex flex-col h-screen font-sans
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Header Logo */}
        <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-gradient-to-r from-zinc-950/60 to-zinc-900/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded border border-cyan-800/50 bg-cyan-950/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h1 className="font-mono font-bold text-zinc-100 tracking-wider text-xs leading-tight">PASSWORD<br/>CRACKING LAB</h1>
              <p className="text-[8px] text-cyan-600/80 tracking-[0.25em] uppercase font-mono">Security Auditor v1.0</p>
            </div>
          </div>
          <button className="md:hidden text-zinc-400 hover:text-white" onClick={() => setIsMobileOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Rank / Rating Progress */}
        <div className="p-4 border-b border-zinc-800">
          <div className="flex justify-between text-[10px] text-zinc-500 mb-1.5 uppercase tracking-widest font-mono">
            <span>Security Classification</span>
          </div>
          <div className="text-xs text-zinc-200 font-medium mb-2 font-mono">
            {getRank()}
          </div>
          <div className="h-1 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/80">
            <div 
              className="h-full bg-zinc-400 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, fillPct))}%` }}
            />
          </div>
        </div>

        {/* Tracks List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 custom-scrollbar">
          {LAB_DATA.map((track) => {
            const trackCompleted = track.labs.every(l => isLabCompleted(l.id));
            const trackActive = track.labs.some(l => activeLabId === l.id);
            const nextLockedIdx = track.labs.findIndex((_, i) => isLabLocked(track.id, i));
            
            return (
            <div key={track.id} className="space-y-0.5">
              <div className={`px-5 py-2 flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-wider border-l-2 ${trackActive ? 'border-cyan-600 bg-cyan-950/10 text-cyan-400' : 'border-transparent text-zinc-500'}`}>
                {renderTrackIcon(track.icon)}
                <span className="flex-1">{track.name}</span>
                {trackCompleted && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                {nextLockedIdx === 0 && <Lock className="w-3 h-3 text-zinc-600" />}
              </div>
              
              <div className="flex flex-col">
                {track.labs.map((lab, index) => {
                  const isCompleted = isLabCompleted(lab.id);
                  const isLocked = isLabLocked(track.id, index);
                  const isActive = activeLabId === lab.id;
                  
                  return (
                    <button
                      key={lab.id}
                      disabled={isLocked}
                      onClick={() => {
                        loadLab(track.id, lab.id);
                        if (window.innerWidth < 768) setIsMobileOpen(false);
                      }}
                      className={`
                        w-full text-left px-5 py-2 flex items-center justify-between text-xs transition-all border-l-2 ml-2
                        ${isLocked ? 'opacity-25 cursor-not-allowed' : 'hover:bg-zinc-800/40 hover:border-zinc-600'}
                        ${isActive 
                          ? 'bg-cyan-500/8 border-cyan-500 text-cyan-300 font-medium shadow-[inset_0_0_12px_rgba(6,182,212,0.06)]' 
                          : isCompleted 
                            ? 'border-emerald-900/30 text-zinc-500' 
                            : isLocked 
                              ? 'border-transparent text-zinc-600' 
                              : 'border-transparent text-zinc-400 hover:text-zinc-200'}
                      `}
                      style={isActive ? { borderLeftWidth: '2px' } : {}}
                    >
                      <div className="flex items-center gap-2 truncate mr-2">
                        <div className={`w-1 h-1 rounded-full shrink-0 ${
                          isCompleted ? 'bg-emerald-500' : isActive ? 'bg-cyan-400 animate-pulse' : isLocked ? 'bg-zinc-700' : 'bg-zinc-600'
                        }`} />
                        <span className="truncate">{index + 1}. {lab.name}</span>
                      </div>
                      
                      <div className="shrink-0 flex items-center justify-center">
                        {isCompleted ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-500/70" />
                        ) : isLocked ? (
                          <Lock className="w-2.5 h-2.5 text-zinc-600" />
                        ) : isActive ? (
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(6,182,212,0.5)]" />
                        ) : (
                          <div className="w-1 h-1 rounded-full bg-zinc-600" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )})}
        </div>

        {/* User Card & Stats */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/20 space-y-4 font-mono text-[10px]">
          <div className="space-y-1.5 text-zinc-500">
            <div className="flex justify-between items-center">
              <span>ACTIVE USER:</span>
              <span className="text-zinc-300 max-w-[150px] truncate" title={user?.email || ''}>{user?.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>TOTAL SCORE:</span>
              <span className="text-zinc-300">{data.xp} XP</span>
            </div>
            <div className="flex justify-between items-center">
              <span>COMPLETED MODULES:</span>
              <span className="text-zinc-300">{completedCount}/{totalLabs}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-2">
            <button 
              onClick={openDashboard}
              title="Dashboard"
              className="col-span-1 flex items-center justify-center gap-1.5 py-2 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800/80 rounded transition-colors text-[10px] uppercase font-mono tracking-wider"
            >
              <LayoutDashboard className="w-3 h-3" /> Dash
            </button>
            <button 
              onClick={openDailyChallenge}
              title="Daily Challenge"
              className="col-span-1 flex items-center justify-center gap-1 py-2 bg-zinc-900 border border-zinc-800 text-cyan-400 hover:text-cyan-300 hover:border-cyan-900/50 hover:bg-cyan-950/20 rounded transition-colors text-[10px] uppercase font-mono tracking-wider"
            >
              <Sparkles className="w-3 h-3" /> Daily
            </button>
            <button 
              onClick={openLeaderboard}
              title="Leaderboard"
              className="col-span-1 flex items-center justify-center gap-1.5 py-2 bg-zinc-900 border border-zinc-800 text-amber-500 hover:text-amber-400 hover:border-amber-900/50 hover:bg-amber-950/20 rounded transition-colors text-[10px] uppercase font-mono tracking-wider"
            >
              <Trophy className="w-3 h-3" /> Rank
            </button>
            <button
              onClick={() => logout()}
              title="Sign Out"
              className="col-span-1 flex items-center justify-center py-2 bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-950/50 hover:bg-red-950/10 rounded transition-colors"
            >
              <LogOut className="w-3 h-3" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
