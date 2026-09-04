'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { Loader2, AlertCircle } from 'lucide-react';

// Configure PDF.js worker to use local public worker with origin fallback
if (typeof window !== 'undefined' && 'GlobalWorkerOptions' in pdfjsLib) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.js`;
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
  }
}

export interface PdfViewerProps {
  /** Source URL or Object URL of the PDF blob */
  fileUrl: string;
  /** Document or session title for accessibility and aria labels */
  title: string;
  /** Current 1-indexed page */
  currentPage: number;
  /** Callback fired when PDF metadata and page count are loaded */
  onTotalPagesLoaded?: (totalPages: number) => void;
  /** Callback to update parent page index */
  onPageChange?: (page: number) => void;
  /** Zoom percentage multiplier (100 = 1.0x fit-to-width) */
  zoomLevel?: number;
  /** Search term to highlight if available */
  searchTerm?: string;
  /** Optional container ref to register text selection actions */
  selectionContainerRef?: React.RefObject<HTMLDivElement>;
}

export function PdfViewer({
  fileUrl,
  title,
  currentPage,
  onTotalPagesLoaded,
  onPageChange,
  zoomLevel = 100,
  searchTerm = '',
  selectionContainerRef
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [rendering, setRendering] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Live container width measured via ResizeObserver
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // In-flight task reference
  const renderTaskRef = useRef<RenderTask | null>(null);

  // ── 1. ResizeObserver to track container live width ──────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId: number | null = null;

    const measure = () => {
      const el = containerRef.current;
      if (!el) return;
      const width = el.clientWidth || el.getBoundingClientRect().width;
      if (width > 0) {
        if (rafId !== null) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          setContainerWidth((prev) => (Math.abs(prev - width) > 1 ? width : prev));
        });
      }
    };

    measure();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect?.width || container.clientWidth || container.getBoundingClientRect().width;
        if (width > 0) {
          if (rafId !== null) cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => {
            setContainerWidth((prev) => (Math.abs(prev - width) > 1 ? width : prev));
          });
        }
      }
    });

    observer.observe(container);

    const onWindowResize = () => measure();
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('orientationchange', onWindowResize);

    return () => {
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('orientationchange', onWindowResize);
    };
  }, []);

  // ── 2. Load PDF Document via ArrayBuffer / URL fallback ─────────────────────
  useEffect(() => {
    if (!fileUrl) return;

    let cancelled = false;
    let loadingTask: any = null;
    setLoading(true);
    setError(null);

    async function loadDocument() {
      try {
        let doc: PDFDocumentProxy;
        try {
          // Fetch raw bytes on main thread to avoid worker CORS/blob limitations
          const res = await fetch(fileUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch PDF bytes`);
          const buffer = await res.arrayBuffer();
          if (cancelled) return;

          const data = new Uint8Array(buffer);

          loadingTask = pdfjsLib.getDocument({
            data,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
            cMapPacked: true,
            standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/'
          });
          doc = await loadingTask.promise;
        } catch {
          if (cancelled) return;
          loadingTask = pdfjsLib.getDocument({
            url: fileUrl,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
            cMapPacked: true,
            standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/'
          });
          doc = await loadingTask.promise;
        }

        if (cancelled) return;

        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        onTotalPagesLoaded?.(doc.numPages);
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
      if (loadingTask) {
        try {
          loadingTask.destroy();
        } catch {
          /* ignore */
        }
      }
    };
  }, [fileUrl, onTotalPagesLoaded]);

  // ── 3. Render Current Page at Live Fit-To-Width Scale * Zoom Multiplier ───────
  const renderCurrentPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    const currentWidth =
      containerWidth > 0
        ? containerWidth
        : containerRef.current?.clientWidth ||
          containerRef.current?.getBoundingClientRect().width ||
          600;

    if (currentWidth <= 0) return;

    const pageNumber = Math.min(Math.max(currentPage, 1), pdfDoc.numPages || 1);

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

      // Unscaled viewport (scale = 1.0)
      const unscaledViewport = page.getViewport({ scale: 1.0 });

      // Compute available width inside container with responsive padding
      const horizontalPadding = currentWidth < 640 ? 16 : currentWidth < 1024 ? 32 : 48;
      const availableWidth = Math.max(currentWidth - horizontalPadding, 120);

      // Fit-to-width base scale
      const baseScale = availableWidth / unscaledViewport.width;

      // User zoom multiplier on top of the fit-to-width scale
      const zoomMultiplier = Math.max(0.2, (zoomLevel || 100) / 100);
      const effectiveScale = baseScale * zoomMultiplier;

      // Display viewport for CSS element dimensions
      const displayViewport = page.getViewport({ scale: effectiveScale });

      // High-DPI render viewport for crisp Retina canvas
      const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2.5);

      const canvas = canvasRef.current;
      if (!canvas) return;

      const displayW = Math.floor(displayViewport.width);
      const displayH = Math.floor(displayViewport.height);

      canvas.width = Math.floor(displayW * dpr);
      canvas.height = Math.floor(displayH * dpr);
      canvas.style.width = `${displayW}px`;
      canvas.style.height = `${displayH}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Fill white background before rendering to guarantee opaque page behind text/images
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const renderContext = {
        canvasContext: ctx,
        viewport: displayViewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;

      await renderTask.promise;

      // Render Text Layer for text selection & tutor interaction
      const textLayerEl = textLayerRef.current;
      if (textLayerEl) {
        textLayerEl.innerHTML = '';
        textLayerEl.style.width = `${displayW}px`;
        textLayerEl.style.height = `${displayH}px`;

        try {
          const textContent = await page.getTextContent();
          if (pdfjsLib.renderTextLayer) {
            const task = pdfjsLib.renderTextLayer({
              textContentSource: textContent,
              container: textLayerEl,
              viewport: displayViewport,
              textDivs: []
            });
            if (task?.promise) await task.promise;
          }
        } catch {
          /* text layer rendering is non-fatal */
        }
      }

      setRendering(false);
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('PDF Page render error:', err);
      }
      setRendering(false);
    }
  }, [pdfDoc, currentPage, containerWidth, zoomLevel]);

  useEffect(() => {
    void renderCurrentPage();
  }, [renderCurrentPage]);

  // Handle keyboard page navigation when canvas is focused
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

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-12 text-center bg-surface-container-low min-h-[360px]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-xs font-semibold text-on-surface-variant animate-pulse">
          Loading PDF document…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center bg-surface-container-low min-h-[360px]">
        <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <p className="text-sm font-bold text-on-surface">Failed to load PDF</p>
        <p className="text-xs text-on-surface-variant max-w-sm">{error}</p>
      </div>
    );
  }

  return (
    <div
      ref={(node) => {
        containerRef.current = node;
        if (selectionContainerRef && 'current' in selectionContainerRef) {
          (selectionContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="flex-1 w-full h-full min-h-0 bg-surface-container-low overflow-auto custom-scrollbar flex flex-col items-center p-3 sm:p-5 outline-none focus:ring-1 focus:ring-primary/20 select-text"
      aria-label={`PDF Viewer: ${title}`}
    >
      {/* Page Stage */}
      <div className="relative mx-auto flex flex-col items-center justify-start my-2 sm:my-3">
        {/* PDF Canvas */}
        <canvas
          ref={canvasRef}
          className="shadow-notebook-card rounded-xl bg-white block transition-shadow duration-200 border border-outline-variant/60"
        />

        {/* Transparent Text Layer for Selection & Highlights */}
        <div
          ref={textLayerRef}
          className="textLayer absolute inset-0 pointer-events-auto select-text rounded-xl overflow-hidden"
          style={{ transformOrigin: 'top left' }}
        />

        {/* Subtle page rendering overlay */}
        {rendering && (
          <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-charcoal/70 backdrop-blur-md text-white text-[10px] font-mono flex items-center gap-1.5 pointer-events-none animate-in fade-in">
            <Loader2 className="w-3 h-3 animate-spin text-primary" />
            <span>Rendering</span>
          </div>
        )}
      </div>
    </div>
  );
}
