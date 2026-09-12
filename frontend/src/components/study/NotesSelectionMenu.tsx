'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Bold, Eraser, Highlighter, Italic, Underline } from 'lucide-react';
import { Portal } from '@/components/ui/Portal';
import { NotesFieldSelection } from '@/hooks/useNotesFieldSelection';
import { HIGHLIGHT_COLORS, rangeHasKind } from '@/lib/notesPresentation';
import { NoteMark, NotesHighlightColor, NotesHighlightMode } from '@/lib/types';
import { cn } from '@/lib/utils';

interface NotesSelectionMenuProps {
  selection: NotesFieldSelection | null;
  marks: NoteMark[];
  highlightMode: NotesHighlightMode;
  activeColor: NotesHighlightColor;
  onFormat: (kind: 'bold' | 'italic' | 'underline') => void;
  onHighlight: (color: NotesHighlightColor) => void;
  onClear: () => void;
  onDismiss: () => void;
}

const MENU_WIDTH = 320;
const MENU_HEIGHT = 44;
const GAP = 10;

export function NotesSelectionMenu({
  selection,
  marks,
  highlightMode,
  activeColor,
  onFormat,
  onHighlight,
  onClear,
  onDismiss
}: NotesSelectionMenuProps) {
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

  const isBold = rangeHasKind(marks, selection.path, selection.start, selection.end, 'bold');
  const isItalic = rangeHasKind(marks, selection.path, selection.start, selection.end, 'italic');
  const isUnderline = rangeHasKind(marks, selection.path, selection.start, selection.end, 'underline');
  const showColors = highlightMode === 'manual';

  return (
    <Portal>
      <div
        ref={menuRef}
        role="toolbar"
        aria-label="Format selected notes"
        onMouseDown={(e) => e.preventDefault()}
        className="fixed z-[90] flex items-center gap-0.5 p-1 rounded-full bg-charcoal text-white shadow-2xl border border-white/10 animate-in fade-in zoom-in-95 duration-150"
        style={{ top: position.top, left: position.left }}
      >
        <FormatButton label="Bold" pressed={isBold} onClick={() => onFormat('bold')}>
          <Bold className="w-3.5 h-3.5" />
        </FormatButton>
        <FormatButton label="Italic" pressed={isItalic} onClick={() => onFormat('italic')}>
          <Italic className="w-3.5 h-3.5" />
        </FormatButton>
        <FormatButton label="Underline" pressed={isUnderline} onClick={() => onFormat('underline')}>
          <Underline className="w-3.5 h-3.5" />
        </FormatButton>

        {showColors && (
          <>
            <span className="w-px h-5 bg-white/15 mx-0.5" />
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color.id}
                type="button"
                title={`${color.label} highlight`}
                aria-label={`${color.label} highlight`}
                onClick={() => onHighlight(color.id)}
                className={cn(
                  'w-6 h-6 rounded-full border-2 transition-transform hover:scale-110',
                  `notes-swatch-${color.id}`,
                  activeColor === color.id ? 'border-white' : 'border-white/30'
                )}
              />
            ))}
          </>
        )}

        <span className="w-px h-5 bg-white/15 mx-0.5" />

        <button
          type="button"
          onClick={onClear}
          title="Clear formatting"
          aria-label="Clear formatting on selected text"
          className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/15 transition-colors"
        >
          <Eraser className="w-3.5 h-3.5" />
        </button>
      </div>
    </Portal>
  );
}

function FormatButton({
  label,
  pressed,
  onClick,
  children
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'p-1.5 rounded-full transition-colors',
        pressed ? 'bg-white/20 text-white' : 'text-white/80 hover:text-white hover:bg-white/15'
      )}
    >
      {children}
    </button>
  );
}

export function NotesHighlightHint({
  mode,
  autoTermCount = 0,
  autoLoading = false,
  autoError = null
}: {
  mode: NotesHighlightMode;
  autoTermCount?: number;
  autoLoading?: boolean;
  autoError?: string | null;
}) {
  if (mode === 'off') return null;
  return (
    <p className="flex items-center gap-1.5 text-[11px] text-on-surface-variant">
      <Highlighter className="w-3 h-3 text-focus-gold" />
      {mode === 'auto'
        ? autoLoading
          ? 'Asking Gemini to highlight study-worthy phrases that appear in these notes…'
            : autoError
            ? 'Auto-highlight could not run. Click Auto again to retry, or use Manual.'
            : autoTermCount > 0
              ? `Gemini highlighted ${autoTermCount} phrase${autoTermCount === 1 ? '' : 's'} found in these notes.`
              : 'No grounded phrases to highlight. Use Manual to paint your own.'
        : 'Select text in the document, then pick a highlighter color.'}
    </p>
  );
}
