'use client';

import React from 'react';
import { 
  BookOpen, 
  Edit3, 
  CheckCircle2, 
  ArrowRight
} from 'lucide-react';
import { Notes } from '@/lib/types';

interface CompactNotesCardProps {
  notes: Notes | null | undefined;
  onOpenFullNotes: () => void;
}

export function CompactNotesCard({
  notes,
  onOpenFullNotes
}: CompactNotesCardProps) {
  const content = notes?.content;
  const sections = content?.sections || [];
  const totalKeyTerms = sections.reduce((acc, s) => acc + (s.key_terms?.length || 0), 0);

  const fallbackSummary = "Exploration of hippocampal memory consolidation, long-term potentiation (LTP), and the neurobiological basis for active recall and spaced retrieval.";
  
  const fallbackTerms = [
    "Memory Consolidation & Hippocampus",
    "Active Recall vs. Passive Review",
    "#Long-Term Potentiation (LTP)",
    "#Synaptic Plasticity",
    "#Testing Effect"
  ];

  return (
    <div className="bg-surface-container-lowest rounded-3xl p-6 sm:p-7 border border-outline-variant hover:border-outline transition-colors border-t-4 border-t-primary shadow-notebook-subtle flex flex-col justify-between">
      {/* Header Area */}
      <div className="flex items-start justify-between mb-5 gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-surface-container text-on-surface flex items-center justify-center border border-outline-variant shrink-0">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-headline-sm text-base sm:text-lg text-on-surface font-bold leading-tight">
              Reviewer & Notes Extractor
            </h3>
            <p className="text-xs text-on-surface-variant font-medium mt-0.5">
              {sections.length > 0 ? `${sections.length} Core Sections` : '2 Core Sections'} • {totalKeyTerms > 0 ? `${totalKeyTerms} Key Definitions` : '4 Key Definitions'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-surface-container text-on-surface px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wide border border-outline-variant shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
          <span>Verified Notes</span>
        </div>
      </div>

      {/* Synthesized Summary Block */}
      <div className="bg-surface-container-low rounded-xl p-4 sm:p-5 mb-5 border border-outline-variant/50">
        <h4 className="text-[10px] font-mono uppercase text-on-surface-variant tracking-wider mb-2 font-bold">
          Synthesized Summary
        </h4>
        <p className="text-xs sm:text-sm text-on-surface leading-relaxed font-normal">
          {content?.summary || fallbackSummary}
        </p>
      </div>

      {/* Key Topics & Terms */}
      <div className="mb-6">
        <h4 className="text-[10px] font-mono uppercase text-on-surface-variant tracking-wider mb-2.5 font-bold">
          Key Topics & Terms
        </h4>
        <div className="flex flex-wrap gap-2">
          {sections.length > 0 ? (
            <>
              {sections.slice(0, 2).map((s, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface text-xs font-medium border border-outline-variant/50 truncate max-w-[220px]"
                >
                  {s.heading.replace(/^\d+\.\s*/, '')}
                </span>
              ))}
              {sections.flatMap((s) => s.key_terms || []).slice(0, 3).map((kt, kIdx) => (
                <span
                  key={kIdx}
                  className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold"
                >
                  #{kt.term}
                </span>
              ))}
            </>
          ) : (
            fallbackTerms.map((term, tIdx) => (
              <span
                key={tIdx}
                className={`px-3 py-1.5 rounded-lg text-xs ${
                  term.startsWith('#')
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'bg-surface-container text-on-surface font-medium border border-outline-variant/50'
                }`}
              >
                {term}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Action Footer Button */}
      <button
        onClick={onOpenFullNotes}
        className="w-full py-3.5 rounded-xl border border-outline-variant text-on-surface hover:bg-surface-container transition-all flex items-center justify-between px-5 group shadow-sm bg-surface-container-lowest"
      >
        <div className="flex items-center gap-3">
          <Edit3 className="w-4 h-4 text-on-surface" />
          <span className="font-semibold text-xs sm:text-sm text-on-surface">Edit & Review Full Notes</span>
        </div>
        <ArrowRight className="w-4 h-4 text-on-surface-variant group-hover:translate-x-1 transition-transform" />
      </button>
    </div>
  );
}
