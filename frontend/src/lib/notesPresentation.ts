import {
  NoteContent,
  NoteMark,
  NotePresentation,
  NotesHighlightColor,
  NotesHighlightMode,
  NotesMarkKind
} from '@/lib/types';

export interface AutoTerm {
  phrase: string;
  color: NotesHighlightColor;
  reason: 'key_term' | 'doctrine' | 'case';
}

export interface AutoRange {
  start: number;
  end: number;
  color: NotesHighlightColor;
  reason: AutoTerm['reason'];
}

export interface TextSpan {
  text: string;
  highlight?: NotesHighlightColor;
  highlightSource?: 'auto' | 'manual';
  highlightReason?: AutoTerm['reason'];
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

const SKIP_AUTO_PATH = /(^title$|\.heading$|\.term$|\.case_name$|\.name$)/;
const MIN_AUTO_PHRASE = 3;
const MAX_AUTO_PHRASE = 80;

export const HIGHLIGHT_COLORS: { id: NotesHighlightColor; label: string }[] = [
  { id: 'yellow', label: 'Yellow' },
  { id: 'green', label: 'Green' },
  { id: 'pink', label: 'Pink' },
  { id: 'sky', label: 'Blue' }
];

export const DEFAULT_PRESENTATION: NotePresentation = {
  highlight_mode: 'off',
  marks: []
};

export function emptyPresentation(): NotePresentation {
  return { highlight_mode: 'off', marks: [] };
}

export function normalizeNoteContent(raw?: NoteContent | null): NoteContent {
  return {
    title: raw?.title || 'Extracted Study Notes',
    summary: raw?.summary || '',
    document_type: raw?.document_type || 'general',
    sections: raw?.sections || [],
    cases: raw?.cases || [],
    doctrines: raw?.doctrines || [],
    presentation: {
      highlight_mode: raw?.presentation?.highlight_mode,
      marks: Array.isArray(raw?.presentation?.marks) ? raw!.presentation!.marks! : []
    }
  };
}

export function createMarkId(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function isNotesHighlightMode(value: unknown): value is NotesHighlightMode {
  return value === 'off' || value === 'auto' || value === 'manual';
}

export function shouldAutoHighlightPath(path: string): boolean {
  return !SKIP_AUTO_PATH.test(path);
}

function isWordChar(ch: string | undefined): boolean {
  if (!ch) return false;
  return /[A-Za-z0-9]/.test(ch);
}

export function findPhraseRanges(text: string, phrase: string): Array<{ start: number; end: number }> {
  const needle = phrase.trim();
  if (!needle || needle.length < MIN_AUTO_PHRASE) return [];

  const ranges: Array<{ start: number; end: number }> = [];
  const haystack = text.toLowerCase();
  const search = needle.toLowerCase();
  let from = 0;

  while (from < haystack.length) {
    const idx = haystack.indexOf(search, from);
    if (idx === -1) break;
    const end = idx + needle.length;
    const beforeOk = idx === 0 || !isWordChar(text[idx - 1]);
    const afterOk = end >= text.length || !isWordChar(text[end]);
    if (beforeOk && afterOk) ranges.push({ start: idx, end });
    from = idx + Math.max(1, needle.length);
  }

  return ranges;
}

export function collectAutoTerms(content: NoteContent): AutoTerm[] {
  const seen = new Set<string>();
  const terms: AutoTerm[] = [];

  const push = (phrase: string, color: NotesHighlightColor, reason: AutoTerm['reason']) => {
    const cleaned = phrase.trim().replace(/\s+/g, ' ');
    if (cleaned.length < MIN_AUTO_PHRASE || cleaned.length > MAX_AUTO_PHRASE) return;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    terms.push({ phrase: cleaned, color, reason });
  };

  for (const section of content.sections || []) {
    for (const kt of section.key_terms || []) push(kt.term, 'yellow', 'key_term');
  }
  for (const doctrine of content.doctrines || []) push(doctrine.name, 'green', 'doctrine');
  for (const legalCase of content.cases || []) push(legalCase.case_name, 'sky', 'case');

  terms.sort((a, b) => b.phrase.length - a.phrase.length);
  return terms;
}

export function collectAutoRanges(text: string, terms: AutoTerm[]): AutoRange[] {
  if (!text || terms.length === 0) return [];
  const taken = new Uint8Array(text.length);
  const ranges: AutoRange[] = [];

  for (const term of terms) {
    for (const match of findPhraseRanges(text, term.phrase)) {
      let overlaps = false;
      for (let i = match.start; i < match.end; i++) {
        if (taken[i]) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;
      for (let i = match.start; i < match.end; i++) taken[i] = 1;
      ranges.push({ start: match.start, end: match.end, color: term.color, reason: term.reason });
    }
  }

  return ranges;
}

function rangesOverlap(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end;
}

export function resolveMarks(marks: NoteMark[], path: string, text: string): NoteMark[] {
  const resolved: NoteMark[] = [];
  for (const mark of marks) {
    if (mark.path !== path) continue;
    if (mark.end <= mark.start || !mark.text) continue;
    if (text.slice(mark.start, mark.end) === mark.text) {
      resolved.push(mark);
      continue;
    }
    const idx = text.indexOf(mark.text);
    if (idx === -1) continue;
    resolved.push({ ...mark, start: idx, end: idx + mark.text.length });
  }
  return resolved;
}

export function buildSpans(text: string, marks: NoteMark[], autoRanges: AutoRange[] = []): TextSpan[] {
  const n = text.length;
  if (n === 0) return [];

  const bold = new Uint8Array(n);
  const italic = new Uint8Array(n);
  const underline = new Uint8Array(n);
  const highlight = new Array<NotesHighlightColor | null>(n).fill(null);
  const source = new Array<'auto' | 'manual' | null>(n).fill(null);
  const reason = new Array<AutoTerm['reason'] | null>(n).fill(null);

  for (const range of autoRanges) {
    const start = Math.max(0, range.start);
    const end = Math.min(n, range.end);
    for (let i = start; i < end; i++) {
      if (!highlight[i]) {
        highlight[i] = range.color;
        source[i] = 'auto';
        reason[i] = range.reason;
      }
    }
  }

  for (const mark of marks) {
    const start = Math.max(0, mark.start);
    const end = Math.min(n, mark.end);
    for (let i = start; i < end; i++) {
      if (mark.kind === 'bold') bold[i] = 1;
      else if (mark.kind === 'italic') italic[i] = 1;
      else if (mark.kind === 'underline') underline[i] = 1;
      else if (mark.kind === 'highlight') {
        highlight[i] = mark.color || 'yellow';
        source[i] = 'manual';
        reason[i] = null;
      }
    }
  }

  const spans: TextSpan[] = [];
  let i = 0;
  while (i < n) {
    const key = `${bold[i]}|${italic[i]}|${underline[i]}|${highlight[i]}|${source[i]}|${reason[i]}`;
    let j = i + 1;
    while (
      j < n &&
      `${bold[j]}|${italic[j]}|${underline[j]}|${highlight[j]}|${source[j]}|${reason[j]}` === key
    ) {
      j++;
    }
    spans.push({
      text: text.slice(i, j),
      bold: Boolean(bold[i]),
      italic: Boolean(italic[i]),
      underline: Boolean(underline[i]),
      highlight: highlight[i] || undefined,
      highlightSource: source[i] || undefined,
      highlightReason: reason[i] || undefined
    });
    i = j;
  }
  return spans;
}

export function upsertMark(marks: NoteMark[], mark: NoteMark): NoteMark[] {
  const exact = marks.find(
    (existing) =>
      existing.path === mark.path &&
      existing.kind === mark.kind &&
      existing.start === mark.start &&
      existing.end === mark.end &&
      (mark.kind !== 'highlight' || existing.color === mark.color)
  );
  if (exact) return marks.filter((existing) => existing.id !== exact.id);

  if (mark.kind === 'highlight') {
    const rest = marks.filter(
      (existing) =>
        !(existing.path === mark.path && existing.kind === 'highlight' && rangesOverlap(existing, mark))
    );
    return [...rest, mark];
  }

  return [...marks, mark];
}

export function rangeHasKind(
  marks: NoteMark[],
  path: string,
  start: number,
  end: number,
  kind: NotesMarkKind,
  color?: NotesHighlightColor
): boolean {
  return marks.some((mark) => {
    if (mark.path !== path || mark.kind !== kind) return false;
    if (kind === 'highlight' && color && mark.color !== color) return false;
    return mark.start <= start && mark.end >= end;
  });
}

export function clearMarksInRange(
  marks: NoteMark[],
  path: string,
  start: number,
  end: number,
  kinds?: NotesMarkKind[]
): NoteMark[] {
  return marks.filter((mark) => {
    if (mark.path !== path) return true;
    if (kinds && !kinds.includes(mark.kind)) return true;
    return !rangesOverlap(mark, { start, end });
  });
}

export function makeMark(
  path: string,
  start: number,
  end: number,
  text: string,
  kind: NotesMarkKind,
  extras: Partial<Pick<NoteMark, 'color' | 'source'>> = {}
): NoteMark {
  return {
    id: createMarkId(),
    path,
    start,
    end,
    text,
    kind,
    ...extras
  };
}
