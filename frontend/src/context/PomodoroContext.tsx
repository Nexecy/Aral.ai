'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { sound } from '@/lib/sound';
import { api } from '@/lib/api';
import { PomodoroSettings } from '@/lib/types';
import { BRAND_LOGO_FALLBACK } from '@/lib/brand';
import { useNotifications } from '@/context/NotificationContext';

export type TimerMode = 'work' | 'short_break' | 'long_break';

const DEFAULT_SETTINGS: PomodoroSettings = {
  id: 'default',
  user_id: '',
  study_minutes: 25,
  short_break_minutes: 5,
  long_break_minutes: 15,
  cycles_before_long_break: 4,
  auto_start_next: false,
  sound_enabled: true,
  sound_choice: 'zen'
};

interface PomodoroContextType {
  mode: TimerMode;
  timeLeft: number;
  isRunning: boolean;
  isWidgetOpen: boolean;
  isMinimized: boolean;
  currentSessionId: string | null;
  activeSessionTitle: string | null;
  cyclesCompleted: number;
  /** Focused work seconds accrued for the currently linked session. */
  sessionFocusSeconds: number;
  settings: PomodoroSettings;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  toggleTimer: () => void;
  toggleWidget: () => void;
  toggleMinimize: () => void;
  setTimerMode: (mode: TimerMode) => void;
  linkSession: (sessionId: string | null, title?: string | null) => void;
  resetSessionFocus: () => void;
  updateSettings: (newSettings: Partial<PomodoroSettings>) => Promise<void>;
  formattedTime: string;
}

const PomodoroContext = createContext<PomodoroContextType | undefined>(undefined);

