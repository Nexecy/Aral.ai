'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  BookOpen,
  Layers,
  Bot,
  Timer,
  ArrowLeft,
  ChevronRight,
  Award,
  Loader2,
  Columns,
  GripVertical,
  GripHorizontal,
  Play,
  Pause,
  LogOut,
  Pin,
  PinOff,
  Minimize2,
  Maximize2,
  Dock,
  ExternalLink,
  CloudOff,
  Keyboard
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DocumentViewer } from '@/components/study/DocumentViewer';
import { CompactNotesCard } from '@/components/study/CompactNotesCard';
import { CompactFlashcardCard } from '@/components/study/CompactFlashcardCard';
import { CompactQuizCard } from '@/components/study/CompactQuizCard';
import { WorkspaceChatPanel, TutorContextRequest } from '@/components/study/WorkspaceChatPanel';
import { NotesReviewEditor } from '@/components/study/NotesReviewEditor';
import { FlashcardDeck, FlashcardPrefill } from '@/components/study/FlashcardDeck';
import { QuizArena } from '@/components/study/QuizArena';
import { RealtimeChatPanel } from '@/components/study/RealtimeChatPanel';
import { SessionSnapshot, Notes, Flashcard, QuizAttempt, ChatMessage } from '@/lib/types';
import { api } from '@/lib/api';
import { usePomodoro } from '@/context/PomodoroContext';
import { useAuth } from '@/context/AuthContext';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';
import { useShortcutMap } from '@/hooks/useShortcuts';
import { SHORTCUT_DEFINITIONS, formatCombo } from '@/lib/shortcuts';
import {
  ResizeBounds,
  Size,
  resizeKeyHandler,
  useResizable
} from '@/hooks/useResizable';
import {
  cacheDocumentBlob,
  clearSessionState,
  createDebouncedSaver,
  loadSessionState,
  saveSessionState,
  CachedSessionState
} from '@/lib/sessionCache';

type ViewMode = 'split' | 'notes' | 'flashcards' | 'quiz' | 'chat';

interface FloatPos { x: number; y: number; }

// Chat sizing bounds. The floating minimums are fixed by the spec.
const MIN_FLOAT_CHAT_WIDTH = 320;
const MIN_FLOAT_CHAT_HEIGHT = 400;
const DEFAULT_FLOAT_CHAT_SIZE: Size = { width: 384, height: 480 };
const FLOAT_CHAT_SIZE_KEY = 'aral_chat_float_size';

const MIN_DOCKED_CHAT_HEIGHT = 260;
const MAX_DOCKED_CHAT_HEIGHT = 900;
const DEFAULT_DOCKED_CHAT_HEIGHT = 400;
const DOCKED_CHAT_HEIGHT_KEY = 'aral_chat_docked_height';

interface SessionWorkspaceClientProps {
  sessionId: string;
}

/** Rebuild a snapshot from cache so an offline reload still has a usable workspace. */
function snapshotFromCache(cached: CachedSessionState): SessionSnapshot {
  const now = new Date().toISOString();
  return {
    session: {
      id: cached.sessionId,
      user_id: '',
      document_id: cached.documentId,
      title: cached.title || 'Recovered Session',
      status: 'active',
      created_at: now,
      last_accessed_at: now,
      total_focus_seconds: cached.focusSeconds,
      cards_reviewed: cached.cardsReviewed
    },
    document: cached.documentId
      ? {
          id: cached.documentId,
          user_id: '',
          filename: cached.documentName || 'document.pdf',
          storage_path: '',
          uploaded_at: now,
          page_count: 1,
          extracted_text: ''
        }
      : null,
    notes: cached.notes,
    flashcards: cached.flashcards,
    quiz_attempts: [],
    chat_history: cached.chatMessages
  };
}

