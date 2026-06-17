"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useProgress } from '@/context/ProgressContext';
import { LabProvider } from '@/context/LabContext';
import { Sidebar } from './Sidebar';
import { Dashboard } from './Dashboard';
import { Leaderboard } from './Leaderboard';
import { DailyChallengePanel } from './DailyChallengePanel';
import { LabViewer } from './LabViewer';
import { VirtualMentor } from './VirtualMentor';
import { TerminalSimulator } from './TerminalSimulator';
import { AuthScreens } from './AuthScreens';
import { AccountSetupPage } from './AccountSetupPage';
import { HackerBackground } from './HackerBackground';
import { Toaster } from 'react-hot-toast';
import { Menu } from 'lucide-react';

// Route guard for authenticated operators who have finished onboarding
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (profile && !profile.onboardingComplete) {
    return <Navigate to="/onboarding" replace />;
  }
  
  return <>{children}</>;
}

// Route guard for onboarding questionnaire
function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (profile?.onboardingComplete) {
    return <Navigate to="/workspace" replace />;
  }
  
  return <>{children}</>;
}

// Route guard for unauthorized pages (Login, Register, Reset)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  
  if (user) {
    if (profile && !profile.onboardingComplete) {
      return <Navigate to="/onboarding" replace />;
    }
    return <Navigate to="/workspace" replace />;
  }
  
  return <>{children}</>;
}

function ResizeHandle({ onDrag, onDragStart, onDragEnd, position }: { onDrag: (delta: number) => void; onDragStart?: () => void; onDragEnd?: () => void; position: 'left' | 'right' }) {
  const dragging = useRef(false);
  const startX = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    onDragStart?.();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = ev.clientX - startX.current;
      startX.current = ev.clientX;
      onDrag(position === 'right' ? -delta : delta);
    };

    const onMouseUp = () => {
      dragging.current = false;
      onDragEnd?.();
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [onDrag, onDragStart, onDragEnd, position]);

  return (
    <div
      onMouseDown={onMouseDown}
      data-resize-handle
      className="hidden md:block w-1 hover:w-1.5 bg-transparent hover:bg-cyan-800/30 cursor-col-resize shrink-0 transition-all duration-150 relative z-20 group"
    >
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  );
}

