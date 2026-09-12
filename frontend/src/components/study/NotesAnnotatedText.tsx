'use client';

import React from 'react';
import { AutoTerm, AutoRange, buildSpans, collectAutoRanges, resolveMarks, shouldAutoHighlightPath } from '@/lib/notesPresentation';
import { NoteMark, NotesHighlightMode } from '@/lib/types';
import { cn } from '@/lib/utils';

interface NotesAnnotatedTextProps {
  path: string;
  text: string;
  marks: NoteMark[];
  autoTerms: AutoTerm[];
  highlightMode: NotesHighlightMode;
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'blockquote' | 'div';
  className?: string;
  emptyFallback?: string;
}

const HIGHLIGHT_CLASS: Record<string, string> = {
  yellow: 'notes-hl-yellow',
  green: 'notes-hl-green',
  pink: 'notes-hl-pink',
  sky: 'notes-hl-sky'
};

const AUTO_REASON_LABEL: Record<AutoTerm['reason'], string> = {
  key_term: 'Key term',
  doctrine: 'Legal doctrine',
  case: 'Case name'
};

export function NotesAnnotatedText({
  path,
  text,
  marks,
  autoTerms,
  highlightMode,
  as: Tag = 'span',
  className,
  emptyFallback
}: NotesAnnotatedTextProps) {
  const source = text || '';
  const pathMarks = resolveMarks(marks, path, source);
  const formatMarks = pathMarks.filter((mark) => mark.kind !== 'highlight');
  const manualHighlights = highlightMode === 'off' ? [] : pathMarks.filter((mark) => mark.kind === 'highlight');
  const autoRanges: AutoRange[] =
    highlightMode === 'auto' && shouldAutoHighlightPath(path) ? collectAutoRanges(source, autoTerms) : [];

  if (!source) {
    return <Tag className={cn(className)}>{emptyFallback || ''}</Tag>;
  }

  const spans = buildSpans(source, [...formatMarks, ...manualHighlights], autoRanges);

  return (
    <Tag data-notes-path={path} className={cn('selectable-text', className)}>
      {spans.map((span, i) => {
        const highlightClass = span.highlight ? HIGHLIGHT_CLASS[span.highlight] : undefined;
        const title =
          span.highlightSource === 'auto' && span.highlightReason
            ? `Auto-highlighted ${AUTO_REASON_LABEL[span.highlightReason].toLowerCase()}`
            : span.highlightSource === 'manual'
              ? 'Manual highlight'
              : undefined;
        return (
          <span
            key={`${path}-${i}`}
            title={title}
            className={cn(
              highlightClass,
              span.bold && 'notes-fmt-bold',
              span.italic && 'notes-fmt-italic',
              span.underline && 'notes-fmt-underline'
            )}
          >
            {span.text}
          </span>
        );
      })}
    </Tag>
  );
}
