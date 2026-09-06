'use client';

import React from 'react';
import {
  FileUp,
  Layers,
  HelpCircle,
  MessageSquare,
  Timer,
  CalendarCheck,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { motion, Variants } from 'framer-motion';
import { CardTiltWrapper } from '@/components/ui/card-tilt-wrapper';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.05,
    },
  },
};

const cardItemVariants: Variants = {
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
      href: '/signup/',
    },
    {
      icon: Layers,
      title: 'Active Recall Flashcards',
      category: 'RETENTION ENGINE',
      description:
        'Never waste hours manually creating flashcard decks. Aral.ai extracts core principles into spaced repetition cards with confidence tracking.',
      badge: 'Spaced Repetition',
      accent: 'text-sticker-purple bg-sticker-purple/10 border-sticker-purple/20',
      href: '/signup/',
    },
    {
      icon: HelpCircle,
      title: 'Diagnostic Mock Exams',
      category: 'EXAM PREPARATION',
      description:
        'Generate realistic exam quizzes matching your professor’s difficulty level. Practice multiple-choice, true/false, and reasoning questions with immediate explanations.',
      badge: 'Instant Grading',
      accent: 'text-sticker-sky bg-sticker-sky/10 border-sticker-sky/20',
      href: '/signup/',
    },
    {
      icon: MessageSquare,
      title: 'Grounded AI Study Companion',
      category: 'INTERACTIVE TUTORING',
      description:
        'Ask complex conceptual questions and receive concise, grounded answers with exact slide and page citations. No generic hallucinations.',
      badge: 'Direct Page Citations',
      accent: 'text-sticker-teal bg-sticker-teal/10 border-sticker-teal/20',
      href: '/signup/',
    },
    {
      icon: Timer,
      title: 'Pomodoro Deep Focus Studio',
      category: 'PRODUCTIVITY',
      description:
        'Maintain a steady flow state with customizable 25/5 study sprints, session statistics, audio chimes, and persistent streak tracking.',
      badge: 'Streak Tracking',
      accent: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
      href: '/signup/',
    },
    {
      icon: CalendarCheck,
      title: 'Exam Readiness Tracker',
      category: 'PLANNING',
      description:
        'Set midterm and final exam deadlines. Aral.ai monitors your days remaining and color-codes urgent study priorities so you never fall behind.',
      badge: 'Deadline Urgency',
      accent: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      href: '/signup/',
    },
  ];

  return (
    <section id="features" className="py-12 lg:py-16 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="max-w-3xl mx-auto text-center space-y-3"
        >
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
        </motion.div>

        {/* Feature Cards Staggered Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="mt-9 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6"
        >
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <motion.div key={idx} variants={cardItemVariants} className="h-full">
                <CardTiltWrapper className="h-full" maxTilt={16} glareOpacity={0.38}>
                  <div
                    style={{ transformStyle: 'preserve-3d' }}
                    className="group relative rounded-2xl p-6 sm:p-7 bg-card border border-border hover:border-primary/60 transition-colors duration-200 shadow-notion-soft hover:shadow-2xl hover:shadow-primary/10 flex flex-col justify-between h-full cursor-pointer"
                  >
                    <div className="space-y-3.5">
                      {/* Icon & Status Pill with 3D depth */}
                      <div
                        className="flex items-center justify-between"
                        style={{ transform: 'translateZ(36px)', transformStyle: 'preserve-3d' }}
                      >
                        <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center text-primary group-hover:scale-110 group-hover:rotate-2 group-hover:bg-primary/10 transition-all duration-300 shadow-xs">
                          <Icon className="w-5 h-5 transition-transform duration-300 group-hover:scale-105" />
                        </div>
                        <span
                          className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border transition-colors duration-200 ${feat.accent}`}
                          style={{ transform: 'translateZ(28px)' }}
                        >
                          {feat.badge}
                        </span>
                      </div>

                      {/* Category & Title */}
                      <div
                        className="space-y-1"
                        style={{ transform: 'translateZ(24px)' }}
                      >
                        <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-muted-foreground">
                          {feat.category}
                        </span>
                        <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors duration-200">
                          {feat.title}
                        </h3>
                      </div>

                      {/* Description */}
                      <p
                        className="text-xs sm:text-sm text-muted-foreground leading-relaxed"
                        style={{ transform: 'translateZ(16px)' }}
                      >
                        {feat.description}
                      </p>
                    </div>

                    {/* Action link with hover arrow micro-interaction */}
                    <div
                      className="pt-4 mt-3 border-t border-border/60 flex items-center text-xs font-bold text-primary transition-all duration-200"
                      style={{ transform: 'translateZ(20px)' }}
                    >
                      <Link
                        href={feat.href}
                        className="inline-flex items-center group/link text-primary hover:opacity-90"
                      >
                        <span>Explore in workspace</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1.5 transition-transform duration-300 group-hover:translate-x-2" />
                      </Link>
                    </div>
                  </div>
                </CardTiltWrapper>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Bottom Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-10 rounded-2xl p-6 sm:p-8 bg-gradient-to-br from-primary/10 via-surface-container to-sticker-purple/10 border border-primary/20 text-center space-y-4"
        >
          <h3 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
            Ready to experience active recall in action?
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Create an account in 30 seconds and upload your first syllabus, textbook, or lecture deck.
          </p>
          <div className="pt-2">
            <motion.div
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="inline-block"
            >
              <Link
                href="/signup/"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all"
              >
                <span>Get started for free</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
