'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AuthScreen } from '@/components/auth/AuthScreen';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await forgotPassword(email.trim());
      setNotice(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a reset email.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthScreen
      subtitle="Reset your password"
      footer={
        <p className="text-center text-xs text-muted-foreground">
          Remembered it?{' '}
          <Link href="/login/" className="font-bold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="p-6 sm:p-7 rounded-3xl bg-card border border-border shadow-notion-soft space-y-4"
      >
        <p className="text-sm text-muted-foreground">
          Enter the email on your account. If it is registered, we will send a reset link.
        </p>
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
          disabled={submitting}
          className="w-full py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary-container disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Send reset link
        </button>
      </form>
    </AuthScreen>
  );
}
