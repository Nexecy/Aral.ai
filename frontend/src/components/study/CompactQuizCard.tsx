'use client';

import React from 'react';
import { 
  Award, 
  ListChecks, 
  Search, 
  Grid,
  Rocket
} from 'lucide-react';
import { QuizAttempt } from '@/lib/types';

interface CompactQuizCardProps {
  quizAttempts: QuizAttempt[];
  onOpenQuiz: () => void;
}

export function CompactQuizCard({
  quizAttempts,
  onOpenQuiz
}: CompactQuizCardProps) {
  const latestAttempt = quizAttempts.length > 0 ? quizAttempts[0] : null;

  return (
    <div className="bg-surface-container-lowest rounded-3xl p-5 sm:p-6 border border-outline-variant hover:border-outline transition-colors flex flex-col justify-between shadow-notebook-subtle">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface-container text-on-surface flex items-center justify-center border border-outline-variant shrink-0">
            <Award className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-headline-sm text-sm sm:text-base text-on-surface leading-tight font-bold">
              Quiz Arena
            </h3>
            <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">
              Self-Evaluation
            </p>
          </div>
        </div>

        {latestAttempt ? (
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full font-mono border ${
            latestAttempt.score >= 80 
              ? 'bg-accent-mint/40 text-on-surface border-accent-mint' 
              : 'bg-surface-container text-on-surface border-outline-variant'
          }`}>
            Score: {latestAttempt.score}%
          </span>
        ) : (
          <span className="bg-surface-container text-on-surface px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-outline-variant font-mono">
            3 Formats
          </span>
        )}
      </div>

      {/* Evaluation Modes List */}
      <div className="flex-1 bg-surface-container-low rounded-xl p-3.5 sm:p-4 mb-4 flex flex-col gap-2 border border-outline-variant/50 justify-center">
        <h4 className="text-[9px] font-mono uppercase text-on-surface-variant tracking-wider font-bold mb-0.5">
          Evaluation Modes
        </h4>
        <div className="flex items-center gap-2.5 bg-surface-container-lowest px-3 py-1.5 rounded-lg border border-outline-variant text-xs text-on-surface font-medium">
          <ListChecks className="w-3.5 h-3.5 text-primary" />
          <span>Multiple Choice</span>
        </div>
        <div className="flex items-center gap-2.5 bg-surface-container-lowest px-3 py-1.5 rounded-lg border border-outline-variant text-xs text-on-surface font-medium">
          <Search className="w-3.5 h-3.5 text-primary" />
          <span>Identification</span>
        </div>
        <div className="flex items-center gap-2.5 bg-surface-container-lowest px-3 py-1.5 rounded-lg border border-outline-variant text-xs text-on-surface font-medium">
          <Grid className="w-3.5 h-3.5 text-primary" />
          <span>Matching</span>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={onOpenQuiz}
        className="w-full py-2.5 sm:py-3 rounded-xl bg-primary text-on-primary font-semibold text-xs sm:text-sm hover:bg-primary-container transition-colors flex items-center justify-center gap-2 shadow-sm"
      >
        <Rocket className="w-3.5 h-3.5" />
        <span>Launch Arena</span>
      </button>
    </div>
  );
}
