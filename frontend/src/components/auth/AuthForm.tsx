'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { signInWithSocialPopup } from '@/lib/socialAuth';

interface AuthFormProps {
  mode: 'login' | 'signup';
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const { login, signup, refreshUser } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSignup = mode === 'signup';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (isSignup && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (isSignup && !acceptedTerms) {
      setError('Please accept the Terms and Conditions to create an account.');
      return;
    }

    setSubmitting(true);
    try {
      if (isSignup) {
        await signup(email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthScreen
      subtitle={isSignup ? 'Create your study account' : 'Sign in to continue studying'}
      footer={
        <p className="text-center text-xs text-muted-foreground">
          {isSignup ? (
            <>
              Already have an account?{' '}
              <Link href="/login/" className="font-bold text-primary hover:underline">
                Sign in
              </Link>
            </>
          ) : (
            <>
              New to Aral.ai?{' '}
              <Link href="/signup/" className="font-bold text-primary hover:underline">
                Create an account
              </Link>
            </>
          )}
        </p>
      }
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="p-6 sm:p-7 rounded-3xl bg-card border border-border shadow-notion-soft space-y-4"
      >
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs font-bold text-foreground">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@school.edu"
            className="w-full text-sm bg-surface-container-low px-4 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-xs font-bold text-foreground">
              Password
            </label>
            {!isSignup && (
              <Link href="/forgot-password/" className="text-[11px] font-bold text-primary hover:underline">
                Forgot password?
              </Link>
            )}
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignup ? 'At least 8 characters' : 'Your password'}
              className="w-full text-sm bg-surface-container-low px-4 py-2.5 pr-11 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {isSignup && (
          <div className="space-y-1.5">
            <label htmlFor="confirm" className="text-xs font-bold text-foreground">
              Confirm password
            </label>
            <input
              id="confirm"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your password"
              className="w-full text-sm bg-surface-container-low px-4 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground"
            />
          </div>
        )}

        {isSignup && (
          <label className="flex items-start gap-2.5 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 rounded border-border text-primary focus:ring-primary"
            />
            <span>
              I agree to the{' '}
              <Link href="/terms/" className="font-bold text-primary hover:underline" target="_blank">
                Terms and Conditions
              </Link>{' '}
              and{' '}
              <Link href="/privacy/" className="font-bold text-primary hover:underline" target="_blank">
                Privacy Policy
              </Link>
            </span>
          </label>
        )}

        {error && (
          <p className="text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary-container disabled:opacity-60 transition-colors flex items-center justify-center gap-2 shadow-xs"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{isSignup ? 'Create account' : 'Sign in'}</span>
        </button>

        {/* Divider */}
        <div className="relative flex items-center justify-center my-4 pt-1">
          <div className="border-t border-border w-full"></div>
          <span className="bg-card px-3 text-[11px] text-muted-foreground font-semibold uppercase tracking-wider absolute">
            Or continue with
          </span>
        </div>

        {/* Social Auth Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          {/* Google Sign-In matching Facebook design and opening a popup */}
          <button
            type="button"
            onClick={() => {
              setError(null);
              signInWithSocialPopup(
                'google',
                async () => {
                  await refreshUser();
                  router.replace('/');
                },
                (err) => {
                  setError(err);
                }
              );
            }}
            className="relative w-full h-[40px] flex items-center justify-center rounded-[4px] border border-[#dadce0] dark:border-[#5f6368] bg-white dark:bg-[#131314] hover:bg-[#f8f9fa] dark:hover:bg-[#202124] text-[#3c4043] dark:text-[#e8eaed] transition-colors shadow-none cursor-pointer select-none"
            title="Sign in with Google"
          >
            <div className="absolute left-[12px] top-1/2 -translate-y-1/2 w-[18px] h-[18px] flex items-center justify-center">
              <GoogleIcon className="w-[18px] h-[18px]" />
            </div>
            <span className="text-[14px] font-medium tracking-[0.25px]">
              Sign in
            </span>
          </button>

          {/* Facebook Sign-In matching Google design and opening a popup */}
          <button
            type="button"
            onClick={() => {
              setError(null);
              signInWithSocialPopup(
                'facebook',
                async () => {
                  await refreshUser();
                  router.replace('/');
                },
                (err) => {
                  setError(err);
                }
              );
            }}
            className="relative w-full h-[40px] flex items-center justify-center rounded-[4px] border border-[#dadce0] dark:border-[#5f6368] bg-white dark:bg-[#131314] hover:bg-[#f8f9fa] dark:hover:bg-[#202124] text-[#3c4043] dark:text-[#e8eaed] transition-colors shadow-none cursor-pointer select-none"
            title="Sign in with Facebook"
          >
            <div className="absolute left-[12px] top-1/2 -translate-y-1/2 w-[18px] h-[18px] flex items-center justify-center">
              <FacebookIcon className="w-[18px] h-[18px]" />
            </div>
            <span className="text-[14px] font-medium tracking-[0.25px]">
              Sign in
            </span>
          </button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground pt-3">
          By continuing, you agree to our{' '}
          <Link href="/terms/" className="underline hover:text-foreground">Terms</Link>
          {' '}and{' '}
          <Link href="/privacy/" className="underline hover:text-foreground">Privacy Policy</Link>.
        </p>
      </form>
    </AuthScreen>
  );
}

function GoogleIcon({ className = 'w-[18px] h-[18px]' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function FacebookIcon({ className = 'w-[18px] h-[18px]' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#1877F2"
        d="M24 12a12 12 0 1 0-13.875 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385A12.001 12.001 0 0 0 24 12z"
      />
      <path
        fill="#FFFFFF"
        d="M16.828 14.531l.532-3.47h-3.328v-2.25c0-.949.465-1.874 1.956-1.874H17.33V3.984s-1.374-.235-2.686-.235c-2.741 0-4.533 1.662-4.533 4.669v2.569H7.078v3.47h3.047v8.385a12.09 12.09 0 0 0 3.875 0v-8.385h2.828z"
      />
    </svg>
  );
}
