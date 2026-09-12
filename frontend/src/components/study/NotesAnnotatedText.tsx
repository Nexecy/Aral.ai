'use client';

import React from 'react';
import { buildSpans, resolveMarks } from '@/lib/notesPresentation';
import { NoteMark, NotesHighlightMode } from '@/lib/types';
import { cn } from '@/lib/utils';

interface NotesAnnotatedTextProps {
  path: string;
  text: string;
  marks: NoteMark[];
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

export function NotesAnnotatedText({
  path,
  text,
  marks,
  highlightMode,
  as: Tag = 'span',
  className,
  emptyFallback
}: NotesAnnotatedTextProps) {
  const source = text || '';
  const pathMarks = resolveMarks(marks, path, source);
  const formatMarks = pathMarks.filter((mark) => mark.kind !== 'highlight');
  const highlightMarks = pathMarks.filter((mark) => {
    if (mark.kind !== 'highlight') return false;
    if (highlightMode === 'off') return false;
    if (highlightMode === 'auto') return mark.source === 'auto';
    return mark.source !== 'auto';
  });

  if (!source) {
    return <Tag className={cn(className)}>{emptyFallback || ''}</Tag>;
  }

  const spans = buildSpans(source, [...formatMarks, ...highlightMarks]);

  return (
    <Tag data-notes-path={path} className={cn('selectable-text', className)}>
      {spans.map((span, i) => {
        const highlightClass = span.highlight ? HIGHLIGHT_CLASS[span.highlight] : undefined;
        const title =
          span.highlightSource === 'auto'
            ? 'Auto-highlighted study phrase'
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
