'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import {
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Timer,
  Layers,
  HelpCircle,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mockup, MockupFrame } from '@/components/ui/mockup';
import { Glow } from '@/components/ui/glow';

export interface HeroSectionProps {
  badge?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  trustIndicators?: React.ReactNode;
  preview?: React.ReactNode;
  image?: {
    light: string;
    dark: string;
    alt?: string;
  };
  className?: string;
}

function TypewriterText({ text }: { text: string }) {
  const [displayedLength, setDisplayedLength] = useState(0);
  const [isTypingDone, setIsTypingDone] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    // Start animation once the hero card is visible in the viewport
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    } else {
      setIsInView(true);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isInView) return;

    // Noticeable start delay (450ms) after coming into view so typing is clearly seen
    let interval: NodeJS.Timeout;
    const startTimeout = setTimeout(() => {
      let current = 0;
      // Natural 28ms pace streams text over ~4 seconds across the lines
      interval = setInterval(() => {
        current += 1;
        setDisplayedLength(current);

        if (current >= text.length) {
          clearInterval(interval);
          setIsTypingDone(true);
          // Keep cursor blinking for 1.5s after finishing, then smoothly fade out
          const fadeTimer = setTimeout(() => {
            setCursorVisible(false);
          }, 1500);
          return () => clearTimeout(fadeTimer);
        }
      }, 28);
    }, 450);

    return () => {
      clearTimeout(startTimeout);
      if (interval) clearInterval(interval);
    };
  }, [isInView, text]);

  // Click to replay animation
  const handleReplay = () => {
    setDisplayedLength(0);
    setIsTypingDone(false);
    setCursorVisible(true);
    setIsInView(false);
    setTimeout(() => setIsInView(true), 50);
  };

  return (
    <div
      ref={containerRef}
      onClick={handleReplay}
      className="relative cursor-pointer select-text"
      title="Click to replay typing animation"
    >
      {/* Invisible clone reserves the exact container height to prevent any layout shift (CLS) */}
      <p className="invisible select-none pointer-events-none leading-relaxed" aria-hidden="true">
        {text}
      </p>
      {/* Visible streaming text with blinking vertical cursor */}
      <p className="absolute inset-0 text-foreground/90 leading-relaxed">
        {text.slice(0, displayedLength)}
        {cursorVisible && (
          <span
            className={`inline-block w-[2px] h-[1.15em] ml-0.5 bg-primary align-text-bottom transition-opacity duration-500 ${
              isTypingDone ? 'opacity-0' : 'animate-pulse'
            }`}
            aria-hidden="true"
          />
        )}
      </p>
    </div>
  );
}

