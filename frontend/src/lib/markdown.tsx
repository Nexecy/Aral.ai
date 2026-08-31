import React from 'react';

/**
 * Minimal markdown-to-React renderer for the document reader.
 *
 * Deliberately dependency-free: the app ships as a static export bundled for
 * Capacitor and Tauri, so a full markdown pipeline is more weight than the
 * headings / lists / emphasis / code subset actually present in study material.
 */

type InlineToken = { text: string; bold?: boolean; italic?: boolean; code?: boolean };

const INLINE_PATTERN = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;

function tokenizeInline(line: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const pattern = new RegExp(INLINE_PATTERN.source, 'g');
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) tokens.push({ text: line.slice(lastIndex, match.index) });

    const raw = match[0];
    if (raw.startsWith('**') || raw.startsWith('__')) {
      tokens.push({ text: raw.slice(2, -2), bold: true });
    } else if (raw.startsWith('`')) {
      tokens.push({ text: raw.slice(1, -1), code: true });
    } else {
      tokens.push({ text: raw.slice(1, -1), italic: true });
    }
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < line.length) tokens.push({ text: line.slice(lastIndex) });
  return tokens;
}

function renderInline(line: string, keyPrefix: string): React.ReactNode[] {
  return tokenizeInline(line).map((token, i) => {
    const key = `${keyPrefix}-${i}`;
    if (token.code) {
      return (
        <code key={key} className="px-1.5 py-0.5 rounded bg-surface-container text-primary font-mono text-[0.9em]">
          {token.text}
        </code>
      );
    }
    if (token.bold) return <strong key={key} className="font-bold text-on-surface">{token.text}</strong>;
    if (token.italic) return <em key={key} className="italic">{token.text}</em>;
    return <React.Fragment key={key}>{token.text}</React.Fragment>;
  });
}

const HEADING_CLASSES: Record<number, string> = {
  1: 'text-3xl font-extrabold tracking-tight mt-8 mb-3',
  2: 'text-2xl font-bold tracking-tight mt-7 mb-3',
  3: 'text-xl font-bold mt-6 mb-2',
  4: 'text-lg font-bold mt-5 mb-2',
  5: 'text-base font-bold mt-4 mb-1.5',
  6: 'text-sm font-bold uppercase tracking-wider text-on-surface-variant mt-4 mb-1.5'
};

/**
 * Chat headings size themselves from the `--chat-*` variables published by the
 * reader-comfort setting, so raising the font size scales the whole hierarchy.
 */
const CHAT_HEADING_CLASSES: Record<number, string> = {
  1: 'font-extrabold tracking-tight pt-1',
  2: 'font-bold tracking-tight pt-1',
  3: 'font-bold pt-0.5',
  4: 'font-bold',
  5: 'font-bold uppercase tracking-wide',
  6: 'font-bold uppercase tracking-wider text-on-surface-variant'
};

const CHAT_HEADING_STYLES: Record<number, React.CSSProperties> = {
  1: { fontSize: 'var(--chat-h1)', lineHeight: 1.3 },
  2: { fontSize: 'var(--chat-h2)', lineHeight: 1.35 },
  3: { fontSize: 'var(--chat-h3)', lineHeight: 1.4 },
  4: { fontSize: 'var(--chat-h4)', lineHeight: 1.45 },
  5: { fontSize: 'var(--chat-meta)', lineHeight: 1.5 },
  6: { fontSize: 'var(--chat-meta)', lineHeight: 1.5 }
};

const CHAT_BODY_STYLE: React.CSSProperties = {
  fontSize: 'var(--chat-body)',
  lineHeight: 'var(--chat-line-height)'
};

const CHAT_CODE_STYLE: React.CSSProperties = { fontSize: 'var(--chat-code)' };

