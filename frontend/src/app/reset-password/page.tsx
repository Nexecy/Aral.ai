'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AuthScreen } from '@/components/auth/AuthScreen';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { token, loading, resetPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await resetPassword(password);
      setNotice(result.message);
      setTimeout(() => router.replace('/login/'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthScreen
      subtitle="Choose a new password"
      footer={
        <p className="text-center text-xs text-muted-foreground">
          <Link href="/login/" className="font-bold text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      }
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="p-6 sm:p-7 rounded-3xl bg-card border border-border shadow-notion-soft space-y-4"
      >
        {loading && (
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Opening your reset link…
          </p>
        )}
        {!loading && !token && (
          <p className="text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
            Open the reset link from your email. If it expired, request a new one from Forgot password.
          </p>
        )}
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-bold text-foreground">
            New password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
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
        {error && (
          <p className="text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {notice && (
          <p className="text-xs font-medium text-sticker-green bg-sticker-green/10 border border-sticker-green/20 rounded-lg px-3 py-2">
            {notice}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting || loading || !token}
          className="w-full py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary-container disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Update password
        </button>
      </form>
    </AuthScreen>
  );
}
