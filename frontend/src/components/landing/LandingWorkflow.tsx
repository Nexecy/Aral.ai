'use client';

import React from 'react';
import { UploadCloud, Cpu, Award, Sparkles } from 'lucide-react';
import { motion, Variants, useReducedMotion } from 'framer-motion';

const workflowContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.05,
    },
  },
};

const workflowItemVariants: Variants = {
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

function StepOneDocumentMotion() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="relative w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary overflow-hidden">
      {/* Gliding document/upload icon */}
      <motion.div
        animate={
          prefersReducedMotion
            ? {}
            : {
                y: [-2, 2, -2],
              }
        }
        transition={{
          repeat: Infinity,
          duration: 3,
          ease: 'easeInOut',
        }}
      >
        <UploadCloud className="w-5 h-5" />
      </motion.div>

      {/* Subtle scanner laser beam passing over the document */}
      {!prefersReducedMotion && (
        <motion.div
          animate={{
            y: [-16, 44],
            opacity: [0, 0.9, 0.9, 0],
          }}
          transition={{
            repeat: Infinity,
            duration: 2.4,
            ease: 'linear',
            repeatDelay: 0.8,
          }}
          className="pointer-events-none absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_8px_rgba(79,70,229,0.8)]"
        />
      )}
    </div>
  );
}

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
    <section id="how-it-works" className="py-12 lg:py-16 bg-gradient-to-b from-surface-container-low/20 via-surface-container-low/40 to-surface-container-low/20 border-y border-border/50 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center space-y-3">
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

        <motion.div
          variants={workflowContainerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="mt-9 grid grid-cols-1 md:grid-cols-3 gap-6 relative"
        >
          {steps.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={idx}
                variants={workflowItemVariants}
                className="relative rounded-2xl p-6 sm:p-7 bg-card border border-border hover:border-primary/40 transition-all shadow-notion-soft hover:shadow-md space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-3xl font-extrabold text-primary/30">
                      {item.step}
                    </span>
                    {idx === 0 ? (
                      <StepOneDocumentMotion />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                        <Icon className="w-5 h-5" />
                      </div>
                    )}
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
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
