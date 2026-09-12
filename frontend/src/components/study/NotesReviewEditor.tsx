'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  Check, 
  Edit3, 
  Plus, 
  Trash2, 
  Save, 
  Sparkles, 
  Tag, 
  BookOpen, 
  Loader2,
  Layers,
  RotateCw,
  Scale,
  Gavel,
  Copy,
  ShieldAlert,
  ListOrdered,
  X
} from 'lucide-react';
import { Notes, NoteContent, NoteMark, NotesHighlightColor, NotesHighlightMode, NotesMarkKind, LegalCase, LegalDoctrine } from '@/lib/types';
import { api } from '@/lib/api';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';
import { useNotesFieldSelection } from '@/hooks/useNotesFieldSelection';
import { NotesAnnotatedText } from '@/components/study/NotesAnnotatedText';
import { NotesDocumentToolbar } from '@/components/study/NotesDocumentToolbar';
import { NotesSelectionMenu } from '@/components/study/NotesSelectionMenu';
import {
  NOTES_CUSTOM_PX_STORAGE_KEY,
  NOTES_FONT_SIZE_STORAGE_KEY,
  NOTES_HIGHLIGHT_MODE_STORAGE_KEY,
  NotesFontSize,
  clampNotesCustomPx,
  getNotesTypeScale,
  isNotesFontSize,
  notesScaleVars
} from '@/lib/notesPreferences';
import {
  clearMarksInRange,
  isCredibleGlossaryTerm,
  isNotesHighlightMode,
  makeMark,
  normalizeNoteContent,
  upsertMark
} from '@/lib/notesPresentation';

interface NotesReviewEditorProps {
  sessionId: string;
  initialNotes: Notes | null;
  generating?: boolean;
  onConfirmReview: (reviewedNotes: Notes) => void;
  onRegenerateNotes?: () => void;
}

