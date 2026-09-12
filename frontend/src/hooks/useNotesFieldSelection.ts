'use client';

import { RefObject, useCallback, useEffect, useState } from 'react';

export interface NotesFieldSelection {
  path: string;
  start: number;
  end: number;
  text: string;
  x: number;
  y: number;
}

const MIN_SELECTION_LENGTH = 1;

/**
 * Reads a text selection inside a notes document and maps it back to the
 * `data-notes-path` field it belongs to, with offsets against that field's
 * plain text (so highlight / format marks can be stored independently of DOM).
 */
export function useNotesFieldSelection(containerRef: RefObject<HTMLElement>, enabled = true) {
  const [selection, setSelection] = useState<NotesFieldSelection | null>(null);

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
      const text = active?.toString() || '';
      const trimmed = text.trim();

      if (!active || active.rangeCount === 0 || trimmed.length < MIN_SELECTION_LENGTH) {
        setSelection(null);
        return;
      }

      const range = active.getRangeAt(0);
      const node = range.commonAncestorContainer;
      const el = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement) as HTMLElement | null;
      const field = el?.closest('[data-notes-path]') as HTMLElement | null;
      if (!field || !container.contains(field)) {
        setSelection(null);
        return;
      }

      const path = field.dataset.notesPath;
      if (!path) {
        setSelection(null);
        return;
      }

      const prefix = range.cloneRange();
      prefix.selectNodeContents(field);
      prefix.setEnd(range.startContainer, range.startOffset);
      const start = prefix.toString().length;
      const selected = range.toString();
      const end = start + selected.length;
      if (end <= start) {
        setSelection(null);
        return;
      }

      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setSelection(null);
        return;
      }

      setSelection({
        path,
        start,
        end,
        text: selected,
        x: rect.left + rect.width / 2,
        y: rect.top
      });
    };

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
