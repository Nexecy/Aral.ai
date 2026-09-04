'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  Grid,
  Loader2,
  Minus,
  Plus,
  X,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import { Portal } from '@/components/ui/Portal';

interface PageNavigatorPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: number;
  totalPages: number;
  onSelectPage: (page: number) => void;
  fileUrl?: string | null;
  isPdf: boolean;
  extractedPages?: string[];
  sessionTitle?: string;
}

function PdfPageThumbnailItem({
  pdfDoc,
  pageNumber,
  thumbWidth,
  isSelected,
  onClick
}: {
  pdfDoc: PDFDocumentProxy | null;
  pageNumber: number;
  thumbWidth: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rendered, setRendered] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number>(1.3);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;
    let renderTask: any = null;

    async function renderThumbnail() {
      try {
        const page = await pdfDoc!.getPage(pageNumber);
        if (cancelled) return;

        const unscaled = page.getViewport({ scale: 1.0 });
        const ratio = unscaled.height / unscaled.width;
        setAspectRatio(ratio);

        const targetWidth = Math.max(thumbWidth, 80);
        const scale = targetWidth / unscaled.width;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        renderTask = page.render({
          canvasContext: ctx,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined
        });

        await renderTask.promise;
        if (!cancelled) setRendered(true);
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          // ignore non-fatal thumbnail errors
        }
      }
    }

    void renderThumbnail();

    return () => {
      cancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          /* ignore */
        }
      }
    };
  }, [pdfDoc, pageNumber, thumbWidth]);

  const thumbHeight = Math.round(thumbWidth * (aspectRatio || 1.3));

  return (
    <button
      id={`page-thumb-${pageNumber}`}
      type="button"
      onClick={onClick}
      style={{ width: `${thumbWidth + 16}px` }}
      className={`group flex flex-col items-center p-2 rounded-2xl transition-all duration-150 text-left relative focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        isSelected
          ? 'bg-primary/10 ring-2 ring-primary shadow-sm'
          : 'hover:bg-surface-container bg-surface-container-lowest border border-outline-variant/60 hover:border-outline-variant hover:shadow-xs'
      }`}
    >
      <div
        className="rounded-lg overflow-hidden bg-white shadow-sm flex items-center justify-center relative border border-outline-variant/40 transition-all duration-150"
        style={{ width: `${thumbWidth}px`, height: `${thumbHeight}px` }}
      >
        {!rendered && (
          <div className="absolute inset-0 bg-surface-container flex flex-col items-center justify-center gap-1">
            <Loader2 className="w-4 h-4 animate-spin text-primary/60" />
            <span className="text-[10px] text-on-surface-variant font-mono">{pageNumber}</span>
          </div>
        )}
        <canvas ref={canvasRef} className="block w-full h-full object-contain" />
      </div>

      <div className="mt-2 flex items-center justify-between w-full px-1">
        <span className={`text-xs font-bold ${isSelected ? 'text-primary' : 'text-on-surface'}`}>
          Page {pageNumber}
        </span>
        {isSelected && (
          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-primary text-on-primary">
            Current
          </span>
        )}
      </div>
    </button>
  );
}

