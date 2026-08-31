'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AuthScreen } from '@/components/auth/AuthScreen';

interface AuthFormProps {
  mode: 'login' | 'signup';
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const { login, signup } = useAuth();

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
          className="w-full py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary-container disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{isSignup ? 'Create account' : 'Sign in'}</span>
        </button>
      </form>
    </AuthScreen>
  );
}
