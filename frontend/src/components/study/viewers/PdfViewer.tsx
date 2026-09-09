'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { Loader2, AlertCircle } from 'lucide-react';
import { loadPdfDocument, scaleToFitPage, ZOOM_FIT } from '@/lib/pdfjsClient';

export interface PdfViewerProps {
  /** Source URL or Object URL of the PDF blob */
  fileUrl: string;
  /** Document or session title for accessibility and aria labels */
  title: string;
  /** Current 1-indexed page */
  currentPage: number;
  /** Callback fired when PDF metadata and page count are loaded */
  onTotalPagesLoaded?: (totalPages: number) => void;
  /** Share the parsed document so thumbnails do not parse it again. */
  onDocumentLoaded?: (doc: PDFDocumentProxy) => void;
  /** Callback to update parent page index */
  onPageChange?: (page: number) => void;
  /** Zoom percentage. 100 = fit the whole page in the visible viewer. */
  zoomLevel?: number;
  /** Search term to highlight if available */
  searchTerm?: string;
  /** Optional container ref to register text selection actions */
  selectionContainerRef?: React.RefObject<HTMLDivElement>;
  /** Darker stage and tighter padding when the parent is in reader fullscreen. */
  immersive?: boolean;
  /** Double-click a page (without a text selection) to toggle fullscreen. */
  onToggleFullscreen?: () => void;
}

const MAX_CANVAS_EDGE = 4096;

