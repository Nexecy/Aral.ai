'use client';

import { useCallback, useEffect, useState } from 'react';

function fullscreenElement(): Element | null {
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  return document.fullscreenElement || doc.webkitFullscreenElement || null;
}

function requestFullscreen(el: HTMLElement): Promise<void> {
  const req =
    el.requestFullscreen?.bind(el) ||
    (el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }).webkitRequestFullscreen?.bind(el);
  if (!req) return Promise.reject(new Error('Fullscreen API unavailable'));
  return Promise.resolve(req());
}

function exitFullscreen(): Promise<void> {
  const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> | void };
  const exit = document.exitFullscreen?.bind(document) || doc.webkitExitFullscreen?.bind(document);
  if (!exit || !fullscreenElement()) return Promise.resolve();
  return Promise.resolve(exit());
}

/**
 * True viewport-covering reader mode. Prefers the Fullscreen API (hides browser
 * chrome) and falls back to a fixed overlay when the API is missing or denied.
 */
export function useViewerFullscreen(ref: { current: HTMLElement | null }) {
  const [cssFallback, setCssFallback] = useState(false);
  const [nativeActive, setNativeActive] = useState(false);

  const isFullscreen = cssFallback || nativeActive;

  useEffect(() => {
    const sync = () => {
      const el = ref.current;
      setNativeActive(Boolean(el && fullscreenElement() === el));
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, [ref]);

  useEffect(() => {
    if (!cssFallback) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [cssFallback]);

  const exit = useCallback(async () => {
    try {
      await exitFullscreen();
    } catch {
      /* ignore */
    }
    setCssFallback(false);
  }, []);

  const toggle = useCallback(async () => {
    if (isFullscreen) {
      await exit();
      return;
    }
    const el = ref.current;
    if (!el) {
      setCssFallback(true);
      return;
    }

    const canNative =
      typeof el.requestFullscreen === 'function' ||
      typeof (el as HTMLElement & { webkitRequestFullscreen?: unknown }).webkitRequestFullscreen === 'function';

    if (canNative) {
      try {
        await requestFullscreen(el);
        if (fullscreenElement() === el) setNativeActive(true);
        // If the element is not promoted yet, fullscreenchange will sync it.
        // Do not also enable the CSS overlay or Esc cannot fully exit.
        return;
      } catch {
        /* permission / iOS / embedded webview */
      }
    }
    setCssFallback(true);
  }, [exit, isFullscreen, ref]);

  return { isFullscreen, toggle, exit };
}
