'use client';

import React from 'react';
import {
  FileUp,
  BrainCircuit,
  Layers,
  HelpCircle,
  MessageSquare,
  Timer,
  CalendarCheck,
  Search,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';

export function LandingFeatures() {
  const features = [
    {
      icon: FileUp,
      title: 'Smart Document Ingestion',
      category: 'KNOWLEDGE BASE',
      description:
        'Upload textbooks, lecture slides, research papers, and syllabi in PDF, Word, EPUB, or TXT. Aral.ai instantly indexes and structures your entire course corpus.',
      badge: 'PDF / Slides / DOCX',
      accent: 'text-primary bg-primary/10 border-primary/20',
    },
    {
      icon: Layers,
      title: 'Active Recall Flashcards',
      category: 'RETENTION ENGINE',
      description:
        'Never waste hours manually creating flashcard decks. Aral.ai extracts core principles into spaced repetition cards with confidence tracking.',
      badge: 'Spaced Repetition',
      accent: 'text-sticker-purple bg-sticker-purple/10 border-sticker-purple/20',
    },
    {
      icon: HelpCircle,
      title: 'Diagnostic Mock Exams',
      category: 'EXAM PREPARATION',
      description:
        'Generate realistic exam quizzes matching your professor’s difficulty level. Practice multiple-choice, true/false, and reasoning questions with immediate explanations.',
      badge: 'Instant Grading',
      accent: 'text-sticker-sky bg-sticker-sky/10 border-sticker-sky/20',
    },
    {
      icon: MessageSquare,
      title: 'Grounded AI Study Companion',
      category: 'INTERACTIVE TUTORING',
      description:
        'Ask complex conceptual questions and receive concise, grounded answers with exact slide and page citations. No generic hallucinations.',
      badge: 'Direct Page Citations',
      accent: 'text-sticker-teal bg-sticker-teal/10 border-sticker-teal/20',
    },
    {
      icon: Timer,
      title: 'Pomodoro Deep Focus Studio',
      category: 'PRODUCTIVITY',
      description:
        'Maintain a steady flow state with customizable 25/5 study sprints, session statistics, audio chimes, and persistent streak tracking.',
      badge: 'Streak Tracking',
      accent: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
    },
    {
      icon: CalendarCheck,
      title: 'Exam Readiness Tracker',
      category: 'PLANNING',
      description:
        'Set midterm and final exam deadlines. Aral.ai monitors your days remaining and color-codes urgent study priorities so you never fall behind.',
      badge: 'Deadline Urgency',
      accent: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
  ];

  return (
    <section id="features" className="py-12 lg:py-16 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Comprehensive Toolset</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Everything You Need for Academic Excellence
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            From initial document upload to the night before your final exam, Aral.ai provides an end-to-end cognitive study ecosystem.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-9 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                className="group relative rounded-2xl p-6 sm:p-7 bg-card border border-border hover:border-primary/50 transition-all duration-200 shadow-notion-soft hover:shadow-md flex flex-col justify-between"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border ${feat.accent}`}>
                      {feat.badge}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-muted-foreground">
                      {feat.category}
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                      {feat.title}
                    </h3>
                  </div>

                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {feat.description}
                  </p>
                </div>

                <div className="pt-4 mt-3 border-t border-border/60 flex items-center text-xs font-bold text-primary group-hover:translate-x-1 transition-transform">
                  <span>Explore in workspace</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Banner */}
        <div className="mt-10 rounded-2xl p-6 sm:p-8 bg-gradient-to-br from-primary/10 via-surface-container to-sticker-purple/10 border border-primary/20 text-center space-y-4">
          <h3 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
            Ready to experience active recall in action?
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Create an account in 30 seconds and upload your first syllabus, textbook, or lecture deck.
          </p>
          <div className="pt-2">
            <Link
              href="/signup/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all"
            >
              <span>Get started for free</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
