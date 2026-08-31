'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Maximize,
  Minus,
  Move,
  Plus,
  RotateCcw,
  RotateCw
} from 'lucide-react';

interface ImageViewerProps {
  src: string;
  alt: string;
}

const MIN_ZOOM = 25;
const MAX_ZOOM = 500;
const ZOOM_STEP = 25;

interface Offset { x: number; y: number; }

/** Interactive image canvas with zoom, drag-to-pan, and 90° rotation. */
export function ImageViewer({ src, alt }: ImageViewerProps) {
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [loadFailed, setLoadFailed] = useState<boolean>(false);

  const panStart = useRef<Offset>({ x: 0, y: 0 });
  const offsetStart = useRef<Offset>({ x: 0, y: 0 });

  const reset = useCallback(() => {
    setZoom(100);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    reset();
    setLoadFailed(false);
  }, [src, reset]);

  const zoomBy = useCallback((delta: number) => {
    setZoom((prev) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
  }, []);

  const rotateBy = useCallback((delta: number) => {
    setRotation((prev) => (prev + delta + 360) % 360);
  }, []);

  useEffect(() => {
    if (!isPanning) return;

    const onMove = (e: MouseEvent) => {
      setOffset({
        x: offsetStart.current.x + (e.clientX - panStart.current.x),
        y: offsetStart.current.y + (e.clientY - panStart.current.y)
      });
    };
    const onUp = () => setIsPanning(false);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isPanning]);

  const handleWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
  };

  if (loadFailed) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-container-low p-8 text-center">
        <div className="space-y-2">
          <p className="text-sm font-bold text-on-surface">Preview unavailable</p>
          <p className="text-xs text-on-surface-variant max-w-xs">
            The image could not be loaded. Switch to the Text Layer to read the extracted content.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-surface-container-low overflow-hidden relative">
      {/* Image canvas */}
      <div
        onWheel={handleWheel}
        onMouseDown={(e) => {
          e.preventDefault();
          panStart.current = { x: e.clientX, y: e.clientY };
          offsetStart.current = offset;
          setIsPanning(true);
        }}
        onDoubleClick={reset}
        className={`flex-1 flex items-center justify-center overflow-hidden select-none ${
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          onError={() => setLoadFailed(true)}
          className="max-w-none shadow-notebook-card rounded-lg bg-surface-container-lowest"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom / 100}) rotate(${rotation}deg)`,
            transition: isPanning ? 'none' : 'transform 180ms ease-out',
            maxHeight: '100%'
          }}
        />
      </div>

      {/* Floating control dock */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1.5 rounded-full bg-charcoal/90 backdrop-blur-md text-white shadow-2xl border border-white/10">
        <button
          onClick={() => zoomBy(-ZOOM_STEP)}
          disabled={zoom <= MIN_ZOOM}
          title="Zoom out"
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/15 disabled:opacity-30 transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={reset}
          title="Reset zoom, pan, and rotation (or double-click the image)"
          className="px-2 min-w-[52px] text-center font-mono text-xs font-bold hover:text-primary transition-colors"
        >
          {zoom}%
        </button>

        <button
          onClick={() => zoomBy(ZOOM_STEP)}
          disabled={zoom >= MAX_ZOOM}
          title="Zoom in"
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/15 disabled:opacity-30 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        <span className="w-px h-5 bg-white/15 mx-0.5" />

        <button
          onClick={() => rotateBy(-90)}
          title="Rotate counter-clockwise"
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/15 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => rotateBy(90)}
          title="Rotate clockwise"
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/15 transition-colors"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        <span className="w-px h-5 bg-white/15 mx-0.5" />

        <button
          onClick={reset}
          title="Fit to view"
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/15 transition-colors"
        >
          <Maximize className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Interaction hint */}
      <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-charcoal/70 backdrop-blur-md text-white/80 text-[10px] font-semibold pointer-events-none">
        <Move className="w-3 h-3" />
        <span>Drag to pan • Ctrl + scroll to zoom</span>
      </div>
    </div>
  );
}
