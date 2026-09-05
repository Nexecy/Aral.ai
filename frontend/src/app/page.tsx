'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock,
  Loader2,
  Sparkles
} from 'lucide-react';
import { DocumentUploader } from '@/components/study/DocumentUploader';
import { DocumentLibrary } from '@/components/documents/DocumentLibrary';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { DashboardSummary, Document, Exam, Session } from '@/lib/types';
import { api } from '@/lib/api';
import { examColor, formatCountdown, formatExamDate } from '@/lib/examColors';
import { useAuth } from '@/context/AuthContext';
import { LandingPage } from '@/components/landing/LandingPage';

function StatColumn({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">{value}</div>
    </div>
  );
}

function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [summaryData, sessionData, examData, docData] = await Promise.all([
        api.getDashboardSummary(),
        api.getSessions(),
        api.getExams(),
        api.getDocuments()
      ]);
      setSummary(summaryData);
      setSessions(sessionData);
      setExams(examData);
      setDocuments(docData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void api.pingBackend();
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm font-semibold text-muted-foreground">Loading your dashboard…</p>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="max-w-lg mx-auto p-8 rounded-2xl bg-card border border-border text-center space-y-3">
        <h1 className="text-lg font-bold text-foreground">Couldn&apos;t load your dashboard</h1>
        <p className="text-xs text-muted-foreground">{error}</p>
        <button
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="px-5 py-2.5 rounded-full bg-primary text-on-primary text-xs font-bold"
        >
          Try again
        </button>
      </div>
    );
  }

  const upcomingExams = exams.filter((e) => e.days_remaining >= 0);
  const nearestExam = summary.nearest_exam;
  const latestSession = sessions[0] ?? null;

  // A brand-new account gets the full pitch; returning users get a slim strip.
  if (!summary.has_data) {
    return (
      <div className="space-y-10">
        <section className="relative overflow-hidden rounded-3xl bg-secondary p-8 sm:p-12 shadow-notion-elevated border border-secondary/20">
          <div className="absolute top-4 right-8 w-24 h-24 bg-sticker-purple/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-2 right-36 w-32 h-32 bg-sticker-sky/20 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-2xl space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-foreground/10 backdrop-blur-md border border-secondary-foreground/20 text-xs font-semibold text-secondary-foreground">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI-Powered Study Intelligence</span>
            </div>

            <div className="flex items-center gap-4">
              <BrandLogo href={null} showWordmark={false} size={56} variant="white" />
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-notion-display leading-tight text-secondary-foreground">
                Aral<span className="text-sticker-sky">.ai</span>
              </h1>
            </div>

            <p className="text-sm sm:text-base text-secondary-foreground/80 leading-relaxed">
              Transform dense textbook chapters, lecture slides, and notes into structured study
              sheets, active recall flashcard decks, and multi-format quizzes in seconds.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Upload your first document
            </h2>
            <p className="text-xs text-muted-foreground">
              Aral.ai extracts notes, flashcards, and quizzes automatically.
            </p>
          </div>
          <DocumentUploader />
        </section>

        <section className="p-6 rounded-2xl bg-card border border-border shadow-notion-soft flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Add your exam dates</h2>
              <p className="text-xs text-muted-foreground">
                Track a countdown to every exam and link them to your study material.
              </p>
            </div>
          </div>
          <Link
            href="/calendar/"
            className="px-4 py-2.5 rounded-full bg-primary text-on-primary text-xs font-bold hover:bg-primary-container transition-colors"
          >
            Open calendar
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Welcome strip */}
      <section className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0 space-y-1">
          {nearestExam && (
            <p className="text-xs text-muted-foreground truncate">{nearestExam.title}</p>
          )}
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            {nearestExam
              ? `${formatCountdown(nearestExam.days_remaining)} until your exam`
              : 'No exams scheduled'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {summary.study_streak_days > 0
              ? `${summary.study_streak_days}-day study streak`
              : 'Start a focus cycle to begin a streak'}
            {summary.total_cycles_completed > 0
              ? ` · ${summary.total_cycles_completed} focus ${
                  summary.total_cycles_completed === 1 ? 'cycle' : 'cycles'
                } logged`
              : ''}
          </p>
        </div>

        {latestSession && (
          <Link
            href={`/session/${latestSession.id}/`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-surface-container-low text-sm font-semibold text-foreground hover:bg-surface-container transition-colors shrink-0"
          >
            <span>Resume session</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </section>

      {/* Stats row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-8">
        <StatColumn
          label="Streak"
          value={
            summary.study_streak_days === 1
              ? '1 day'
              : `${summary.study_streak_days} days`
          }
        />
        <StatColumn
          label="Exam countdown"
          value={
            summary.days_until_nearest_exam === null
              ? 'None set'
              : summary.days_until_nearest_exam === 1
                ? '1 day'
                : `${summary.days_until_nearest_exam} days`
          }
        />
        <StatColumn label="Focus time" value={`${summary.total_focus_minutes} min`} />
        <StatColumn
          label="Sessions"
          value={String(summary.total_sessions)}
        />
      </section>

      {/* Upload + upcoming exams */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight text-foreground">Start new study pass</h2>
          <DocumentUploader />
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight text-foreground">Upcoming exams</h2>
          <div className="rounded-2xl border border-border overflow-hidden">
            {upcomingExams.length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted-foreground text-center">
                No exams scheduled. Add one to start a countdown.
              </p>
            ) : (
              upcomingExams.slice(0, 5).map((exam, index) => {
                const palette = examColor(exam.color);
                return (
                  <Link
                    key={exam.id}
                    href="/calendar/"
                    className={`flex items-start gap-3 px-4 py-3.5 hover:bg-surface-container-low transition-colors ${
                      index > 0 ? 'border-t border-border' : ''
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${palette.dot}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-foreground truncate">
                        {exam.title}
                      </span>
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        {formatExamDate(exam.exam_date)} · {formatCountdown(exam.days_remaining)}
                      </span>
                    </span>
                  </Link>
                );
              })
            )}
            <div className={`${upcomingExams.length > 0 ? 'border-t border-border' : ''} p-3`}>
              <Link
                href="/calendar/"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-full border border-border text-sm font-semibold text-foreground hover:bg-surface-container-low transition-colors"
              >
                <CalendarDays className="w-4 h-4" />
                Open calendar
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Uploaded Documents Library Section */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Your Reference Documents
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Check, preview, rename, and manage all your uploaded study materials
            </p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
            {documents.length} {documents.length === 1 ? 'file' : 'files'}
          </span>
        </div>

        <DocumentLibrary
          documents={documents}
          sessions={sessions}
          onDocumentUpdated={(updated) => {
            setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
          }}
          onDocumentDeleted={(deletedId) => {
            setDocuments((prev) => prev.filter((d) => d.id !== deletedId));
          }}
        />
      </section>

      {sessions.slice(1).length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">Recent sessions</h2>
            <Link href="/history/" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
              View all
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {sessions.slice(1, 5).map((session) => (
            <Link
              key={session.id}
              href={`/session/${session.id}/`}
              className="flex items-center gap-3 py-2 group"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                  {session.title}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(session.last_accessed_at).toLocaleDateString()}
                </span>
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}

export default function Page() {
  const { user, loading } = useAuth();

  // If visitor is definitely not logged in, render the Landing Homepage
  if (!user && !loading) {
    return <LandingPage />;
  }

  // If no auth token is stored in localStorage, render LandingPage immediately on client
  if (!user && typeof window !== 'undefined' && !localStorage.getItem('aral_auth_token')) {
    return <LandingPage />;
  }

  // If logged in, render the authenticated Study Dashboard
  if (user) {
    return <DashboardPage />;
  }

  // Otherwise during initial auth verification for existing users, show gentle loader
  return (
    <div className="py-24 flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
      <p className="text-sm font-semibold text-muted-foreground">Loading your study dashboard…</p>
    </div>
  );
}

