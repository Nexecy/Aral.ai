'use client';

import React, { useEffect, useState } from 'react';
import { FileText, Loader2, Pencil, X } from 'lucide-react';
import { Document } from '@/lib/types';
import { api } from '@/lib/api';
import { formatFileSize } from '@/lib/fileTypes';
import { Portal } from '@/components/ui/Portal';

interface DocumentEditDialogProps {
  document: Document | null;
  open: boolean;
  onClose: () => void;
  onUpdated: (updated: Document) => void;
}

export function DocumentEditDialog({
  document,
  open,
  onClose,
  onUpdated
}: DocumentEditDialogProps) {
  const [filename, setFilename] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (document) {
      setFilename(document.filename || '');
      setError(null);
      setSaving(false);
    }
  }, [document, open]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = filename.trim();
    if (!clean) {
      setError('Document name cannot be empty.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await api.updateDocument(document.id, { filename: clean });
      onUpdated(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update document name.');
      setSaving(false);
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
        aria-label="Edit Document"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95"
      >
        <div className="flex items-center justify-between p-5 border-b border-border bg-surface-container-lowest">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-foreground">Edit Document</h2>
              <p className="text-xs text-muted-foreground">Rename your uploaded study file</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-container transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="doc-filename" className="text-xs font-bold text-foreground">
              Document Name / Filename
            </label>
            <input
              id="doc-filename"
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="e.g. Chapter 4 - Neuroanatomy.pdf"
              className="w-full text-sm bg-surface-container-low border border-border rounded-xl px-3.5 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
              autoFocus
            />
          </div>

          <div className="p-3 rounded-xl bg-surface-container-low border border-border/60 text-xs text-muted-foreground space-y-1">
            <div className="flex items-center justify-between">
              <span>Original Size:</span>
              <span className="font-mono font-medium text-foreground">
                {formatFileSize(document.file_size_bytes)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Pages:</span>
              <span className="font-mono font-medium text-foreground">{document.page_count}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Uploaded:</span>
              <span className="font-medium text-foreground">
                {new Date(document.uploaded_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive font-medium bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-surface-container transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary-container transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </Portal>
);
}
