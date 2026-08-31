'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Keyboard, RotateCcw, X } from 'lucide-react';
import { useShortcutMap } from '@/hooks/useShortcuts';
import {
  KeyCombo,
  SHORTCUT_DEFINITIONS,
  ShortcutAction,
  combosEqual,
  comboFromEvent,
  findConflicts,
  formatCombo,
  getDefaultShortcuts,
  isModifierKey
} from '@/lib/shortcuts';

const ACTION_LABELS = SHORTCUT_DEFINITIONS.reduce((acc, def) => {
  acc[def.action] = def.label;
  return acc;
}, {} as Record<ShortcutAction, string>);

export function ShortcutsManager() {
  const { shortcuts, setShortcut, resetShortcuts, hydrated } = useShortcutMap();

  const [recording, setRecording] = useState<ShortcutAction | null>(null);
  const [pending, setPending] = useState<KeyCombo | null>(null);
  const [conflicts, setConflicts] = useState<ShortcutAction[]>([]);
  const [savedAction, setSavedAction] = useState<ShortcutAction | null>(null);

  const recordingRef = useRef<ShortcutAction | null>(null);
  recordingRef.current = recording;

  const stopRecording = useCallback(() => {
    setRecording(null);
    setPending(null);
    setConflicts([]);
  }, []);

  // While recording, the window swallows every keystroke so the combo being
  // captured can't also trigger the app shortcut it is replacing.
  useEffect(() => {
    if (!recording) return;

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        stopRecording();
        return;
      }
      if (isModifierKey(e.key)) return;

      const combo = comboFromEvent(e);
      if (!combo) return;

      const action = recordingRef.current;
      if (!action) return;

      setPending(combo);
      setConflicts(findConflicts(shortcuts, combo, action));
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [recording, shortcuts, stopRecording]);

  const confirm = useCallback(() => {
    if (!recording || !pending) return;
    setShortcut(recording, pending);
    setSavedAction(recording);
    window.setTimeout(
      () => setSavedAction((current) => (current === recording ? null : current)),
      1800
    );
    stopRecording();
  }, [recording, pending, setShortcut, stopRecording]);

  const defaults = getDefaultShortcuts();
  const isCustomised = SHORTCUT_DEFINITIONS.some(
    (def) => !combosEqual(shortcuts[def.action], defaults[def.action])
  );

  return (
    <div
      id="shortcuts"
      className="p-6 rounded-2xl bg-card border border-border shadow-notion-soft space-y-4 scroll-mt-24"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-primary" />
            <span>Keyboard Shortcuts</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Click a shortcut, then press the key combination you want to use.
          </p>
        </div>

        <button
          onClick={() => {
            resetShortcuts();
            stopRecording();
          }}
          disabled={!isCustomised}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-surface-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset to defaults
        </button>
      </div>

      <div className="space-y-2">
        {SHORTCUT_DEFINITIONS.map((def) => {
          const isRecording = recording === def.action;
          const combo = shortcuts[def.action];
          const changed = !combosEqual(combo, defaults[def.action]);

          return (
            <div
              key={def.action}
              className={`p-3.5 rounded-xl border transition-colors ${
                isRecording
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                  : 'border-border bg-surface-container-low'
              }`}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-foreground flex items-center gap-2">
                    <span>{def.label}</span>
                    {changed && !isRecording && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        Custom
                      </span>
                    )}
                    {savedAction === def.action && (
                      <span className="text-[10px] font-bold text-sticker-green flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Saved
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{def.description}</p>
                </div>

                {isRecording ? (
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-lg bg-surface-container border border-primary/40 font-mono font-bold text-[11px] text-foreground min-w-[110px] text-center">
                      {pending ? formatCombo(pending) : 'Press keys…'}
                    </span>
                    <button
                      onClick={confirm}
                      disabled={!pending}
                      aria-label="Save shortcut"
                      className="p-1.5 rounded-lg bg-primary text-on-primary disabled:opacity-40 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={stopRecording}
                      aria-label="Cancel"
                      className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setRecording(def.action);
                      setPending(null);
                      setConflicts([]);
                    }}
                    disabled={!hydrated}
                    className="px-3 py-1.5 rounded-lg bg-surface-container border border-border font-mono font-bold text-[11px] text-foreground hover:border-primary/50 hover:text-primary transition-colors min-w-[110px]"
                  >
                    {formatCombo(combo)}
                  </button>
                )}
              </div>

              {isRecording && conflicts.length > 0 && (
                <div className="mt-2.5 flex items-start gap-2 p-2.5 rounded-lg bg-sticker-orange/10 border border-sticker-orange/30">
                  <AlertTriangle className="w-3.5 h-3.5 text-sticker-orange shrink-0 mt-0.5" />
                  <p className="text-[11px] text-sticker-orange font-medium">
                    Already used by{' '}
                    <strong>{conflicts.map((a) => ACTION_LABELS[a]).join(', ')}</strong>. Saving
                    will leave both on the same keys — pick another combination to avoid a clash.
                  </p>
                </div>
              )}

              {isRecording && !conflicts.length && pending && (
                <p className="mt-2.5 text-[11px] text-muted-foreground">
                  Press <kbd className="font-mono font-bold">Esc</kbd> to cancel, or confirm to
                  save.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Shortcuts are stored on this device and apply everywhere in the app.
      </p>
    </div>
  );
}