function WorkspaceLayout() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isDailyChallengeOpen, setIsDailyChallengeOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Track viewport width for responsive behavior
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );
  const isMobile = windowWidth < 768;

  // Resizable panel widths (in px, persisted to localStorage)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = parseInt(localStorage.getItem('pcl_sidebar_width') || '260', 10);
      return Math.min(saved, window.innerWidth * 0.35);
    }
    return 260;
  });
  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = parseInt(localStorage.getItem('pcl_right_panel_width') || '340', 10);
      return Math.min(saved, Math.max(260, window.innerWidth * 0.4));
    }
    return 340;
  });

  // Track window resize for responsive layout
  useEffect(() => {
    const handleResize = () => {
      const ww = window.innerWidth;
      setWindowWidth(ww);
      setSidebarWidth(w => clamp(w, 180, Math.min(400, ww * 0.4)));
      setRightPanelWidth(w => clamp(w, 260, Math.min(600, ww * 0.45)));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem('pcl_sidebar_width', String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem('pcl_right_panel_width', String(rightPanelWidth));
  }, [rightPanelWidth]);

  // Clear resizing flag after drag finishes
  useEffect(() => {
    if (!isResizing) return;
    const timer = setTimeout(() => setIsResizing(false), 100);
    return () => clearTimeout(timer);
  }, [isResizing]);

  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
  const smoothClass = isResizing ? '' : 'md:transition-[width] md:duration-200 md:ease-out';

  return (
    <LabProvider>
      <main className="flex h-screen w-full overflow-hidden relative bg-zinc-950 text-zinc-100">
        
        {/* Cursor Reactive Grid Canvas */}
        <HackerBackground />
        
        {/* Dashboard Overlay */}
        <Dashboard isOpen={isDashboardOpen} onClose={() => setIsDashboardOpen(false)} />

        {/* Leaderboard Overlay */}
        {isLeaderboardOpen && <Leaderboard onClose={() => setIsLeaderboardOpen(false)} />}

        {/* Sidebar — fixed on mobile, static on desktop */}
        <div style={{ width: sidebarWidth }} className={`hidden md:block shrink-0 overflow-hidden ${smoothClass}`}>
          <Sidebar 
            isMobileOpen={isMobileOpen} 
            setIsMobileOpen={setIsMobileOpen} 
            openDashboard={() => setIsDashboardOpen(true)} 
            openLeaderboard={() => setIsLeaderboardOpen(true)}
            openDailyChallenge={() => setIsDailyChallengeOpen(true)}
            onNavigate={() => setIsDailyChallengeOpen(false)}
          />
        </div>
        {/* Mobile sidebar always rendered (slides in/out via CSS) */}
        <div className="md:hidden">
          <Sidebar 
            isMobileOpen={isMobileOpen} 
            setIsMobileOpen={setIsMobileOpen} 
            openDashboard={() => setIsDashboardOpen(true)} 
            openLeaderboard={() => setIsLeaderboardOpen(true)}
            openDailyChallenge={() => setIsDailyChallengeOpen(true)}
            onNavigate={() => setIsDailyChallengeOpen(false)}
          />
        </div>

        <ResizeHandle 
          onDrag={(delta) => { setIsResizing(true); setSidebarWidth(w => clamp(w - delta, 180, 400)); }}
          onDragStart={() => setIsResizing(true)}
          onDragEnd={() => setIsResizing(false)}
          position="right"
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 relative z-10 bg-transparent overflow-hidden">
          
          {/* Mobile Header */}
          <div className="md:hidden h-14 border-b border-zinc-800/80 flex items-center justify-between px-4 bg-zinc-900/80 backdrop-blur-xl shrink-0">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsMobileOpen(true)}
                className="text-zinc-400 hover:text-zinc-100 transition-colors p-1 rounded"
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <span className="font-mono font-bold text-xs tracking-widest text-zinc-300">PCL</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsDashboardOpen(true)}
                className="text-zinc-400 hover:text-zinc-100 transition-colors p-1.5 rounded border border-zinc-800"
                aria-label="Dashboard"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
              <button
                onClick={() => setIsLeaderboardOpen(true)}
                className="text-amber-500 hover:text-amber-400 transition-colors p-1.5 rounded border border-zinc-800"
                aria-label="Leaderboard"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 21H5a2 2 0 01-2-2v-1a5 5 0 015-5h8a5 5 0 015 5v1a2 2 0 01-2 2h-3M12 3a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Desktop + Mobile main content: lab viewer + right panel */}
          <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden bg-transparent">
            {/* Lab content — always full width on mobile, flex-1 on desktop */}
            <div className="flex-1 min-h-0 flex flex-col">
              <LabViewer 
                showDailyChallenge={isDailyChallengeOpen}
                onCloseDailyChallenge={() => setIsDailyChallengeOpen(false)}
              />
            </div>

            <ResizeHandle 
              onDrag={(delta) => { setIsResizing(true); setRightPanelWidth(w => clamp(w - delta, 260, 600)); }}
              onDragStart={() => setIsResizing(true)}
              onDragEnd={() => setIsResizing(false)}
              position="left"
            />

            {/* Right panel: Mentor + Terminal — stacks below on mobile */}
            <div 
              style={{ width: isMobile ? '100%' : rightPanelWidth }}
              className={`right-panel-mobile md:shrink-0 md:min-h-0 border-t md:border-t-0 md:border-l border-zinc-800 flex flex-col bg-zinc-900/60 ${smoothClass}`}
            >
              <VirtualMentor />
              <TerminalSimulator />
            </div>
          </div>
        </div>
      </main>
    </LabProvider>
  );
}

export function AppRouter() {
  return (
    <>
      {/* Toast Notification system formatted in minimal monochrome theme */}
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: {
            background: '#18181b',
            border: '1px solid #27272a',
            color: '#f4f4f5',
            fontFamily: 'monospace',
            fontSize: '11px',
            borderRadius: '4px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
          },
          success: {
            iconTheme: {
              primary: '#e4e4e7',
              secondary: '#18181b',
            },
          },
          error: {
            style: {
              border: '1px solid rgba(220, 38, 38, 0.4)',
              background: '#18181b',
              color: '#f87171',
            },
            iconTheme: {
              primary: '#ef4444',
              secondary: '#18181b',
            },
          },
        }}
      />
      <HashRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><AuthScreens view="login" /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><AuthScreens view="signup" /></PublicRoute>} />
          <Route path="/forgot" element={<PublicRoute><AuthScreens view="forgot" /></PublicRoute>} />
          <Route path="/setup" element={<AccountSetupPage />} />
          <Route path="/onboarding" element={<OnboardingRoute><AuthScreens view="onboarding" /></OnboardingRoute>} />
          <Route path="/workspace" element={<ProtectedRoute><WorkspaceLayout /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/workspace" replace />} />
        </Routes>
      </HashRouter>
    </>
  );
}
