"use client";

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Shield, KeyRound, Loader2, ArrowRight, Mail, CheckCircle2, AlertTriangle } from 'lucide-react';
import { HackerBackground } from './HackerBackground';

interface AuthScreensProps {
  view: 'login' | 'signup' | 'forgot' | 'onboarding';
}

export function AuthScreens({ view }: AuthScreensProps) {
  const { login, initiateEmailVerification, resetPassword, saveOnboarding, isMockMode } = useAuth();
  const navigate = useNavigate();

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Onboarding states
  const [interest, setInterest] = useState('Application Security');
  const [experience, setExperience] = useState('Entry-level / Student');

  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [emailSent, setEmailSent] = useState(false); // for signup "check your inbox" state

  const isMockBackend =
    !process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY.includes('mock');

  const clearMessages = () => {
    setError('');
    setSuccessMsg('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    clearMessages();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Authentication successful. Console unlocked.');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
      toast.error(err.message || 'Authentication failed.');
      setLoading(false);
    }
  };

  // Step 1: User submits email → send verification link
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    clearMessages();
    setLoading(true);
    try {
      await initiateEmailVerification(email);

      if (isMockMode) {
        // In mock mode, skip email and go directly to setup
        toast.success('Mock mode: Skip directly to account setup.');
        navigate(`/setup?email=${encodeURIComponent(email)}&mock=1`);
      } else {
        setEmailSent(true);
        toast.success('Verification email sent! Check your inbox or spam folder.');
      }
    } catch (err: any) {
      if (err.message === 'VERIFICATION_EMAIL_FAILED') {
        toast.success('Continuing to account setup...');
        navigate(`/setup?email=${encodeURIComponent(email)}`);
      } else {
        setError(err.message || 'Failed to send verification email. Please try again.');
        toast.error(err.message || 'Email send failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    clearMessages();
    setLoading(true);
    try {
      await resetPassword(email);
      setSuccessMsg("A password reset link has been sent to your email. If you don't see it in your inbox, please check your Spam or Junk folder.");
      toast.success('Reset email dispatched. Check your Spam folder if not found in inbox.');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset link.');
      toast.error(err.message || 'Reset failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      await saveOnboarding(interest, experience);
      toast.success('System configuration set. Welcome to the lab.');
    } catch (err: any) {
      setError('Failed to save onboarding questions. Please try again.');
      toast.error('Configuration save failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-100 p-4 font-sans select-none relative overflow-hidden">
      <HackerBackground />

      {/* Top progress bar when loading */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-zinc-800 z-50">
        {loading && <div className="h-full bg-zinc-400 animate-pulse w-full" />}
      </div>

      {/* Mock mode banner */}
      {isMockBackend && (
        <div className="w-full max-w-md mb-4 bg-zinc-900/90 border border-yellow-900/30 text-yellow-600/90 p-3 rounded text-[10px] font-mono flex gap-2.5 items-start z-10 shadow-lg backdrop-blur-sm">
          <AlertTriangle className="w-4 h-4 text-yellow-600/90 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold uppercase">DATABASE MOCK MODE:</span> No Firebase keys found.
            Progress resets on reload. Email verification is simulated — you will be taken directly to setup.
          </div>
        </div>
      )}

      <div className="w-full max-w-md bg-zinc-900/90 border border-zinc-800 p-8 rounded shadow-2xl relative z-10 backdrop-blur-md">
        {/* Header */}
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded border border-zinc-800 flex items-center justify-center bg-zinc-950/60 text-zinc-400">
            {view === 'onboarding' ? <KeyRound className="w-6 h-6 text-zinc-300" /> :
             view === 'signup' && emailSent ? <Mail className="w-6 h-6 text-cyan-400" /> :
             <Shield className="w-6 h-6 text-zinc-300" />}
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="font-mono text-xs tracking-[0.3em] text-zinc-300 uppercase font-bold">Password Cracking Lab</h1>
          <p className="text-[9px] text-zinc-500 tracking-wider uppercase mt-1">Operational Audit Workspace</p>
        </div>

        {/* Error / Success */}
        {error && (
          <div className="mb-6 p-3 bg-red-950/30 border border-red-900/50 text-red-400 text-xs font-mono rounded flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-6 p-3 bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs font-mono rounded">
            {successMsg}
          </div>
        )}

        {/* ── LOGIN ── */}
        {view === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-500 font-mono mb-2">User Email</label>
              <input
                type="email" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)} disabled={loading}
                className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-zinc-600 text-zinc-100 text-sm p-3 rounded outline-none transition-colors font-mono placeholder:text-zinc-700"
                placeholder="operator@system.domain"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-500 font-mono mb-2">Password</label>
              <input
                type="password" required autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)} disabled={loading}
                className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-zinc-600 text-zinc-100 text-sm p-3 rounded outline-none transition-colors font-mono placeholder:text-zinc-700"
                placeholder="••••••••"
              />
            </div>
            <div className="flex justify-between items-center text-xs pt-1">
              <button type="button" onClick={() => { navigate('/forgot'); clearMessages(); }}
                className="text-zinc-500 hover:text-zinc-300 transition-colors" disabled={loading}>
                Forgot Password?
              </button>
            </div>
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 mt-2 py-3 bg-zinc-100 hover:bg-white text-zinc-900 font-semibold text-xs uppercase tracking-wider rounded transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Authenticate <ArrowRight className="w-4 h-4" /></>}
            </button>
            <div className="text-center text-xs pt-4 border-t border-zinc-800/50 text-zinc-500">
              New operator?{' '}
              <button type="button" onClick={() => { navigate('/signup'); clearMessages(); setEmailSent(false); }}
                className="text-zinc-300 hover:text-white transition-colors" disabled={loading}>
                Register Account
              </button>
            </div>
          </form>
        )}

        {/* ── SIGNUP: Step 1 — Email only ── */}
        {view === 'signup' && !emailSent && (
          <form onSubmit={handleSignup} className="space-y-5">
            <p className="text-xs text-zinc-400 font-mono leading-relaxed">
              Enter your email address. We will send you a <span className="text-cyan-400 font-semibold">secure verification link</span>.
              After clicking the link, you will be taken to a private page to complete your account setup.
            </p>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-500 font-mono mb-2">Email Address</label>
              <input
                type="email" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)} disabled={loading}
                className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-cyan-800 text-zinc-100 text-sm p-3 rounded outline-none transition-colors font-mono placeholder:text-zinc-700"
                placeholder="operator@system.domain"
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-900/40 hover:bg-cyan-900/70 border border-cyan-800/50 text-cyan-300 font-semibold text-xs uppercase tracking-wider rounded transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Mail className="w-4 h-4" /> Send Verification Email</>}
            </button>
            <div className="text-center text-xs pt-2 border-t border-zinc-800/50 text-zinc-500">
              Already registered?{' '}
              <button type="button" onClick={() => { navigate('/login'); clearMessages(); }}
                className="text-zinc-300 hover:text-white transition-colors" disabled={loading}>
                Authenticate
              </button>
            </div>
          </form>
        )}

        {/* ── SIGNUP: Step 2 — Check inbox state ── */}
        {view === 'signup' && emailSent && (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full border border-cyan-800/50 bg-cyan-950/20 flex items-center justify-center">
                <Mail className="w-8 h-8 text-cyan-400" />
              </div>
            </div>
            <div>
              <h2 className="font-mono text-sm font-bold text-zinc-100 mb-2">Check Your Inbox</h2>
              <p className="text-xs text-zinc-400 font-mono leading-relaxed">
                A secure verification link was sent to:<br />
                <span className="text-cyan-400 font-semibold">{email}</span>
              </p>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded p-4 text-left space-y-2.5">
              <div className="flex items-start gap-2 text-xs font-mono text-zinc-400">
                <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                <span>Open your email inbox (including <span className="text-zinc-200">Spam / Junk</span> folder)</span>
              </div>
              <div className="flex items-start gap-2 text-xs font-mono text-zinc-400">
                <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                <span>Look for a message from <span className="text-zinc-200">Password Cracking Lab</span></span>
              </div>
              <div className="flex items-start gap-2 text-xs font-mono text-zinc-400">
                <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                <span>Click the secure link inside to complete your account setup</span>
              </div>
            </div>
            <p className="text-[10px] text-zinc-600 font-mono">
              Link not received? Check spam or{' '}
              <button onClick={() => setEmailSent(false)} className="text-zinc-400 hover:text-zinc-200 underline">
                try a different email
              </button>
            </p>
          </div>
        )}

        {/* ── FORGOT PASSWORD ── */}
        {view === 'forgot' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <p className="text-xs text-zinc-400 font-mono leading-relaxed mb-4">
              Enter your account email to receive a secure password reset link.
            </p>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-500 font-mono mb-2">Account Email</label>
              <input
                type="email" required
                value={email} onChange={e => setEmail(e.target.value)} disabled={loading}
                className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-zinc-600 text-zinc-100 text-sm p-3 rounded outline-none transition-colors font-mono placeholder:text-zinc-700"
                placeholder="operator@system.domain"
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 mt-2 py-3 bg-zinc-100 hover:bg-white text-zinc-900 font-semibold text-xs uppercase tracking-wider rounded transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Reset Link'}
            </button>
            <div className="text-center text-xs pt-4 border-t border-zinc-800/50">
              <button type="button" onClick={() => { navigate('/login'); clearMessages(); }}
                className="text-zinc-400 hover:text-white transition-colors" disabled={loading}>
                Back to Login
              </button>
            </div>
          </form>
        )}

        {/* ── ONBOARDING ── */}
        {view === 'onboarding' && (
          <form onSubmit={handleOnboarding} className="space-y-4">
            <p className="text-xs text-zinc-400 font-mono leading-relaxed mb-4">
              Onboarding: Configure your lab console by answering these quick questions.
            </p>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-500 font-mono mb-2">Primary Interest</label>
              <select value={interest} onChange={e => setInterest(e.target.value)} disabled={loading}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-600 text-zinc-100 text-sm p-3 rounded outline-none font-mono">
                <option value="Application Security">Application Security</option>
                <option value="Penetration Testing">Penetration Testing</option>
                <option value="Security Auditing & Compliance">Security Auditing &amp; Compliance</option>
                <option value="Incident Response & Forensics">Incident Response &amp; Forensics</option>
                <option value="Cryptography">Cryptography</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-500 font-mono mb-2">Experience Level</label>
              <select value={experience} onChange={e => setExperience(e.target.value)} disabled={loading}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-600 text-zinc-100 text-sm p-3 rounded outline-none font-mono">
                <option value="Entry-level / Student">Entry-level / Student</option>
                <option value="Intermediate Security Specialist">Intermediate Security Specialist</option>
                <option value="Advanced Practitioner / Engineer">Advanced Practitioner / Engineer</option>
              </select>
            </div>
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 mt-4 py-3 bg-zinc-100 hover:bg-white text-zinc-900 font-semibold text-xs uppercase tracking-wider rounded transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Complete Setup'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
