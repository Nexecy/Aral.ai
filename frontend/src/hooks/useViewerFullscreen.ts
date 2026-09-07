'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type DocWithWebkit = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type ElWithWebkit = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function fullscreenElement(): Element | null {
  const doc = document as DocWithWebkit;
  return document.fullscreenElement || doc.webkitFullscreenElement || null;
}

function requestNativeFullscreen(el: HTMLElement): Promise<void> {
  if (typeof el.requestFullscreen === 'function') {
    try {
      return Promise.resolve(el.requestFullscreen({ navigationUI: 'hide' }));
    } catch {
      return Promise.resolve(el.requestFullscreen());
    }
  }
  const webkit = (el as ElWithWebkit).webkitRequestFullscreen;
  if (typeof webkit === 'function') {
    return Promise.resolve(webkit.call(el));
  }
  return Promise.reject(new Error('Fullscreen API unavailable'));
}

function exitNativeFullscreen(): Promise<void> {
  const doc = document as DocWithWebkit;
  const exit = document.exitFullscreen?.bind(document) || doc.webkitExitFullscreen?.bind(document);
  if (!exit || !fullscreenElement()) return Promise.resolve();
  return Promise.resolve(exit());
}

/**
 * True fullscreen for the PDF reader.
 *
 * CSS `position: fixed` inside the workspace is trapped by `backdrop-filter`
 * and `overflow: hidden` ancestors, so it only fills the document card. We
 * therefore (1) request the browser Fullscreen API on <html> to hide browser
 * chrome, and (2) tell the caller to portal the reader onto document.body so
 * it covers the app shell.
 */
export function useViewerFullscreen() {
  const [overlay, setOverlay] = useState(false);
  const htmlFsRef = useRef(false);

  const isFullscreen = overlay;

  useEffect(() => {
    const sync = () => {
      const fsEl = fullscreenElement();
      if (htmlFsRef.current && !fsEl) {
        htmlFsRef.current = false;
        setOverlay(false);
      }
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  useEffect(() => {
    if (!overlay) return;
    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    const prevBody = document.body.style.overflow;
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [overlay]);

  const exit = useCallback(async () => {
    htmlFsRef.current = false;
    try {
      await exitNativeFullscreen();
    } catch {
      /* ignore */
    }
    setOverlay(false);
  }, []);

  const toggle = useCallback(() => {
    if (overlay) {
      void exit();
      return;
    }

    setOverlay(true);

    // Same click turn — required for the Fullscreen API to be allowed.
    try {
      void requestNativeFullscreen(document.documentElement).then(() => {
        if (fullscreenElement() === document.documentElement) {
          htmlFsRef.current = true;
        }
      }).catch(() => {
        htmlFsRef.current = false;
      });
    } catch {
      htmlFsRef.current = false;
    }
  }, [exit, overlay]);

  return { isFullscreen, isNativeFullscreen: false, toggle, exit };
}
