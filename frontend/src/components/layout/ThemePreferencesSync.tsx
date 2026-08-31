'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { api } from '@/lib/api';

/** Loads the signed-in user's saved theme and writes changes back to profiles. */
export function ThemePreferencesSync() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const lastSaved = useRef<string | null>(null);
  const ready = useRef(false);
  const userId = user?.id ?? null;
  const savedTheme = user?.theme ?? null;

  useEffect(() => {
    ready.current = false;
    if (!userId) {
      lastSaved.current = null;
      return;
    }
    if (savedTheme === 'light' || savedTheme === 'dark') {
      lastSaved.current = savedTheme;
      setTheme(savedTheme);
    } else {
      lastSaved.current = theme;
    }
    const timer = window.setTimeout(() => {
      ready.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
    // Hydrate once per sign-in, not on every theme click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!userId || !ready.current) return;
    if (lastSaved.current === theme) return;
    lastSaved.current = theme;
    void api.updateProfile({ theme }).catch(() => {
      /* keep local theme even if save fails */
    });
  }, [theme, userId]);

  return null;
}
