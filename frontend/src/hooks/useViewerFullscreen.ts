'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type DocWithWebkit = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type ElWithWebkit = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

const HOST_ID = 'aral-pdf-fs-host';

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

function applyHostStyles(host: HTMLElement, active: boolean) {
  if (!active) {
    host.setAttribute('hidden', '');
    host.style.cssText = 'display:none';
    return;
  }
  host.removeAttribute('hidden');
  host.style.cssText = [
    'display:flex',
    'flex-direction:column',
    'position:fixed',
    'top:0',
    'right:0',
    'bottom:0',
    'left:0',
    'width:100vw',
    'height:100vh',
    'height:100dvh',
    'margin:0',
    'padding:0',
    'border:0',
    'z-index:2147483647',
    'background:#0f172a',
    'overflow:hidden'
  ].join(';');
}

function ensureHost(): HTMLElement {
  const doc = window.document;
  let host = doc.getElementById(HOST_ID) as HTMLElement | null;
  if (!host) {
    host = doc.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('role', 'presentation');
    doc.body.appendChild(host);
  }
  return host;
}

/**
 * Fullscreen the PDF on a body-level host. The workspace card uses
 * `backdrop-filter`, which traps `position:fixed` descendants — so the reader
 * must leave that tree. Native Fullscreen API is requested on the host in the
 * same click as showing it, so the browser chrome can hide too.
 */
export function useViewerFullscreen() {
  const [active, setActive] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const nativeOnRef = useRef(false);
  const hostRef = useRef<HTMLElement | null>(null);

  const isFullscreen = active;

  useEffect(() => {
    const sync = () => {
      const fsEl = fullscreenElement();
      if (nativeOnRef.current && fsEl !== hostRef.current) {
        nativeOnRef.current = false;
        setActive(false);
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
    const node = hostRef.current;
    if (!node) return;
    applyHostStyles(node, active);
    const html = window.document.documentElement;
    const prevHtml = html.style.overflow;
    const prevBody = window.document.body.style.overflow;
    if (active) {
      html.style.overflow = 'hidden';
      window.document.body.style.overflow = 'hidden';
    }
    return () => {
      html.style.overflow = prevHtml;
      window.document.body.style.overflow = prevBody;
      if (!active) applyHostStyles(node, false);
    };
  }, [active]);

  const exit = useCallback(async () => {
    nativeOnRef.current = false;
    try {
      await exitNativeFullscreen();
    } catch {
      /* ignore */
    }
    setActive(false);
  }, []);

  const toggle = useCallback(() => {
    if (active) {
      void exit();
      return;
    }

    const node = ensureHost();
    hostRef.current = node;
    applyHostStyles(node, true);
    setHost(node);
    setActive(true);

    try {
      void requestNativeFullscreen(node).then(() => {
        window.setTimeout(() => {
          if (fullscreenElement() === hostRef.current) nativeOnRef.current = true;
        }, 400);
      }).catch(() => {
        nativeOnRef.current = false;
      });
    } catch {
      nativeOnRef.current = false;
    }
  }, [active, exit]);

  useEffect(() => {
    return () => {
      nativeOnRef.current = false;
      const node = hostRef.current;
      if (node) applyHostStyles(node, false);
      void exitNativeFullscreen();
    };
  }, []);

  return { isFullscreen, host, toggle, exit };
}
