'use client';

import Link from 'next/link';
import { Mail } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function VerifyEmailBanner() {
  const { user } = useAuth();
  if (!user || user.email_verified !== false) return null;

  return (
    <div className="mb-6 rounded-2xl border border-primary/25 bg-primary/8 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-start gap-3 flex-1">
        <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Mail className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Confirm your email to unlock AI tools</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            You can still upload documents, use the calendar, and run the Pomodoro timer.
            Notes, flashcards, quizzes, and the tutor stay locked until you verify{' '}
            <span className="font-semibold text-foreground">{user.email}</span>.
          </p>
        </div>
      </div>
      <Link
        href="/confirm/"
        className="shrink-0 text-xs font-bold text-primary hover:underline px-3 py-2 rounded-xl bg-card border border-border"
      >
        Open confirmation page
      </Link>
    </div>
  );
}
