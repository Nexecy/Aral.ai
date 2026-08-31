/**
 * Reader-comfort settings for the AI tutor transcript.
 *
 * Every size is expressed as a full scale (font size, line height, and the
 * secondary/code sizes derived from it) so bubbles keep their proportions
 * instead of just growing the body text.
 */

export type ChatFontSize = 'small' | 'default' | 'large' | 'xlarge';

export interface ChatTypeScale {
  label: string;
  shortLabel: string;
  /** Body copy size in px. */
  body: number;
  lineHeight: number;
  /** Timestamps, the streaming caption, and other supporting text. */
  meta: number;
  code: number;
  /** Vertical rhythm between markdown blocks, in px. */
  blockGap: number;
}

export const CHAT_FONT_SIZES: Record<ChatFontSize, ChatTypeScale> = {
  small: { label: 'Small', shortLabel: 'S', body: 13, lineHeight: 1.6, meta: 10, code: 11.5, blockGap: 8 },
  default: { label: 'Default', shortLabel: 'M', body: 15, lineHeight: 1.65, meta: 11, code: 13, blockGap: 10 },
  large: { label: 'Large', shortLabel: 'L', body: 17, lineHeight: 1.7, meta: 12, code: 14.5, blockGap: 12 },
  xlarge: { label: 'Extra Large', shortLabel: 'XL', body: 19, lineHeight: 1.75, meta: 13, code: 16, blockGap: 14 }
};

export const CHAT_FONT_SIZE_ORDER: ChatFontSize[] = ['small', 'default', 'large', 'xlarge'];

export const CHAT_FONT_SIZE_STORAGE_KEY = 'aral_chat_font_size';

export function isChatFontSize(value: unknown): value is ChatFontSize {
  return typeof value === 'string' && value in CHAT_FONT_SIZES;
}

export function getChatTypeScale(size: ChatFontSize): ChatTypeScale {
  return CHAT_FONT_SIZES[size] ?? CHAT_FONT_SIZES.default;
}

/**
 * CSS custom properties consumed by the markdown renderer's `chat` variant.
 * Headings are derived from the body size so the hierarchy scales with it.
 */
export function chatScaleVars(scale: ChatTypeScale): React.CSSProperties {
  return {
    '--chat-body': `${scale.body}px`,
    '--chat-line-height': `${scale.lineHeight}`,
    '--chat-meta': `${scale.meta}px`,
    '--chat-code': `${scale.code}px`,
    '--chat-block-gap': `${scale.blockGap}px`,
    '--chat-h1': `${(scale.body * 1.35).toFixed(2)}px`,
    '--chat-h2': `${(scale.body * 1.2).toFixed(2)}px`,
    '--chat-h3': `${(scale.body * 1.08).toFixed(2)}px`,
    '--chat-h4': `${scale.body}px`
  } as React.CSSProperties;
}
