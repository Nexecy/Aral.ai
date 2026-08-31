'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Loader2, Mail, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AuthScreen } from '@/components/auth/AuthScreen';

export default function ConfirmEmailPage() {
  const { user, loading, resendConfirmation } = useAuth();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verified = user?.email_verified !== false && Boolean(user);

  const handleResend = async () => {
    if (!user?.email) return;
    setSending(true);
    setError(null);
    try {
      const result = await resendConfirmation(user.email);
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the confirmation email.');
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthScreen subtitle="Confirm your email">
      <div className="p-6 sm:p-7 rounded-3xl bg-card border border-border shadow-notion-soft space-y-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : verified ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <Mail className="w-5 h-5" />
          )}
        </div>

        <p className="text-sm text-foreground leading-relaxed">
          {loading
            ? 'Checking your confirmation link…'
            : verified
              ? 'Your email is confirmed. You now have full access to AI study tools.'
              : user
                ? `We sent a confirmation email to ${user.email}. Confirm it to unlock AI study tools. You can keep studying with limited access in the meantime.`
                : 'Check your inbox for a confirmation email, then return here or sign in.'}
        </p>

        {message && (
          <p className="text-xs font-medium text-sticker-green bg-sticker-green/10 border border-sticker-green/20 rounded-lg px-3 py-2">
            {message}
          </p>
        )}
        {error && (
          <p className="text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {!loading && !verified && user?.email && (
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={sending}
            className="w-full py-2.5 rounded-xl border border-border text-sm font-bold hover:bg-muted disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {sending && <Loader2 className="w-4 h-4 animate-spin" />}
            Resend confirmation email
          </button>
        )}

        <Link
          href={user ? '/' : '/login/'}
          className="block w-full py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary-container"
        >
          {verified ? 'Continue studying' : user ? 'Continue with limited access' : 'Go to sign in'}
        </Link>
      </div>
    </AuthScreen>
  );
}
