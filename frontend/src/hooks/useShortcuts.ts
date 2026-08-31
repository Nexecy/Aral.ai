'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  SHORTCUTS_CHANGED_EVENT,
  SHORTCUTS_STORAGE_KEY,
  ShortcutAction,
  ShortcutMap,
  getDefaultShortcuts,
  loadShortcuts,
  saveShortcuts
} from '@/lib/shortcuts';

/**
 * The user's keybindings, kept in sync across every component that reads them
 * (and across browser tabs) via a custom event plus the native storage event.
 */
export function useShortcutMap(): {
  shortcuts: ShortcutMap;
  setShortcut: (action: ShortcutAction, combo: ShortcutMap[ShortcutAction]) => void;
  resetShortcuts: () => void;
  hydrated: boolean;
} {
  // Defaults on first paint keep server and client markup identical.
  const [shortcuts, setShortcuts] = useState<ShortcutMap>(getDefaultShortcuts);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setShortcuts(loadShortcuts());
    setHydrated(true);

    const sync = () => setShortcuts(loadShortcuts());
    const onStorage = (e: StorageEvent) => {
      if (e.key === SHORTCUTS_STORAGE_KEY) sync();
    };

    window.addEventListener(SHORTCUTS_CHANGED_EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(SHORTCUTS_CHANGED_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setShortcut = useCallback((action: ShortcutAction, combo: ShortcutMap[ShortcutAction]) => {
    setShortcuts((prev) => {
      const next = { ...prev, [action]: combo };
      saveShortcuts(next);
      return next;
    });
  }, []);

  const resetShortcuts = useCallback(() => {
    const defaults = getDefaultShortcuts();
    setShortcuts(defaults);
    saveShortcuts(defaults);
  }, []);

  return { shortcuts, setShortcut, resetShortcuts, hydrated };
}
