'use client';

import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Grid,
  Minimize2,
  Minus,
  Plus,
  Search,
  X
} from 'lucide-react';

interface PdfFullscreenChromeProps {
  visible: boolean;
  filename: string;
  currentPage: number;
  totalPages: number;
  zoomLevel: number;
  showSearch: boolean;
  searchTerm: string;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onJumpPage: (page: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onOpenThumbnails: () => void;
  onToggleSearch: () => void;
  onSearchTerm: (value: string) => void;
  onExit: () => void;
  onChromeHover: (hovering: boolean) => void;
}

const chromeBtn =
  'w-10 h-10 rounded-full flex items-center justify-center text-white/85 hover:text-white hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors';

export function PdfFullscreenChrome({
  visible,
  filename,
  currentPage,
  totalPages,
  zoomLevel,
  showSearch,
  searchTerm,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onJumpPage,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onOpenThumbnails,
  onToggleSearch,
  onSearchTerm,
  onExit,
  onChromeHover,
}: PdfFullscreenChromeProps) {
  const [pageDraft, setPageDraft] = useState(String(currentPage));

  useEffect(() => {
    setPageDraft(String(currentPage));
  }, [currentPage]);

  const commitPage = () => {
    const parsed = parseInt(pageDraft, 10);
    if (Number.isNaN(parsed)) {
      setPageDraft(String(currentPage));
      return;
    }
    onJumpPage(Math.min(totalPages, Math.max(1, parsed)));
  };

  const visibility = visible
    ? 'opacity-100 pointer-events-auto'
    : 'opacity-0 pointer-events-none';

  return (
    <>
      <div
        data-pdf-chrome
        aria-hidden={!visible}
        className={`absolute top-0 inset-x-0 z-20 px-4 pt-4 pb-10 bg-gradient-to-b from-charcoal-dark/80 to-transparent transition-opacity duration-300 cursor-auto ${visibility}`}
        onMouseEnter={() => onChromeHover(true)}
        onMouseLeave={() => onChromeHover(false)}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white truncate max-w-[70%] drop-shadow-sm">
            {filename}
          </p>
          <p className="text-[11px] font-mono text-white/55 shrink-0">Esc to exit</p>
        </div>
      </div>

      {totalPages > 1 && (
        <>
          <button
            type="button"
            data-pdf-chrome
            onClick={onPrev}
            disabled={!canPrev}
            aria-label="Previous page"
            className={`absolute left-3 top-1/2 -translate-y-1/2 z-20 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-charcoal-dark/70 text-white hover:bg-charcoal-dark/90 disabled:opacity-0 border border-white/10 transition-opacity duration-300 ${visibility}`}
            onMouseEnter={() => onChromeHover(true)}
            onMouseLeave={() => onChromeHover(false)}
          >
            <ChevronLeft className="w-7 h-7 mx-auto" />
          </button>
          <button
            type="button"
            data-pdf-chrome
            onClick={onNext}
            disabled={!canNext}
            aria-label="Next page"
            className={`absolute right-3 top-1/2 -translate-y-1/2 z-20 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-charcoal-dark/70 text-white hover:bg-charcoal-dark/90 disabled:opacity-0 border border-white/10 transition-opacity duration-300 ${visibility}`}
            onMouseEnter={() => onChromeHover(true)}
            onMouseLeave={() => onChromeHover(false)}
          >
            <ChevronRight className="w-7 h-7 mx-auto" />
          </button>
        </>
      )}

      <div
        data-pdf-chrome
        aria-hidden={!visible}
        className={`absolute bottom-0 inset-x-0 z-20 flex justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10 bg-gradient-to-t from-charcoal-dark/80 to-transparent transition-opacity duration-300 ${visibility}`}
        onMouseEnter={() => onChromeHover(true)}
        onMouseLeave={() => onChromeHover(false)}
      >
        <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 px-2 py-1.5 rounded-full bg-charcoal-dark/90 border border-white/10 backdrop-blur-md max-w-full">
          {totalPages > 1 && (
            <div className="flex items-center gap-0.5 pr-1 sm:pr-2 border-r border-white/10">
              <button type="button" onClick={onPrev} disabled={!canPrev} className={chromeBtn} aria-label="Previous page">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  commitPage();
                }}
                className="flex items-center gap-1 px-1"
              >
                <input
                  aria-label="Page number"
                  inputMode="numeric"
                  value={pageDraft}
                  onChange={(e) => setPageDraft(e.target.value.replace(/[^\d]/g, ''))}
                  onBlur={commitPage}
                  className="w-8 sm:w-10 bg-white/10 rounded-md text-center text-xs font-mono font-bold text-white py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="text-xs font-mono text-white/50">/</span>
                <span className="text-xs font-mono text-white/80 min-w-[1.5rem]">{totalPages}</span>
              </form>
              <button type="button" onClick={onNext} disabled={!canNext} className={chromeBtn} aria-label="Next page">
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={onOpenThumbnails}
                className={chromeBtn}
                title="Page thumbnails"
                aria-label="Show page thumbnails"
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-0.5 px-1">
            <button type="button" onClick={onZoomOut} className={chromeBtn} aria-label="Zoom out">
              <Minus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onZoomReset}
              className="min-w-[3.25rem] h-10 px-2 rounded-full text-xs font-mono font-bold text-white/90 hover:bg-white/15"
              title="Fit to width"
            >
              {zoomLevel}%
            </button>
            <button type="button" onClick={onZoomIn} className={chromeBtn} aria-label="Zoom in">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-0.5 pl-1 sm:pl-2 border-l border-white/10">
            {showSearch ? (
              <div className="flex items-center gap-1.5 pl-3 pr-1">
                <Search className="w-3.5 h-3.5 text-white/55" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => onSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.stopPropagation();
                      onSearchTerm('');
                      onToggleSearch();
                    }
                  }}
                  placeholder="Find…"
                  className="w-28 sm:w-36 text-xs bg-transparent text-white placeholder:text-white/40 focus:outline-none"
                  autoFocus
                />
                <button type="button" onClick={onToggleSearch} className={chromeBtn} aria-label="Close find">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onToggleSearch}
                className={chromeBtn}
                title="Find in document"
                aria-label="Find in document"
              >
                <Search className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onExit}
              className={chromeBtn}
              title="Exit fullscreen (Esc)"
              aria-label="Exit fullscreen"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
