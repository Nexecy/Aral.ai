'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Type } from 'lucide-react';
import {
  CHAT_FONT_SIZES,
  CHAT_FONT_SIZE_ORDER,
  ChatFontSize
} from '@/lib/chatPreferences';

interface ChatFontSizeMenuProps {
  value: ChatFontSize;
  onChange: (size: ChatFontSize) => void;
}

/** `Aa` control in the chat header for adjusting transcript reading size. */
export function ChatFontSizeMenu({ value, onChange }: ChatFontSizeMenuProps) {
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
        aria-label={`Text size: ${CHAT_FONT_SIZES[value].label}`}
        title="Text size"
        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors ${
          open
            ? 'bg-primary/10 text-primary'
            : 'text-on-surface-variant hover:text-primary hover:bg-primary/10'
        }`}
      >
        <Type className="w-4 h-4" />
        <span className="text-[10px] font-bold leading-none">
          {CHAT_FONT_SIZES[value].shortLabel}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Chat text size"
          className="absolute right-0 top-full mt-1.5 z-50 w-44 p-1.5 rounded-xl bg-popover border border-outline-variant shadow-notion-elevated animate-in fade-in zoom-in-95 duration-100"
        >
          <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            Text size
          </p>
          {CHAT_FONT_SIZE_ORDER.map((size) => {
            const scale = CHAT_FONT_SIZES[size];
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
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-on-surface hover:bg-surface-container'
                }`}
              >
                <span style={{ fontSize: Math.min(scale.body, 16) }}>{scale.label}</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-mono text-on-surface-variant">
                    {scale.body}px
                  </span>
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