export function renderMarkdown(
  source: string,
  variant: 'document' | 'chat' = 'document'
): React.ReactNode[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  const isChat = variant === 'chat';

  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listOrdered = false;
  let codeLines: string[] = [];
  let inCodeFence = false;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const key = `p-${blocks.length}`;
    blocks.push(
      <p
        key={key}
        className={isChat ? 'text-on-surface/90' : 'leading-relaxed text-on-surface/90'}
        style={isChat ? CHAT_BODY_STYLE : undefined}
      >
        {renderInline(paragraph.join(' '), key)}
      </p>
    );
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    const key = `l-${blocks.length}`;
    const items = listItems.map((item, i) => (
      <li
        key={`${key}-${i}`}
        className={isChat ? 'text-on-surface/90 pl-1' : 'leading-relaxed text-on-surface/90 pl-1'}
        style={isChat ? CHAT_BODY_STYLE : undefined}
      >
        {renderInline(item, `${key}-${i}`)}
      </li>
    ));
    blocks.push(
      listOrdered
        ? <ol key={key} className={`list-decimal ${isChat ? 'pl-5 space-y-1' : 'pl-6 space-y-1.5'} marker:text-primary marker:font-bold`}>{items}</ol>
        : <ul key={key} className={`list-disc ${isChat ? 'pl-5 space-y-1' : 'pl-6 space-y-1.5'} marker:text-primary`}>{items}</ul>
    );
    listItems = [];
  };

  const flushCode = () => {
    if (codeLines.length === 0) return;
    const key = `c-${blocks.length}`;
    blocks.push(
      <pre
        key={key}
        className={`${isChat ? 'p-3 rounded-lg' : 'p-4 rounded-xl text-xs'} bg-surface-container border border-outline-variant overflow-x-auto font-mono leading-relaxed custom-scrollbar`}
        style={isChat ? CHAT_CODE_STYLE : undefined}
      >
        <code>{codeLines.join('\n')}</code>
      </pre>
    );
    codeLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trimStart().startsWith('```')) {
      if (inCodeFence) {
        flushCode();
        inCodeFence = false;
      } else {
        flushParagraph();
        flushList();
        inCodeFence = true;
      }
      continue;
    }

    if (inCodeFence) {
      codeLines.push(rawLine);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const key = `h-${blocks.length}`;
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;
      blocks.push(
        <Tag
          key={key}
          className={`${isChat ? CHAT_HEADING_CLASSES[level] : HEADING_CLASSES[level]} text-on-surface`}
          style={isChat ? CHAT_HEADING_STYLES[level] : undefined}
        >
          {renderInline(heading[2], key)}
        </Tag>
      );
      continue;
    }

    if (/^\s*([-*_])\s*\1\s*\1[\s-*_]*$/.test(line)) {
      flushParagraph();
      flushList();
      blocks.push(
        <hr key={`hr-${blocks.length}`} className={`${isChat ? 'my-2' : 'my-6'} border-outline-variant`} />
      );
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushParagraph();
      flushList();
      const key = `q-${blocks.length}`;
      blocks.push(
        <blockquote
          key={key}
          className="border-l-4 border-primary/50 pl-4 py-1 italic text-on-surface-variant"
          style={isChat ? CHAT_BODY_STYLE : undefined}
        >
          {renderInline(quote[1], key)}
        </blockquote>
      );
      continue;
    }

    const unordered = /^\s*[-*+]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (unordered || ordered) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      if (listItems.length > 0 && isOrdered !== listOrdered) flushList();
      listOrdered = isOrdered;
      listItems.push((unordered ? unordered[1] : ordered![1]));
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushCode();
  flushParagraph();
  flushList();

  return blocks;
}

interface MarkdownProps {
  source: string;
  variant?: 'document' | 'chat';
  className?: string;
}

/**
 * Memoised wrapper. Chat transcripts re-render on every streamed token, so
 * re-parsing every settled message each time is the dominant cost without this.
 */
export const Markdown = React.memo(function Markdown({
  source,
  variant = 'document',
  className
}: MarkdownProps) {
  const blocks = React.useMemo(() => renderMarkdown(source, variant), [source, variant]);
  const isChat = variant === 'chat';

  return (
    <div
      className={className ?? (isChat ? 'break-words' : 'space-y-4')}
      style={isChat ? { display: 'grid', gap: 'var(--chat-block-gap)' } : undefined}
    >
      {blocks}
    </div>
  );
});
