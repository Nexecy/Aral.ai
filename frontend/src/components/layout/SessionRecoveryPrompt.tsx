'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { GripVertical, History, Layers, Timer, X } from 'lucide-react';
import { CachedSessionState, listUnfinishedSessions } from '@/lib/sessionCache';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';
import { resizeKeyHandler, useResizable, Size } from '@/hooks/useResizable';

const DISMISS_KEY = 'aral_recovery_dismissed';
const LAYOUT_KEY = 'aral_recovery_card_layout';
const MIN_WIDTH = 260;
const MIN_HEIGHT = 180;
const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 220;
const MARGIN = 16;
const HEADER_CLEARANCE = 96;

type CardLayout = { x: number; y: number; width: number; height: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function defaultLayout(): CardLayout {
  if (typeof window === 'undefined') {
    return { x: 400, y: HEADER_CLEARANCE, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  }
  const width = DEFAULT_WIDTH;
  const height = DEFAULT_HEIGHT;
  return {
    x: Math.max(MARGIN, window.innerWidth - width - MARGIN),
    y: HEADER_CLEARANCE,
    width,
    height
  };
}

function clampLayout(layout: CardLayout): CardLayout {
  if (typeof window === 'undefined') return layout;
  const width = clamp(layout.width, MIN_WIDTH, window.innerWidth - MARGIN * 2);
  const height = clamp(layout.height, MIN_HEIGHT, window.innerHeight - MARGIN * 2);
  const x = clamp(layout.x, MARGIN, Math.max(MARGIN, window.innerWidth - width - MARGIN));
  const y = clamp(layout.y, MARGIN, Math.max(MARGIN, window.innerHeight - height - MARGIN));
  return { x, y, width, height };
}

function formatAge(timestamp: number): string {
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'moments ago';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/**
 * Offers to restore a study session that was never cleanly exited — a reload,
 * crash, or closed tab leaves its cached state behind.
 *
 * Only sessions that belong to the signed-in user *and* still exist on the
 * server are offered. Leftover cache from another account is ignored.
 */
export function SessionRecoveryPrompt() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [candidate, setCandidate] = useState<CachedSessionState | null>(null);
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches
  );
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const [layout, setLayout, layoutReady] = useLocalStorageState<CardLayout>(
    LAYOUT_KEY,
    defaultLayout(),
    (raw) => {
      if (!raw || typeof raw !== 'object') return null;
      const value = raw as Partial<CardLayout>;
      if (
        typeof value.x !== 'number' ||
        typeof value.y !== 'number' ||
        typeof value.width !== 'number' ||
        typeof value.height !== 'number'
      ) {
        return null;
      }
      return clampLayout({
        x: value.x,
        y: value.y,
        width: value.width,
        height: value.height
      });
    }
  );

  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)');
    const apply = () => setNarrow(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!layoutReady) return;
    try {
      if (window.localStorage.getItem(LAYOUT_KEY) === null) {
        setLayout(defaultLayout());
      } else {
        setLayout((prev) => clampLayout(prev));
      }
    } catch {
      setLayout(defaultLayout());
    }
  }, [layoutReady, setLayout]);

  useEffect(() => {
    const onResize = () => setLayout((prev) => clampLayout(prev));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setLayout]);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!user?.id) {
        setCandidate(null);
        return;
      }
      if (sessionStorage.getItem(DISMISS_KEY) === 'true') return;

      try {
        const [unfinished, mine] = await Promise.all([
          listUnfinishedSessions(user.id),
          api.getSessions()
        ]);
        if (cancelled) return;

        const mineIds = new Set(mine.map((session) => session.id));
        const next = unfinished.find((cached) => {
          if (!mineIds.has(cached.sessionId)) return false;
          if (cached.userId && cached.userId !== user.id) return false;
          if (pathname?.includes(cached.sessionId)) return false;
          return true;
        });
        setCandidate(next ?? null);
      } catch {
        if (!cancelled) setCandidate(null);
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [pathname, user?.id]);

  const resizeBounds = {
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    maxWidth: typeof window === 'undefined' ? 640 : Math.max(MIN_WIDTH, window.innerWidth - layout.x - MARGIN),
    maxHeight: typeof window === 'undefined' ? 480 : Math.max(MIN_HEIGHT, window.innerHeight - layout.y - MARGIN)
  };

  const applySize = useCallback(
    (size: Size) => {
      setLayout((prev) =>
        clampLayout({
          ...prev,
          width: size.width,
          height: size.height
        })
      );
    },
    [setLayout]
  );

  const { isResizing, beginResize } = useResizable(
    { width: layout.width, height: layout.height },
    applySize,
    resizeBounds,
    'both'
  );

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      setLayout((prev) =>
        clampLayout({
          ...prev,
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y
        })
      );
    };
    const onUp = () => setDragging(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.body.style.userSelect = previousUserSelect;
    };
  }, [dragging, setLayout]);

  if (!candidate) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, 'true');
    setCandidate(null);
  };

  const resume = () => {
    setCandidate(null);
    router.push(`/session/${candidate.sessionId}/`);
  };

  const focusMinutes = Math.floor((candidate.focusSeconds || 0) / 60);

  const body = (
    <>
      <div className="flex items-center gap-3 text-[11px] font-semibold text-muted-foreground">
        <span className="flex items-center gap-1">
          <Timer className="w-3 h-3 text-primary" />
          {focusMinutes} min focused
        </span>
        <span className="flex items-center gap-1">
          <Layers className="w-3 h-3 text-primary" />
          {candidate.cardsReviewed || 0} cards
        </span>
        <span className="ml-auto">{formatAge(candidate.updatedAt)}</span>
      </div>

      <button
        onClick={resume}
        className="w-full py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary-container transition-colors"
      >
        Resume Session
      </button>
    </>
  );

  if (narrow) {
    return (
      <div className="lg:hidden fixed top-14 left-0 right-0 z-[60] px-3 pt-2">
        <div className="bg-card/95 backdrop-blur-2xl border border-border rounded-2xl shadow-xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <History className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-extrabold text-foreground">Resume previous session?</h3>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {candidate.title || 'Untitled session'}
              </p>
            </div>
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-container transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {body}
        </div>
      </div>
    );
  }

  return (
    <div
      className="hidden lg:block fixed z-[60]"
      style={{ left: layout.x, top: layout.y, width: layout.width, height: layout.height }}
    >
      <div
        className={`relative h-full bg-card/95 backdrop-blur-2xl border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col ${
          dragging || isResizing ? '' : 'animate-in fade-in'
        }`}
      >
        <div
          className={`flex items-start gap-2 px-4 py-3 border-b border-border select-none ${
            dragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            e.preventDefault();
            dragOffset.current = { x: e.clientX - layout.x, y: e.clientY - layout.y };
            setDragging(true);
          }}
        >
          <GripVertical className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0 pointer-events-none" />
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 pointer-events-none">
            <History className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0 pointer-events-none">
            <h3 className="text-sm font-extrabold text-foreground">Resume previous session?</h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {candidate.title || 'Untitled session'}
            </p>
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-container transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 p-4 space-y-3 overflow-auto">{body}</div>

        <div
          role="separator"
          aria-label="Resize recovery card"
          tabIndex={0}
          onPointerDown={beginResize}
          onKeyDown={resizeKeyHandler(
            { width: layout.width, height: layout.height },
            applySize,
            resizeBounds,
            'both'
          )}
          title="Drag to resize"
          className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-br-2xl"
        >
          <svg
            viewBox="0 0 12 12"
            className={`w-3 h-3 absolute bottom-1 right-1 transition-colors ${
              isResizing ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
            }`}
            aria-hidden
          >
            <path
              d="M11 1v10H1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
