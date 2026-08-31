'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flashcard } from '@/lib/types';

/** Above this many cards the strip renders only the visible window. */
export const NAVIGATOR_VIRTUALIZE_THRESHOLD = 20;

const ITEM_WIDTH = 34; // 30px chip + 4px gap
const OVERSCAN = 10;

interface FlashcardNavigatorProps {
  cards: Flashcard[];
  currentIndex: number;
  onJump: (index: number) => void;
}

/**
 * Jump-to-card strip for large decks. Horizontally windowed so a 500-card deck
 * mounts the same handful of chips as a 30-card one.
 */
export function FlashcardNavigator({ cards, currentIndex, onJump }: FlashcardNavigatorProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [range, setRange] = useState({ start: 0, end: cards.length });

  const virtualize = cards.length > NAVIGATOR_VIRTUALIZE_THRESHOLD;

  const recompute = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !virtualize) return;

    const first = Math.floor(el.scrollLeft / ITEM_WIDTH);
    const visible = Math.ceil(el.clientWidth / ITEM_WIDTH);
    setRange({
      start: Math.max(0, first - OVERSCAN),
      end: Math.min(cards.length, first + visible + OVERSCAN)
    });
  }, [virtualize, cards.length]);

  useEffect(() => {
    if (!virtualize) {
      setRange({ start: 0, end: cards.length });
      return;
    }

    const el = scrollRef.current;
    if (!el) return;

    let frame: number | null = null;
    const onScroll = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        recompute();
      });
    };

    recompute();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [virtualize, recompute, cards.length]);

  // Keep the active chip in view as the user moves through the deck.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const target = currentIndex * ITEM_WIDTH;
    if (target < el.scrollLeft || target > el.scrollLeft + el.clientWidth - ITEM_WIDTH) {
      el.scrollTo({ left: Math.max(0, target - el.clientWidth / 2), behavior: 'smooth' });
    }
  }, [currentIndex]);

  const visibleCards = useMemo(
    () =>
      (virtualize ? cards.slice(range.start, range.end) : cards).map((card, i) => ({
        card,
        index: (virtualize ? range.start : 0) + i
      })),
    [cards, virtualize, range.start, range.end]
  );

  if (cards.length < 2) return null;

  const padLeft = virtualize ? range.start * ITEM_WIDTH : 0;
  const padRight = virtualize ? Math.max(0, (cards.length - range.end) * ITEM_WIDTH) : 0;

  return (
    <div
      ref={scrollRef}
      role="tablist"
      aria-label="Jump to card"
      className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1"
    >
      {padLeft > 0 && <div style={{ width: padLeft }} className="shrink-0" aria-hidden />}

      {visibleCards.map(({ card, index }) => {
        const active = index === currentIndex;
        const mastered = card.rating === 'good' || card.rating === 'easy';

        return (
          <button
            key={card.id || index}
            role="tab"
            aria-selected={active}
            aria-label={`Card ${index + 1}`}
            onClick={() => onJump(index)}
            className={`shrink-0 w-[30px] h-7 rounded-md text-[10px] font-bold transition-colors ${
              active
                ? 'bg-primary text-on-primary'
                : mastered
                  ? 'bg-sticker-green/15 text-sticker-green hover:bg-sticker-green/25'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-highest'
            }`}
          >
            {index + 1}
          </button>
        );
      })}

      {padRight > 0 && <div style={{ width: padRight }} className="shrink-0" aria-hidden />}
    </div>
  );
}
