'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Check, Copy, User as UserIcon } from 'lucide-react';
import { ChatMessage } from '@/lib/types';
import { Markdown } from '@/lib/markdown';

/** Above this many messages, only a window around the viewport is mounted. */
export const VIRTUALIZE_THRESHOLD = 20;

/** Messages rendered outside the visible window on each side. */
const OVERSCAN = 8;

interface ChatBubbleProps {
  message: ChatMessage;
  copied: boolean;
  onCopy: (text: string, id: string) => void;
}

/**
 * Memoised so a streaming token or a resize only re-renders the live bubble,
 * never the whole settled transcript.
 */
const ChatBubble = React.memo(function ChatBubble({ message, copied, onCopy }: ChatBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-start gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="w-3.5 h-3.5" />
        </div>
      )}

      <div
        className={`max-w-[85%] rounded-2xl p-3.5 relative group ${
          isUser
            ? 'bg-primary text-on-primary font-medium rounded-tr-xs shadow-sm'
            : 'bg-surface-container-low text-on-surface border border-outline-variant/60 rounded-tl-xs shadow-notebook-subtle'
        }`}
      >
        {isUser ? (
          <div
            className="whitespace-pre-wrap break-words"
            style={{ fontSize: 'var(--chat-body)', lineHeight: 'var(--chat-line-height)' }}
          >
            {message.content}
          </div>
        ) : (
          <Markdown source={message.content} variant="chat" />
        )}

        <div
          className={`flex items-center justify-between pt-1.5 ${
            isUser ? 'text-on-primary/70' : 'text-on-surface-variant'
          }`}
          style={{ fontSize: 'var(--chat-meta)' }}
        >
          <span>
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
          {!isUser && (
            <button
              onClick={() => onCopy(message.content, message.id)}
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-on-surface transition-opacity"
              title="Copy message"
              aria-label="Copy message"
            >
              {copied ? (
                <Check className="w-3 h-3 text-primary" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          )}
        </div>
      </div>

      {isUser && (
        <div className="w-6 h-6 rounded-lg bg-surface-container text-on-surface-variant flex items-center justify-center shrink-0 mt-0.5">
          <UserIcon className="w-3.5 h-3.5" />
        </div>
      )}
    </div>
  );
});

interface ChatMessageListProps {
  messages: ChatMessage[];
  scrollRef: React.RefObject<HTMLDivElement>;
  /** Rough per-message height used to size the virtual spacers. */
  estimatedItemHeight?: number;
  children?: React.ReactNode;
}

/**
 * Transcript renderer. Long histories switch to windowed rendering so the
 * message count stops driving DOM size.
 */
export function ChatMessageList({
  messages,
  scrollRef,
  estimatedItemHeight = 104,
  children
}: ChatMessageListProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [range, setRange] = useState({ start: 0, end: messages.length });

  const virtualize = messages.length > VIRTUALIZE_THRESHOLD;

  const handleCopy = useCallback((text: string, id: string) => {
    void navigator.clipboard?.writeText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 2000);
  }, []);

  const recomputeRange = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !virtualize) return;

    const first = Math.floor(el.scrollTop / estimatedItemHeight);
    const visible = Math.ceil(el.clientHeight / estimatedItemHeight);
    setRange({
      start: Math.max(0, first - OVERSCAN),
      end: Math.min(messages.length, first + visible + OVERSCAN)
    });
  }, [scrollRef, virtualize, estimatedItemHeight, messages.length]);

  useEffect(() => {
    if (!virtualize) {
      setRange({ start: 0, end: messages.length });
      return;
    }

    const el = scrollRef.current;
    if (!el) return;

    let frame: number | null = null;
    const onScroll = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        recomputeRange();
      });
    };

    recomputeRange();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [virtualize, recomputeRange, scrollRef, messages.length]);

  const visibleMessages = useMemo(
    () => (virtualize ? messages.slice(range.start, range.end) : messages),
    [messages, virtualize, range.start, range.end]
  );

  const padTop = virtualize ? range.start * estimatedItemHeight : 0;
  const padBottom = virtualize
    ? Math.max(0, (messages.length - range.end) * estimatedItemHeight)
    : 0;

  return (
    <>
      {padTop > 0 && <div style={{ height: padTop }} aria-hidden />}
      {visibleMessages.map((message, index) => (
        <ChatBubble
          key={message.id || `${range.start + index}`}
          message={message}
          copied={copiedId === message.id}
          onCopy={handleCopy}
        />
      ))}
      {padBottom > 0 && <div style={{ height: padBottom }} aria-hidden />}
      {children}
    </>
  );
}