export function SessionWorkspaceClient({ sessionId }: SessionWorkspaceClientProps) {
  const router = useRouter();
  const { user } = useAuth();
  const {
    linkSession,
    formattedTime,
    isRunning,
    isWidgetOpen,
    mode: timerMode,
    timeLeft,
    startTimer,
    pauseTimer,
    toggleTimer,
    toggleWidget,
    sessionFocusSeconds,
    resetSessionFocus
  } = usePomodoro();

  // ── View & Data ──────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [restoredOffline, setRestoredOffline] = useState<boolean>(false);

  // ── Selection → AI / Flashcard bridge ────────────────────────────────────────
  const [contextRequest, setContextRequest] = useState<TutorContextRequest | null>(null);
  const [flashcardPrefill, setFlashcardPrefill] = useState<FlashcardPrefill | null>(null);
  const [chatFocusToken, setChatFocusToken] = useState<number>(0);

  // ── Session metrics synced on exit ───────────────────────────────────────────
  const [cardsReviewed, setCardsReviewed] = useState<number>(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // ── Horizontal Split Resize ──────────────────────────────────────────────────
  const [splitRatio, setSplitRatio] = useState<number>(62);
  const [isHDragging, setIsHDragging] = useState<boolean>(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // ── Vertical Viewer Height Resize ────────────────────────────────────────────
  const [pdfHeight, setPdfHeight] = useState<number>(760);
  const [isVDragging, setIsVDragging] = useState<boolean>(false);
  const vDragStartY = useRef<number>(0);
  const vDragStartH = useRef<number>(760);

  // ── Exit ─────────────────────────────────────────────────────────────────────
  const [showExitDialog, setShowExitDialog] = useState<boolean>(false);
  const [exiting, setExiting] = useState<boolean>(false);
  const [exitError, setExitError] = useState<string | null>(null);

  // ── Detachable Chat ──────────────────────────────────────────────────────────
  const [chatDetached, setChatDetached] = useState<boolean>(false);
  const [chatMinimized, setChatMinimized] = useState<boolean>(false);
  const [chatPinned, setChatPinned] = useState<boolean>(false);
  const [chatPos, setChatPos] = useState<FloatPos>({ x: 60, y: 60 });
  const chatDragOffset = useRef<FloatPos>({ x: 0, y: 0 });
  const [isChatDragging, setIsChatDragging] = useState<boolean>(false);

  // ── Chat sizing (persisted) ──────────────────────────────────────────────────
  const [dockedChatHeight, setDockedChatHeight] = useLocalStorageState<number>(
    DOCKED_CHAT_HEIGHT_KEY,
    DEFAULT_DOCKED_CHAT_HEIGHT,
    (raw) => (typeof raw === 'number' && raw >= MIN_DOCKED_CHAT_HEIGHT ? raw : null)
  );
  const [floatChatSize, setFloatChatSize] = useLocalStorageState<Size>(
    FLOAT_CHAT_SIZE_KEY,
    DEFAULT_FLOAT_CHAT_SIZE,
    (raw) => {
      if (!raw || typeof raw !== 'object') return null;
      const { width, height } = raw as Partial<Size>;
      if (typeof width !== 'number' || typeof height !== 'number') return null;
      return {
        width: Math.max(width, MIN_FLOAT_CHAT_WIDTH),
        height: Math.max(height, MIN_FLOAT_CHAT_HEIGHT)
      };
    }
  );

  const dockedChatSize = useMemo<Size>(
    () => ({ width: 0, height: dockedChatHeight }),
    [dockedChatHeight]
  );

  const handleDockedResize = useCallback(
    (next: Size) => setDockedChatHeight(next.height),
    [setDockedChatHeight]
  );

  const dockedResize = useResizable(
    dockedChatSize,
    handleDockedResize,
    { minHeight: MIN_DOCKED_CHAT_HEIGHT, maxHeight: MAX_DOCKED_CHAT_HEIGHT },
    'y'
  );

  const floatResizeBounds = useMemo<ResizeBounds>(
    () => ({
      minWidth: MIN_FLOAT_CHAT_WIDTH,
      minHeight: MIN_FLOAT_CHAT_HEIGHT,
      maxWidth: typeof window === 'undefined' ? 900 : Math.max(MIN_FLOAT_CHAT_WIDTH, window.innerWidth - chatPos.x - 16),
      maxHeight: typeof window === 'undefined' ? 900 : Math.max(MIN_FLOAT_CHAT_HEIGHT, window.innerHeight - chatPos.y - 16)
    }),
    [chatPos.x, chatPos.y]
  );

  const floatResize = useResizable(floatChatSize, setFloatChatSize, floatResizeBounds, 'both');

  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);
  const { shortcuts } = useShortcutMap();

  const saver = useMemo(() => createDebouncedSaver(700), []);

  // ── Restore persisted layout preferences ─────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedSplit = localStorage.getItem('aral_split_ratio');
    if (savedSplit) {
      const n = parseFloat(savedSplit);
      if (!isNaN(n) && n >= 25 && n <= 75) setSplitRatio(n);
    }
    const savedH = localStorage.getItem('aral_pdf_height');
    if (savedH) {
      const n = parseInt(savedH, 10);
      if (!isNaN(n) && n >= 400 && n <= 1100) setPdfHeight(n);
    }
    const savedDetach = sessionStorage.getItem(`aral_chat_detached_${sessionId}`);
    if (savedDetach === 'true') setChatDetached(true);
    const savedPos = sessionStorage.getItem(`aral_chat_pos_${sessionId}`);
    if (savedPos) { try { setChatPos(JSON.parse(savedPos)); } catch (_) {} }
  }, [sessionId]);

  // ── Drag handling ────────────────────────────────────────────────────────────
  // Pointer events fire far faster than the display refreshes, so each drag
  // coalesces its updates into one state commit per animation frame.
  const dragFrame = useRef<number | null>(null);
  const latestSplitRatio = useRef(splitRatio);
  const latestPdfHeight = useRef(pdfHeight);
  const latestChatPos = useRef(chatPos);

  useEffect(() => { if (!isHDragging) latestSplitRatio.current = splitRatio; }, [splitRatio, isHDragging]);
  useEffect(() => { if (!isVDragging) latestPdfHeight.current = pdfHeight; }, [pdfHeight, isVDragging]);
  useEffect(() => { if (!isChatDragging) latestChatPos.current = chatPos; }, [chatPos, isChatDragging]);

  const scheduleDragCommit = useCallback((commit: () => void) => {
    if (dragFrame.current !== null) return;
    dragFrame.current = window.requestAnimationFrame(() => {
      dragFrame.current = null;
      commit();
    });
  }, []);

  useEffect(() => () => {
    if (dragFrame.current !== null) window.cancelAnimationFrame(dragFrame.current);
  }, []);

  // Horizontal split drag
  useEffect(() => {
    if (!isHDragging) return;

    const onMove = (e: PointerEvent) => {
      const container = splitContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const ratio = ((e.clientX - rect.left) / rect.width) * 100;
      latestSplitRatio.current = Math.min(Math.max(ratio, 25), 75);
      scheduleDragCommit(() => setSplitRatio(latestSplitRatio.current));
    };
    const onUp = () => {
      setIsHDragging(false);
      setSplitRatio(latestSplitRatio.current);
      localStorage.setItem('aral_split_ratio', latestSplitRatio.current.toString());
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [isHDragging, scheduleDragCommit]);

  // Vertical viewer height drag
  useEffect(() => {
    if (!isVDragging) return;

    const onMove = (e: PointerEvent) => {
      const delta = e.clientY - vDragStartY.current;
      latestPdfHeight.current = Math.min(Math.max(vDragStartH.current + delta, 400), 1100);
      scheduleDragCommit(() => setPdfHeight(latestPdfHeight.current));
    };
    const onUp = () => {
      setIsVDragging(false);
      setPdfHeight(latestPdfHeight.current);
      localStorage.setItem('aral_pdf_height', latestPdfHeight.current.toString());
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [isVDragging, scheduleDragCommit]);

  // Floating chat drag
  useEffect(() => {
    if (!isChatDragging || chatPinned) return;

    const onMove = (e: PointerEvent) => {
      const floatH = chatMinimized ? 56 : floatChatSize.height;
      latestChatPos.current = {
        x: Math.min(Math.max(e.clientX - chatDragOffset.current.x, 0), window.innerWidth - floatChatSize.width),
        y: Math.min(Math.max(e.clientY - chatDragOffset.current.y, 0), window.innerHeight - floatH)
      };
      scheduleDragCommit(() => setChatPos(latestChatPos.current));
    };
    const onUp = () => {
      setIsChatDragging(false);
      setChatPos(latestChatPos.current);
      sessionStorage.setItem(`aral_chat_pos_${sessionId}`, JSON.stringify(latestChatPos.current));
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [isChatDragging, chatPinned, chatMinimized, floatChatSize.width, floatChatSize.height, sessionId, scheduleDragCommit]);

  // ── Link the focus timer to this session ─────────────────────────────────────
  useEffect(() => {
    linkSession(sessionId);
    return () => linkSession(null);
  }, [sessionId]);

  // ── Fetch snapshot, falling back to the offline cache ────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function fetchSnapshot() {
      setLoading(true);
      try {
        const data = await api.getSessionSnapshot(sessionId);
        if (cancelled) return;
        setSnapshot(data);
        setChatMessages(data.chat_history || []);
        setError(null);

        // Carry over unsynced review progress from a previous crashed run.
        const cached = await loadSessionState(sessionId);
        if (cached && !cancelled) {
          if (cached.cardsReviewed > 0) setCardsReviewed(cached.cardsReviewed);
          if (cached.viewMode) setViewMode(cached.viewMode as ViewMode);
        }
      } catch (err: any) {
        if (cancelled) return;
        const cached = await loadSessionState(sessionId);
        if (cached && !cancelled) {
          setSnapshot(snapshotFromCache(cached));
          setChatMessages(cached.chatMessages || []);
          setCardsReviewed(cached.cardsReviewed || 0);
          setViewMode((cached.viewMode as ViewMode) || 'split');
          setRestoredOffline(true);
          setError(null);
        } else {
          setError(err.message || 'Failed to load study session.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSnapshot();
    return () => { cancelled = true; };
  }, [sessionId]);

  // ── Auto-save the live workspace state ───────────────────────────────────────
  // The countdown ticks every second; checkpointing every 5s keeps the cache
  // current without hammering IndexedDB.
  const timerCheckpoint = Math.floor(timeLeft / 5);

  useEffect(() => {
    if (!snapshot || exiting) return;
    saver.queue(sessionId, {
      title: snapshot.session.title,
      documentId: snapshot.document?.id || null,
      documentName: snapshot.document?.filename || null,
      // Object URLs are per-page-load; the cached blob is the durable copy.
      fileUrl: null,
      viewMode,
      timerMode,
      timerSecondsLeft: timeLeft,
      timerRunning: isRunning,
      focusSeconds: sessionFocusSeconds,
      cardsReviewed,
      notes: snapshot.notes || null,
      flashcards: snapshot.flashcards || [],
      chatMessages,
      finished: false,
      userId: user?.id ?? null
    });
  }, [
    snapshot, viewMode, timerMode, timerCheckpoint, isRunning,
    cardsReviewed, chatMessages, sessionId, exiting, saver, user?.id
  ]);

  // Flush any pending write if the tab is closed or backgrounded mid-session.
  useEffect(() => {
    const flush = () => saver.flush();
    window.addEventListener('beforeunload', flush);
    // `document` is shadowed by the session's document record in this scope.
    window.document.addEventListener('visibilitychange', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.document.removeEventListener('visibilitychange', flush);
      saver.flush();
    };
  }, [saver]);

  const handleFileFetched = useCallback((blob: Blob) => {
    void cacheDocumentBlob(sessionId, blob).then((stored) => {
      if (stored) void saveSessionState(sessionId, { hasBlob: true });
    });
  }, [sessionId]);

  // ── Snapshot handlers ─────────────────────────────────────────────────────────
  const handleNotesReviewed = (updatedNotes: Notes) => {
    setSnapshot((prev) => (prev ? { ...prev, notes: updatedNotes } : prev));
  };
  const handleCardsUpdated = (cards: Flashcard[]) => {
    setSnapshot((prev) => (prev ? { ...prev, flashcards: cards } : prev));
  };
  const handleAttemptSaved = (attempt: QuizAttempt) => {
    setSnapshot((prev) =>
      prev ? { ...prev, quiz_attempts: [attempt, ...(prev.quiz_attempts || [])] } : prev
    );
  };
  const handleCardReviewed = useCallback(() => {
    setCardsReviewed((n) => n + 1);
  }, []);

  // ── Selection → AI / Flashcard actions ───────────────────────────────────────
  const revealChat = useCallback(() => {
    if (chatDetached) {
      setChatMinimized(false);
    } else if (viewMode !== 'split' && viewMode !== 'chat') {
      setViewMode('split');
    }
  }, [chatDetached, viewMode]);

  const handleAskTutor = useCallback((text: string) => {
    revealChat();
    setContextRequest({ id: Date.now(), text, mode: 'append' });
  }, [revealChat]);

  const handleExplainConcept = useCallback((text: string) => {
    revealChat();
    setContextRequest({ id: Date.now(), text, mode: 'send' });
  }, [revealChat]);

  const handleCreateFlashcard = useCallback((text: string) => {
    setViewMode('flashcards');
    setFlashcardPrefill({ id: Date.now(), front: text });
  }, []);

  // ── Chat dock / float ─────────────────────────────────────────────────────────
  const handleDetachChat = useCallback(() => {
    setChatDetached(true);
    setChatMinimized(false);
    setChatPos({ x: Math.max(20, window.innerWidth - 410), y: 80 });
    sessionStorage.setItem(`aral_chat_detached_${sessionId}`, 'true');
  }, [sessionId]);

  const handleDockChat = useCallback(() => {
    setChatDetached(false);
    setChatMinimized(false);
    sessionStorage.removeItem(`aral_chat_detached_${sessionId}`);
  }, [sessionId]);

  const toggleChatDock = useCallback(() => {
    if (chatDetached) handleDockChat();
    else handleDetachChat();
  }, [chatDetached, handleDockChat, handleDetachChat]);

  const toggleTutor = useCallback(() => {
    if (chatDetached) {
      setChatMinimized((m) => {
        if (m) setChatFocusToken((t) => t + 1);
        return !m;
      });
      return;
    }
    if (viewMode === 'chat') {
      setViewMode('split');
      return;
    }
    if (viewMode !== 'split') setViewMode('split');
    setChatFocusToken((t) => t + 1);
  }, [chatDetached, viewMode]);

  // ── Focus controls ────────────────────────────────────────────────────────────
  const handleStartFocus = () => {
    if (!isWidgetOpen) toggleWidget();
    if (!isRunning) startTimer();
  };

  const handleToggleFocus = useCallback(() => {
    if (!isRunning && !isWidgetOpen) toggleWidget();
    toggleTimer();
  }, [isRunning, isWidgetOpen, toggleTimer, toggleWidget]);

  // ── Exit session ──────────────────────────────────────────────────────────────
  const handleConfirmExit = useCallback(async () => {
    setExiting(true);
    setExitError(null);
    saver.cancel();

    if (isRunning) pauseTimer();

    try {
      // Sync the closing metrics before tearing down the workspace.
      await api.endSession(sessionId, {
        status: 'completed',
        total_focus_seconds: sessionFocusSeconds,
        cards_reviewed: cardsReviewed
      });
      await clearSessionState(sessionId);
      resetSessionFocus();
      linkSession(null);
      window.dispatchEvent(new CustomEvent('aral:session-ended'));
      router.replace('/workspace/');
    } catch (err: any) {
      // Keep the cache so nothing is lost, and let the user retry or leave anyway.
      await saveSessionState(sessionId, { finished: false, userId: user?.id ?? null });
      setExitError(err.message || 'Could not sync this session. Check your connection.');
      setExiting(false);
    }
  }, [
    sessionId, isRunning, pauseTimer, sessionFocusSeconds, cardsReviewed,
    resetSessionFocus, linkSession, router, saver
  ]);

  const handleDiscardAndLeave = useCallback(async () => {
    saver.cancel();
    if (isRunning) pauseTimer();
    try {
      await api.endSession(sessionId, {
        status: 'completed',
        total_focus_seconds: sessionFocusSeconds,
        cards_reviewed: cardsReviewed
      });
    } catch {
      // Still leave the workspace so a failed sync cannot trap the user.
    }
    await clearSessionState(sessionId);
    resetSessionFocus();
    linkSession(null);
    window.dispatchEvent(new CustomEvent('aral:session-ended'));
    router.replace('/workspace/');
  }, [
    saver, isRunning, pauseTimer, sessionId, sessionFocusSeconds, cardsReviewed,
    resetSessionFocus, linkSession, router
  ]);

  // ── Productivity hotkeys ──────────────────────────────────────────────────────
  useHotkeys([
    {
      combo: shortcuts.toggleTimer,
      // The flashcard deck owns Space for card flips while it is on screen.
      handler: () => { if (viewMode !== 'flashcards') handleToggleFocus(); }
    },
    { combo: shortcuts.toggleTutor, allowInInput: true, handler: toggleTutor },
    { combo: shortcuts.toggleChatDock, allowInInput: true, handler: toggleChatDock },
    {
      key: 'Escape',
      handler: () => {
        if (showShortcuts) { setShowShortcuts(false); return; }
        if (showExitDialog) { setShowExitDialog(false); return; }
        if (chatDetached && !chatMinimized) { setChatMinimized(true); return; }
        if (viewMode !== 'split') setViewMode('split');
      }
    }
  ], !loading);

  // ── Loading / Error ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <div className="text-sm font-semibold text-muted-foreground animate-pulse">
          Loading study workspace...
        </div>
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="p-8 text-center bg-card border border-border rounded-2xl max-w-lg mx-auto space-y-4 shadow-notion-soft">
        <h2 className="text-lg font-bold text-foreground">Session Not Found</h2>
        <p className="text-xs text-muted-foreground">{error || 'Unable to retrieve session.'}</p>
        <Link href="/" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-bold text-xs">
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Study Library</span>
        </Link>
      </div>
    );
  }

  const { session, document, notes, flashcards, quiz_attempts } = snapshot;
  const focusMinutes = Math.floor(sessionFocusSeconds / 60);

  const toolTabs = [
    { id: 'split',      label: 'Split View', icon: Columns,  count: 'Live' },
    { id: 'notes',      label: 'Notes',      icon: BookOpen, count: notes ? 'Ready' : 'Pending' },
    { id: 'flashcards', label: 'Flashcards', icon: Layers,   count: flashcards.length > 0 ? `${flashcards.length}` : '—' },
    { id: 'quiz',       label: 'Quiz',       icon: Award,    count: quiz_attempts.length ? `${quiz_attempts[0].score}%` : '3 Modes' },
    { id: 'chat',       label: 'AI Tutor',   icon: Bot,      count: 'Live' }
  ];

  const chatPanel = (extra?: { onDetach?: () => void; footerSlot?: React.ReactNode }) => (
    <WorkspaceChatPanel
      sessionId={sessionId}
      documentTitle={document?.filename || session.title}
      // Seeded from the lifted transcript so docking/floating never drops messages.
      initialMessages={chatMessages}
      contextRequest={contextRequest}
      onClearContextRequest={() => setContextRequest(null)}
      focusToken={chatFocusToken}
      onMessagesChange={setChatMessages}
      onDetach={extra?.onDetach}
      fill
      footerSlot={extra?.footerSlot}
    />
  );

  /** Drag divider that reallocates vertical space between the chat and the modules above it. */
  const dockedResizeGrip = (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize AI tutor height"
      aria-valuenow={dockedChatHeight}
      aria-valuemin={MIN_DOCKED_CHAT_HEIGHT}
      aria-valuemax={MAX_DOCKED_CHAT_HEIGHT}
      tabIndex={0}
      onPointerDown={dockedResize.beginResize}
      onKeyDown={resizeKeyHandler(
        dockedChatSize,
        handleDockedResize,
        { minHeight: MIN_DOCKED_CHAT_HEIGHT, maxHeight: MAX_DOCKED_CHAT_HEIGHT },
        'y'
      )}
      title="Drag to resize the AI tutor (or use arrow keys)"
      className="group h-3 shrink-0 flex items-center justify-center cursor-ns-resize border-t border-outline-variant/60 bg-surface-container-low focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div
        className={`h-1 w-16 rounded-full transition-colors ${
          dockedResize.isResizing ? 'bg-primary' : 'bg-outline-variant group-hover:bg-primary/60'
        }`}
      />
    </div>
  );

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto">

      {/* ── EXIT DIALOG ─────────────────────────────────────────────────────── */}
      {showExitDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-foreground">End Study Session?</h2>
                <p className="text-xs text-muted-foreground">Progress will be saved to your history.</p>
              </div>
            </div>

            <p className="text-sm text-foreground/80 leading-relaxed">
              You&apos;re about to close <strong>{session.title}</strong>.
            </p>

            {/* Metrics that will be written to the session record */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-surface-container-low border border-border">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Focus Time</div>
                <div className="text-lg font-black text-foreground">{focusMinutes}<span className="text-xs font-bold ml-1">min</span></div>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low border border-border">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cards Reviewed</div>
                <div className="text-lg font-black text-foreground">{cardsReviewed}</div>
              </div>
            </div>

            {exitError && (
              <div className="text-xs text-destructive font-medium bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 space-y-2">
                <p>{exitError}</p>
                <button onClick={handleDiscardAndLeave} className="font-bold underline">
                  Leave without syncing
                </button>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowExitDialog(false)}
                disabled={exiting}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-surface-container transition-colors disabled:opacity-50"
              >
                Keep Studying
              </button>
              <button
                onClick={handleConfirmExit}
                disabled={exiting}
                className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold hover:bg-destructive/90 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {exiting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{exiting ? 'Saving...' : 'Save & Exit'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SHORTCUTS SHEET ──────────────────────────────────────────────────── */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-3xl shadow-2xl p-7 max-w-sm w-full mx-4 space-y-4 animate-in zoom-in-95"
          >
            <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-primary" />
              Keyboard Shortcuts
            </h2>
            <div className="space-y-2">
              {SHORTCUT_DEFINITIONS.map((def) => (
                <div key={def.action} className="flex items-center justify-between gap-4 text-xs">
                  <span className="text-muted-foreground">{def.label}</span>
                  <kbd className="px-2 py-1 rounded-lg bg-surface-container border border-border font-mono font-bold text-[11px] text-foreground whitespace-nowrap">
                    {formatCombo(shortcuts[def.action])}
                  </kbd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 text-xs">
                <span className="text-muted-foreground">Close dialogs or unfocus a field</span>
                <kbd className="px-2 py-1 rounded-lg bg-surface-container border border-border font-mono font-bold text-[11px] text-foreground whitespace-nowrap">
                  Esc
                </kbd>
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                href="/settings/#shortcuts"
                className="flex-1 py-2.5 rounded-xl border border-border text-xs font-bold text-foreground text-center hover:bg-surface-container transition-colors"
              >
                Customize
              </Link>
              <button
                onClick={() => setShowShortcuts(false)}
                className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FLOATING DETACHED CHAT ───────────────────────────────────────────── */}
      {chatDetached && (
        <div
          className="fixed z-50 animate-in fade-in"
          style={{ left: chatPos.x, top: chatPos.y, width: floatChatSize.width }}
        >
          <div
            className={`relative bg-card/95 backdrop-blur-2xl border border-border rounded-3xl shadow-2xl overflow-hidden ${
              chatMinimized ? 'h-14' : ''
            } ${floatResize.isResizing || isChatDragging ? '' : 'transition-[height,width] duration-200'}`}
            style={chatMinimized ? undefined : { height: floatChatSize.height }}
          >
            <div
              className={`flex items-center gap-2 px-4 py-3 border-b border-border bg-surface-container-lowest select-none ${chatPinned ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
              onPointerDown={(e) => {
                if (chatPinned) return;
                e.preventDefault();
                chatDragOffset.current = { x: e.clientX - chatPos.x, y: e.clientY - chatPos.y };
                setIsChatDragging(true);
              }}
            >
              <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-on-surface flex-1 truncate">AI Tutor — {session.title}</span>

              <div className="flex items-center gap-0.5 ml-auto">
                <button
                  onClick={() => setChatPinned((p) => !p)}
                  title={chatPinned ? 'Unpin (allow drag)' : 'Pin position'}
                  className={`p-1.5 rounded-lg transition-colors ${chatPinned ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:bg-surface-container'}`}
                >
                  {chatPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setChatMinimized((m) => !m)}
                  title={chatMinimized ? 'Expand' : 'Collapse'}
                  className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  {chatMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={handleDockChat}
                  title="Dock back into sidebar (Ctrl/⌘ + \)"
                  className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  <Dock className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {!chatMinimized && (
              <>
                {/* Panel fills the space left by the 48px drag header. */}
                <div style={{ height: floatChatSize.height - 48 }}>{chatPanel()}</div>

                {/* Bottom-right corner grip: 2-axis resize. */}
                <div
                  role="separator"
                  aria-label="Resize AI tutor window"
                  tabIndex={0}
                  onPointerDown={floatResize.beginResize}
                  onKeyDown={resizeKeyHandler(
                    floatChatSize,
                    setFloatChatSize,
                    floatResizeBounds,
                    'both'
                  )}
                  title="Drag to resize (or use arrow keys)"
                  className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-br-3xl"
                >
                  <svg
                    viewBox="0 0 12 12"
                    className={`w-3 h-3 absolute bottom-1 right-1 transition-colors ${
                      floatResize.isResizing
                        ? 'text-primary'
                        : 'text-outline group-hover:text-primary'
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
              </>
            )}
          </div>
        </div>
      )}

      {/* ── OFFLINE RESTORE BANNER ───────────────────────────────────────────── */}
      {restoredOffline && (
        <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-sticker-orange/10 border border-sticker-orange/30 text-sticker-orange">
          <CloudOff className="w-4 h-4 shrink-0" />
          <p className="text-xs font-semibold flex-1">
            Server unreachable — this workspace was restored from your local cache. Changes will sync when you reconnect.
          </p>
        </div>
      )}

      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest p-5 sm:p-7 rounded-2xl border border-outline-variant">
        <div>
          <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-1.5 font-medium">
            <Link href="/" className="hover:text-primary transition-colors">Library</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="font-semibold text-on-surface truncate max-w-xs sm:max-w-md">{session.title}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-on-surface">
            {session.title}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {isRunning && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold animate-pulse">
              <Timer className="w-3.5 h-3.5" />
              <span className="font-mono tracking-wider">{formattedTime}</span>
            </div>
          )}

          <button
            onClick={() => setShowShortcuts(true)}
            title="Keyboard shortcuts"
            className="w-10 h-10 rounded-full flex items-center justify-center border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary/40 transition-all"
          >
            <Keyboard className="w-4 h-4" />
          </button>

          {isRunning ? (
            <button
              onClick={pauseTimer}
              title="Pause focus timer (Space)"
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-surface-container-lowest hover:bg-surface-container border border-outline-variant text-on-surface text-xs font-semibold transition-all"
            >
              <Pause className="w-3.5 h-3.5 text-primary" />
              <span>Pause Focus</span>
            </button>
          ) : (
            <button
              onClick={handleStartFocus}
              title="Start focus timer (Space)"
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-on-primary text-xs font-bold shadow-sm hover:bg-primary-container transition-all active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Focus</span>
            </button>
          )}

          <button
            onClick={() => { setExitError(null); setShowExitDialog(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-outline-variant text-on-surface-variant hover:text-destructive hover:border-destructive/40 text-xs font-semibold transition-all"
            title="End study session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exit</span>
          </button>
        </div>
      </div>

      {/* ── MODE SELECTOR TOOLBAR ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 bg-surface-container-lowest p-2.5 rounded-2xl overflow-x-auto no-scrollbar border border-outline-variant">
        {toolTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = viewMode === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id as ViewMode)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-primary text-on-primary shadow-sm hover:scale-[1.01]'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ml-1 ${
                isActive ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container-highest text-on-surface-variant'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          VIEW MODE 1: RESIZABLE SPLIT WORKSPACE
          Always mounted – CSS visibility preserves scroll/zoom/split state
          ========================================================================= */}
      <div className={viewMode === 'split' ? 'block' : 'hidden'}>
        <div
          ref={splitContainerRef}
          className="flex flex-col xl:flex-row gap-0 xl:gap-4 min-h-0 items-start relative select-none"
        >
          <div
            style={{ flex: `0 0 ${splitRatio}%` }}
            className={`w-full xl:w-auto flex flex-col relative ${isHDragging ? 'pointer-events-none' : ''}`}
          >
            <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant overflow-hidden shadow-notebook-card">
              <DocumentViewer
                document={document}
                sessionTitle={session.title}
                height={pdfHeight}
                onAskTutor={handleAskTutor}
                onCreateFlashcard={handleCreateFlashcard}
                onExplainConcept={handleExplainConcept}
                onFileFetched={handleFileFetched}
              />
            </div>

            <div
              onPointerDown={(e) => {
                e.preventDefault();
                vDragStartY.current = e.clientY;
                vDragStartH.current = pdfHeight;
                setIsVDragging(true);
              }}
              className="hidden xl:flex items-center justify-center h-4 w-full cursor-row-resize group mt-1 shrink-0"
              title="Drag to resize viewer height"
            >
              {/* transform-only hover/active state so the grip never triggers layout */}
              <div
                className={`h-1.5 w-24 rounded-full transition-transform duration-200 will-change-transform ${
                  isVDragging ? 'bg-primary scale-x-125' : 'bg-outline-variant group-hover:bg-primary group-hover:scale-x-110'
                }`}
              >
                <div className="sr-only">Resize viewer height</div>
              </div>
              <GripHorizontal className={`absolute w-4 h-4 transition-opacity ${isVDragging ? 'opacity-100 text-primary' : 'opacity-0 group-hover:opacity-60 text-on-surface-variant'}`} />
            </div>
          </div>

          <div
            onPointerDown={(e) => { e.preventDefault(); setIsHDragging(true); }}
            className="hidden xl:flex items-center justify-center w-4 cursor-col-resize group self-stretch z-20 shrink-0"
            title="Drag to resize columns"
            style={{ minHeight: pdfHeight }}
          >
            <div
              className={`w-1.5 h-16 rounded-full transition-transform duration-200 will-change-transform flex items-center justify-center ${
                isHDragging ? 'bg-primary scale-y-125 shadow-md' : 'bg-outline-variant group-hover:bg-primary group-hover:scale-y-110'
              }`}
            >
              <GripVertical className="w-3 h-3 text-on-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          <div
            style={{ flex: `1 1 ${100 - splitRatio}%` }}
            className={`w-full xl:w-auto flex flex-col gap-6 overflow-y-auto mt-6 xl:mt-0 pr-1 custom-scrollbar ${
              isHDragging ? 'pointer-events-none' : ''
            }`}
          >
            <CompactNotesCard notes={notes} onOpenFullNotes={() => setViewMode('notes')} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <CompactFlashcardCard
                flashcards={flashcards}
                onOpenDeck={() => setViewMode('flashcards')}
                onQuickGenerate={() => setViewMode('flashcards')}
              />
              <CompactQuizCard quizAttempts={quiz_attempts} onOpenQuiz={() => setViewMode('quiz')} />
            </div>

            {!chatDetached && (
              <div
                style={{ height: dockedChatHeight }}
                className={dockedResize.isResizing ? '' : 'transition-[height] duration-150'}
              >
                {chatPanel({ onDetach: handleDetachChat, footerSlot: dockedResizeGrip })}
              </div>
            )}

            {chatDetached && (
              <div className="border-2 border-dashed border-outline-variant rounded-3xl p-6 text-center space-y-3 bg-surface-container-lowest/60">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                  <ExternalLink className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-on-surface">AI Tutor is floating</p>
                <p className="text-xs text-on-surface-variant">Drag it anywhere, or press Ctrl/⌘ + \ to dock it back.</p>
                <button
                  onClick={handleDockChat}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-bold hover:bg-primary-container transition-all"
                >
                  <Dock className="w-3.5 h-3.5" />
                  Dock Back
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* VIEW MODE 2: FULL NOTES REVIEWER */}
      <div className={`${viewMode === 'notes' ? 'block' : 'hidden'} space-y-4 animate-in fade-in`}>
        <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border text-xs">
          <span className="font-semibold text-muted-foreground">Viewing Full Notes Reviewer Editor</span>
          <button onClick={() => setViewMode('split')} className="font-bold text-primary hover:underline flex items-center gap-1">
            <Columns className="w-3.5 h-3.5" />
            <span>Back to Split View</span>
          </button>
        </div>
        <NotesReviewEditor
          sessionId={sessionId}
          initialNotes={notes || null}
          onConfirmReview={handleNotesReviewed}
        />
      </div>

      {/* VIEW MODE 3: FULL FLASHCARD DECK */}
      <div className={`${viewMode === 'flashcards' ? 'block' : 'hidden'} space-y-4 animate-in fade-in`}>
        <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border text-xs">
          <span className="font-semibold text-muted-foreground">Viewing Active Recall Flashcard Arena</span>
          <button onClick={() => setViewMode('split')} className="font-bold text-primary hover:underline flex items-center gap-1">
            <Columns className="w-3.5 h-3.5" />
            <span>Back to Split View</span>
          </button>
        </div>
        <FlashcardDeck
          sessionId={sessionId}
          initialFlashcards={flashcards}
          onCardsUpdated={handleCardsUpdated}
          onCardReviewed={handleCardReviewed}
          prefill={flashcardPrefill}
          onClearPrefill={() => setFlashcardPrefill(null)}
          active={viewMode === 'flashcards'}
        />
      </div>

      {/* VIEW MODE 4: FULL QUIZ ARENA */}
      <div className={`${viewMode === 'quiz' ? 'block' : 'hidden'} space-y-4 animate-in fade-in`}>
        <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border text-xs">
          <span className="font-semibold text-muted-foreground">Viewing Multi-Mode Quiz Arena</span>
          <button onClick={() => setViewMode('split')} className="font-bold text-primary hover:underline flex items-center gap-1">
            <Columns className="w-3.5 h-3.5" />
            <span>Back to Split View</span>
          </button>
        </div>
        <QuizArena
          sessionId={sessionId}
          initialAttempts={quiz_attempts}
          onAttemptSaved={handleAttemptSaved}
        />
      </div>

      {/* VIEW MODE 5: FULL AI TUTOR */}
      <div className={`${viewMode === 'chat' ? 'block' : 'hidden'} space-y-4 animate-in fade-in`}>
        <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border text-xs">
          <span className="font-semibold text-muted-foreground">Viewing Dedicated AI Study Tutor</span>
          <button onClick={() => setViewMode('split')} className="font-bold text-primary hover:underline flex items-center gap-1">
            <Columns className="w-3.5 h-3.5" />
            <span>Back to Split View</span>
          </button>
        </div>
        <RealtimeChatPanel sessionId={sessionId} initialMessages={snapshot.chat_history} />
      </div>
    </div>
  );
}
