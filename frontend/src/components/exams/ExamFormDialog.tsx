'use client';

import React, { useEffect, useState } from 'react';
import { CalendarPlus, Loader2, Trash2, X } from 'lucide-react';
import { Document, Exam, ExamColor, ExamInput } from '@/lib/types';
import { EXAM_COLORS, EXAM_COLOR_ORDER, toDateKey } from '@/lib/examColors';
import { DocumentManagerModal } from '@/components/documents/DocumentManagerModal';
import { Portal } from '@/components/ui/Portal';

interface ExamFormDialogProps {
  open: boolean;
  /** Present when editing; absent when creating. */
  exam?: Exam | null;
  /** Pre-selects the date when opened from a calendar cell. */
  initialDate?: string | null;
  documents: Document[];
  onClose: () => void;
  onSubmit: (payload: ExamInput) => Promise<void>;
  onDelete?: (exam: Exam) => Promise<void>;
  onDocumentsChanged?: () => void;
}

export function ExamFormDialog({
  open,
  exam,
  initialDate,
  documents,
  onClose,
  onSubmit,
  onDelete,
  onDocumentsChanged
}: ExamFormDialogProps) {
  const [title, setTitle] = useState('');
  const [examDate, setExamDate] = useState('');
  const [color, setColor] = useState<ExamColor>('blue');
  const [documentId, setDocumentId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDocManager, setShowDocManager] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(exam?.title ?? '');
    setExamDate(exam?.exam_date?.slice(0, 10) ?? initialDate ?? toDateKey(new Date()));
    setColor((exam?.color as ExamColor) ?? 'blue');
    setDocumentId(exam?.document_id ?? '');
    setNotes(exam?.notes ?? '');
    setError(null);
    setSaving(false);
    setDeleting(false);
  }, [open, exam, initialDate]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Give the exam a title.');
      return;
    }
    if (!examDate) {
      setError('Pick an exam date.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        exam_date: examDate,
        color,
        document_id: documentId || null,
        notes: notes.trim() || null
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this exam.');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!exam || !onDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete(exam);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this exam.');
      setDeleting(false);
    }
  };

  const busy = saving || deleting;

  return (
    <Portal>
      <div
        className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-md p-4 animate-in fade-in"
        onClick={onClose}
      >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={exam ? 'Edit exam' : 'Add exam'}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl animate-in zoom-in-95"
      >
        <div className="flex items-center justify-between gap-3 p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <CalendarPlus className="w-4 h-4" />
            </div>
            <h2 className="text-base font-extrabold text-foreground">
              {exam ? 'Edit exam' : 'Add exam'}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-container transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="exam-title" className="text-xs font-bold text-foreground">
              Title
            </label>
            <input
              id="exam-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cognitive Neuroscience Final"
              autoFocus
              className="w-full text-sm bg-surface-container-low border border-border rounded-xl px-3.5 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="exam-date" className="text-xs font-bold text-foreground">
                Date
              </label>
              <input
                id="exam-date"
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full text-sm bg-surface-container-low border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="exam-document" className="text-xs font-bold text-foreground">
                  Linked subject <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowDocManager(true)}
                  className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                >
                  Manage files
                </button>
              </div>
              <select
                id="exam-document"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                className="w-full text-sm bg-surface-container-low border border-border rounded-xl px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
              >
                <option value="">No linked document</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.filename}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-bold text-foreground block">Colour</span>
            <div className="grid grid-cols-6 gap-2">
              {EXAM_COLOR_ORDER.map((option) => {
                const selected = color === option;
                const swatch = EXAM_COLORS[option];
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setColor(option)}
                    aria-label={swatch.label}
                    aria-pressed={selected}
                    title={swatch.label}
                    className={`h-9 w-full rounded-full ${swatch.dot} ring-2 ring-offset-2 ring-offset-card transition-all ${
                      selected ? 'ring-primary scale-105' : 'ring-transparent hover:ring-border'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="exam-notes" className="text-xs font-bold text-foreground">
              Notes <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="exam-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Chapters, room number, revision plan…"
              className="w-full text-sm bg-surface-container-low border border-border rounded-xl px-3.5 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-destructive font-medium bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            {exam && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="p-2.5 rounded-xl border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors disabled:opacity-50"
                aria-label="Delete exam"
                title="Delete exam"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-surface-container transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary-container transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{exam ? 'Save changes' : 'Add exam'}</span>
            </button>
          </div>
        </form>
      </div>
      </div>

      <DocumentManagerModal
        open={showDocManager}
        onClose={() => setShowDocManager(false)}
        onDocumentsChanged={() => {
          onDocumentsChanged?.();
        }}
      />
    </Portal>
  );
}
