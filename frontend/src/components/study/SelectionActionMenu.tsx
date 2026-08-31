'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Bot, Layers, Sparkles, X } from 'lucide-react';
import { TextSelection } from '@/hooks/useTextSelection';

export interface SelectionActionMenuProps {
  selection: TextSelection | null;
  /** Append the excerpt to the tutor input as an @context tag. */
  onAskTutor: (text: string) => void;
  /** Open the flashcard composer pre-filled with the excerpt. */
  onCreateFlashcard: (text: string) => void;
  /** Fire an immediate explain-this query at the tutor. */
  onExplainConcept: (text: string) => void;
  onDismiss: () => void;
}

const MENU_WIDTH = 336;
const MENU_HEIGHT = 44;
const GAP = 10;

export function SelectionActionMenu({
  selection,
  onAskTutor,
  onCreateFlashcard,
  onExplainConcept,
  onDismiss
}: SelectionActionMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!selection) {
      setPosition(null);
      return;
    }
    const width = menuRef.current?.offsetWidth || MENU_WIDTH;
    const height = menuRef.current?.offsetHeight || MENU_HEIGHT;

    const left = Math.min(Math.max(selection.x - width / 2, GAP), window.innerWidth - width - GAP);
    // Flip below the selection when there is no headroom above it.
    const above = selection.y - height - GAP;
    const top = above > GAP ? above : selection.y + 24;

    setPosition({ top, left });
  }, [selection]);

  useEffect(() => {
    if (!selection) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onDismiss();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selection, onDismiss]);

  if (!selection || !position) return null;

  const actions = [
    { key: 'ask', label: 'Ask Tutor', icon: Bot, run: onAskTutor },
    { key: 'card', label: 'Create Flashcard', icon: Layers, run: onCreateFlashcard },
    { key: 'explain', label: 'Explain Concept', icon: Sparkles, run: onExplainConcept }
  ];

  return (
    <div
      ref={menuRef}
      role="toolbar"
      aria-label="Actions for selected text"
      // Keep the browser selection alive while the user reaches for a button.
      onMouseDown={(e) => e.preventDefault()}
      className="fixed z-[90] flex items-center gap-0.5 p-1 rounded-full bg-charcoal text-white shadow-2xl border border-white/10 animate-in fade-in zoom-in-95 duration-150"
      style={{ top: position.top, left: position.left }}
    >
      {actions.map(({ key, label, icon: Icon, run }) => (
        <button
          key={key}
          onClick={() => run(selection.text)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap text-white/90 hover:text-white hover:bg-white/15 transition-colors"
        >
          <Icon className="w-3.5 h-3.5 text-primary" />
          <span>{label}</span>
        </button>
      ))}

      <span className="w-px h-5 bg-white/15 mx-0.5" />

      <button
        onClick={onDismiss}
        title="Dismiss (Esc)"
        aria-label="Dismiss selection actions"
        className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/15 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
