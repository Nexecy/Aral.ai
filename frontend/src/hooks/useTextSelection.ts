'use client';

import { RefObject, useCallback, useEffect, useState } from 'react';

export interface TextSelection {
  text: string;
  /** Viewport coordinates of the selection's top edge, for a fixed-position menu. */
  x: number;
  y: number;
}

const MIN_SELECTION_LENGTH = 3;

/**
 * Tracks the user's text selection inside `containerRef` and exposes its viewport
 * anchor so callers can float an action menu above it.
 */
export function useTextSelection(containerRef: RefObject<HTMLElement>, enabled = true) {
  const [selection, setSelection] = useState<TextSelection | null>(null);

  const clearSelection = useCallback(() => {
    setSelection(null);
    if (typeof window !== 'undefined') {
      window.getSelection()?.removeAllRanges();
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setSelection(null);
      return;
    }

    const read = () => {
      const container = containerRef.current;
      if (!container) return;

      const active = window.getSelection();
      const text = active?.toString().trim() || '';

      if (!active || active.rangeCount === 0 || text.length < MIN_SELECTION_LENGTH) {
        setSelection(null);
        return;
      }

      const range = active.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) {
        setSelection(null);
        return;
      }

      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setSelection(null);
        return;
      }

      setSelection({ text, x: rect.left + rect.width / 2, y: rect.top });
    };

    // Read after the browser has committed the selection change.
    const onPointerUp = () => window.setTimeout(read, 0);
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.shiftKey || e.key.startsWith('Arrow')) window.setTimeout(read, 0);
    };

    document.addEventListener('mouseup', onPointerUp);
    document.addEventListener('touchend', onPointerUp);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('mouseup', onPointerUp);
      document.removeEventListener('touchend', onPointerUp);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [containerRef, enabled]);

  return { selection, clearSelection };
}