export function PomodoroProvider({ children }: { children: React.ReactNode }) {
  const { addNotification } = useNotifications();
  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_SETTINGS);
  const [mode, setMode] = useState<TimerMode>('work');
  const [timeLeft, setTimeLeft] = useState<number>(25 * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isWidgetOpen, setIsWidgetOpen] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [activeSessionTitle, setActiveSessionTitle] = useState<string | null>(null);
  const [cyclesCompleted, setCyclesCompleted] = useState<number>(0);
  const [sessionFocusSeconds, setSessionFocusSeconds] = useState<number>(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to compute seconds for mode
  const getSecondsForMode = (m: TimerMode, s: PomodoroSettings) => {
    switch (m) {
      case 'short_break': return s.short_break_minutes * 60;
      case 'long_break': return s.long_break_minutes * 60;
      case 'work':
      default:
        return s.study_minutes * 60;
    }
  };

  // Load custom settings and restore active session link on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const savedLocal = localStorage.getItem('aral_pomodoro_settings');
        if (savedLocal) {
          const parsed = JSON.parse(savedLocal);
          setSettings((prev) => ({ ...prev, ...parsed }));
          setTimeLeft(parsed.study_minutes ? parsed.study_minutes * 60 : 25 * 60);
        }

        const savedSessionId = localStorage.getItem('aral_active_session_id');
        const savedSessionTitle = localStorage.getItem('aral_active_session_title');
        const savedFocusSecs = localStorage.getItem('aral_session_focus_seconds');
        if (savedSessionId) {
          setCurrentSessionId(savedSessionId);
          if (savedSessionTitle) setActiveSessionTitle(savedSessionTitle);
          if (savedFocusSecs) {
            const n = parseInt(savedFocusSecs, 10);
            if (!isNaN(n)) setSessionFocusSeconds(n);
          }
        }
        const serverSettings = await api.getPomodoroSettings();
        if (serverSettings) {
          setSettings(serverSettings);
          localStorage.setItem('aral_pomodoro_settings', JSON.stringify(serverSettings));
          if (!isRunning && mode === 'work') {
            setTimeLeft(serverSettings.study_minutes * 60);
          }
        }
      } catch (e) {
        // use default/local
      }
    }
    loadSettings();
  }, []);

  // Request browser notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  // Timer Tick Interval
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        // Only work intervals inside a linked session count toward focus time.
        if (mode === 'work' && currentSessionId) {
          setSessionFocusSeconds((prev) => {
            const next = prev + 1;
            if (typeof window !== 'undefined') {
              localStorage.setItem('aral_session_focus_seconds', String(next));
            }
            return next;
          });
        }
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleCycleComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, mode, currentSessionId, settings, cyclesCompleted]);

  const handleCycleComplete = async () => {
    if (settings.sound_enabled) {
      sound.playPomodoroChime(settings.sound_choice);
    }

    const nextCycleCount = cyclesCompleted + 1;
    const isLongBreak = nextCycleCount % settings.cycles_before_long_break === 0;
    const workBody = `Great work! Take a ${isLongBreak ? settings.long_break_minutes : settings.short_break_minutes}-minute restorative break.`;
    const breakBody = 'Break is over. Ready to jump back into your study session?';

    addNotification({
      id: `pomodoro-${mode}-${Date.now()}`,
      kind: 'pomodoro',
      title: mode === 'work' ? 'Pomodoro complete' : 'Break finished',
      body: mode === 'work' ? workBody : breakBody
    });

    // Trigger Browser Notification
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(
        mode === 'work' ? 'Pomodoro focus completed' : 'Break finished',
        {
          body: mode === 'work' ? workBody : breakBody,
          icon: BRAND_LOGO_FALLBACK
        }
      );
    }

    if (mode === 'work') {
      try {
        await api.logPomodoro(settings.study_minutes, currentSessionId, true);
      } catch (e) {
        console.error('Failed to log pomodoro:', e);
      }
      setCyclesCompleted(nextCycleCount);

      // Check if time for long break
      const nextMode: TimerMode = isLongBreak ? 'long_break' : 'short_break';
      setMode(nextMode);
      const nextSeconds = getSecondsForMode(nextMode, settings);
      setTimeLeft(nextSeconds);
      setIsRunning(settings.auto_start_next);
    } else {
      setMode('work');
      const nextSeconds = getSecondsForMode('work', settings);
      setTimeLeft(nextSeconds);
      setIsRunning(settings.auto_start_next);
    }
  };

  const startTimer = () => setIsRunning(true);
  const pauseTimer = () => setIsRunning(false);
  const toggleTimer = () => setIsRunning((prev) => !prev);

  
  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(getSecondsForMode(mode, settings));
  };

  const toggleWidget = () => setIsWidgetOpen((prev) => !prev);
  const toggleMinimize = () => setIsMinimized((prev) => !prev);

  const setTimerMode = (newMode: TimerMode) => {
    setMode(newMode);
    setIsRunning(false);
    setTimeLeft(getSecondsForMode(newMode, settings));
  };

  const linkSession = (sessionId: string | null, title?: string | null) => {
    if (sessionId) {
      setCurrentSessionId((prev) => {
        if (prev !== sessionId) setSessionFocusSeconds(0);
        return sessionId;
      });
      if (title) setActiveSessionTitle(title);
      if (typeof window !== 'undefined') {
        localStorage.setItem('aral_active_session_id', sessionId);
        if (title) localStorage.setItem('aral_active_session_title', title);
      }
    } else {
      setCurrentSessionId(null);
      setActiveSessionTitle(null);
      setSessionFocusSeconds(0);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('aral_active_session_id');
        localStorage.removeItem('aral_active_session_title');
        localStorage.removeItem('aral_session_focus_seconds');
      }
    }
  };

  const resetSessionFocus = () => {
    setSessionFocusSeconds(0);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('aral_session_focus_seconds');
    }
  };

  const updateSettings = async (newSettings: Partial<PomodoroSettings>) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    localStorage.setItem('aral_pomodoro_settings', JSON.stringify(merged));
    if (!isRunning) {
      setTimeLeft(getSecondsForMode(mode, merged));
    }
    try {
      await api.updatePomodoroSettings(newSettings);
    } catch (e) {
      console.error('Failed to update remote settings:', e);
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <PomodoroContext.Provider
      value={{
        mode,
        timeLeft,
        isRunning,
        isWidgetOpen,
        isMinimized,
        currentSessionId,
        activeSessionTitle,
        cyclesCompleted,
        sessionFocusSeconds,
        settings,
        startTimer,
        pauseTimer,
        resetTimer,
        toggleTimer,
        toggleWidget,
        toggleMinimize,
        setTimerMode,
        linkSession,
        resetSessionFocus,
        updateSettings,
        formattedTime
      }}
    >
      {children}
    </PomodoroContext.Provider>
  );
}

export function usePomodoro() {
  const context = useContext(PomodoroContext);
  if (!context) throw new Error('usePomodoro must be used within a PomodoroProvider');
  return context;
}
