/**
 * User-customisable keyboard shortcuts.
 *
 * A binding is stored as a normalised descriptor rather than a display string,
 * so matching stays layout-independent and conflict detection is exact.
 */

export type ShortcutAction =
  | 'toggleTutor'
  | 'toggleTimer'
  | 'focusSearch'
  | 'toggleChatDock';

export interface KeyCombo {
  /** `KeyboardEvent.key`, lower-cased. Space is stored as `' '`. */
  key: string;
  /** Cmd on macOS, Ctrl elsewhere. */
  mod: boolean;
  shift: boolean;
  alt: boolean;
}

export interface ShortcutDefinition {
  action: ShortcutAction;
  label: string;
  description: string;
  /** Allowed to fire while a text field has focus. */
  allowInInput: boolean;
  default: KeyCombo;
}

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  {
    action: 'toggleTutor',
    label: 'Toggle AI Tutor',
    description: 'Show, hide, or focus the tutor panel',
    allowInInput: true,
    default: { key: '/', mod: true, shift: false, alt: false }
  },
  {
    action: 'toggleTimer',
    label: 'Play / Pause Timer',
    description: 'Start or pause the focus timer',
    allowInInput: false,
    default: { key: ' ', mod: false, shift: false, alt: false }
  },
  {
    action: 'focusSearch',
    label: 'Focus Search',
    description: 'Jump to the knowledge search box',
    allowInInput: true,
    default: { key: 'k', mod: true, shift: false, alt: false }
  },
  {
    action: 'toggleChatDock',
    label: 'Dock / Float Chat',
    description: 'Move the tutor between the sidebar and a floating window',
    allowInInput: true,
    default: { key: '\\', mod: true, shift: false, alt: false }
  }
];

export type ShortcutMap = Record<ShortcutAction, KeyCombo>;

export const SHORTCUTS_STORAGE_KEY = 'aral_shortcuts';

/** Event fired on `window` when bindings change, so open tabs stay in sync. */
export const SHORTCUTS_CHANGED_EVENT = 'aral:shortcuts-changed';

export function getDefaultShortcuts(): ShortcutMap {
  return SHORTCUT_DEFINITIONS.reduce((acc, def) => {
    acc[def.action] = { ...def.default };
    return acc;
  }, {} as ShortcutMap);
}

function isKeyCombo(value: unknown): value is KeyCombo {
  if (!value || typeof value !== 'object') return false;
  const combo = value as Partial<KeyCombo>;
  return (
    typeof combo.key === 'string' &&
    typeof combo.mod === 'boolean' &&
    typeof combo.shift === 'boolean' &&
    typeof combo.alt === 'boolean'
  );
}

/** Merges stored bindings over the defaults, discarding anything malformed. */
export function parseShortcutMap(raw: unknown): ShortcutMap {
  const map = getDefaultShortcuts();
  if (!raw || typeof raw !== 'object') return map;

  for (const def of SHORTCUT_DEFINITIONS) {
    const candidate = (raw as Record<string, unknown>)[def.action];
    if (isKeyCombo(candidate)) map[def.action] = candidate;
  }
  return map;
}

export function loadShortcuts(): ShortcutMap {
  if (typeof window === 'undefined') return getDefaultShortcuts();
  try {
    const raw = window.localStorage.getItem(SHORTCUTS_STORAGE_KEY);
    return raw ? parseShortcutMap(JSON.parse(raw)) : getDefaultShortcuts();
  } catch {
    return getDefaultShortcuts();
  }
}

export function saveShortcuts(map: ShortcutMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Non-fatal: the in-memory map is still authoritative for this session.
  }
  window.dispatchEvent(new CustomEvent(SHORTCUTS_CHANGED_EVENT));
}

export function combosEqual(a: KeyCombo, b: KeyCombo): boolean {
  return (
    a.key.toLowerCase() === b.key.toLowerCase() &&
    a.mod === b.mod &&
    a.shift === b.shift &&
    a.alt === b.alt
  );
}

/** Actions (other than `except`) already bound to `combo`. */
export function findConflicts(
  map: ShortcutMap,
  combo: KeyCombo,
  except: ShortcutAction
): ShortcutAction[] {
  return SHORTCUT_DEFINITIONS
    .filter((def) => def.action !== except && combosEqual(map[def.action], combo))
    .map((def) => def.action);
}

const KEY_LABELS: Record<string, string> = {
  ' ': 'Space',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  escape: 'Esc',
  enter: 'Enter',
  tab: 'Tab',
  backspace: 'Backspace',
  '\\': '\\',
  '/': '/'
};

function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
}

export function formatCombo(combo: KeyCombo): string {
  const mac = isMacPlatform();
  const parts: string[] = [];
  if (combo.mod) parts.push(mac ? '⌘' : 'Ctrl');
  if (combo.alt) parts.push(mac ? '⌥' : 'Alt');
  if (combo.shift) parts.push(mac ? '⇧' : 'Shift');

  const lower = combo.key.toLowerCase();
  parts.push(KEY_LABELS[lower] ?? (combo.key.length === 1 ? combo.key.toUpperCase() : combo.key));

  return parts.join(mac ? '' : ' + ');
}

/** Modifier-only presses can't be a shortcut on their own. */
export function isModifierKey(key: string): boolean {
  return ['control', 'meta', 'shift', 'alt', 'os', 'altgraph'].includes(key.toLowerCase());
}

export function comboFromEvent(e: KeyboardEvent | React.KeyboardEvent): KeyCombo | null {
  if (isModifierKey(e.key)) return null;
  return {
    // `e.code` keeps Space stable across layouts, matching useHotkeys.
    key: e.code === 'Space' ? ' ' : e.key.toLowerCase(),
    mod: e.metaKey || e.ctrlKey,
    shift: e.shiftKey,
    alt: e.altKey
  };
}

export function comboMatchesEvent(e: KeyboardEvent, combo: KeyCombo): boolean {
  if ((e.metaKey || e.ctrlKey) !== combo.mod) return false;
  if (e.shiftKey !== combo.shift) return false;
  if (e.altKey !== combo.alt) return false;
  if (combo.key === ' ') return e.code === 'Space';
  return e.key.toLowerCase() === combo.key.toLowerCase();
}