function TextPageThumbnailItem({
  pageNumber,
  content,
  thumbWidth,
  isSelected,
  onClick
}: {
  pageNumber: number;
  content?: string;
  thumbWidth: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const snippet = (content || '').slice(0, 250).trim();
  const thumbHeight = Math.round(thumbWidth * 1.35);

  return (
    <button
      id={`page-thumb-${pageNumber}`}
      type="button"
      onClick={onClick}
      style={{ width: `${thumbWidth + 16}px` }}
      className={`group flex flex-col items-center p-2 rounded-2xl transition-all duration-150 text-left relative focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        isSelected
          ? 'bg-primary/10 ring-2 ring-primary shadow-sm'
          : 'hover:bg-surface-container bg-surface-container-lowest border border-outline-variant/60 hover:border-outline-variant hover:shadow-xs'
      }`}
    >
      <div
        className="rounded-lg overflow-hidden bg-white p-3 shadow-sm flex flex-col border border-outline-variant/40 text-on-surface-variant leading-tight select-none transition-all duration-150"
        style={{
          width: `${thumbWidth}px`,
          height: `${thumbHeight}px`,
          fontSize: thumbWidth > 160 ? '11px' : '9px'
        }}
      >
        <div className="font-bold text-on-surface mb-1 flex items-center gap-1 border-b border-outline-variant/40 pb-1 shrink-0">
          <FileText className="w-3.5 h-3.5 text-primary" />
          <span>Page {pageNumber}</span>
        </div>
        <p className="line-clamp-8 opacity-75 overflow-hidden">{snippet || 'Empty page content…'}</p>
      </div>

      <div className="mt-2 flex items-center justify-between w-full px-1">
        <span className={`text-xs font-bold ${isSelected ? 'text-primary' : 'text-on-surface'}`}>
          Page {pageNumber}
        </span>
        {isSelected && (
          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-primary text-on-primary">
            Current
          </span>
        )}
      </div>
    </button>
  );
}

export function PageNavigatorPopover({
  isOpen,
  onClose,
  currentPage,
  totalPages,
  onSelectPage,
  fileUrl,
  isPdf,
  extractedPages
}: PageNavigatorPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [jumpInput, setJumpInput] = useState<string>(currentPage.toString());
  const [jumpError, setJumpError] = useState<string | null>(null);
  const [thumbZoom, setThumbZoom] = useState<number>(100);

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [loadingDoc, setLoadingDoc] = useState<boolean>(false);

  // Computed thumbnail width based on user zoom level
  const thumbWidth = Math.round(135 * (thumbZoom / 100));

  // Sync jump input with current page
  useEffect(() => {
    setJumpInput(currentPage.toString());
    setJumpError(null);
  }, [currentPage, isOpen]);

  // Load PDF document proxy once for thumbnail rendering
  useEffect(() => {
    if (!isOpen || !isPdf || !fileUrl) return;

    let cancelled = false;
    let loadingTask: any = null;

    async function loadPdf() {
      setLoadingDoc(true);
      try {
        let doc: PDFDocumentProxy;
        try {
          const res = await fetch(fileUrl!);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buffer = await res.arrayBuffer();
          if (cancelled) return;
          loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(buffer),
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
            cMapPacked: true,
            standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/'
          });
          doc = await loadingTask.promise;
        } catch {
          if (cancelled) return;
          loadingTask = pdfjsLib.getDocument({
            url: fileUrl!,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
            cMapPacked: true,
            standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/'
          });
          doc = await loadingTask.promise;
        }

        if (cancelled) return;
        setPdfDoc(doc);
        setLoadingDoc(false);
      } catch (err) {
        if (!cancelled) {
          console.error('Thumbnail PDF load error:', err);
          setLoadingDoc(false);
        }
      }
    }

    void loadPdf();

    return () => {
      cancelled = true;
      if (loadingTask) {
        try {
          loadingTask.destroy();
        } catch {
          /* ignore */
        }
      }
    };
  }, [isOpen, isPdf, fileUrl]);

  // Auto-scroll current page thumbnail into view when opened
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`page-thumb-${currentPage}`);
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [isOpen, currentPage]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(jumpInput, 10);
    if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
      setJumpError(`Enter 1–${totalPages}`);
      return;
    }
    onSelectPage(pageNum);
    onClose();
  };

  const handleSelect = (page: number) => {
    onSelectPage(page);
    onClose();
  };

  const pagesArray = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <Portal>
      <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[9999] flex items-center justify-center p-3 sm:p-6 bg-charcoal/50 backdrop-blur-md animate-in fade-in duration-150">
      <div
        ref={popoverRef}
        className="w-full max-w-lg md:max-w-3xl lg:max-w-4xl xl:max-w-5xl bg-surface-container-lowest border border-outline-variant rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-outline-variant bg-surface-container-lowest gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs">
              <Grid className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">Page Overview</h2>
              <p className="text-xs text-on-surface-variant font-medium">
                {totalPages} {totalPages === 1 ? 'Page' : 'Pages'} total • Jump to any page
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {/* Thumbnail Zoom In / Out Controls */}
            <div className="flex items-center gap-1 bg-surface-container rounded-full px-2 py-1 border border-outline-variant/60 shadow-xs">
              <button
                type="button"
                onClick={() => setThumbZoom((z) => Math.max(65, z - 15))}
                disabled={thumbZoom <= 65}
                className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Zoom out thumbnails"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setThumbZoom(100)}
                className="font-mono text-xs font-bold text-on-surface w-10 text-center hover:text-primary transition-colors"
                title="Reset thumbnail zoom (100%)"
              >
                {thumbZoom}%
              </button>
              <button
                type="button"
                onClick={() => setThumbZoom((z) => Math.min(180, z + 15))}
                disabled={thumbZoom >= 180}
                className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Zoom in thumbnails"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
              title="Close page preview (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Jump Bar */}
        <div className="px-5 sm:px-7 py-3 border-b border-outline-variant/60 bg-surface-container-low flex flex-wrap items-center justify-between gap-3">
          <form onSubmit={handleJumpSubmit} className="flex items-center gap-2">
            <span className="text-xs font-semibold text-on-surface-variant">Go to page:</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpInput}
                onChange={(e) => {
                  setJumpInput(e.target.value);
                  setJumpError(null);
                }}
                className="w-16 px-2.5 py-1 text-xs font-mono font-bold text-center rounded-lg bg-surface-container border border-outline-variant text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
              <span className="text-xs font-mono text-on-surface-variant">/ {totalPages}</span>
              <button
                type="submit"
                className="px-3 py-1 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary-container flex items-center gap-1 transition-all shadow-xs"
              >
                <span>Go</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            {jumpError && (
              <span className="text-[11px] text-destructive font-semibold">{jumpError}</span>
            )}
          </form>

          {/* Quick Step Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleSelect(1)}
              disabled={currentPage === 1}
              className="px-2.5 py-1 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs font-semibold flex items-center gap-1 border border-outline-variant/50"
              title="First page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
              <span>First</span>
            </button>
            <button
              onClick={() => handleSelect(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-outline-variant/50"
              title="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleSelect(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-outline-variant/50"
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleSelect(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs font-semibold flex items-center gap-1 border border-outline-variant/50"
              title="Last page"
            >
              <span>Last</span>
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Thumbnails Flow Grid */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 sm:p-7 custom-scrollbar bg-surface-container-low max-h-[64vh]"
        >
          {loadingDoc && !pdfDoc && isPdf && (
            <div className="py-16 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <span className="text-xs text-on-surface-variant font-semibold">Generating page thumbnails…</span>
            </div>
          )}

          <div className="flex flex-wrap gap-4 sm:gap-5 justify-center sm:justify-start items-start">
            {pagesArray.map((pageNum) => {
              if (isPdf) {
                return (
                  <PdfPageThumbnailItem
                    key={pageNum}
                    pdfDoc={pdfDoc}
                    pageNumber={pageNum}
                    thumbWidth={thumbWidth}
                    isSelected={pageNum === currentPage}
                    onClick={() => handleSelect(pageNum)}
                  />
                );
              } else {
                const chunk = extractedPages?.[pageNum - 1] || '';
                return (
                  <TextPageThumbnailItem
                    key={pageNum}
                    pageNumber={pageNum}
                    content={chunk}
                    thumbWidth={thumbWidth}
                    isSelected={pageNum === currentPage}
                    onClick={() => handleSelect(pageNum)}
                  />
                );
              }
            })}
          </div>
        </div>
      </div>
      </div>
    </Portal>
  );
}
