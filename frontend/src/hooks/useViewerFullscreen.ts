'use client';

import { useCallback, useEffect, useState } from 'react';

type DocWithWebkit = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type ElWithWebkit = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function exitNativeFullscreen() {
  const doc = document as DocWithWebkit;
  const exit = document.exitFullscreen?.bind(document) || doc.webkitExitFullscreen?.bind(document);
  if (!exit) return;
  try {
    void Promise.resolve(exit());
  } catch {
    /* ignore */
  }
}

export function requestNativeFullscreen(el: HTMLElement) {
  if (typeof el.requestFullscreen === 'function') {
    try {
      void el.requestFullscreen({ navigationUI: 'hide' });
      return;
    } catch {
      void el.requestFullscreen();
      return;
    }
  }
  const webkit = (el as ElWithWebkit).webkitRequestFullscreen;
  if (typeof webkit === 'function') webkit.call(el);
}

/**
 * App-covering PDF reader. Native Fullscreen API is optional (hides browser
 * chrome). The overlay itself is React state + a body portal with inline
 * fixed positioning — it must not depend on the Fullscreen API succeeding.
 */
export function useViewerFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const exit = useCallback(() => {
    exitNativeFullscreen();
    setIsFullscreen(false);
    window.document.documentElement.classList.remove('aral-pdf-fs');
    window.document.body.style.overflow = '';
  }, []);

  const toggle = useCallback(() => {
    setIsFullscreen((open) => {
      if (open) {
        exitNativeFullscreen();
        window.document.documentElement.classList.remove('aral-pdf-fs');
        window.document.body.style.overflow = '';
        return false;
      }
      window.document.documentElement.classList.add('aral-pdf-fs');
      window.document.body.style.overflow = 'hidden';
      return true;
    });
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    const html = window.document.documentElement;
    html.classList.add('aral-pdf-fs');
    window.document.body.style.overflow = 'hidden';
    return () => {
      html.classList.remove('aral-pdf-fs');
      window.document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  return { isFullscreen, toggle, exit };
}