export function PdfViewer({
  fileUrl,
  title,
  currentPage,
  onTotalPagesLoaded,
  onDocumentLoaded,
  onPageChange,
  zoomLevel = ZOOM_FIT,
  searchTerm = '',
  selectionContainerRef,
  immersive = false,
  onToggleFullscreen
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [rendering, setRendering] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const renderTaskRef = useRef<RenderTask | null>(null);
  const renderGenRef = useRef(0);
  const onTotalPagesLoadedRef = useRef(onTotalPagesLoaded);
  const onDocumentLoadedRef = useRef(onDocumentLoaded);
  onTotalPagesLoadedRef.current = onTotalPagesLoaded;
  onDocumentLoadedRef.current = onDocumentLoaded;

  const attachContainer = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    if (selectionContainerRef && 'current' in selectionContainerRef) {
      (selectionContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }
  }, [selectionContainerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId: number | null = null;

    const applySize = (width: number, height: number) => {
      if (width <= 0 && height <= 0) return;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setContainerSize((prev) => {
          if (Math.abs(prev.width - width) <= 1 && Math.abs(prev.height - height) <= 1) {
            return prev;
          }
          return { width, height };
        });
      });
    };

    const measure = () => {
      const el = containerRef.current;
      if (!el) return;
      applySize(el.clientWidth, el.clientHeight);
    };

    measure();

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = entry.contentRect?.width || container.clientWidth;
      const height = entry.contentRect?.height || container.clientHeight;
      applySize(width, height);
    });

    observer.observe(container);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);

    return () => {
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [loading, error]);

  useEffect(() => {
    if (!fileUrl) return;

    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    let published = false;
    setLoading(true);
    setError(null);
    setPdfDoc(null);

    async function loadDocument() {
      try {
        const loaded = await loadPdfDocument(fileUrl);
        loadingTask = loaded.task;
        if (cancelled) {
          try {
            loaded.task.destroy();
          } catch {
            /* ignore */
          }
          return;
        }

        setPdfDoc(loaded.doc);
        setTotalPages(loaded.doc.numPages);
        onTotalPagesLoadedRef.current?.(loaded.doc.numPages);
        onDocumentLoadedRef.current?.(loaded.doc);
        published = true;
        setLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        console.error('PDF load error:', err);
        setError(err.message || 'Failed to load PDF document.');
        setLoading(false);
      }
    }

    void loadDocument();

    return () => {
      cancelled = true;
      if (loadingTask && !(published && onDocumentLoadedRef.current)) {
        try {
          loadingTask.destroy();
        } catch {
          /* ignore */
        }
      }
    };
  }, [fileUrl]);

  const renderCurrentPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    const boxWidth =
      containerSize.width > 0
        ? containerSize.width
        : containerRef.current?.clientWidth || 0;
    const boxHeight =
      containerSize.height > 0
        ? containerSize.height
        : containerRef.current?.clientHeight || 0;

    if (boxWidth <= 0) return;

    const pageNumber = Math.min(Math.max(currentPage, 1), pdfDoc.numPages || 1);
    const gen = ++renderGenRef.current;

    try {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          /* ignore */
        }
        renderTaskRef.current = null;
      }

      setRendering(true);

      const page = await pdfDoc.getPage(pageNumber);
      if (gen !== renderGenRef.current) return;

      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const gutter = immersive ? 16 : 24;
      const availableWidth = Math.max(boxWidth - gutter, 80);
      const availableHeight = Math.max((boxHeight || unscaledViewport.height) - gutter, 80);

      const fitScale = scaleToFitPage(
        unscaledViewport.width,
        unscaledViewport.height,
        availableWidth,
        availableHeight
      );
      const zoomMultiplier = Math.max(0.2, (zoomLevel || ZOOM_FIT) / 100);
      const effectiveScale = fitScale * zoomMultiplier;
      const displayViewport = page.getViewport({ scale: effectiveScale });

      const canvas = canvasRef.current;
      if (!canvas || gen !== renderGenRef.current) return;

      const displayW = Math.max(1, Math.floor(displayViewport.width));
      const displayH = Math.max(1, Math.floor(displayViewport.height));
      const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
      const outputScale = Math.min(
        dpr,
        MAX_CANVAS_EDGE / displayW,
        MAX_CANVAS_EDGE / displayH
      );

      canvas.width = Math.floor(displayW * outputScale);
      canvas.height = Math.floor(displayH * outputScale);
      canvas.style.width = `${displayW}px`;
      canvas.style.height = `${displayH}px`;

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const renderTask = page.render({
        canvasContext: ctx,
        viewport: displayViewport,
        transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
        intent: 'display'
      });
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      if (gen !== renderGenRef.current) return;

      setRendering(false);

      const textLayerEl = textLayerRef.current;
      if (textLayerEl) {
        textLayerEl.innerHTML = '';
        textLayerEl.style.width = `${displayW}px`;
        textLayerEl.style.height = `${displayH}px`;

        try {
          const textContent = await page.getTextContent();
          if (gen !== renderGenRef.current || !pdfjsLib.renderTextLayer) return;
          const task = pdfjsLib.renderTextLayer({
            textContentSource: textContent,
            container: textLayerEl,
            viewport: displayViewport,
            textDivs: []
          });
          if (task?.promise) await task.promise;
        } catch {
          /* text layer rendering is non-fatal */
        }
      }

      const neighbor = pageNumber + 1;
      if (neighbor <= pdfDoc.numPages) void pdfDoc.getPage(neighbor);
      if (pageNumber > 1) void pdfDoc.getPage(pageNumber - 1);
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('PDF Page render error:', err);
      }
      if (gen === renderGenRef.current) setRendering(false);
    }
  }, [pdfDoc, currentPage, containerSize.width, containerSize.height, zoomLevel, immersive]);

  useEffect(() => {
    void renderCurrentPage();
  }, [renderCurrentPage]);

  useEffect(() => {
    if (rendering) return;
    const layer = textLayerRef.current;
    if (!layer) return;
    const term = searchTerm.trim().toLowerCase();
    layer.querySelectorAll('span').forEach((span) => {
      const el = span as HTMLElement;
      if (term && el.textContent?.toLowerCase().includes(term)) {
        el.style.backgroundColor = 'rgba(0, 107, 74, 0.28)';
      } else {
        el.style.backgroundColor = '';
      }
    });
  }, [searchTerm, rendering, currentPage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      if (currentPage < totalPages) {
        e.preventDefault();
        onPageChange?.(currentPage + 1);
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      if (currentPage > 1) {
        e.preventDefault();
        onPageChange?.(currentPage - 1);
      }
    }
  };

  const handleStageDoubleClick = () => {
    if (!onToggleFullscreen) return;
    const selected = typeof window !== 'undefined' ? window.getSelection()?.toString() : '';
    if (selected?.trim()) return;
    onToggleFullscreen();
  };

  return (
    <div
      ref={attachContainer}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`flex-1 w-full h-full min-h-0 overflow-auto custom-scrollbar outline-none select-text ${
        immersive
          ? 'bg-charcoal-dark focus:ring-0'
          : 'bg-surface-container-low focus:ring-1 focus:ring-primary/20'
      }`}
      aria-label={`PDF Viewer: ${title}`}
    >
      {loading && (
        <div className={`flex flex-col items-center justify-center gap-3 p-12 text-center min-h-full ${
          immersive ? 'bg-charcoal-dark' : 'bg-surface-container-low'
        }`}>
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className={`text-xs font-semibold animate-pulse ${
            immersive ? 'text-white/60' : 'text-on-surface-variant'
          }`}>
            Loading PDF document…
          </p>
        </div>
      )}

      {!loading && error && (
        <div className={`flex flex-col items-center justify-center gap-3 p-8 text-center min-h-full ${
          immersive ? 'bg-charcoal-dark' : 'bg-surface-container-low'
        }`}>
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-on-surface">Failed to load PDF</p>
          <p className="text-xs text-on-surface-variant max-w-sm">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="min-h-full w-full flex items-center justify-center">
          <div
            className={`relative flex flex-col items-center ${
              immersive ? 'm-2 sm:m-3' : 'm-3 sm:m-4'
            }`}
            onDoubleClick={handleStageDoubleClick}
          >
            <canvas
              ref={canvasRef}
              className={`bg-white block ${
                immersive
                  ? 'shadow-2xl rounded-sm'
                  : 'shadow-notebook-card rounded-xl border border-outline-variant/60'
              }`}
            />

            <div
              ref={textLayerRef}
              className={`textLayer absolute inset-0 pointer-events-auto select-text overflow-hidden ${
                immersive ? 'rounded-sm' : 'rounded-xl'
              }`}
              style={{ transformOrigin: 'top left' }}
            />

            {rendering && (
              <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-charcoal/70 backdrop-blur-md text-white text-[10px] font-mono flex items-center gap-1.5 pointer-events-none animate-in fade-in">
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                <span>Rendering</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
