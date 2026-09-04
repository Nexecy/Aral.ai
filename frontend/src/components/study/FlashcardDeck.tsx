'use client';

import React, { useState, useEffect } from 'react';
import { 
  RotateCw, 
  ChevronLeft, 
  ChevronRight, 
  Shuffle, 
  Plus, 
  CheckCircle, 
  XCircle, 
  Sparkles, 
  Loader2,
  HelpCircle,
  Layers,
  Award
} from 'lucide-react';
import { Flashcard } from '@/lib/types';
import { sound } from '@/lib/sound';
import { api } from '@/lib/api';
import { FlashcardNavigator } from '@/components/study/FlashcardNavigator';
import { useEmailGate } from '@/context/AuthContext';
import { Portal } from '@/components/ui/Portal';

/** A card composer request routed in from the viewer's selection menu. */
export interface FlashcardPrefill {
  /** Nonce so repeating the same excerpt still opens the composer. */
  id: number;
  front: string;
}

interface FlashcardDeckProps {
  sessionId: string;
  initialFlashcards: Flashcard[];
  onCardsUpdated?: (cards: Flashcard[]) => void;
  /** Fired on each confidence rating so the workspace can tally reviews. */
  onCardReviewed?: (cardId: string, rating: string) => void;
  prefill?: FlashcardPrefill | null;
  onClearPrefill?: () => void;
  /** Deck keyboard shortcuts only bind while the deck view is on screen. */
  active?: boolean;
}

