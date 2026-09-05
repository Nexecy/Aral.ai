'use client';

import React from 'react';
import { UploadCloud, Cpu, Award, ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';

export function LandingWorkflow() {
  const steps = [
    {
      step: '01',
      icon: UploadCloud,
      title: 'Upload Course Materials',
      description:
        'Drop your lecture slides, syllabus, textbook chapters, or lecture notes. Aral.ai handles multi-format ingestion seamlessly.',
    },
    {
      step: '02',
      icon: Cpu,
      title: 'Aral AI Synthesizes & Structures',
      description:
        'Our cognitive engine extracts core concepts, creates spaced repetition flashcards, and generates realistic diagnostic quizzes with grounded citations.',
    },
    {
      step: '03',
      icon: Award,
      title: 'Active Recall & Exam Mastery',
      description:
        'Self-test under timed conditions, track your confidence intervals, and clarify tough concepts with your AI tutor until you hit full mastery.',
    },
  ];

  return (
    <section id="how-it-works" className="py-20 lg:py-28 bg-surface-container-low/50 border-y border-border/60 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Frictionless Workflow</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            How Aral.ai Works in 3 Simple Steps
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            Go from an overwhelming 100-page slide deck to an exam-ready mastery deck in under two minutes.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {steps.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="relative rounded-2xl p-8 bg-card border border-border hover:border-primary/40 transition-all shadow-notion-soft hover:shadow-md space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-3xl font-extrabold text-primary/30">
                      {item.step}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-foreground">
                    {item.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-border/60 text-[11px] font-mono font-semibold text-muted-foreground">
                  Step {idx + 1} of 3
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
