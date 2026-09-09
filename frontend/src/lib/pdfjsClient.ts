'use client';

import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';

const PDFJS_ASSETS = {
  cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/',
  useSystemFonts: true,
  verbosity: 0
} as const;

export const ZOOM_FIT = 100;
export const ZOOM_MIN = 50;

export function configurePdfWorker() {
  if (typeof window === 'undefined') return;
  if (pdfjsLib.GlobalWorkerOptions.workerSrc) return;
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.js`;
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
  }
}

function documentOptions(source: { url: string } | { data: Uint8Array }) {
  const isBlobUrl = 'url' in source && source.url.startsWith('blob:');
  return {
    ...source,
    ...PDFJS_ASSETS,
    disableRange: isBlobUrl,
    disableStream: isBlobUrl
  };
}

/** Open a PDF in the worker. Blob URLs are read directly — no main-thread copy. */
export function openPdfDocument(fileUrl: string): PDFDocumentLoadingTask {
  configurePdfWorker();
  return pdfjsLib.getDocument(documentOptions({ url: fileUrl }));
}

export function openPdfDocumentFromData(data: Uint8Array): PDFDocumentLoadingTask {
  configurePdfWorker();
  return pdfjsLib.getDocument(documentOptions({ data }));
}

export async function loadPdfDocument(fileUrl: string): Promise<{
  doc: PDFDocumentProxy;
  task: PDFDocumentLoadingTask;
}> {
  let task = openPdfDocument(fileUrl);
  try {
    const doc = await task.promise;
    return { doc, task };
  } catch {
    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch PDF bytes`);
    const buffer = await res.arrayBuffer();
    task = openPdfDocumentFromData(new Uint8Array(buffer));
    return { doc: await task.promise, task };
  }
}

/**
 * Scale that fits the whole page inside the viewer box (contain), like a
 * native PDF viewer's "Fit page" / "Fit to screen".
 */
export function scaleToFitPage(
  pageWidth: number,
  pageHeight: number,
  boxWidth: number,
  boxHeight: number
): number {
  if (pageWidth <= 0 || pageHeight <= 0) return 1;
  if (boxWidth <= 0 && boxHeight <= 0) return 1;
  if (boxHeight <= 0) return boxWidth / pageWidth;
  if (boxWidth <= 0) return boxHeight / pageHeight;
  return Math.min(boxWidth / pageWidth, boxHeight / pageHeight);
}

export function zoomLabel(zoomLevel: number): string {
  return zoomLevel === ZOOM_FIT ? 'Fit' : `${zoomLevel}%`;
}
