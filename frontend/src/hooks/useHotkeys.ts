'use client';

import { useEffect, useRef } from 'react';
import { KeyCombo, comboMatchesEvent } from '@/lib/shortcuts';

export interface HotkeyBinding {
  /** `e.key` to match, case-insensitive. Use ' ' for the space bar. */
  key?: string;
  /** Requires Cmd on macOS or Ctrl elsewhere. */
  mod?: boolean;
  shift?: boolean;
  /** A user-customised binding. Takes precedence over `key`/`mod`/`shift`. */
  combo?: KeyCombo | null;
  /** Fire even while the user is typing in a field. Off by default. */
  allowInInput?: boolean;
  preventDefault?: boolean;
  handler: (e: KeyboardEvent) => void;
}

/** True when keystrokes belong to a text field rather than the app shortcuts. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return el.isContentEditable === true;
}

function matches(e: KeyboardEvent, binding: HotkeyBinding): boolean {
  if (binding.combo) return comboMatchesEvent(e, binding.combo);
  if (!binding.key) return false;

  const wantsMod = Boolean(binding.mod);
  const hasMod = e.metaKey || e.ctrlKey;
  if (wantsMod !== hasMod) return false;
  if (Boolean(binding.shift) !== e.shiftKey) return false;

  // Space reports inconsistently across browsers/layouts; use the physical code.
  if (binding.key === ' ') return e.code === 'Space';
  return e.key.toLowerCase() === binding.key.toLowerCase();
}

/**
 * Registers window-level keyboard shortcuts.
 *
 * Bindings are held in a ref so callers can pass inline handlers without
 * re-subscribing the listener on every render.
 */
export function useHotkeys(bindings: HotkeyBinding[], enabled = true): void {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const typing = isTypingTarget(e.target);

      for (const binding of bindingsRef.current) {
        if (typing && !binding.allowInInput) continue;
        if (!matches(e, binding)) continue;
        if (binding.preventDefault !== false) e.preventDefault();
        binding.handler(e);
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
