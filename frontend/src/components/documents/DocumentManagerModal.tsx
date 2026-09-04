'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { FileText, Loader2, Plus, X } from 'lucide-react';
import { Document, Session } from '@/lib/types';
import { api } from '@/lib/api';
import { DocumentLibrary } from './DocumentLibrary';
import { DocumentUploader } from '@/components/study/DocumentUploader';
import { Portal } from '@/components/ui/Portal';

interface DocumentManagerModalProps {
  open: boolean;
  onClose: () => void;
  onSelectDocument?: (doc: Document) => void;
  onDocumentsChanged?: () => void;
}

export function DocumentManagerModal({
  open,
  onClose,
  onSelectDocument,
  onDocumentsChanged
}: DocumentManagerModalProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showUpload, setShowUpload] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [docs, sess] = await Promise.all([
        api.getDocuments(),
        api.getSessions()
      ]);
      setDocuments(docs);
      setSessions(sess);
    } catch (err) {
      console.error('Failed to load documents in manager:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadData();
      setShowUpload(false);
    }
  }, [open, loadData]);

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

  if (!open) return null;

  return (
    <Portal>
      <div
        className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-3 sm:p-6 animate-in fade-in"
        onClick={onClose}
      >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Manage Uploaded Documents"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-container-lowest gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-foreground">Uploaded Documents</h2>
              <p className="text-xs text-muted-foreground">
                Check, preview, rename, and delete your study reference files
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUpload(!showUpload)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all ${
                showUpload
                  ? 'bg-surface-container text-foreground'
                  : 'bg-primary text-on-primary hover:bg-primary-container shadow-xs'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>{showUpload ? 'View Library' : 'Upload New'}</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-container transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar bg-surface-container-low">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-xs font-semibold text-muted-foreground">Loading documents…</p>
            </div>
          ) : showUpload ? (
            <div className="max-w-xl mx-auto py-4">
              <DocumentUploader />
            </div>
          ) : (
            <DocumentLibrary
              documents={documents}
              sessions={sessions}
              onDocumentUpdated={(updated) => {
                setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
                onDocumentsChanged?.();
              }}
              onDocumentDeleted={(deletedId) => {
                setDocuments((prev) => prev.filter((d) => d.id !== deletedId));
                onDocumentsChanged?.();
              }}
            />
          )}
        </div>
      </div>
    </div>
  </Portal>
);
}
