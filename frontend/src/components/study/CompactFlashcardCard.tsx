'use client';

import React, { useState } from 'react';
import {
  Layers,
  RotateCw,
  Play
} from 'lucide-react';
import { Flashcard } from '@/lib/types';
import { sound } from '@/lib/sound';

interface CompactFlashcardCardProps {
  flashcards: Flashcard[];
  onOpenDeck: () => void;
  onQuickGenerate: () => void;
}

export function CompactFlashcardCard({
  flashcards,
  onOpenDeck,
  onQuickGenerate
}: CompactFlashcardCardProps) {
  const [flipped, setFlipped] = useState<boolean>(false);
  const sampleCard = flashcards.length > 0 ? flashcards[0] : null;

  const handleFlip = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!sampleCard) return;
    try { sound.playCardFlip(); } catch (err) {}
    setFlipped(!flipped);
  };

  const cardCount = flashcards.length;

  return (
    <div 
      onClick={onOpenDeck}
      className="bg-surface-container-lowest rounded-3xl p-5 sm:p-6 border border-outline-variant hover:border-outline transition-colors flex flex-col cursor-pointer group shadow-notebook-subtle justify-between"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface-container text-on-surface flex items-center justify-center border border-outline-variant shrink-0">
            <Layers className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-headline-sm text-sm sm:text-base text-on-surface leading-tight font-bold">
              Flashcards
            </h3>
            <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">
              Active Recall Deck
            </p>
          </div>
        </div>

        <span className="bg-surface-container text-on-surface px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-outline-variant font-mono">
          {cardCount} Cards
        </span>
      </div>

      {/* Interactive Question Card */}
      <div
        onClick={handleFlip}
        className="flex-1 bg-surface-container-low rounded-xl p-4 sm:p-5 flex flex-col justify-between text-left relative overflow-hidden mb-4 group-hover:bg-surface-container transition-colors border border-outline-variant/50 min-h-[130px] select-none"
      >
        <div className="flex items-center justify-between text-[9px] font-mono uppercase text-on-surface-variant tracking-wider font-bold">
          <span>{sampleCard ? (flipped ? 'Definition / Answer' : 'Prompt / Question') : 'Empty Deck'}</span>
          {sampleCard && <RotateCw className="w-3 h-3 text-primary group-hover:rotate-180 transition-transform duration-300" />}
        </div>

        <p className="text-xs font-semibold text-on-surface leading-relaxed my-2 line-clamp-3">
          {sampleCard
            ? (flipped ? sampleCard.back : sampleCard.front)
            : 'No flashcards yet. Generate a deck from your reviewed notes to start active recall.'}
        </p>

        <span className="text-primary text-[11px] font-semibold flex items-center gap-1">
          {sampleCard
            ? (flipped ? 'Click to show question' : 'Click to flip answer')
            : 'Open the deck to generate cards'}
        </span>
      </div>

      {/* Action Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (sampleCard) onOpenDeck();
          else onQuickGenerate();
        }}
        className="w-full py-2.5 sm:py-3 rounded-xl bg-surface-container text-on-surface font-semibold text-xs sm:text-sm hover:bg-primary hover:text-on-primary transition-colors flex items-center justify-center gap-2 border border-outline-variant shadow-sm"
      >
        <Play className="w-3.5 h-3.5 fill-current" />
        <span>{sampleCard ? 'Practice Deck' : 'Generate Deck'}</span>
      </button>
    </div>
  );
}
