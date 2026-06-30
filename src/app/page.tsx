"use client";

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useProgress } from '@/context/ProgressContext';
import dynamic from 'next/dynamic';
const AppRouter = dynamic(() => import('@/components/AppRouter').then(mod => mod.AppRouter), { ssr: false });
import { Loader2 } from 'lucide-react';
import { HackerBackground } from '@/components/HackerBackground';

export default function Home() {
  const { loading: authLoading } = useAuth();
  const { loading: progressLoading } = useProgress();

  // Show system progress loader during provider handshakes
  if (authLoading || progressLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-500 font-mono relative">
        <HackerBackground />
        <Loader2 className="w-5 h-5 animate-spin text-zinc-600 mb-3 relative z-10" />
        <span className="text-[10px] uppercase tracking-[0.2em] relative z-10 text-zinc-600">Initializing PASSWORD CRACKING LAB...</span>
      </div>
    );
  }

  return <AppRouter />;
}
