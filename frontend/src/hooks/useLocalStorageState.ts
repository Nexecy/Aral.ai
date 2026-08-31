'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * State mirrored into localStorage.
 *
 * The initial render always returns `fallback` so server and client markup
 * match; the stored value is adopted in an effect straight after hydration.
 */
export function useLocalStorageState<T>(
  key: string,
  fallback: T,
  parse?: (raw: unknown) => T | null
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const [value, setValue] = useState<T>(fallback);
  const [hydrated, setHydrated] = useState(false);
  const parseRef = useRef(parse);
  parseRef.current = parse;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        const decoded = JSON.parse(raw);
        const next = parseRef.current ? parseRef.current(decoded) : (decoded as T);
        if (next !== null && next !== undefined) setValue(next);
      }
    } catch {
      // Corrupt or unavailable storage just falls back to the default.
    }
    setHydrated(true);
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // Ignore quota/private-mode failures — state still updates in memory.
        }
        return resolved;
      });
    },
    [key]
  );

  return [value, update, hydrated];
}
