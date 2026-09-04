'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import { Document } from '@/lib/types';
import { api } from '@/lib/api';
import { formatFileSize } from '@/lib/fileTypes';

import { Portal } from '@/components/ui/Portal';

interface DocumentDeleteDialogProps {
  document: Document | null;
  open: boolean;
  onClose: () => void;
  onDeleted: (documentId: string) => void;
}

export function DocumentDeleteDialog({
  document,
  open,
  onClose,
  onDeleted
}: DocumentDeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setDeleting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  if (!open || !document) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      await api.deleteDocument(document.id);
      onDeleted(document.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete document.');
      setDeleting(false);
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-md p-4 animate-in fade-in"
        onClick={onClose}
      >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Delete Document"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95"
      >
        <div className="flex items-center justify-between p-5 border-b border-border bg-surface-container-lowest">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-foreground">Delete Document</h2>
              <p className="text-xs text-muted-foreground">Permanent removal from library</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-container transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          {/* Alert Banner */}
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-900/60">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-slate-900 dark:text-slate-100 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-red-950 dark:text-red-200">{document.filename}</span>? This action cannot be undone.
            </p>
          </div>

          {/* Metadata Card */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 text-xs sm:text-sm space-y-2">
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500 dark:text-slate-400 font-normal">File name</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[240px]" title={document.filename}>
                {document.filename}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500 dark:text-slate-400 font-normal">Pages</span>
              <span className="font-semibold font-mono text-slate-900 dark:text-slate-100">
                {document.page_count}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500 dark:text-slate-400 font-normal">Size</span>
              <span className="font-semibold font-mono text-slate-900 dark:text-slate-100">
                {formatFileSize(document.file_size_bytes)}
              </span>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}

          {/* Right-aligned Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs sm:text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{deleting ? 'Deleting...' : 'Delete File'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Portal>
);
}
