'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  History as HistoryIcon, 
  Search, 
  Layers, 
  Clock, 
  FileText, 
  ArrowRight, 
  Calendar, 
  Award, 
  Sparkles, 
  Filter,
  Trash2,
  AlertTriangle,
  Loader2,
  Pencil,
  Tag,
  Check,
  X
} from 'lucide-react';
import { Session } from '@/lib/types';
import { api } from '@/lib/api';
import { Portal } from '@/components/ui/Portal';

const QUICK_LABELS = [
  'Midterm Prep',
  'Finals Review',
  'Case Digest',
  'Chapter Summary',
  'Mock Exam',
  'Quick Recap',
  'Key Concepts'
];

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [sessionToRename, setSessionToRename] = useState<Session | null>(null);
  const [renameInput, setRenameInput] = useState<string>('');
  const [renaming, setRenaming] = useState<boolean>(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSessions() {
      try {
        setLoading(true);
        const data = await api.getSessions(searchQuery);
        setSessions(data);
      } catch (e) {
        console.error('Failed to load session history:', e);
      } finally {
        setLoading(false);
      }
    }
    loadSessions();
  }, [searchQuery]);

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;
    try {
      setDeleting(true);
      await api.deleteSession(sessionToDelete.id);
      setSessions((prev) => prev.filter((s) => s.id !== sessionToDelete.id));
      setSessionToDelete(null);
    } catch (e: any) {
      alert(`Failed to delete session: ${e.message || 'Unknown error'}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleRenameSession = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!sessionToRename || !renameInput.trim()) return;
    const trimmed = renameInput.trim();
    try {
      setRenaming(true);
      setRenameError(null);
      await api.updateSession(sessionToRename.id, { title: trimmed });
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionToRename.id ? { ...s, title: trimmed } : s))
      );
      setSessionToRename(null);
    } catch (err: any) {
      setRenameError(err?.message || 'Failed to update session title.');
    } finally {
      setRenaming(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-notion-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sticker-purple/15 text-sticker-purple flex items-center justify-center font-bold">
            <HistoryIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
              Study Session History
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review past snapshots, notes, active recall decks, and quiz scores
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by topic or document..."
            className="w-full text-xs bg-surface-container-low pl-9 pr-4 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Session Cards Grid */}
      {sessions.length === 0 ? (
        <div className="p-12 text-center bg-card border border-border rounded-2xl space-y-3 shadow-notion-soft">
          <HistoryIcon className="w-10 h-10 text-muted-foreground mx-auto" />
          <h3 className="font-bold text-foreground">No matching study sessions found</h3>
          <p className="text-xs text-muted-foreground">Try a different search query or upload a new PDF.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((sess) => (
            <div
              key={sess.id}
              className="p-5 rounded-2xl bg-card border border-border hover:border-primary/50 shadow-notion-soft hover:shadow-notion-elevated transition-all flex flex-col justify-between group space-y-4 relative"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wider">
                    Snapshot
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(sess.last_accessed_at).toLocaleDateString()}</span>
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSessionToRename(sess);
                        setRenameInput(sess.title);
                        setRenameError(null);
                      }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Customize session label or title"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSessionToDelete(sess);
                      }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Delete study session"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <Link href={`/session/${sess.id}/`}>
                  <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {sess.title}
                  </h3>
                </Link>

                {sess.document && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                    <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate">{sess.document.filename}</span>
                    <span className="shrink-0">({sess.document.page_count}p)</span>
                  </div>
                )}
              </div>

              <Link
                href={`/session/${sess.id}/`}
                className="pt-3 border-t border-border flex items-center justify-between text-xs font-semibold text-primary"
              >
                <span>Resume Session</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {sessionToDelete && (
        <Portal>
          <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[9999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-destructive/15 text-destructive flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-foreground">Delete Study Session?</h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Are you sure you want to delete <strong className="text-foreground">"{sessionToDelete.title}"</strong>?
                  This will permanently remove its extracted notes, flashcards, quiz attempts, and chat history. The original PDF document will be kept safe.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setSessionToDelete(null)}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-surface-container transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteSession}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  <span>{deleting ? 'Deleting...' : 'Delete Session'}</span>
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Customize Session Title / Label Modal */}
      {sessionToRename && (
        <Portal>
          <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[9999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
                  <Pencil className="w-5 h-5" />
                </div>
                <button
                  onClick={() => setSessionToRename(null)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <h3 className="text-lg font-bold text-foreground">Customize Session Label</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Rename this study session or assign a custom organizational label to easily identify it.
                </p>
              </div>

              <form onSubmit={handleRenameSession} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    Session Label / Title
                  </label>
                  <input
                    type="text"
                    value={renameInput}
                    onChange={(e) => setRenameInput(e.target.value)}
                    placeholder="e.g. ObliCon - Midterms Review"
                    autoFocus
                    maxLength={120}
                    className="w-full text-xs bg-surface-container-low px-3.5 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground font-medium"
                  />
                  {renameError && (
                    <p className="text-xs text-destructive mt-1.5 font-medium">{renameError}</p>
                  )}
                </div>

                {/* Quick organizational labels */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                    <Tag className="w-3 h-3 text-primary" />
                    Quick Label Suggestions:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_LABELS.map((label) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          const base = sessionToRename.document?.filename 
                            ? sessionToRename.document.filename.replace(/\.[^/.]+$/, '') 
                            : 'Study Session';
                          setRenameInput(`${base} · ${label}`);
                        }}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-border/80 bg-surface-container-low hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all text-muted-foreground"
                      >
                        +{label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSessionToRename(null)}
                    disabled={renaming}
                    className="flex-1 py-2.5 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-surface-container transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={renaming || !renameInput.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                  >
                    {renaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>{renaming ? 'Saving...' : 'Save Label'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
