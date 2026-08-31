'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface Size {
  width: number;
  height: number;
}

export interface ResizeBounds {
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}

type Axis = 'x' | 'y' | 'both';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Pointer-driven resizing.
 *
 * While dragging, the live size is written to a ref and flushed on an
 * animation frame, so a fast pointer produces at most one React commit per
 * frame instead of one per `pointermove`.
 */
export function useResizable(
  size: Size,
  onChange: (size: Size) => void,
  bounds: ResizeBounds = {},
  axis: Axis = 'both'
) {
  const [isResizing, setIsResizing] = useState(false);

  const start = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const latest = useRef<Size>(size);
  const frame = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  const boundsRef = useRef(bounds);
  onChangeRef.current = onChange;
  boundsRef.current = bounds;

  useEffect(() => {
    if (!isResizing) latest.current = size;
  }, [size, isResizing]);

  const beginResize = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      start.current = { x: e.clientX, y: e.clientY, width: size.width, height: size.height };
      setIsResizing(true);
    },
    [size.width, size.height]
  );

  useEffect(() => {
    if (!isResizing) return;

    const flush = () => {
      frame.current = null;
      onChangeRef.current(latest.current);
    };

    const onMove = (e: PointerEvent) => {
      const origin = start.current;
      if (!origin) return;

      const {
        minWidth = 240,
        maxWidth = Number.POSITIVE_INFINITY,
        minHeight = 200,
        maxHeight = Number.POSITIVE_INFINITY
      } = boundsRef.current;

      const width =
        axis === 'y'
          ? origin.width
          : clamp(origin.width + (e.clientX - origin.x), minWidth, maxWidth);
      const height =
        axis === 'x'
          ? origin.height
          : clamp(origin.height + (e.clientY - origin.y), minHeight, maxHeight);

      latest.current = { width, height };
      if (frame.current === null) frame.current = window.requestAnimationFrame(flush);
    };

    const onUp = () => {
      if (frame.current !== null) {
        window.cancelAnimationFrame(frame.current);
        frame.current = null;
      }
      onChangeRef.current(latest.current);
      start.current = null;
      setIsResizing(false);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    // Stops the drag from selecting page text or flickering the I-beam cursor.
    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = axis === 'y' ? 'ns-resize' : axis === 'x' ? 'ew-resize' : 'nwse-resize';

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      if (frame.current !== null) {
        window.cancelAnimationFrame(frame.current);
        frame.current = null;
      }
    };
  }, [isResizing, axis]);

  return { isResizing, beginResize };
}

/**
 * Keyboard-accessible nudging for the same handles, so resizing is not
 * pointer-only.
 */
export function resizeKeyHandler(
  size: Size,
  onChange: (size: Size) => void,
  bounds: ResizeBounds,
  axis: Axis,
  step = 24
) {
  return (e: React.KeyboardEvent) => {
    const {
      minWidth = 240,
      maxWidth = Number.POSITIVE_INFINITY,
      minHeight = 200,
      maxHeight = Number.POSITIVE_INFINITY
    } = bounds;

    let { width, height } = size;
    let handled = false;

    if (axis !== 'y') {
      if (e.key === 'ArrowLeft') { width = clamp(width - step, minWidth, maxWidth); handled = true; }
      if (e.key === 'ArrowRight') { width = clamp(width + step, minWidth, maxWidth); handled = true; }
    }
    if (axis !== 'x') {
      if (e.key === 'ArrowUp') { height = clamp(height - step, minHeight, maxHeight); handled = true; }
      if (e.key === 'ArrowDown') { height = clamp(height + step, minHeight, maxHeight); handled = true; }
    }

    if (handled) {
      e.preventDefault();
      onChange({ width, height });
    }
  };
}
