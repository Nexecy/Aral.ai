'use client';

import React from 'react';
import { 
  BookOpen, 
  Edit3, 
  CheckCircle2, 
  ArrowRight,
  Loader2,
  Sparkles,
  Scale
} from 'lucide-react';
import { Notes } from '@/lib/types';

interface CompactNotesCardProps {
  notes: Notes | null | undefined;
  onOpenFullNotes: () => void;
  generating?: boolean;
}

export function CompactNotesCard({
  notes,
  onOpenFullNotes,
  generating = false
}: CompactNotesCardProps) {
  const content = notes?.content;
  const sections = content?.sections || [];
  const cases = content?.cases || [];
  const doctrines = content?.doctrines || [];
  const isLaw = content?.document_type === 'law' || cases.length > 0 || doctrines.length > 0;
  const totalKeyTerms = sections.reduce((acc, s) => acc + (s.key_terms?.length || 0), 0);
  const hasNotes = sections.length > 0 || cases.length > 0 || doctrines.length > 0 || Boolean(content?.summary);

  const statusSubtitle = generating
    ? 'Gemini is synthesizing your notes…'
    : hasNotes
      ? isLaw
        ? `${cases.length} Case Briefs • ${doctrines.length} Doctrines • ${sections.length} Sections`
        : `${sections.length} Core Sections • ${totalKeyTerms} Key Definitions`
      : 'Waiting for notes';

  return (
    <div className="bg-surface-container-lowest rounded-3xl p-6 sm:p-7 border border-outline-variant hover:border-outline transition-colors border-t-4 border-t-primary shadow-notebook-subtle flex flex-col justify-between">
      <div className="flex items-start justify-between mb-5 gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-surface-container text-on-surface flex items-center justify-center border border-outline-variant shrink-0">
            {generating ? (
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            ) : isLaw ? (
              <Scale className="w-5 h-5 text-primary" />
            ) : (
              <BookOpen className="w-5 h-5 text-primary" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-headline-sm text-base sm:text-lg text-on-surface font-bold leading-tight">
                {isLaw ? 'Law School Reviewer' : 'Reviewer & Notes Extractor'}
              </h3>
              {isLaw && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary uppercase">
                  Law
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant font-medium mt-0.5">
              {statusSubtitle}
            </p>
          </div>
        </div>

        {generating ? (
          <div className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wide border border-primary/20 shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generating</span>
          </div>
        ) : hasNotes ? (
          <div className="flex items-center gap-1 bg-surface-container text-on-surface px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wide border border-outline-variant shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
            <span>Verified Notes</span>
          </div>
        ) : null}
      </div>

      <div className="bg-surface-container-low rounded-xl p-4 sm:p-5 mb-5 border border-outline-variant/50">
        <h4 className="text-[10px] font-mono uppercase text-on-surface-variant tracking-wider mb-2 font-bold">
          Synthesized Summary
        </h4>
        <p className="text-xs sm:text-sm text-on-surface leading-relaxed font-normal">
          {generating
            ? 'Hang tight — structured notes, key terms, and section headings are being extracted from your document.'
            : content?.summary || 'Notes will appear here after generation finishes. You can review and edit them before unlocking flashcards and quizzes.'}
        </p>
      </div>

      <div className="mb-6">
        <h4 className="text-[10px] font-mono uppercase text-on-surface-variant tracking-wider mb-2.5 font-bold">
          {isLaw ? 'Cases, Doctrines & Topics' : 'Key Topics & Terms'}
        </h4>
        <div className="flex flex-wrap gap-2">
          {hasNotes ? (
            <>
              {cases.slice(0, 2).map((c, idx) => (
                <span
                  key={`case-${idx}`}
                  className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold border border-primary/20 truncate max-w-[220px] flex items-center gap-1"
                >
                  <span>⚖️</span>
                  <span>{c.case_name}</span>
                </span>
              ))}
              {doctrines.slice(0, 2).map((d, idx) => (
                <span
                  key={`doc-${idx}`}
                  className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface text-xs font-semibold border border-outline-variant truncate max-w-[200px] flex items-center gap-1"
                >
                  <span>📜</span>
                  <span>{d.name}</span>
                </span>
              ))}
              {sections.slice(0, cases.length > 0 ? 1 : 2).map((s, idx) => (
                <span
                  key={`sec-${idx}`}
                  className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface text-xs font-medium border border-outline-variant/50 truncate max-w-[220px]"
                >
                  {s.heading.replace(/^\d+\.\s*/, '')}
                </span>
              ))}
              {sections.flatMap((s) => s.key_terms || []).slice(0, cases.length > 0 ? 2 : 3).map((kt, kIdx) => (
                <span
                  key={`term-${kIdx}`}
                  className="px-3 py-1.5 rounded-lg bg-primary/5 text-primary text-xs font-semibold"
                >
                  #{kt.term}
                </span>
              ))}
            </>
          ) : (
            <span className="text-xs text-on-surface-variant">
              {generating ? 'Topics will show up as soon as extraction completes.' : 'No topics yet.'}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={onOpenFullNotes}
        disabled={generating && !hasNotes}
        className="w-full py-3.5 rounded-xl border border-outline-variant text-on-surface hover:bg-surface-container transition-all flex items-center justify-between px-5 group shadow-sm bg-surface-container-lowest disabled:opacity-60 disabled:cursor-wait"
      >
        <div className="flex items-center gap-3">
          <Edit3 className="w-4 h-4 text-on-surface" />
          <span className="font-semibold text-xs sm:text-sm text-on-surface">
            {generating && !hasNotes ? 'Generating notes…' : 'Edit & Review Full Notes'}
          </span>
        </div>
        <ArrowRight className="w-4 h-4 text-on-surface-variant group-hover:translate-x-1 transition-transform" />
      </button>
    </div>
  );
}
