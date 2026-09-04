'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  ExternalLink,
  FileText,
  Loader2,
  Sparkles,
  X
} from 'lucide-react';
import { Document } from '@/lib/types';
import { api } from '@/lib/api';
import { useEmailGate } from '@/context/AuthContext';
import { formatFileSize } from '@/lib/fileTypes';
import { DocumentViewer } from '@/components/study/DocumentViewer';
import { Portal } from '@/components/ui/Portal';

interface DocumentPreviewModalProps {
  document: Document | null;
  open: boolean;
  onClose: () => void;
}

export function DocumentPreviewModal({
  document,
  open,
  onClose
}: DocumentPreviewModalProps) {
  const router = useRouter();
  const { allowed: aiAllowed } = useEmailGate();
  const [startingSession, setStartingSession] = useState(false);

  if (!open || !document) return null;

  const handleStartSession = async () => {
    setStartingSession(true);
    try {
      const title = document.filename.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      const session = await api.createSession(title, document.id);
      if (aiAllowed) {
        void api.generateNotes(session.id).catch(() => {});
      }
      onClose();
      router.push(`/session/${session.id}/`);
    } catch (err) {
      console.error('Failed to create session:', err);
      setStartingSession(false);
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-3 sm:p-6 animate-in fade-in"
        onClick={onClose}
      >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Preview ${document.filename}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-container-lowest gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-foreground truncate max-w-sm sm:max-w-md">
                {document.filename}
              </h2>
              <p className="text-xs text-muted-foreground font-medium">
                {document.page_count} {document.page_count === 1 ? 'page' : 'pages'} • {formatFileSize(document.file_size_bytes)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleStartSession}
              disabled={startingSession}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-bold hover:bg-primary-container transition-all shadow-sm disabled:opacity-60"
            >
              {startingSession ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>{startingSession ? 'Opening...' : 'Study Document'}</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-container transition-colors"
              title="Close preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewer */}
        <div className="flex-1 overflow-hidden min-h-[420px] max-h-[75vh]">
          <DocumentViewer
            document={document}
            sessionTitle={document.filename}
            height={620}
          />
        </div>
      </div>
    </div>
  </Portal>
);
}
