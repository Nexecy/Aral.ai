'use client';

import React from 'react';
import { Brain, Zap, Target, BookOpenCheck, ShieldAlert, Sparkles, TrendingUp } from 'lucide-react';
import { motion, Variants } from 'framer-motion';

const purposeContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.05,
    },
  },
};

const purposeItemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export function LandingPurpose() {
  const pillars = [
    {
      icon: Target,
      tag: 'COGNITIVE SCIENCE',
      title: 'Active Retrieval Over Passive Re-Reading',
      description:
        'Cognitive science proves that highlighting and re-reading gives an illusion of competence. Aral.ai transforms your syllabus into spaced flashcards and interactive self-quizzes so you retrieve knowledge under pressure.',
      badgeColor: 'text-primary bg-primary/10 border-primary/20',
    },
    {
      icon: BookOpenCheck,
      tag: 'ACADEMIC INTEGRITY',
      title: 'Zero-Hallucination Document Grounding',
      description:
        'Generic AI makes up plausible-sounding false facts. Aral.ai uses strict retrieval grounding on your uploaded lecture decks, textbooks, and papers—citing the exact chapter and page number for every claim.',
      badgeColor: 'text-sticker-teal bg-sticker-teal/10 border-sticker-teal/20',
    },
    {
      icon: Zap,
      tag: 'FLOW STATE',
      title: 'Eliminate Study Procrastination & Fatigue',
      description:
        'Staring at a 300-page slide deck is paralyzing. Aral.ai breaks overwhelming materials into bite-sized 25-minute Pomodoro sprints with automatic progress tracking and study streaks.',
      badgeColor: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
    },
  ];

  return (
    <section id="purpose" className="py-12 lg:py-16 bg-gradient-to-b from-surface-container-low/20 via-surface-container-low/40 to-surface-container-low/20 border-y border-border/50 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Our Purpose & Philosophy</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Why Aral.ai Was Built
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            Most students spend hundreds of hours highlighting textbooks and re-reading slides, yet forget 80% within 48 hours. Aral.ai was engineered to replace passive study habits with high-retention cognitive science.
          </p>
        </div>

        {/* 3 Pillars Grid */}
        <motion.div
          variants={purposeContainerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="mt-9 grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {pillars.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <motion.div
                key={idx}
                variants={purposeItemVariants}
                className="relative rounded-2xl p-6 sm:p-7 bg-card border border-border hover:border-primary/40 transition-all duration-200 shadow-notion-soft hover:shadow-md space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border ${pillar.badgeColor}`}>
                      {pillar.tag}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-foreground leading-snug">
                    {pillar.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {pillar.description}
                  </p>
                </div>

                <div className="pt-3.5 border-t border-border/60 flex items-center gap-2 text-xs font-mono text-muted-foreground">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  <span>Engineered for lifelong mastery</span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Comparison Strip */}
        <div className="mt-9 max-w-4xl mx-auto p-6 sm:p-7 rounded-2xl bg-card border border-border shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-red-500 uppercase tracking-wider">
                <ShieldAlert className="w-4 h-4" />
                <span>The Traditional Cramming Cycle</span>
              </div>
              <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">✕</span>
                  <span>Highlighting entire pages with zero active recall.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">✕</span>
                  <span>Enduring 4-hour fatigue sessions with low focus.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">✕</span>
                  <span>Wondering if generic chatbot summaries missed syllabus details.</span>
                </li>
              </ul>
            </div>

            <div className="space-y-3 md:border-l md:border-border/80 md:pl-8">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                <BookOpenCheck className="w-4 h-4" />
                <span>The Aral.ai Deep Study Method</span>
              </div>
              <ul className="space-y-2 text-xs sm:text-sm text-foreground/90">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Automated question generation testing retrieval strength.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Pomodoro-timed focus bursts maximizing mental energy.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Direct citations to exact slide numbers in your course materials.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
