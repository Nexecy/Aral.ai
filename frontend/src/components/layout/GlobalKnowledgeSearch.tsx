'use client';

import React, { forwardRef, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, Search } from 'lucide-react';
import { KnowledgeResult } from '@/lib/types';
import { api } from '@/lib/api';
import { useShortcutMap } from '@/hooks/useShortcuts';
import { formatCombo } from '@/lib/shortcuts';

/**
 * Top-bar search across notes, key terms, flashcards, and sessions.
 * Focused globally with Ctrl/⌘ + K.
 */
export const GlobalKnowledgeSearch = forwardRef<HTMLInputElement>(function GlobalKnowledgeSearch(_props, ref) {
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<KnowledgeResult[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { shortcuts } = useShortcutMap();
  const searchCombo = formatCombo(shortcuts.focusSearch);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await api.searchKnowledge(query);
        if (!cancelled) setResults(found);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const showResults = open && query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative w-96">
      <div className="flex items-center gap-3 bg-surface-container rounded-full px-5 py-2.5 border border-border/80 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          ref={ref}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search your knowledge..."
          className="bg-transparent border-none focus:outline-none text-sm text-foreground w-full placeholder:text-muted-foreground font-normal"
        />
        {searching ? (
          <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
        ) : (
          <kbd className="hidden xl:block px-1.5 py-0.5 rounded border border-border bg-card text-[10px] font-mono font-bold text-muted-foreground shrink-0">
            {searchCombo}
          </kbd>
        )}
      </div>

      {showResults && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-card border border-border rounded-2xl shadow-notion-elevated p-2 max-h-96 overflow-y-auto custom-scrollbar z-50">
          {results.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              {searching ? 'Searching...' : 'No matching study concepts found.'}
            </p>
          ) : (
            results.map((result, i) => (
              <Link
                key={`${result.session_id}-${i}`}
                href={`/session/${result.session_id}/`}
                onClick={() => setOpen(false)}
                className="block p-3 rounded-xl hover:bg-surface-container transition-colors group"
              >
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider mb-1 gap-2">
                  <span className="text-primary bg-primary/10 px-2 py-0.5 rounded-full">{result.type}</span>
                  <span className="text-muted-foreground truncate">{result.session_title}</span>
                </div>
                <h4 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors line-clamp-1">
                  {result.title}
                </h4>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{result.snippet}</p>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
});
