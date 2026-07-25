"use client";

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useProgress } from '@/context/ProgressContext';
import dynamic from 'next/dynamic';
const AppRouter = dynamic(() => import('@/components/AppRouter').then(mod => mod.AppRouter), { ssr: false });
import { Loader2 } from 'lucide-react';
import { AntigravityBackground } from '@/components/AntigravityBackground';

export default function Home() {
  const { loading: authLoading } = useAuth();
  const { loading: progressLoading } = useProgress();

  if (authLoading || progressLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-gray-400 font-mono relative">
        <AntigravityBackground />
        <Loader2 className="w-5 h-5 animate-spin text-gray-500 mb-3 relative z-10" />
        <span className="text-[10px] uppercase tracking-[0.2em] relative z-10 text-gray-500">Initializing PASSWORD CRACKING LAB...</span>
      </div>
    );
  }

  return <AppRouter />;
}