export function NotesReviewEditor({
  sessionId,
  initialNotes,
  generating = false,
  onConfirmReview,
  onRegenerateNotes
}: NotesReviewEditorProps) {
  const [content, setContent] = useState<NoteContent>(() => normalizeNoteContent(initialNotes?.content));
  
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'cases' | 'doctrines' | 'sections'>('all');
  const [copiedCaseId, setCopiedCaseId] = useState<string | null>(null);
  const [highlightColor, setHighlightColor] = useState<NotesHighlightColor>('yellow');
  const [fontSize, setFontSize] = useLocalStorageState<NotesFontSize>(
    NOTES_FONT_SIZE_STORAGE_KEY,
    'default',
    (raw) => (isNotesFontSize(raw) ? raw : null)
  );
  const [customPx, setCustomPx] = useLocalStorageState<number>(
    NOTES_CUSTOM_PX_STORAGE_KEY,
    16,
    (raw) => clampNotesCustomPx(raw)
  );
  const [storedHighlightMode, setStoredHighlightMode] = useLocalStorageState<NotesHighlightMode>(
    NOTES_HIGHLIGHT_MODE_STORAGE_KEY,
    'off',
    (raw) => (isNotesHighlightMode(raw) ? raw : null)
  );
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [autoRequestId, setAutoRequestId] = useState(0);

  const documentRef = useRef<HTMLDivElement | null>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef<NoteContent | null>(null);
  const autoKeyRef = useRef<string | null>(null);

  const highlightMode: NotesHighlightMode = content.presentation?.highlight_mode ?? storedHighlightMode;
  const marks = content.presentation?.marks || [];
  const autoMarks = marks.filter((mark) => mark.kind === 'highlight' && mark.source === 'auto');
  const formattingEnabled = !isEditing;
  const { selection, clearSelection } = useNotesFieldSelection(documentRef, formattingEnabled);
  const notesFingerprint = useMemo(
    () =>
      JSON.stringify({
        title: content.title,
        summary: content.summary,
        sections: content.sections,
        cases: content.cases,
        doctrines: content.doctrines
      }),
    [content.title, content.summary, content.sections, content.cases, content.doctrines]
  );

  useEffect(() => {
    if (initialNotes?.content) {
      setContent(normalizeNoteContent(initialNotes.content));
    }
  }, [initialNotes]);

  useEffect(() => {
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, []);

  const persistNotes = useCallback((next: NoteContent, scope = 'reviewed edit') => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      api.updateNotes(sessionId, next, scope).catch(() => {
        /* Keep local marks even if the network save fails; Save Changes still works. */
      });
    }, 800);
  }, [sessionId]);

  const patchPresentation = useCallback((
    updater: (currentMarks: NoteMark[], mode: NotesHighlightMode) => { marks?: NoteMark[]; highlight_mode?: NotesHighlightMode },
    persist = true
  ) => {
    setContent((prev) => {
      const currentMarks = prev.presentation?.marks || [];
      const currentMode = prev.presentation?.highlight_mode || storedHighlightMode;
      const patch = updater(currentMarks, currentMode);
      const next: NoteContent = {
        ...prev,
        presentation: {
          highlight_mode: patch.highlight_mode ?? currentMode,
          marks: patch.marks ?? currentMarks
        }
      };
      if (persist) persistNotes(next, 'notes formatting');
      return next;
    });
  }, [persistNotes, storedHighlightMode]);

  const handleHighlightModeChange = (mode: NotesHighlightMode) => {
    if (mode === 'auto' && autoError) {
      autoKeyRef.current = null;
      setAutoRequestId((n) => n + 1);
    }
    setStoredHighlightMode(mode);
    patchPresentation(() => ({ highlight_mode: mode }));
  };

  const applyMark = (kind: NotesMarkKind, color?: NotesHighlightColor) => {
    if (!selection) return;
    const nextMark = makeMark(
      selection.path,
      selection.start,
      selection.end,
      selection.text,
      kind,
      kind === 'highlight' ? { color: color || highlightColor, source: 'manual' } : undefined
    );
    patchPresentation((current) => ({ marks: upsertMark(current, nextMark) }));
  };

  const handleFormat = (kind: 'bold' | 'italic' | 'underline') => applyMark(kind);

  const handleHighlight = (color: NotesHighlightColor) => {
    setHighlightColor(color);
    if (highlightMode !== 'manual') handleHighlightModeChange('manual');
    applyMark('highlight', color);
  };

  const handleClearSelectionMarks = () => {
    if (!selection) return;
    patchPresentation((current) => ({
      marks: clearMarksInRange(current, selection.path, selection.start, selection.end)
    }));
    clearSelection();
  };

  const hasCases = Boolean(content.cases && content.cases.length > 0);
  const hasDoctrines = Boolean(content.doctrines && content.doctrines.length > 0);
  const isLawReviewer = content.document_type === 'law' || hasCases || hasDoctrines;

  // ── Clipboard Copy for Case Digest ─────────────────────────────────────────
  const handleCopyCaseDigest = (c: LegalCase, idx: number) => {
    const parts = [
      `CASE: ${c.case_name}`,
      c.citation ? `CITATION: ${c.citation}` : null,
      c.ponente ? `PONENTE: ${c.ponente}` : null,
      c.date ? `DATE: ${c.date}` : null,
      '',
      'FACTS:',
      c.facts || '(No facts summarized)',
      '',
      'ISSUE:',
      c.issue || '(No issue specified)',
      '',
      'RULING / RATIO DECIDENDI:',
      c.ruling || '(No ruling specified)',
      c.doctrine_applied ? `\nDOCTRINE APPLIED: ${c.doctrine_applied}` : null
    ].filter((p): p is string => p !== null).join('\n');

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(parts);
      const id = c.id || `case-${idx}`;
      setCopiedCaseId(id);
      setTimeout(() => setCopiedCaseId(null), 2500);
    }
  };

  // ── Case Handlers ──────────────────────────────────────────────────────────
  const handleCaseChange = (idx: number, field: keyof LegalCase, val: string) => {
    const updated = { ...content };
    if (!updated.cases) updated.cases = [];
    updated.cases[idx] = { ...updated.cases[idx], [field]: val };
    setContent(updated);
  };

  const addCase = () => {
    const updated = { ...content };
    if (!updated.cases) updated.cases = [];
    updated.cases.push({
      id: `case-${Date.now()}`,
      case_name: 'New Case Title (e.g. People v. Cruz)',
      citation: 'G.R. No. 000000',
      ponente: 'Supreme Court Justice',
      facts: 'Essential facts of the case...',
      issue: 'Whether or not...',
      ruling: 'The Supreme Court ruled that...',
      doctrine_applied: 'Applied legal doctrine / precedent'
    });
    updated.document_type = 'law';
    setContent(updated);
  };

  const removeCase = (idx: number) => {
    const updated = { ...content };
    if (updated.cases) {
      updated.cases.splice(idx, 1);
      setContent(updated);
    }
  };

  // ── Doctrine Handlers ──────────────────────────────────────────────────────
  const handleDoctrineChange = (idx: number, field: keyof LegalDoctrine, val: any) => {
    const updated = { ...content };
    if (!updated.doctrines) updated.doctrines = [];
    updated.doctrines[idx] = { ...updated.doctrines[idx], [field]: val };
    setContent(updated);
  };

  const addDoctrine = () => {
    const updated = { ...content };
    if (!updated.doctrines) updated.doctrines = [];
    updated.doctrines.push({
      id: `doc-${Date.now()}`,
      name: 'New Legal Doctrine',
      statement: 'Authoritative rule of law or doctrine definition...',
      elements: ['Requisite 1: Essential condition', 'Requisite 2: Action or conduct'],
      exceptions: ['Exception: Under extraordinary circumstances'],
      statutory_basis: 'Constitutional / Statutory provision',
      supporting_cases: []
    });
    updated.document_type = 'law';
    setContent(updated);
  };

  const removeDoctrine = (idx: number) => {
    const updated = { ...content };
    if (updated.doctrines) {
      updated.doctrines.splice(idx, 1);
      setContent(updated);
    }
  };

  const handleDoctrineElementChange = (dIdx: number, eIdx: number, val: string) => {
    const updated = { ...content };
    if (updated.doctrines && updated.doctrines[dIdx]?.elements) {
      updated.doctrines[dIdx].elements![eIdx] = val;
      setContent(updated);
    }
  };

  const addDoctrineElement = (dIdx: number) => {
    const updated = { ...content };
    if (updated.doctrines) {
      if (!updated.doctrines[dIdx].elements) updated.doctrines[dIdx].elements = [];
      updated.doctrines[dIdx].elements!.push('New requisite or element...');
      setContent(updated);
    }
  };

  const removeDoctrineElement = (dIdx: number, eIdx: number) => {
    const updated = { ...content };
    if (updated.doctrines && updated.doctrines[dIdx]?.elements) {
      updated.doctrines[dIdx].elements!.splice(eIdx, 1);
      setContent(updated);
    }
  };

  const handleDoctrineExceptionChange = (dIdx: number, exIdx: number, val: string) => {
    const updated = { ...content };
    if (updated.doctrines && updated.doctrines[dIdx]?.exceptions) {
      updated.doctrines[dIdx].exceptions![exIdx] = val;
      setContent(updated);
    }
  };

  const addDoctrineException = (dIdx: number) => {
    const updated = { ...content };
    if (updated.doctrines) {
      if (!updated.doctrines[dIdx].exceptions) updated.doctrines[dIdx].exceptions = [];
      updated.doctrines[dIdx].exceptions!.push('New recognized exception...');
      setContent(updated);
    }
  };

  const removeDoctrineException = (dIdx: number, exIdx: number) => {
    const updated = { ...content };
    if (updated.doctrines && updated.doctrines[dIdx]?.exceptions) {
      updated.doctrines[dIdx].exceptions!.splice(exIdx, 1);
      setContent(updated);
    }
  };

  // ── Section Handlers ───────────────────────────────────────────────────────
  const handleSectionHeadingChange = (index: number, newHeading: string) => {
    const updated = { ...content };
    updated.sections[index].heading = newHeading;
    setContent(updated);
  };

  const handleSubpointChange = (sIdx: number, pIdx: number, text: string) => {
    const updated = { ...content };
    updated.sections[sIdx].subpoints[pIdx] = text;
    setContent(updated);
  };

  const addSubpoint = (sIdx: number) => {
    const updated = { ...content };
    updated.sections[sIdx].subpoints.push('New key concept bullet point...');
    setContent(updated);
  };

  const removeSubpoint = (sIdx: number, pIdx: number) => {
    const updated = { ...content };
    updated.sections[sIdx].subpoints.splice(pIdx, 1);
    setContent(updated);
  };

  const handleKeyTermChange = (sIdx: number, tIdx: number, field: 'term' | 'definition', val: string) => {
    const updated = { ...content };
    updated.sections[sIdx].key_terms[tIdx][field] = val;
    setContent(updated);
  };

  const addKeyTerm = (sIdx: number) => {
    const updated = { ...content };
    if (!updated.sections[sIdx].key_terms) updated.sections[sIdx].key_terms = [];
    updated.sections[sIdx].key_terms.push({
      term: isLawReviewer ? 'New Term / Maxim' : 'New term',
      definition: 'Precise definition'
    });
    setContent(updated);
  };

  const removeKeyTerm = (sIdx: number, tIdx: number) => {
    const updated = { ...content };
    updated.sections[sIdx].key_terms.splice(tIdx, 1);
    setContent(updated);
  };

  const addSection = () => {
    const updated = { ...content };
    updated.sections.push({
      heading: isLawReviewer
        ? `Section ${updated.sections.length + 1}: Key Legal Topic`
        : `Section ${updated.sections.length + 1}`,
      subpoints: isLawReviewer
        ? ['Core legal rule or statutory provision']
        : ['Key point from the notes'],
      key_terms: [{ term: isLawReviewer ? 'Legal Concept' : 'Key term', definition: 'Explanation' }]
    });
    setContent(updated);
  };

  const removeSection = (sIdx: number) => {
    const updated = { ...content };
    updated.sections.splice(sIdx, 1);
    setContent(updated);
  };

  // ── Save changes to backend ────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    try {
      await api.updateNotes(sessionId, content, 'reviewed edit');
      draftRef.current = null;
      setIsEditing(false);
      setSaveMessage('Changes saved successfully.');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (e: any) {
      alert(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    if (draftRef.current) {
      setContent(draftRef.current);
      draftRef.current = null;
    }
    setIsEditing(false);
    setSaveMessage(null);
  };

  const handleConfirmAndProceed = async () => {
    setSaving(true);
    try {
      const updated = await api.updateNotes(sessionId, content, 'confirmed review');
      onConfirmReview(updated);
    } catch (e: any) {
      alert(`Confirmation failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!formattingEnabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'b' || key === 'i' || key === 'u') {
        if (!selection) return;
        e.preventDefault();
        handleFormat(key === 'b' ? 'bold' : key === 'i' ? 'italic' : 'underline');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [formattingEnabled, selection, handleFormat]);

  useEffect(() => {
    if (highlightMode !== 'auto' || isEditing || generating) return;
    if (autoKeyRef.current === notesFingerprint) return;
    if (autoMarks.length > 0) {
      autoKeyRef.current = notesFingerprint;
      return;
    }

    let cancelled = false;
    setAutoLoading(true);
    setAutoError(null);

    api
      .generateNoteHighlights(sessionId)
      .then((highlights) => {
        if (cancelled) return;
        autoKeyRef.current = notesFingerprint;
        const incoming: NoteMark[] = highlights.map((mark, index) => ({
          ...mark,
          id: mark.id || `auto_${index}`,
          kind: 'highlight',
          source: 'auto'
        }));
        patchPresentation((current) => ({
          marks: [...current.filter((mark) => mark.source !== 'auto'), ...incoming]
        }));
      })
      .catch((err: { message?: string }) => {
        if (cancelled) return;
        autoKeyRef.current = notesFingerprint;
        setAutoError(err?.message || 'Could not generate auto-highlights.');
      })
      .finally(() => {
        if (!cancelled) setAutoLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [highlightMode, isEditing, generating, notesFingerprint, sessionId, patchPresentation, autoRequestId]);

  const annot = {
    marks,
    highlightMode
  };

  return (
    <div className="space-y-6">
      {generating && content.sections.length === 0 && (!content.cases || content.cases.length === 0) && (
        <div className="p-10 rounded-2xl bg-card border border-border flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm font-semibold text-foreground">Generating structured study notes…</p>
          <p className="text-xs text-muted-foreground">Pulling out the main ideas, terms, and section breakdown.</p>
        </div>
      )}

      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isLawReviewer ? (
            <Scale className="w-4 h-4 text-primary" />
          ) : (
            <BookOpen className="w-4 h-4 text-primary" />
          )}
          <span className="font-semibold text-foreground">
            {isLawReviewer ? 'Law Reviewer: Jurisprudence & Doctrines' : 'AI Study Notes & Concepts'}
          </span>
          {isLawReviewer && (
            <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-wider">
              Law School
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {saveMessage && (
            <div className="px-3 py-1.5 rounded-lg bg-sticker-green/15 border border-sticker-green/30 text-sticker-green text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
              <Check className="w-3.5 h-3.5" />
              <span>{saveMessage}</span>
            </div>
          )}

          {onRegenerateNotes && !isEditing && (
            <button
              onClick={onRegenerateNotes}
              disabled={generating}
              className="px-3.5 py-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground font-semibold text-xs flex items-center gap-1.5 hover:bg-muted transition-all shadow-sm disabled:opacity-50"
              title="Re-extract and generate fresh notes from the document"
            >
              <RotateCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin text-primary' : ''}`} />
              <span>{generating ? 'Generating...' : 'Regenerate Notes'}</span>
            </button>
          )}

          {isEditing ? (
            <>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={saving}
                className="px-4 py-2 rounded-xl border border-border bg-card text-foreground font-semibold text-xs flex items-center gap-1.5 hover:bg-muted transition-all shadow-sm disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1.5 hover:bg-primary/90 transition-all shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                draftRef.current = JSON.parse(JSON.stringify(content)) as NoteContent;
                setIsEditing(true);
              }}
              className="px-4 py-2 rounded-xl border border-border bg-card text-foreground font-semibold text-xs flex items-center gap-1.5 hover:bg-muted transition-all shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Notes</span>
            </button>
          )}
        </div>
      </div>

      {/* Law School Sub-Navigation Tabs */}
      {isLawReviewer && (
        <div className="flex items-center gap-1.5 border-b border-border pb-2 overflow-x-auto text-xs font-medium">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Review Material</span>
          </button>
          <button
            onClick={() => setActiveTab('cases')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'cases'
                ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Jurisprudence & Case Briefs</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary-foreground/20 text-primary-foreground">
              {content.cases?.length || 0}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('doctrines')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'doctrines'
                ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Gavel className="w-3.5 h-3.5" />
            <span>Legal Doctrines & Requisites</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary-foreground/20 text-primary-foreground">
              {content.doctrines?.length || 0}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('sections')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'sections'
                ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Codal & Concept Outlines</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary-foreground/20 text-primary-foreground">
              {content.sections?.length || 0}
            </span>
          </button>
        </div>
      )}
      
      <div className="max-w-[820px] mx-auto w-full space-y-3">
      <NotesDocumentToolbar
        highlightMode={highlightMode}
        onHighlightModeChange={handleHighlightModeChange}
        activeColor={highlightColor}
        onColorChange={handleHighlight}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        customPx={customPx}
        onCustomPxChange={(px) => setCustomPx(clampNotesCustomPx(px))}
        formattingEnabled={formattingEnabled}
        onFormat={handleFormat}
        autoTermCount={autoMarks.length}
        autoLoading={autoLoading}
        autoError={autoError}
      />

      {formattingEnabled && (
        <NotesSelectionMenu
          selection={selection}
          marks={marks}
          highlightMode={highlightMode}
          activeColor={highlightColor}
          onFormat={handleFormat}
          onHighlight={handleHighlight}
          onClear={handleClearSelectionMarks}
          onDismiss={clearSelection}
        />
      )}
      
      {/* Main Notes Sheet */}
      <div
        ref={documentRef}
        style={notesScaleVars(getNotesTypeScale(fontSize, customPx))}
        className="notes-document bg-card border border-border rounded-2xl p-6 sm:p-10 md:p-12 shadow-notion-elevated space-y-10 w-full"
      >
        {/* Title & Summary */}
        <div className="space-y-3 pb-6 border-b border-border">
          {isEditing ? (
            <input
              type="text"
              value={content.title}
              onChange={(e) => setContent({ ...content, title: e.target.value })}
              className="w-full font-bold text-xl sm:text-2xl md:text-3xl text-foreground bg-muted/40 p-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary"
            />
          ) : (
            <NotesAnnotatedText
              path="title"
              text={content.title}
              {...annot}
              as="h1"
              className="notes-title font-extrabold tracking-tight text-foreground leading-snug"
            />
          )}

          {isEditing ? (
            <textarea
              value={content.summary}
              onChange={(e) => setContent({ ...content, summary: e.target.value })}
              rows={2}
              className="w-full text-sm sm:text-[15px] text-foreground bg-muted/40 p-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary resize-none leading-relaxed"
              placeholder={
                isLawReviewer
                  ? 'Executive summary of legal concepts, doctrines, and holdings...'
                  : 'Short overview of what these notes cover...'
              }
            />
          ) : (
            <div className="p-4 sm:p-5 rounded-xl bg-surface-container-low border border-border">
              <div className="text-[11px] font-bold uppercase tracking-wider text-primary mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                <span>Executive Summary & Overview</span>
              </div>
              <NotesAnnotatedText
                path="summary"
                text={content.summary}
                {...annot}
                as="p"
                className="text-foreground/90 leading-relaxed font-normal"
                emptyFallback="Comprehensive structured review material extracted from your study text."
              />
            </div>
          )}
        </div>

        {/* ── PART 1: JURISPRUDENCE & CASE BRIEFS (FIRAC) ──────────────────────── */}
        {(activeTab === 'all' || activeTab === 'cases') && (hasCases || (isEditing && isLawReviewer)) && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 pb-2 border-b border-border/80">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="notes-h2 font-extrabold text-foreground">
                    Jurisprudence & Case Briefs
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Supreme Court decisions analyzed via Facts, Issue, Ruling (FIR), and Doctrine Applied.
                  </p>
                </div>
              </div>

              {isEditing && (
                <button
                  onClick={addCase}
                  className="px-3 py-1.5 rounded-lg border border-primary/30 text-primary text-xs font-bold flex items-center gap-1.5 hover:bg-primary/5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Case Brief</span>
                </button>
              )}
            </div>

            {content.cases && content.cases.length > 0 ? (
              <div className="space-y-6">
                {content.cases.map((c, cIdx) => {
                  const caseId = c.id || `case-${cIdx}`;
                  const isCopied = copiedCaseId === caseId;

                  return (
                    <div
                      key={caseId}
                      className="rounded-2xl bg-surface-container-low border border-border/90 p-5 sm:p-6 space-y-4 shadow-sm hover:border-primary/40 transition-colors"
                    >
                      {/* Case Header */}
                      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-border/60">
                        <div className="space-y-1 flex-1 min-w-[240px]">
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={c.case_name}
                                onChange={(e) => handleCaseChange(cIdx, 'case_name', e.target.value)}
                                className="w-full font-bold text-base bg-card px-3 py-1.5 rounded-lg border border-border text-foreground"
                                placeholder="Case Caption (e.g. Oposa v. Factoran, Jr.)"
                              />
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  value={c.citation || ''}
                                  onChange={(e) => handleCaseChange(cIdx, 'citation', e.target.value)}
                                  className="text-xs bg-card px-2.5 py-1 rounded-md border border-border"
                                  placeholder="G.R. No. / Citation (e.g. G.R. No. 101083)"
                                />
                                <input
                                  type="text"
                                  value={c.ponente || ''}
                                  onChange={(e) => handleCaseChange(cIdx, 'ponente', e.target.value)}
                                  className="text-xs bg-card px-2.5 py-1 rounded-md border border-border"
                                  placeholder="Ponente (e.g. Davide, Jr., J.)"
                                />
                              </div>
                            </div>
                          ) : (
                            <>
                              <h3 className="font-extrabold notes-h3 text-foreground tracking-tight flex items-center gap-2">
                                <NotesAnnotatedText path={`cases.${cIdx}.case_name`} text={c.case_name} {...annot} />
                              </h3>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                {c.citation && (
                                  <span className="px-2 py-0.5 rounded-md bg-card border border-border font-mono text-[11px] font-semibold text-primary">
                                    {c.citation}
                                  </span>
                                )}
                                {c.ponente && (
                                  <span className="flex items-center gap-1 font-medium">
                                    <span className="text-muted-foreground/60">Ponente:</span>
                                    <span className="text-foreground">{c.ponente}</span>
                                  </span>
                                )}
                                {c.date && (
                                  <span className="text-muted-foreground/70">• {c.date}</span>
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCopyCaseDigest(c, cIdx)}
                            className="px-2.5 py-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1.5 hover:bg-muted transition-all"
                            title="Copy formatted case digest"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-sticker-green" />
                                <span className="text-sticker-green text-[11px]">Copied Digest!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span className="text-[11px]">Copy Digest</span>
                              </>
                            )}
                          </button>

                          {isEditing && (
                            <button
                              onClick={() => removeCase(cIdx)}
                              className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg"
                              title="Delete case brief"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* FIR Body: Facts, Issue, Ruling */}
                      <div className="space-y-3.5 leading-relaxed">
                        {/* Facts */}
                        <div className="space-y-1">
                          <div className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                            <span>Facts of the Case</span>
                          </div>
                          {isEditing ? (
                            <textarea
                              value={c.facts || ''}
                              onChange={(e) => handleCaseChange(cIdx, 'facts', e.target.value)}
                              rows={3}
                              className="w-full p-2.5 rounded-lg bg-card border border-border resize-none"
                              placeholder="Concise factual antecedents..."
                            />
                          ) : (
                            <NotesAnnotatedText
                              path={`cases.${cIdx}.facts`}
                              text={c.facts || ''}
                              {...annot}
                              as="p"
                              className="text-foreground/90 pl-3 border-l-2 border-border/80"
                              emptyFallback="No facts provided."
                            />
                          )}
                        </div>

                        {/* Issue */}
                        <div className="space-y-1">
                          <div className="font-bold text-[11px] uppercase tracking-wider text-primary flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            <span>Legal Issue(s)</span>
                          </div>
                          {isEditing ? (
                            <textarea
                              value={c.issue || ''}
                              onChange={(e) => handleCaseChange(cIdx, 'issue', e.target.value)}
                              rows={2}
                              className="w-full p-2.5 rounded-lg bg-card border border-border resize-none"
                              placeholder="Constitutional or legal question..."
                            />
                          ) : (
                            <NotesAnnotatedText
                              path={`cases.${cIdx}.issue`}
                              text={c.issue || ''}
                              {...annot}
                              as="p"
                              className="font-medium text-foreground pl-3 border-l-2 border-primary/50 bg-primary/5 p-2 rounded-r-lg"
                              emptyFallback="No issue defined."
                            />
                          )}
                        </div>

                        {/* Ruling */}
                        <div className="space-y-1">
                          <div className="font-bold text-[11px] uppercase tracking-wider text-sticker-green flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-sticker-green" />
                            <span>Ruling & Ratio Decidendi</span>
                          </div>
                          {isEditing ? (
                            <textarea
                              value={c.ruling || ''}
                              onChange={(e) => handleCaseChange(cIdx, 'ruling', e.target.value)}
                              rows={3}
                              className="w-full p-2.5 rounded-lg bg-card border border-border resize-none"
                              placeholder="Court holding, legal reasoning, and dispositive portion..."
                            />
                          ) : (
                            <NotesAnnotatedText
                              path={`cases.${cIdx}.ruling`}
                              text={c.ruling || ''}
                              {...annot}
                              as="p"
                              className="text-foreground/95 pl-3 border-l-2 border-sticker-green/60 font-medium leading-relaxed"
                              emptyFallback="No ruling extracted."
                            />
                          )}
                        </div>

                        {/* Doctrine Applied */}
                        {(c.doctrine_applied || isEditing) && (
                          <div className="pt-2 flex flex-wrap items-center gap-2">
                            <span className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">
                              Doctrine:
                            </span>
                            {isEditing ? (
                              <input
                                type="text"
                                value={c.doctrine_applied || ''}
                                onChange={(e) => handleCaseChange(cIdx, 'doctrine_applied', e.target.value)}
                                className="flex-1 bg-card px-2.5 py-1 rounded-md border border-border text-xs"
                                placeholder="Legal doctrine applied (e.g. Intergenerational Responsibility)"
                              />
                            ) : (
                              <NotesAnnotatedText
                                path={`cases.${cIdx}.doctrine_applied`}
                                text={c.doctrine_applied || ''}
                                {...annot}
                                className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-semibold notes-meta border border-primary/20"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground space-y-2">
                <p>No legal cases currently extracted.</p>
                {isEditing && (
                  <button
                    onClick={addCase}
                    className="text-primary font-bold hover:underline"
                  >
                    + Add your first case digest
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── PART 2: LEGAL DOCTRINES & REQUISITES ───────────────────────────── */}
        {(activeTab === 'all' || activeTab === 'doctrines') && (hasDoctrines || (isEditing && isLawReviewer)) && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 pb-2 border-b border-border/80">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Gavel className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="notes-h2 font-extrabold text-foreground">
                    Legal Doctrines & Requisites
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Substantive rules of law, numbered elements/requisites, and recognized exceptions.
                  </p>
                </div>
              </div>

              {isEditing && (
                <button
                  onClick={addDoctrine}
                  className="px-3 py-1.5 rounded-lg border border-primary/30 text-primary text-xs font-bold flex items-center gap-1.5 hover:bg-primary/5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Legal Doctrine</span>
                </button>
              )}
            </div>

            {content.doctrines && content.doctrines.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {content.doctrines.map((d, dIdx) => (
                  <div
                    key={d.id || dIdx}
                    className="rounded-2xl bg-surface-container-low border border-border p-5 space-y-4 shadow-sm hover:border-primary/40 transition-colors flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        {isEditing ? (
                          <div className="space-y-1.5 flex-1">
                            <input
                              type="text"
                              value={d.name}
                              onChange={(e) => handleDoctrineChange(dIdx, 'name', e.target.value)}
                              className="w-full font-bold text-sm bg-card px-2.5 py-1 rounded-md border border-border text-foreground"
                              placeholder="Doctrine Name"
                            />
                            <input
                              type="text"
                              value={d.statutory_basis || ''}
                              onChange={(e) => handleDoctrineChange(dIdx, 'statutory_basis', e.target.value)}
                              className="w-full text-xs bg-card px-2.5 py-1 rounded-md border border-border"
                              placeholder="Statutory / Codal Basis (e.g. Art. II, Sec. 16)"
                            />
                          </div>
                        ) : (
                          <div>
                            <h3 className="font-extrabold notes-h3 text-foreground">
                              <NotesAnnotatedText path={`doctrines.${dIdx}.name`} text={d.name} {...annot} />
                            </h3>
                            {d.statutory_basis && (
                              <p className="text-xs font-mono text-primary font-semibold mt-0.5">
                                {d.statutory_basis}
                              </p>
                            )}
                          </div>
                        )}

                        {isEditing && (
                          <button
                            onClick={() => removeDoctrine(dIdx)}
                            className="p-1 text-destructive hover:bg-destructive/10 rounded-md"
                            title="Delete doctrine"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Statement / Rule of law */}
                      <div>
                        {isEditing ? (
                          <textarea
                            value={d.statement}
                            onChange={(e) => handleDoctrineChange(dIdx, 'statement', e.target.value)}
                            rows={2}
                            className="w-full text-xs bg-card p-2 rounded-md border border-border resize-none"
                            placeholder="Statement of the doctrine..."
                          />
                        ) : (
                          <NotesAnnotatedText
                            path={`doctrines.${dIdx}.statement`}
                            text={d.statement}
                            {...annot}
                            as="blockquote"
                            className="text-foreground/90 italic border-l-2 border-primary/50 pl-3 leading-relaxed"
                          />
                        )}
                      </div>

                      {/* Numbered Elements / Requisites */}
                      <div className="space-y-2 pt-1">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <ListOrdered className="w-3 h-3 text-primary" />
                            <span>Elements / Requisites</span>
                          </span>
                          {isEditing && (
                            <button
                              onClick={() => addDoctrineElement(dIdx)}
                              className="text-primary text-[10px] hover:underline flex items-center gap-0.5"
                            >
                              <Plus className="w-3 h-3" /> Add element
                            </button>
                          )}
                        </div>

                        <div className="space-y-1.5 pl-1">
                          {d.elements && d.elements.length > 0 ? (
                            d.elements.map((elem, eIdx) => (
                              <div key={eIdx} className="flex items-start gap-2 text-xs text-foreground/90">
                                <span className="w-4 h-4 rounded-full bg-card border border-border text-[10px] font-bold text-primary flex items-center justify-center shrink-0 mt-0.5">
                                  {eIdx + 1}
                                </span>
                                {isEditing ? (
                                  <div className="flex items-center gap-1.5 flex-1">
                                    <input
                                      type="text"
                                      value={elem}
                                      onChange={(e) => handleDoctrineElementChange(dIdx, eIdx, e.target.value)}
                                      className="flex-1 bg-card px-2 py-0.5 rounded border border-border text-xs"
                                    />
                                    <button
                                      onClick={() => removeDoctrineElement(dIdx, eIdx)}
                                      className="text-muted-foreground hover:text-destructive p-0.5"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <NotesAnnotatedText
                                    path={`doctrines.${dIdx}.elements.${eIdx}`}
                                    text={elem}
                                    {...annot}
                                    className="leading-snug"
                                  />
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-[11px] text-muted-foreground italic">No elements specified.</p>
                          )}
                        </div>
                      </div>

                      {/* Exceptions */}
                      {(d.exceptions && d.exceptions.length > 0 || isEditing) && (
                        <div className="space-y-1.5 pt-1">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-sticker-yellow flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <ShieldAlert className="w-3 h-3" />
                              <span>Exceptions / Limitations</span>
                            </span>
                            {isEditing && (
                              <button
                                onClick={() => addDoctrineException(dIdx)}
                                className="text-primary text-[10px] hover:underline flex items-center gap-0.5"
                              >
                                <Plus className="w-3 h-3" /> Add exception
                              </button>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {d.exceptions?.map((ex, exIdx) => (
                              <div
                                key={exIdx}
                                className="px-2.5 py-1 rounded-lg bg-surface-container border border-border text-xs text-foreground/90 flex items-center gap-1.5"
                              >
                                {isEditing ? (
                                  <>
                                    <input
                                      type="text"
                                      value={ex}
                                      onChange={(e) => handleDoctrineExceptionChange(dIdx, exIdx, e.target.value)}
                                      className="bg-card px-1.5 py-0.5 rounded border border-border text-xs"
                                    />
                                    <button
                                      onClick={() => removeDoctrineException(dIdx, exIdx)}
                                      className="text-muted-foreground hover:text-destructive"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </>
                                ) : (
                                  <NotesAnnotatedText
                                    path={`doctrines.${dIdx}.exceptions.${exIdx}`}
                                    text={ex}
                                    {...annot}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground space-y-2">
                <p>No legal doctrines currently cataloged.</p>
                {isEditing && (
                  <button
                    onClick={addDoctrine}
                    className="text-primary font-bold hover:underline"
                  >
                    + Add your first legal doctrine
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── PART 3: OUTLINE, SECTIONS & KEY TERMS ──────────────────────────── */}
        {(activeTab === 'all' || activeTab === 'sections') && (
          <div className="space-y-8">
            <div className="flex items-center justify-between gap-3 pb-2 border-b border-border/80">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="notes-h2 font-extrabold text-foreground">
                    {isLawReviewer ? 'Codal & Concept Outlines' : 'Study Notes & Sections'}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Structured topic breakdown with key principles and term definitions.
                  </p>
                </div>
              </div>

              {isEditing && (
                <button
                  onClick={addSection}
                  className="px-3 py-1.5 rounded-lg border border-primary/30 text-primary text-xs font-bold flex items-center gap-1.5 hover:bg-primary/5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Section</span>
                </button>
              )}
            </div>

            {content.sections.map((section, sIdx) => (
              <div key={sIdx} className="space-y-4 group">
                {/* Section Header */}
                <div className="flex items-center justify-between gap-3">
                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-xs font-mono font-bold text-primary">#{sIdx + 1}</span>
                      <input
                        type="text"
                        value={section.heading}
                        onChange={(e) => handleSectionHeadingChange(sIdx, e.target.value)}
                        className="flex-1 font-bold text-lg sm:text-xl text-foreground bg-muted/40 px-3 py-1.5 rounded-lg border border-border"
                      />
                      <button
                        onClick={() => removeSection(sIdx)}
                        className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg"
                        title="Delete section"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <h3 className="notes-h3 font-bold tracking-tight text-foreground flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                      <NotesAnnotatedText path={`sections.${sIdx}.heading`} text={section.heading} {...annot} />
                    </h3>
                  )}
                </div>

                {/* Bullet Subpoints */}
                <div className="pl-5 sm:pl-6 space-y-2.5 border-l-2 border-primary/25">
                  {section.subpoints.map((subpoint, pIdx) => (
                    <div key={pIdx} className="flex items-start gap-2.5 text-sm sm:text-[15px] text-foreground/90 leading-relaxed">
                      <span className="text-primary font-bold text-base select-none leading-none mt-1">•</span>
                      {isEditing ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={subpoint}
                            onChange={(e) => handleSubpointChange(sIdx, pIdx, e.target.value)}
                            className="flex-1 bg-muted/40 px-2.5 py-1 rounded-lg border border-border text-sm"
                          />
                          <button
                            onClick={() => removeSubpoint(sIdx, pIdx)}
                            className="text-muted-foreground hover:text-destructive p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <NotesAnnotatedText
                          path={`sections.${sIdx}.subpoints.${pIdx}`}
                          text={subpoint}
                          {...annot}
                          className="flex-1 leading-relaxed text-foreground/90"
                        />
                      )}
                    </div>
                  ))}

                  {isEditing && (
                    <button
                      onClick={() => addSubpoint(sIdx)}
                      className="text-xs text-primary font-semibold flex items-center gap-1 mt-2 hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add bullet point</span>
                    </button>
                  )}
                </div>

                {/* Key Terms Pill Grid */}
                {((section.key_terms && section.key_terms.some((kt) => isEditing || isCredibleGlossaryTerm(kt.term, kt.definition))) || isEditing) && (
                  <div className="mt-3 pl-5 sm:pl-6">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5 flex items-center gap-1.5">
                      <Tag className="w-3 h-3 text-primary" />
                      <span>{isLawReviewer ? 'Key Terms & Maxims' : 'Key Terms'}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {section.key_terms?.map((kt, tIdx) => {
                        if (!isEditing && !isCredibleGlossaryTerm(kt.term, kt.definition)) return null;
                        return (
                        <div
                          key={tIdx}
                          className="p-3.5 rounded-xl bg-surface-container-low/90 border border-border space-y-1 hover:border-primary/40 transition-colors"
                        >
                          {isEditing ? (
                            <div className="space-y-1.5">
                              <input
                                type="text"
                                value={kt.term}
                                onChange={(e) => handleKeyTermChange(sIdx, tIdx, 'term', e.target.value)}
                                className="w-full font-bold text-xs sm:text-sm bg-card px-2 py-1 rounded-md border border-border text-primary"
                                placeholder={isLawReviewer ? 'Term / Maxim' : 'Term'}
                              />
                              <textarea
                                value={kt.definition}
                                onChange={(e) => handleKeyTermChange(sIdx, tIdx, 'definition', e.target.value)}
                                rows={2}
                                className="w-full text-xs bg-card px-2 py-1 rounded-md border border-border text-foreground resize-none leading-relaxed"
                                placeholder="Definition"
                              />
                              <button
                                onClick={() => removeKeyTerm(sIdx, tIdx)}
                                className="text-destructive text-[11px] font-semibold hover:underline"
                              >
                                Remove Term
                              </button>
                            </div>
                          ) : (
                            <>
                              <NotesAnnotatedText
                                path={`sections.${sIdx}.key_terms.${tIdx}.term`}
                                text={kt.term}
                                {...annot}
                                className="font-bold notes-meta text-primary tracking-wide"
                              />
                              <NotesAnnotatedText
                                path={`sections.${sIdx}.key_terms.${tIdx}.definition`}
                                text={kt.definition}
                                {...annot}
                                className="text-foreground/80 leading-normal"
                              />
                            </>
                          )}
                        </div>
                        );
                      })}
                    </div>

                    {isEditing && (
                      <button
                        onClick={() => addKeyTerm(sIdx)}
                        className="text-xs text-primary font-semibold flex items-center gap-1 mt-2 hover:underline"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add key term</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
      </div>
    </div>
  );
}
