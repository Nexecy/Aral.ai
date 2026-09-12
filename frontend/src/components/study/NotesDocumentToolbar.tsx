'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Bold, Check, Highlighter, Italic, Type, Underline } from 'lucide-react';
import { NotesHighlightHint } from '@/components/study/NotesSelectionMenu';
import {
  NOTES_FONT_SIZE_ORDER,
  NOTES_FONT_SIZES,
  NotesFontSize
} from '@/lib/notesPreferences';
import { HIGHLIGHT_COLORS } from '@/lib/notesPresentation';
import { NotesHighlightColor, NotesHighlightMode } from '@/lib/types';
import { cn } from '@/lib/utils';

interface NotesDocumentToolbarProps {
  highlightMode: NotesHighlightMode;
  onHighlightModeChange: (mode: NotesHighlightMode) => void;
  activeColor: NotesHighlightColor;
  onColorChange: (color: NotesHighlightColor) => void;
  fontSize: NotesFontSize;
  onFontSizeChange: (size: NotesFontSize) => void;
  formattingEnabled: boolean;
  onFormat: (kind: 'bold' | 'italic' | 'underline') => void;
  activeFormats?: { bold?: boolean; italic?: boolean; underline?: boolean };
}

const HIGHLIGHT_MODES: { id: NotesHighlightMode; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: 'auto', label: 'Auto' },
  { id: 'manual', label: 'Manual' }
];

export function NotesDocumentToolbar({
  highlightMode,
  onHighlightModeChange,
  activeColor,
  onColorChange,
  fontSize,
  onFontSizeChange,
  formattingEnabled,
  onFormat,
  activeFormats
}: NotesDocumentToolbarProps) {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-notebook-subtle px-3 py-2.5 sm:px-4 space-y-2 sticky top-2 z-20">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div
          role="toolbar"
          aria-label="Document formatting"
          className="flex items-center gap-0.5 p-0.5 rounded-xl bg-surface-container-low border border-outline-variant"
        >
          <ToolbarIcon
            label="Bold"
            pressed={Boolean(activeFormats?.bold)}
            disabled={!formattingEnabled}
            onClick={() => onFormat('bold')}
          >
            <Bold className="w-3.5 h-3.5" />
          </ToolbarIcon>
          <ToolbarIcon
            label="Italic"
            pressed={Boolean(activeFormats?.italic)}
            disabled={!formattingEnabled}
            onClick={() => onFormat('italic')}
          >
            <Italic className="w-3.5 h-3.5" />
          </ToolbarIcon>
          <ToolbarIcon
            label="Underline"
            pressed={Boolean(activeFormats?.underline)}
            disabled={!formattingEnabled}
            onClick={() => onFormat('underline')}
          >
            <Underline className="w-3.5 h-3.5" />
          </ToolbarIcon>
        </div>

        <span className="hidden sm:block w-px h-6 bg-outline-variant" />

        <div className="flex items-center gap-2 min-w-0">
          <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono font-medium uppercase tracking-wider text-on-surface-variant shrink-0">
            <Highlighter className="w-3 h-3" />
            Highlight
          </span>
          <div
            role="radiogroup"
            aria-label="Highlight mode"
            className="flex items-center p-0.5 rounded-xl bg-surface-container-low border border-outline-variant"
          >
            {HIGHLIGHT_MODES.map((mode) => {
              const active = highlightMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onHighlightModeChange(mode.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors',
                    active
                      ? 'bg-card text-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  )}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>

        {highlightMode === 'manual' && (
          <div role="group" aria-label="Highlighter color" className="flex items-center gap-1.5">
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color.id}
                type="button"
                title={color.label}
                aria-label={`${color.label} highlighter`}
                aria-pressed={activeColor === color.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onColorChange(color.id)}
                className={cn(
                  'w-5 h-5 rounded-full border-2 transition-transform hover:scale-110',
                  `notes-swatch-${color.id}`,
                  activeColor === color.id ? 'border-on-surface scale-110' : 'border-white/80'
                )}
              />
            ))}
          </div>
        )}

        <div className="ml-auto">
          <NotesFontSizeMenu value={fontSize} onChange={onFontSizeChange} />
        </div>
      </div>

      <NotesHighlightHint mode={highlightMode} />
      {!formattingEnabled && (
        <p className="text-[11px] text-on-surface-variant">
          Exit Edit Notes to highlight and format the document like a study sheet.
        </p>
      )}
    </div>
  );
}

function ToolbarIcon({
  label,
  pressed,
  disabled,
  onClick,
  children
}: {
  label: string;
  pressed: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        pressed
          ? 'bg-primary/10 text-primary'
          : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
      )}
    >
      {children}
    </button>
  );
}

function NotesFontSizeMenu({
  value,
  onChange
}: {
  value: NotesFontSize;
  onChange: (size: NotesFontSize) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Document text size: ${NOTES_FONT_SIZES[value].label}`}
        title="Document text size"
        className={cn(
          'flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors',
          open
            ? 'bg-primary/10 text-primary'
            : 'text-on-surface-variant hover:text-primary hover:bg-primary/10'
        )}
      >
        <Type className="w-4 h-4" />
        <span className="text-[10px] font-bold leading-none">{NOTES_FONT_SIZES[value].shortLabel}</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Document text size"
          className="absolute right-0 top-full mt-1.5 z-50 w-44 p-1.5 rounded-xl bg-popover border border-outline-variant shadow-notion-elevated animate-in fade-in zoom-in-95 duration-100"
        >
          <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            Text size
          </p>
          {NOTES_FONT_SIZE_ORDER.map((size) => {
            const scale = NOTES_FONT_SIZES[size];
            const active = size === value;
            return (
              <button
                key={size}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onChange(size);
                  setOpen(false);
                }}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg transition-colors',
                  active
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-on-surface hover:bg-surface-container'
                )}
              >
                <span style={{ fontSize: Math.min(scale.body, 16) }}>{scale.label}</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-mono text-on-surface-variant">{scale.body}px</span>
                  {active && <Check className="w-3.5 h-3.5" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
