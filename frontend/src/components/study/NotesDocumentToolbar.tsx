'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Bold, Check, Highlighter, Italic, Loader2, Type, Underline } from 'lucide-react';
import { NotesHighlightHint } from '@/components/study/NotesSelectionMenu';
import {
  NOTES_CUSTOM_PX_MAX,
  NOTES_CUSTOM_PX_MIN,
  NOTES_FONT_SIZE_ORDER,
  NOTES_FONT_SIZES,
  NotesFontSize,
  getNotesTypeScale
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
  customPx: number;
  onCustomPxChange: (px: number) => void;
  formattingEnabled: boolean;
  onFormat: (kind: 'bold' | 'italic' | 'underline') => void;
  activeFormats?: { bold?: boolean; italic?: boolean; underline?: boolean };
  autoTermCount?: number;
  autoLoading?: boolean;
  autoError?: string | null;
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
  customPx,
  onCustomPxChange,
  formattingEnabled,
  onFormat,
  activeFormats,
  autoTermCount = 0,
  autoLoading = false,
  autoError = null
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
              const busy = mode.id === 'auto' && autoLoading;
              return (
                <button
                  key={mode.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-busy={busy || undefined}
                  onClick={() => onHighlightModeChange(mode.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors inline-flex items-center gap-1',
                    active
                      ? 'bg-card text-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  )}
                >
                  {busy && <Loader2 className="w-3 h-3 animate-spin" />}
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
          <NotesFontSizeMenu
            value={fontSize}
            customPx={customPx}
            onChange={onFontSizeChange}
            onCustomPxChange={onCustomPxChange}
          />
        </div>
      </div>

      <NotesHighlightHint
        mode={highlightMode}
        autoTermCount={autoTermCount}
        autoLoading={autoLoading}
        autoError={autoError}
      />
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
  customPx,
  onChange,
  onCustomPxChange
}: {
  value: NotesFontSize;
  customPx: number;
  onChange: (size: NotesFontSize) => void;
  onCustomPxChange: (px: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scale = getNotesTypeScale(value, customPx);
  const customActive = value === 'custom';

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
        aria-label={`Document text size: ${scale.label}${customActive ? ` ${scale.body}px` : ''}`}
        title="Document text size"
        className={cn(
          'flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors',
          open
            ? 'bg-primary/10 text-primary'
            : 'text-on-surface-variant hover:text-primary hover:bg-primary/10'
        )}
      >
        <Type className="w-4 h-4" />
        <span className="text-[10px] font-bold leading-none">
          {customActive ? `${scale.body}` : NOTES_FONT_SIZES[value].shortLabel}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Document text size"
          className="absolute right-0 top-full mt-1.5 z-50 w-52 p-1.5 rounded-xl bg-popover border border-outline-variant shadow-notion-elevated animate-in fade-in zoom-in-95 duration-100"
        >
          <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            Text size
          </p>
          {NOTES_FONT_SIZE_ORDER.map((size) => {
            const preset = NOTES_FONT_SIZES[size];
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
                <span style={{ fontSize: Math.min(preset.body, 16) }}>{preset.label}</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-mono text-on-surface-variant">{preset.body}px</span>
                  {active && <Check className="w-3.5 h-3.5" />}
                </span>
              </button>
            );
          })}

          <div className="mt-1 pt-1.5 border-t border-outline-variant px-2.5 pb-1.5 space-y-1.5">
            <button
              type="button"
              role="menuitemradio"
              aria-checked={customActive}
              onClick={() => onChange('custom')}
              className={cn(
                'w-full flex items-center justify-between gap-2 py-1 rounded-lg transition-colors',
                customActive ? 'text-primary font-bold' : 'text-on-surface'
              )}
            >
              <span>Custom</span>
              {customActive && <Check className="w-3.5 h-3.5" />}
            </button>
            <label className="flex items-center gap-2">
              <span className="sr-only">Custom font size in pixels</span>
              <input
                type="range"
                min={NOTES_CUSTOM_PX_MIN}
                max={NOTES_CUSTOM_PX_MAX}
                step={1}
                value={customPx}
                aria-label="Custom font size"
                onPointerDown={(e) => e.stopPropagation()}
                onChange={(e) => {
                  onChange('custom');
                  onCustomPxChange(Number(e.target.value));
                }}
                className="flex-1 accent-primary h-1.5"
              />
              <input
                type="number"
                min={NOTES_CUSTOM_PX_MIN}
                max={NOTES_CUSTOM_PX_MAX}
                value={customPx}
                aria-label="Custom font size in pixels"
                onPointerDown={(e) => e.stopPropagation()}
                onChange={(e) => {
                  onChange('custom');
                  onCustomPxChange(Number(e.target.value));
                }}
                className="w-12 px-1.5 py-1 rounded-md border border-outline-variant bg-card text-[11px] font-mono text-on-surface text-center"
              />
            </label>
            <p className="text-[10px] text-on-surface-variant">{NOTES_CUSTOM_PX_MIN}–{NOTES_CUSTOM_PX_MAX}px</p>
          </div>
        </div>
      )}
    </div>
  );
}
