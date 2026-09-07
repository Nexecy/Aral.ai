'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Auto-hide overlay chrome after idle, the way native PDF readers do.
 * Stay visible while `pinned` (hovering controls, find, or a dialog).
 */
export function useIdleChrome(active: boolean, pinned: boolean, idleMs = 2200) {
  const [visible, setVisible] = useState(true);
  const pinnedRef = useRef(pinned);
  pinnedRef.current = pinned;
  const timerRef = useRef<number | null>(null);

  const bump = useCallback(() => {
    setVisible(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (pinnedRef.current) return;
    timerRef.current = window.setTimeout(() => {
      if (!pinnedRef.current) setVisible(false);
    }, idleMs);
  }, [idleMs]);

  useEffect(() => {
    if (!active) {
      setVisible(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      return;
    }
    bump();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [active, bump]);

  useEffect(() => {
    if (!active) return;
    if (pinned) setVisible(true);
    else bump();
  }, [pinned, active, bump]);

  return { visible, bump, setVisible };
}
