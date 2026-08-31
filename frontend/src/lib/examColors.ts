import { ExamColor } from '@/lib/types';

/** Semantic accent classes per exam colour, so both themes stay legible. */
export const EXAM_COLORS: Record<ExamColor, { label: string; dot: string; text: string; tint: string; border: string }> = {
  blue:   { label: 'Blue',   dot: 'bg-sticker-sky',    text: 'text-sticker-sky',    tint: 'bg-sticker-sky/15',    border: 'border-sticker-sky/30' },
  purple: { label: 'Purple', dot: 'bg-sticker-purple', text: 'text-sticker-purple', tint: 'bg-sticker-purple/15', border: 'border-sticker-purple/30' },
  pink:   { label: 'Pink',   dot: 'bg-sticker-pink',   text: 'text-sticker-pink',   tint: 'bg-sticker-pink/15',   border: 'border-sticker-pink/30' },
  orange: { label: 'Orange', dot: 'bg-sticker-orange', text: 'text-sticker-orange', tint: 'bg-sticker-orange/15', border: 'border-sticker-orange/30' },
  teal:   { label: 'Teal',   dot: 'bg-sticker-teal',   text: 'text-sticker-teal',   tint: 'bg-sticker-teal/15',   border: 'border-sticker-teal/30' },
  green:  { label: 'Green',  dot: 'bg-sticker-green',  text: 'text-sticker-green',  tint: 'bg-sticker-green/15',  border: 'border-sticker-green/30' }
};

export const EXAM_COLOR_ORDER: ExamColor[] = ['blue', 'purple', 'pink', 'orange', 'teal', 'green'];

export function examColor(color: ExamColor | string | null | undefined) {
  return EXAM_COLORS[(color as ExamColor) in EXAM_COLORS ? (color as ExamColor) : 'blue'];
}

/** `YYYY-MM-DD` for a local date, avoiding the UTC shift `toISOString()` causes. */
export function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Parses a `YYYY-MM-DD` key as a local date rather than UTC midnight. */
export function fromDateKey(key: string): Date {
  const [year, month, day] = key.slice(0, 10).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function formatExamDate(key: string): string {
  return fromDateKey(key).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export function formatCountdown(daysRemaining: number): string {
  if (daysRemaining === 0) return 'Today';
  if (daysRemaining === 1) return 'Tomorrow';
  if (daysRemaining > 0) return `${daysRemaining} days left`;
  if (daysRemaining === -1) return 'Yesterday';
  return `${Math.abs(daysRemaining)} days ago`;
}
