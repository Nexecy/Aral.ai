import type { CSSProperties } from 'react';

/**
 * Reading scale for the notes reviewer document.
 *
 * Independent of the chat transcript size so students can keep a compact
 * tutor pane and a larger reviewer sheet (or the reverse) at the same time.
 */

export type NotesFontSize = 'small' | 'default' | 'large' | 'xlarge';

export interface NotesTypeScale {
  label: string;
  shortLabel: string;
  title: number;
  h2: number;
  h3: number;
  body: number;
  meta: number;
  lineHeight: number;
}

export const NOTES_FONT_SIZES: Record<NotesFontSize, NotesTypeScale> = {
  small: { label: 'Small', shortLabel: 'S', title: 22, h2: 17, h3: 15, body: 13, meta: 10, lineHeight: 1.6 },
  default: { label: 'Default', shortLabel: 'M', title: 26, h2: 19, h3: 16.5, body: 15, meta: 11, lineHeight: 1.7 },
  large: { label: 'Large', shortLabel: 'L', title: 30, h2: 21, h3: 18, body: 17, meta: 12, lineHeight: 1.75 },
  xlarge: { label: 'Extra Large', shortLabel: 'XL', title: 34, h2: 24, h3: 20, body: 19, meta: 13, lineHeight: 1.8 }
};

export const NOTES_FONT_SIZE_ORDER: NotesFontSize[] = ['small', 'default', 'large', 'xlarge'];

export const NOTES_FONT_SIZE_STORAGE_KEY = 'aral_notes_font_size';
export const NOTES_HIGHLIGHT_MODE_STORAGE_KEY = 'aral_notes_highlight_mode';

export function isNotesFontSize(value: unknown): value is NotesFontSize {
  return typeof value === 'string' && value in NOTES_FONT_SIZES;
}

export function getNotesTypeScale(size: NotesFontSize): NotesTypeScale {
  return NOTES_FONT_SIZES[size] ?? NOTES_FONT_SIZES.default;
}

export function notesScaleVars(scale: NotesTypeScale): CSSProperties {
  return {
    '--notes-title': `${scale.title}px`,
    '--notes-h2': `${scale.h2}px`,
    '--notes-h3': `${scale.h3}px`,
    '--notes-body': `${scale.body}px`,
    '--notes-meta': `${scale.meta}px`,
    '--notes-line-height': `${scale.lineHeight}`
  } as CSSProperties;
}