export function StudyWorkspacePreview() {
  const [activeTab, setActiveTab] = useState<'notes' | 'flashcards' | 'quiz'>('flashcards');
  const [revealed, setRevealed] = useState(false);
  const [selectedRating, setSelectedRating] = useState<'hard' | 'good' | 'easy' | null>(null);
  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null);

  return (
    <Mockup className="w-full">
      {/* Top Mockup Window Chrome Frame */}
      <MockupFrame size="small">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
          </div>
          <span className="hidden sm:inline-block ml-3 font-mono text-[11px] text-muted-foreground">
            The_Science_of_Memory_&_Learning.pdf — 32 pages
          </span>
        </div>

        {/* Pomodoro Preview Badge */}
        <div className="flex items-center gap-2 bg-surface-container px-3 py-1 rounded-full font-mono text-[11px] font-bold text-foreground">
          <Timer className="w-3.5 h-3.5 text-primary animate-pulse" />
          <span>24:18 — Deep Focus</span>
        </div>
      </MockupFrame>

      {/* Interactive Tab Switcher in Mockup */}
      <div className="flex border-b border-border bg-surface-container-low/50 px-4 sm:px-6 pt-2">
        <button
          type="button"
          onClick={() => setActiveTab('flashcards')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'flashcards'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Active Recall</span>
          <span className="font-mono text-[11px] font-semibold opacity-70">(12 cards)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('quiz')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'quiz'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Mock Exam Quiz</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('notes')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'notes'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Structured Notes</span>
        </button>
      </div>

      {/* Mockup Workspace Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[380px] sm:min-h-[420px]">
        {/* Left / Main Workspace Interactive Area */}
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-border">
          {activeTab === 'flashcards' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-mono uppercase tracking-wider font-semibold">
                  Card 3 of 12 • High Retention Priority
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                  Spaced Recall
                </span>
              </div>

              {/* 3D Flipping Flashcard */}
              <div
                onClick={() => setRevealed(!revealed)}
                className="relative cursor-pointer select-none [perspective:1000px] w-full"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setRevealed(!revealed);
                  }
                }}
                aria-label="Flashcard preview, click to flip between question and answer"
              >
                <div
                  style={{
                    transform: revealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    transformStyle: 'preserve-3d',
                  }}
                  className="relative w-full transition-transform duration-500 ease-out"
                >
                  {/* Front Face: Question */}
                  <div
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                    }}
                    className="p-6 sm:p-8 rounded-2xl bg-surface-container-low border border-border hover:border-primary/40 transition-colors shadow-sm space-y-4 flex flex-col justify-between min-h-[220px]"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-mono font-bold text-primary">QUESTION</span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          Click to flip
                        </span>
                      </div>
                      <p className="text-base sm:text-lg font-bold text-foreground leading-snug">
                        Why is spaced repetition significantly more effective for long-term memory than cramming?
                      </p>
                    </div>

                    <div className="pt-3 flex items-center gap-2 text-xs text-primary font-semibold">
                      <span>Flip to check answer & citation</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Back Face: Answer & Reasoning */}
                  <div
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                    }}
                    className="absolute inset-0 p-6 sm:p-8 rounded-2xl bg-surface-container-low border border-primary/40 shadow-sm space-y-3 flex flex-col justify-between min-h-[220px]"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          ANSWER & REASONING
                        </span>
                        <span className="text-[11px] text-muted-foreground">Click to flip back</span>
                      </div>
                      <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
                        Spaced repetition takes advantage of the brain&apos;s natural forgetting curve. Actively retrieving information right before you forget it strengthens neural pathways and doubles retention duration.
                      </p>
                    </div>

                    <div className="text-[11px] font-mono text-muted-foreground pt-2 border-t border-border/70">
                      Citation: Chapter 2, Page 19 (The Science of Memory & Learning)
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted-foreground">Confidence assessment:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRating((prev) => (prev === 'hard' ? null : 'hard'));
                      setRevealed(true);
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      selectedRating === 'hard'
                        ? 'bg-red-500/15 border-red-500 text-red-600 dark:text-red-400 font-bold shadow-xs'
                        : 'border-border hover:bg-surface-container text-foreground'
                    }`}
                  >
                    Hard <span className="font-mono text-[11px] opacity-70">(1d)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRating((prev) => (prev === 'good' ? null : 'good'));
                      setRevealed(true);
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      selectedRating === 'good'
                        ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400 font-bold shadow-xs'
                        : 'border-border hover:bg-surface-container text-foreground'
                    }`}
                  >
                    Good <span className="font-mono text-[11px] opacity-70">(3d)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRating((prev) => (prev === 'easy' ? null : 'easy'));
                      setRevealed(true);
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      selectedRating === 'easy'
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                        : 'border-border hover:bg-surface-container text-foreground'
                    }`}
                  >
                    Easy <span className="font-mono text-[11px] opacity-70">(7d)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'quiz' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-mono uppercase font-semibold">Mock Exam • Question 1</span>
                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">Multiple Choice</span>
              </div>

              <p className="text-base font-bold text-foreground">
                Which activation function suffers most severely from the vanishing gradient problem in deep feedforward architectures?
              </p>

              <div className="space-y-2.5">
                {[
                  { id: 0, text: 'ReLU (Rectified Linear Unit)', correct: false },
                  { id: 1, text: 'Sigmoid function', correct: true },
                  { id: 2, text: 'Leaky ReLU', correct: false },
                  { id: 3, text: 'ELU (Exponential Linear Unit)', correct: false }
                ].map((opt) => (
                  <div
                    key={opt.id}
                    onClick={() => setSelectedQuizOption(opt.id)}
                    className={`p-3 rounded-xl border text-xs sm:text-sm font-medium cursor-pointer transition-all flex items-center justify-between ${
                      selectedQuizOption === opt.id
                        ? opt.correct
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold'
                          : 'bg-red-500/10 border-red-500 text-red-700 dark:text-red-300 font-bold'
                        : 'bg-surface-container-low border-border hover:bg-surface-container text-foreground'
                    }`}
                  >
                    <span>{opt.text}</span>
                    {selectedQuizOption === opt.id && (
                      <span className="text-xs font-bold font-mono">
                        {opt.correct ? '✓ Correct' : '✗ Incorrect'}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {selectedQuizOption !== null && (
                <p className="text-xs text-muted-foreground leading-relaxed pt-1 animate-in fade-in">
                  <strong>Explanation:</strong> Sigmoid squashes inputs into [0, 1] where its derivative approaches 0 for large absolute values, causing gradients to vanish during deep backpropagation.
                </p>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-4 font-sans text-xs sm:text-sm text-foreground/90">
              <div className="flex items-center gap-2 text-primary font-mono text-xs font-bold">
                <FileText className="w-3.5 h-3.5" />
                <span>SYNTHESIZED NOTE SUMMARY</span>
              </div>
              <h3 className="text-base font-bold text-foreground">Key Architecture Takeaways</h3>
              <ul className="space-y-2 list-disc list-inside text-muted-foreground leading-relaxed">
                <li><strong className="text-foreground">Vanishing Gradients:</strong> Resolved primarily by residual connections (ResNet) and normalized initializations (He/Xavier).</li>
                <li><strong className="text-foreground">Attention Mechanism:</strong> Replaces recurrent recurrence with dot-product query-key matching, parallelizing sequence computation.</li>
                <li><strong className="text-foreground">Exam Watchout:</strong> Professor emphasized Theorem 3.4 on convergence guarantees for final exam.</li>
              </ul>
            </div>
          )}
        </div>

        {/* Right Side Grounded AI Tutor Preview */}
        <div className="lg:col-span-5 p-6 sm:p-7 bg-surface-container-lowest/60 flex flex-col justify-between space-y-4">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-border/70">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-foreground">Aral AI Companion</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold">
                Grounded in PDF
              </span>
            </div>

            {/* Sample Chat Message */}
            <div className="p-3.5 rounded-2xl bg-surface-container-low border border-border/70 text-xs space-y-2">
              <p className="text-foreground leading-relaxed">
                &quot;Could you simplify why batch normalization stabilizes training?&quot;
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 text-xs space-y-2">
              <TypewriterText text="Batch Norm reduces internal covariate shift by ensuring activations throughout the network have consistent zero-mean and unit variance for each mini-batch." />
              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-background border border-border text-[10px] font-mono text-primary font-bold">
                <span>Source: Lecture 7, Slide 21</span>
              </div>
            </div>
          </div>

          {/* Simulated Input Bar */}
          <div className="pt-2">
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-card text-xs text-muted-foreground">
              <span>Ask anything about this document…</span>
              <div className="w-6 h-6 rounded-lg bg-primary text-on-primary flex items-center justify-center">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Mockup>
  );
}

export function HeroSection({
  badge = (
    <Badge variant="secondary" className="px-3.5 py-1.5 gap-2 backdrop-blur-md shadow-xs">
      <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
      <Sparkles className="w-3.5 h-3.5 text-primary" />
      <span>Next-Gen Active Recall & Deep Study Studio</span>
    </Badge>
  ),
  title = (
    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground tracking-tight leading-[1.12]">
      Stop passive re-reading.{' '}
      <span className="bg-gradient-to-r from-primary via-primary-container to-sticker-purple bg-clip-text text-transparent">
        Master complex topics
      </span>{' '}
      at 3x the speed.
    </h1>
  ),
  subtitle = (
    <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
      Aral.ai turns your syllabus, PDFs, slides, and textbooks into structured smart notes, automated active recall flashcards, diagnostic mock exams, and an instant grounded AI tutor.
    </p>
  ),
  actions = (
    <div className="pt-1 flex flex-col sm:flex-row items-center justify-center gap-3.5">
      <Button asChild size="lg" className="w-full sm:w-auto gap-2.5">
        <Link href="/signup/">
          <span>Start studying for free</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </Button>
      <Button asChild variant="outline" size="lg" className="w-full sm:w-auto gap-2">
        <a href="#features">
          <span>See how it works</span>
        </a>
      </Button>
    </div>
  ),
  trustIndicators = (
    <div className="pt-2 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground font-medium">
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
        <span>Zero-hallucination document citations</span>
      </div>
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
        <span>Pomodoro focus & streaks</span>
      </div>
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
        <span>No credit card required</span>
      </div>
    </div>
  ),
  preview = <StudyWorkspacePreview />,
  image,
  className,
}: HeroSectionProps) {
  const { resolvedTheme } = useTheme();

  return (
    <section className={cn("relative pt-28 pb-12 lg:pt-32 lg:pb-16 overflow-hidden", className)}>
      {/* Ambient background glows */}
      <Glow variant="above" />
      <div className="absolute top-40 right-10 w-72 h-72 bg-sticker-sky/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-60 left-10 w-80 h-80 bg-sticker-purple/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Header */}
        <div className="max-w-3xl mx-auto text-center space-y-5">
          {/* Eyebrow Badge */}
          {badge && (
            <div className="animate-appear delay-100 flex justify-center">
              {badge}
            </div>
          )}

          {/* Main Headline */}
          {title && (
            <div className="animate-appear delay-300">
              {title}
            </div>
          )}

          {/* Subtitle */}
          {subtitle && (
            <div className="animate-appear delay-300">
              {subtitle}
            </div>
          )}

          {/* CTA Actions */}
          {actions && (
            <div className="animate-appear delay-700">
              {actions}
            </div>
          )}

          {/* Trust Indicators */}
          {trustIndicators && (
            <div className="animate-appear delay-700">
              {trustIndicators}
            </div>
          )}
        </div>

        {/* Hero Preview Area (Interactive Mockup or Image) */}
        <div className="mt-10 sm:mt-12 max-w-5xl mx-auto animate-appear-zoom delay-1000">
          {preview ? (
            preview
          ) : image ? (
            <Mockup className="w-full">
              <MockupFrame size="small">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                </div>
              </MockupFrame>
              <Image
                src={resolvedTheme === 'dark' ? image.dark : image.light}
                alt={image.alt || 'Aral.ai Study Preview'}
                width={1200}
                height={675}
                className="w-full h-auto object-cover"
                priority
              />
            </Mockup>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
