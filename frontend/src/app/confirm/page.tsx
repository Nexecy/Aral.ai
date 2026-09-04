'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  Mail,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { readAuthRedirect, clearAuthRedirectFromUrl } from '@/lib/authRedirect';

export default function ConfirmEmailPage() {
  const router = useRouter();
  const { user, loading, resendConfirmation } = useAuth();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check for OAuth cancellation or authorization failure
  const [oauthError, setOauthError] = useState<{
    code: string | null;
    description: string | null;
  } | null>(null);

  useEffect(() => {
    const params = readAuthRedirect();
    if (params.error || params.errorDescription) {
      setOauthError({
        code: params.error,
        description: params.errorDescription ? decodeURIComponent(params.errorDescription.replace(/\+/g, ' ')) : null
      });
      clearAuthRedirectFromUrl();
    }
  }, []);

  const verified = user?.email_verified !== false && Boolean(user);

  useEffect(() => {
    if (verified && user && !oauthError) {
      const timer = setTimeout(() => {
        router.replace('/');
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [verified, user, oauthError, router]);

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

  // Case 1: OAuth Sign-In Cancelled or Failed
  if (oauthError) {
    const isCancelled =
      oauthError.code === 'access_denied' ||
      /cancel/i.test(oauthError.description || '');

    return (
      <AuthScreen subtitle={isCancelled ? 'Sign-in cancelled' : 'Authentication failed'}>
        <div className="p-6 sm:p-8 rounded-3xl bg-card border border-border shadow-notion-soft space-y-5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive mx-auto flex items-center justify-center">
            {isCancelled ? (
              <XCircle className="w-6 h-6" />
            ) : (
              <AlertTriangle className="w-6 h-6" />
            )}
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-foreground">
              {isCancelled ? 'Sign-In Cancelled' : 'Authentication Failed'}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
              {isCancelled
                ? 'You cancelled the sign-in request. No changes were made to your account.'
                : 'We could not complete the sign-in with your provider. Please try again or use your email.'}
            </p>
          </div>

          {oauthError.description && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-snug">
              {oauthError.description}
            </div>
          )}

          <div className="space-y-2.5 pt-2">
            <Link
              href="/login/"
              className="w-full py-2.5 px-4 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary-container transition-all flex items-center justify-center gap-2 shadow-xs"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Try Signing In Again</span>
            </Link>

            <Link
              href="/signup/"
              className="w-full py-2.5 px-4 rounded-xl border border-border hover:bg-surface-container text-xs font-semibold text-foreground transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Create a new account</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </AuthScreen>
    );
  }

  // Case 2: Email Confirmation / Normal Verification
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
