'use client';

import { useCallback, useEffect, useState } from 'react';

type DocWithWebkit = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type ElWithWebkit = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  webkitRequestFullScreen?: () => Promise<void> | void;
};

function fullscreenElement(): Element | null {
  const doc = document as DocWithWebkit;
  return document.fullscreenElement || doc.webkitFullscreenElement || null;
}

function webkitEnter(el: HTMLElement): Promise<void> {
  const node = el as ElWithWebkit;
  const webkit = node.webkitRequestFullscreen || node.webkitRequestFullScreen;
  if (typeof webkit === 'function') {
    return Promise.resolve(webkit.call(el));
  }
  return Promise.reject(new Error('Fullscreen API unavailable'));
}

function enterNativeFullscreen(el: HTMLElement): Promise<void> {
  if (typeof el.requestFullscreen === 'function') {
    try {
      return Promise.resolve(el.requestFullscreen({ navigationUI: 'hide' })).catch(() =>
        Promise.resolve(el.requestFullscreen()).catch(() => webkitEnter(el))
      );
    } catch {
      try {
        return Promise.resolve(el.requestFullscreen()).catch(() => webkitEnter(el));
      } catch {
        return webkitEnter(el);
      }
    }
  }
  return webkitEnter(el);
}

function exitNativeFullscreen(): Promise<void> {
  const doc = document as DocWithWebkit;
  const exit = document.exitFullscreen?.bind(document) || doc.webkitExitFullscreen?.bind(document);
  if (!exit || !fullscreenElement()) return Promise.resolve();
  return Promise.resolve(exit());
}

/**
 * Device fullscreen like Chrome's built-in PDF viewer.
 *
 * `requestFullscreen` must run in the same click/key stack as the user
 * gesture. Do not setState or portal first — that drops the gesture and
 * Chrome will refuse to hide the browser chrome.
 */
export function useViewerFullscreen(ref: { current: HTMLElement | null }) {
  const [native, setNative] = useState(false);
  const [overlay, setOverlay] = useState(false);

  const isFullscreen = native || overlay;

  useEffect(() => {
    const sync = () => {
      const el = ref.current;
      const ours = Boolean(el && fullscreenElement() === el);
      setNative(ours);
      if (ours) setOverlay(false);
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, [ref]);

  useEffect(() => {
    if (!overlay) return;
    const html = document.documentElement;
    const body = document.body;
    html.classList.add('aral-pdf-fs');
    const prevOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      html.classList.remove('aral-pdf-fs');
      body.style.overflow = prevOverflow;
    };
  }, [overlay]);

  const exit = useCallback(() => {
    void exitNativeFullscreen();
    setNative(false);
    setOverlay(false);
  }, []);

  const toggle = useCallback(() => {
    if (native || overlay) {
      exit();
      return;
    }

    const el = ref.current;
    if (!el) {
      setOverlay(true);
      return;
    }

    // Same turn as the click — required by the Fullscreen API.
    try {
      void enterNativeFullscreen(el).catch(() => {
        setOverlay(true);
      });
    } catch {
      setOverlay(true);
    }
  }, [exit, native, overlay, ref]);

  return { isFullscreen, isNativeFullscreen: native, isCssOverlay: overlay, toggle, exit };
}
