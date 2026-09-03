'use client';

import React, { useState, useEffect } from 'react';
import { 
  Check, 
  Edit3, 
  Plus, 
  Trash2, 
  Save, 
  Sparkles, 
  Tag, 
  BookOpen, 
  CheckCircle2,
  Loader2,
  Layers,
  ArrowRight,
  HelpCircle
} from 'lucide-react';
import { Notes, NoteContent, NoteSection, KeyTerm } from '@/lib/types';
import { api } from '@/lib/api';

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
  const [content, setContent] = useState<NoteContent>(
    initialNotes?.content || {
      title: 'Extracted Study Notes',
      summary: '',
      sections: []
    }
  );
  
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [isReviewed, setIsReviewed] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialNotes?.content) setContent(initialNotes.content);
  }, [initialNotes]);

  // Update Section Title
  const handleSectionHeadingChange = (index: number, newHeading: string) => {
    const updated = { ...content };
    updated.sections[index].heading = newHeading;
    setContent(updated);
  };

  // Subpoints handlers
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

  // Key Terms handlers
  const handleKeyTermChange = (sIdx: number, tIdx: number, field: 'term' | 'definition', val: string) => {
    const updated = { ...content };
    updated.sections[sIdx].key_terms[tIdx][field] = val;
    setContent(updated);
  };

  const addKeyTerm = (sIdx: number) => {
    const updated = { ...content };
    if (!updated.sections[sIdx].key_terms) updated.sections[sIdx].key_terms = [];
    updated.sections[sIdx].key_terms.push({ term: 'New Term', definition: 'Definition' });
    setContent(updated);
  };

  const removeKeyTerm = (sIdx: number, tIdx: number) => {
    const updated = { ...content };
    updated.sections[sIdx].key_terms.splice(tIdx, 1);
    setContent(updated);
  };

  // Add Section
  const addSection = () => {
    const updated = { ...content };
    updated.sections.push({
      heading: `Section ${updated.sections.length + 1}: Key Topic`,
      subpoints: ['Core concept detail'],
      key_terms: [{ term: 'Key Concept', definition: 'Explanation' }]
    });
    setContent(updated);
  };

  const removeSection = (sIdx: number) => {
    const updated = { ...content };
    updated.sections.splice(sIdx, 1);
    setContent(updated);
  };

  // Save changes to backend
  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const updated = await api.updateNotes(sessionId, content, 'reviewed edit');
      setIsEditing(false);
      setSaveMessage('Changes saved successfully.');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (e: any) {
      alert(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Confirm and Unlock Flashcards & Quizzes
  const handleConfirmAndProceed = async () => {
    setSaving(true);
    try {
      const updated = await api.updateNotes(sessionId, content, 'confirmed review');
      setIsReviewed(true);
      onConfirmReview(updated);
    } catch (e: any) {
      alert(`Confirmation failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {generating && content.sections.length === 0 && (
        <div className="p-10 rounded-2xl bg-card border border-border flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm font-semibold text-foreground">Generating structured notes…</p>
          <p className="text-xs text-muted-foreground">You can keep reading the document while Gemini works.</p>
        </div>
      )}
      {/* Top Clean Action Bar */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="font-semibold text-foreground">AI Study Notes & Concepts</span>
        </div>

        <div className="flex items-center gap-2">
          {saveMessage && (
            <div className="px-3 py-1.5 rounded-lg bg-sticker-green/15 border border-sticker-green/30 text-sticker-green text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
              <Check className="w-3.5 h-3.5" />
              <span>{saveMessage}</span>
            </div>
          )}

          {isEditing ? (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1.5 hover:bg-primary/90 transition-all shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 rounded-xl border border-border bg-card text-foreground font-semibold text-xs flex items-center gap-1.5 hover:bg-muted transition-all shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Notes</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Main Notes Sheet */}
      <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 md:p-10 shadow-notion-soft space-y-8">
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
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-foreground leading-snug">
              {content.title}
            </h1>
          )}

          {isEditing ? (
            <textarea
              value={content.summary}
              onChange={(e) => setContent({ ...content, summary: e.target.value })}
              rows={2}
              className="w-full text-sm sm:text-[15px] text-foreground bg-muted/40 p-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary resize-none leading-relaxed"
              placeholder="Executive summary of key concepts..."
            />
          ) : (
            <div className="p-4 sm:p-5 rounded-xl bg-surface-container-low border border-border">
              <div className="text-[11px] font-bold uppercase tracking-wider text-primary mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                <span>Executive Summary</span>
              </div>
              <p className="text-sm sm:text-[15px] text-foreground/90 leading-relaxed font-normal">
                {content.summary || 'Comprehensive structured notes extracted from study material.'}
              </p>
            </div>
          )}
        </div>

        {/* Sections */}
        <div className="space-y-8">
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
                  <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                    <span>{section.heading}</span>
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
                      <span className="flex-1">{subpoint}</span>
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
              {((section.key_terms && section.key_terms.length > 0) || isEditing) && (
                <div className="mt-3 pl-5 sm:pl-6">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5 flex items-center gap-1.5">
                    <Tag className="w-3 h-3 text-primary" />
                    <span>Key Terms & Definitions</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {section.key_terms?.map((kt, tIdx) => (
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
                              placeholder="Term"
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
                            <div className="font-bold text-xs sm:text-sm text-primary tracking-wide">{kt.term}</div>
                            <div className="text-xs sm:text-[13px] text-foreground/80 leading-normal">{kt.definition}</div>
                          </>
                        )}
                      </div>
                    ))}
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

          {isEditing && (
            <button
              onClick={addSection}
              className="w-full py-3 rounded-xl border-2 border-dashed border-border hover:border-primary/50 text-xs font-bold text-primary flex items-center justify-center gap-1.5 hover:bg-primary/5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Section</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
