'use client';

import React, { useMemo } from 'react';
import { renderMarkdown } from '@/lib/markdown';

interface TextReaderProps {
  content: string;
  title: string;
  filename: string;
  pageLabel?: string;
  /** Apply markdown formatting instead of plain paragraph flow. */
  markdown?: boolean;
  zoomLevel?: number;
  searchTerm?: string;
}

function highlight(text: string, term: string, keyPrefix: string): React.ReactNode {
  if (!term.trim()) return text;
  const pattern = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.split(pattern).map((part, i) =>
    pattern.test(part) ? (
      <mark key={`${keyPrefix}-${i}`} className="bg-primary/20 text-primary font-bold px-0.5 rounded">
        {part}
      </mark>
    ) : (
      <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>
    )
  );
}

/** Clean, scrollable reading surface for text, markdown, and extracted Word content. */
export function TextReader({
  content,
  title,
  filename,
  pageLabel,
  markdown = false,
  zoomLevel = 100,
  searchTerm = ''
}: TextReaderProps) {
  const body = useMemo(() => {
    if (!content.trim()) return null;

    if (markdown && !searchTerm.trim()) {
      return <div className="space-y-4">{renderMarkdown(content)}</div>;
    }

    // Plain flow: preserve the author's paragraph breaks.
    return (
      <div className="space-y-5">
        {content
          .split(/\n{2,}/)
          .map((para) => para.trim())
          .filter(Boolean)
          .map((para, i) => (
            <p key={i} className="leading-relaxed whitespace-pre-wrap text-on-surface/90">
              {highlight(para, searchTerm, `p${i}`)}
            </p>
          ))}
      </div>
    );
  }, [content, markdown, searchTerm]);

  return (
    <div className="w-full max-w-4xl mx-auto bg-surface-container-lowest border border-outline-variant rounded-2xl p-8 sm:p-14 min-h-[600px] flex flex-col shadow-notebook-subtle transition-transform duration-300"
      style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
    >
      <div className="flex justify-between items-start mb-8 text-on-surface-variant font-mono text-[11px] tracking-widest uppercase gap-4">
        <span className="truncate">{filename}</span>
        {pageLabel && <span className="font-bold text-on-surface shrink-0">{pageLabel}</span>}
      </div>

      <h3 className="text-2xl sm:text-3xl lg:text-[32px] leading-tight text-on-surface mb-8 font-extrabold tracking-tight">
        {title}
      </h3>

      <article className="text-base text-on-surface font-normal">
        {body || (
          <p className="text-sm text-on-surface-variant italic">
            No readable text was extracted from this file.
          </p>
        )}
      </article>
    </div>
  );
}