export function FlashcardDeck({
  sessionId,
  initialFlashcards,
  onCardsUpdated,
  onCardReviewed,
  prefill,
  onClearPrefill,
  active = true
}: FlashcardDeckProps) {
  const { allowed: aiAllowed, message: aiLockMessage } = useEmailGate();
  const [cards, setCards] = useState<Flashcard[]>(initialFlashcards || []);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [knownCardIds, setKnownCardIds] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newFront, setNewFront] = useState<string>('');
  const [newBack, setNewBack] = useState<string>('');

  useEffect(() => {
    if (!prefill) return;
    setNewFront(prefill.front);
    setShowAddModal(true);
    onClearPrefill?.();
  }, [prefill?.id]);

  // Keyboard navigation — scoped to the visible deck so it never competes with
  // the workspace-level shortcuts while the deck is mounted but hidden.
  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (showAddModal || cards.length === 0) return;

      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        flipCard();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextCard();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevCard();
      } else if (e.key === '1') {
        handleConfidenceRating('again');
      } else if (e.key === '2') {
        handleConfidenceRating('hard');
      } else if (e.key === '3') {
        handleConfidenceRating('good');
      } else if (e.key === '4') {
        handleConfidenceRating('easy');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, currentIndex, isFlipped, cards, showAddModal]);

  // Esc dismisses the composer.
  useEffect(() => {
    if (!showAddModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setShowAddModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showAddModal]);

  const flipCard = () => {
    sound.playCardFlip();
    setIsFlipped(!isFlipped);
  };

  const nextCard = () => {
    if (currentIndex < cards.length - 1) {
      setIsFlipped(false);
      setCurrentIndex(currentIndex + 1);
    }
  };

  const prevCard = () => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setCurrentIndex(currentIndex - 1);
    }
  };

  const shuffleDeck = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const handleConfidenceRating = async (rating: 'again' | 'hard' | 'good' | 'easy') => {
    if (cards.length === 0) return;
    const currentCard = cards[currentIndex];
    
    // Update mastery tracking
    const updatedKnown = new Set(knownCardIds);
    if (rating === 'good' || rating === 'easy') {
      updatedKnown.add(currentCard.id);
    } else {
      updatedKnown.delete(currentCard.id);
    }
    setKnownCardIds(updatedKnown);

    onCardReviewed?.(currentCard.id, rating);

    // Call backend spaced repetition API
    try {
      await api.reviewFlashcard(sessionId, currentCard.id, rating);
    } catch (e) {
      // offline / local fallback
    }

    if (currentIndex < cards.length - 1) {
      nextCard();
    }
  };

  const markMastery = (isMastered: boolean) => {
    handleConfidenceRating(isMastered ? 'good' : 'again');
  };

  const handleGenerate = async (count = 8) => {
    if (!aiAllowed) {
      alert(aiLockMessage);
      return;
    }
    setGenerating(true);
    try {
      const generated = await api.generateFlashcards(sessionId, count);
      setCards(generated);
      setCurrentIndex(0);
      setIsFlipped(false);
      setKnownCardIds(new Set());
      if (onCardsUpdated) onCardsUpdated(generated);
    } catch (e: any) {
      alert(`Generation failed: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleAddManualCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFront.trim() || !newBack.trim()) return;

    try {
      const card = await api.createFlashcard(sessionId, newFront.trim(), newBack.trim());
      const updated = [...cards, card];
      setCards(updated);
      setNewFront('');
      setNewBack('');
      setShowAddModal(false);
      if (onCardsUpdated) onCardsUpdated(updated);
    } catch (err: any) {
      alert(`Error creating card: ${err.message}`);
    }
  };

  const currentCard = cards[currentIndex];
  const progressPercent = cards.length > 0 ? ((currentIndex + 1) / cards.length) * 100 : 0;
  const masteredCount = knownCardIds.size;

  return (
    <div className="space-y-6">
      {/* Top Deck Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border shadow-notion-soft">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sticker-pink/15 text-sticker-pink flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <span>Flashcard Active Recall Deck</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono">
                {cards.length} Cards
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Master concepts with spaced retrieval. Space to flip, Arrow keys to navigate.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={shuffleDeck}
            disabled={cards.length === 0}
            className="px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted font-semibold text-xs flex items-center gap-1.5 transition-all"
            title="Shuffle Deck"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>Shuffle</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted font-semibold text-xs flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Card</span>
          </button>

          <button
            onClick={() => handleGenerate(8)}
            disabled={generating || !aiAllowed}
            title={!aiAllowed ? aiLockMessage : undefined}
            className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1.5 hover:bg-primary-active transition-all disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>{generating ? 'Synthesizing...' : 'Regenerate Deck'}</span>
          </button>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="p-12 text-center bg-card border border-border rounded-2xl space-y-4 shadow-notion-soft">
          <div className="w-14 h-14 rounded-2xl bg-muted mx-auto flex items-center justify-center text-muted-foreground">
            <Layers className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-foreground">No Flashcards in this Deck</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Generate an active recall deck from your reviewed notes or create cards manually.
            </p>
          </div>
          <button
            onClick={() => handleGenerate(8)}
            disabled={generating || !aiAllowed}
            title={!aiAllowed ? aiLockMessage : undefined}
            className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground font-bold text-sm inline-flex items-center gap-2 hover:bg-primary-active transition-all disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate Flashcards</span>
          </button>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Progress and Stats Bar */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <div className="font-semibold text-foreground">
              Card {currentIndex + 1} of {cards.length}
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-sticker-green font-medium">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>{masteredCount} Mastered</span>
              </span>
              <span className="flex items-center gap-1 text-sticker-orange font-medium">
                <RotateCw className="w-3.5 h-3.5" />
                <span>{cards.length - masteredCount} Learning</span>
              </span>
            </div>
          </div>

          <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* 3D Flip Card Container */}
          <div
            onClick={flipCard}
            className="perspective-1000 w-full h-80 sm:h-96 cursor-pointer select-none"
          >
            <div
              className={`relative w-full h-full duration-500 transform-style-3d transition-transform ${
                isFlipped ? 'rotate-y-180' : ''
              }`}
            >
              {/* Front Side (Prompt / Term) */}
              <div className="absolute inset-0 w-full h-full backface-hidden bg-card border-2 border-border rounded-2xl p-8 flex flex-col justify-between shadow-notion-elevated hover:border-primary/40 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2.5 py-1 rounded-full bg-muted">
                    Prompt / Question
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <RotateCw className="w-3.5 h-3.5 text-primary" />
                    <span>Click or press Space to reveal</span>
                  </span>
                </div>

                <div className="my-auto text-center px-4">
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-snug">
                    {currentCard?.front}
                  </h3>
                </div>

                <div className="text-center text-xs text-muted-foreground font-medium">
                  Active Recall Stage
                </div>
              </div>

              {/* Back Side (Answer / Explanation) */}
              <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 bg-surface-container-low border-2 border-primary/40 rounded-2xl p-8 flex flex-col justify-between shadow-notion-elevated">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary px-2.5 py-1 rounded-full bg-primary/10">
                    Explanation & Answer
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Press Space to flip back
                  </span>
                </div>

                <div className="my-auto text-center px-4">
                  <p className="text-lg sm:text-xl font-medium text-foreground/95 leading-relaxed">
                    {currentCard?.back}
                  </p>
                </div>

                <div className="text-center text-xs text-primary font-semibold">
                  Conceptual Anchor
                </div>
              </div>
            </div>
          </div>

          {/* Navigation and Rating Buttons */}
          <div className="flex items-center justify-between gap-4 pt-2">
            <button
              onClick={prevCard}
              disabled={currentIndex === 0}
              className="p-3 rounded-full border border-border bg-card text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
              title="Previous card (Left Arrow)"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <button
                onClick={() => handleConfidenceRating('again')}
                className="px-3 sm:px-4 py-2 rounded-xl bg-destructive/10 border border-destructive/25 text-destructive font-semibold text-xs flex items-center gap-1.5 hover:bg-destructive/20 transition-all"
                title="Press '1' on keyboard"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Again (1)</span>
              </button>

              <button
                onClick={() => handleConfidenceRating('hard')}
                className="px-3 sm:px-4 py-2 rounded-xl bg-sticker-orange/10 border border-sticker-orange/25 text-sticker-orange font-semibold text-xs flex items-center gap-1.5 hover:bg-sticker-orange/20 transition-all"
                title="Press '2' on keyboard"
              >
                <span>Hard (2)</span>
              </button>

              <button
                onClick={() => handleConfidenceRating('good')}
                className="px-3 sm:px-4 py-2 rounded-xl bg-sticker-sky/10 border border-sticker-sky/25 text-sticker-sky font-semibold text-xs flex items-center gap-1.5 hover:bg-sticker-sky/20 transition-all"
                title="Press '3' on keyboard"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Good (3)</span>
              </button>

              <button
                onClick={() => handleConfidenceRating('easy')}
                className="px-3 sm:px-4 py-2 rounded-xl bg-sticker-green/10 border border-sticker-green/25 text-sticker-green font-semibold text-xs flex items-center gap-1.5 hover:bg-sticker-green/20 transition-all"
                title="Press '4' on keyboard"
              >
                <Award className="w-3.5 h-3.5" />
                <span>Easy (4)</span>
              </button>
            </div>

            <button
              onClick={nextCard}
              disabled={currentIndex === cards.length - 1}
              className="p-3 rounded-full border border-border bg-card text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
              title="Next card (Right Arrow)"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <FlashcardNavigator
            cards={cards}
            currentIndex={currentIndex}
            onJump={(index) => {
              setCurrentIndex(index);
              setIsFlipped(false);
            }}
          />
        </div>
      )}

      {/* Manual Add Card Modal */}
      {showAddModal && (
        <Portal>
          <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen bg-black/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-notion-elevated space-y-4">
              <h3 className="text-lg font-bold text-foreground">Add Custom Flashcard</h3>
              <form onSubmit={handleAddManualCard} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Front (Prompt / Question)</label>
                  <input
                    type="text"
                    required
                    value={newFront}
                    onChange={(e) => setNewFront(e.target.value)}
                    placeholder="e.g. What is Long-Term Potentiation?"
                    className="w-full text-sm bg-muted/40 p-2.5 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Back (Answer / Explanation)</label>
                  <textarea
                    required
                    rows={3}
                    value={newBack}
                    onChange={(e) => setNewBack(e.target.value)}
                    placeholder="e.g. The persistent strengthening of synapses following high-frequency activation..."
                    className="w-full text-sm bg-muted/40 p-2.5 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary-active"
                  >
                    Save Flashcard
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
