"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  ShieldCheck, Loader2, ArrowRight, Eye, EyeOff, 
  Check, X, User, Lock, AlertTriangle, CheckCircle2 
} from 'lucide-react';
import { HackerBackground } from './HackerBackground';

// Debounce utility
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export function AccountSetupPage() {
  const { completeAccountSetup, checkNameUnique, isMockMode } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const emailFromUrl = searchParams.get('email') || '';
  const isMock = searchParams.get('mock') === '1';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Username uniqueness check (debounced)
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'taken' | 'available'>('idle');
  const debouncedUsername = useDebounce(username, 600);

  useEffect(() => {
    if (!debouncedUsername || debouncedUsername.length < 3) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    checkNameUnique(debouncedUsername).then((isUnique) => {
      setUsernameStatus(isUnique ? 'available' : 'taken');
    });
  }, [debouncedUsername, checkNameUnique]);

  // Password strength checks
  const checks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    digit: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password),
  };
  const metCount = Object.values(checks).filter(Boolean).length;
  const strengthPct = (metCount / 4) * 100;
  const strengthLabel = metCount === 0 ? '' : metCount === 1 ? 'Weak' : metCount === 2 ? 'Fair' : metCount === 3 ? 'Good' : 'Strong';
  const strengthColor =
    metCount <= 1 ? 'bg-red-600' :
    metCount === 2 ? 'bg-yellow-500' :
    metCount === 3 ? 'bg-blue-500' :
    'bg-emerald-500';

  const passwordsMatch = password && confirmPassword && password === confirmPassword;
  const canSubmit = metCount === 4 && passwordsMatch && username.length >= 3 && usernameStatus === 'available';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    try {
      const uidFromUrl = searchParams.get('uid') || '';
      const tFromUrl = searchParams.get('t') || '';
      await completeAccountSetup(emailFromUrl, password, username.trim(), uidFromUrl, tFromUrl);
      setDone(true);
      toast.success('Account created successfully! 🎉');
    } catch (err: any) {
      setError(err.message || 'Failed to create account. Please try again.');
      toast.error(err.message || 'Setup failed.');
    } finally {
      setLoading(false);
    }
  };

  // If email is missing from URL, something went wrong
  if (!emailFromUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-4">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
          <h1 className="font-mono font-bold text-zinc-100">Invalid Setup Link</h1>
          <p className="text-xs text-zinc-500 font-mono">This link is invalid or has expired. Please register again.</p>
          <button onClick={() => navigate('/signup')}
            className="px-4 py-2 bg-zinc-100 text-zinc-900 text-xs font-mono font-bold rounded">
            Back to Register
          </button>
        </div>
      </div>
    );
  }

  // Success screen
  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-100 p-4 relative overflow-hidden">
        <HackerBackground />
        <div className="w-full max-w-md bg-zinc-900/90 border border-zinc-800 p-10 rounded shadow-2xl relative z-10 backdrop-blur-md text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full border-2 border-emerald-500/40 bg-emerald-950/30 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
          </div>
          <div>
            <h1 className="font-mono font-bold text-xl text-zinc-100 mb-2">Account Activated</h1>
            <p className="text-sm text-zinc-400 font-mono leading-relaxed">
              Welcome, <span className="text-emerald-400 font-semibold">{username}</span>!<br />
              Your operator account has been successfully created.
            </p>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded p-4 text-left space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Email verified and account secured</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Username <span className="text-zinc-200 font-semibold">{username}</span> reserved</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Ready to access the audit console</span>
            </div>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-100 hover:bg-white text-zinc-900 font-semibold text-xs uppercase tracking-wider rounded transition-all"
          >
            Go to Login Console <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-[10px] text-zinc-600 font-mono">
            Use email <span className="text-zinc-400">{emailFromUrl}</span> to sign in
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-100 p-4 font-sans select-none relative overflow-hidden">
      <HackerBackground />

      {/* Encrypted top bar effect */}
      <div className="absolute top-0 left-0 right-0 h-1 z-50 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-transparent via-cyan-600/60 to-transparent animate-pulse" />
      </div>

      {/* Security badge */}
      <div className="flex items-center gap-2 mb-6 z-10 px-3 py-1.5 bg-emerald-950/30 border border-emerald-800/40 rounded-full">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">Encrypted Connection — SSL/TLS Active</span>
      </div>

      <div className="w-full max-w-lg bg-zinc-900/95 border border-zinc-700 p-8 rounded-lg shadow-2xl relative z-10 backdrop-blur-xl">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-zinc-800">
          <div className="w-12 h-12 rounded-lg border border-cyan-800/50 bg-cyan-950/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="font-mono font-bold text-zinc-100 text-sm tracking-wider">Secure Account Setup</h1>
            <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
              Email verified — <span className="text-cyan-400">{emailFromUrl}</span>
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3 bg-red-950/30 border border-red-900/50 text-red-400 text-xs font-mono rounded flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Username */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-500 font-mono mb-2">
              Operator Handle (Unique Username)
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text" required minLength={3} maxLength={20}
                value={username}
                onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                disabled={loading}
                placeholder="e.g. CipherX_99"
                className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-cyan-700 text-zinc-100 text-sm pl-10 pr-10 py-3 rounded outline-none transition-colors font-mono placeholder:text-zinc-700"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {usernameStatus === 'checking' && <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />}
                {usernameStatus === 'available' && <Check className="w-4 h-4 text-emerald-500" />}
                {usernameStatus === 'taken' && <X className="w-4 h-4 text-red-500" />}
              </div>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[9px] font-mono text-zinc-600">Letters, numbers, _ and - only. Min 3 characters.</p>
              {usernameStatus === 'taken' && <p className="text-[9px] font-mono text-red-500">Username already taken</p>}
              {usernameStatus === 'available' && <p className="text-[9px] font-mono text-emerald-500">Username available ✓</p>}
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-500 font-mono mb-2">
              Create Password
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'} required
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
                placeholder="••••••••"
                className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-cyan-700 text-zinc-100 text-sm pl-10 pr-10 py-3 rounded outline-none transition-colors font-mono placeholder:text-zinc-700"
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition-colors">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Strength Progress Bar */}
            {password.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                  <span>Password Strength</span>
                  <span className={
                    metCount <= 1 ? 'text-red-500' : metCount === 2 ? 'text-yellow-500' : metCount === 3 ? 'text-blue-400' : 'text-emerald-400'
                  }>{strengthLabel}</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${strengthColor}`}
                    style={{ width: `${strengthPct}%` }}
                  />
                </div>
                {/* Requirement pills */}
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  {[
                    { label: '8+ characters', met: checks.length },
                    { label: '1 uppercase letter', met: checks.upper },
                    { label: '1 digit (0–9)', met: checks.digit },
                    { label: '1 special symbol', met: checks.special },
                  ].map(({ label, met }) => (
                    <div key={label} className={`flex items-center gap-1.5 text-[9px] font-mono px-2 py-1 rounded border transition-colors ${
                      met ? 'border-emerald-800/50 bg-emerald-950/20 text-emerald-400' : 'border-zinc-800 bg-zinc-950/20 text-zinc-600'
                    }`}>
                      <span className="flex items-center justify-center shrink-0 w-2.5 h-2.5">
                        {met ? <Check className="w-full h-full" /> : <X className="w-full h-full" />}
                      </span>
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-500 font-mono mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showConfirm ? 'text' : 'password'} required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                disabled={loading}
                placeholder="••••••••"
                className={`w-full bg-zinc-950/60 border text-zinc-100 text-sm pl-10 pr-10 py-3 rounded outline-none transition-colors font-mono placeholder:text-zinc-700 ${
                  confirmPassword.length > 0
                    ? passwordsMatch ? 'border-emerald-700 focus:border-emerald-600' : 'border-red-800 focus:border-red-700'
                    : 'border-zinc-800 focus:border-cyan-700'
                }`}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition-colors">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && (
              <p className={`text-[9px] font-mono mt-1.5 ${passwordsMatch ? 'text-emerald-500' : 'text-red-500'}`}>
                {passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-zinc-100 hover:bg-white text-zinc-900 font-bold text-xs uppercase tracking-wider rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Creating Account...</>
            ) : (
              <><ShieldCheck className="w-4 h-4" /> Activate Operator Account</>
            )}
          </button>

          <p className="text-[10px] text-zinc-600 font-mono text-center">
            By creating an account you agree to use this platform for ethical, educational purposes only.
          </p>
        </form>
      </div>
    </div>
  );
}
