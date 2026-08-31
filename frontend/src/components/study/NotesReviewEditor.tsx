'use client';

import React, { useState } from 'react';
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
  Layers,
  ArrowRight,
  HelpCircle
} from 'lucide-react';
import { Notes, NoteContent, NoteSection, KeyTerm } from '@/lib/types';
import { api } from '@/lib/api';

interface NotesReviewEditorProps {
  sessionId: string;
  initialNotes: Notes | null;
  onConfirmReview: (reviewedNotes: Notes) => void;
  onRegenerateNotes?: () => void;
}

export function NotesReviewEditor({
  sessionId,
  initialNotes,
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
      {/* Top Banner: Notion Review Step Indicator */}
      <div className="p-4 rounded-xl bg-card border border-border shadow-notion-soft flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sticker-sky/15 text-sticker-sky flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">Step 1: Notes Review & Verification</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sticker-orange/15 text-sticker-orange">
                Required Review
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Refine the AI extraction below. Flashcards & Quizzes will be generated strictly from this verified content.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isEditing ? (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1.5 hover:bg-primary-active transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Edits'}</span>
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 rounded-lg border border-border bg-card text-foreground font-semibold text-xs flex items-center gap-1.5 hover:bg-muted transition-all"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Notes</span>
            </button>
          )}

          <button
            onClick={handleConfirmAndProceed}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-sticker-green text-on-primary font-bold text-xs flex items-center gap-1.5 hover:bg-sticker-green/90 shadow-sm transition-all ml-auto sm:ml-0"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirm & Unlock Study Tools</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {saveMessage && (
        <div className="p-3 rounded-lg bg-sticker-green/15 border border-sticker-green/30 text-sticker-green text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Main Notes Sheet */}
      <div className="bg-card border border-border rounded-2xl p-6 sm:p-10 shadow-notion-soft space-y-8">
        {/* Title & Summary */}
        <div className="space-y-3 pb-6 border-b border-border">
          {isEditing ? (
            <input
              type="text"
              value={content.title}
              onChange={(e) => setContent({ ...content, title: e.target.value })}
              className="w-full font-bold text-2xl sm:text-3xl text-foreground bg-muted/40 p-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
            />
          ) : (
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {content.title}
            </h1>
          )}

          {isEditing ? (
            <textarea
              value={content.summary}
              onChange={(e) => setContent({ ...content, summary: e.target.value })}
              rows={2}
              className="w-full text-sm text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="Executive summary of key concepts..."
            />
          ) : (
            <div className="p-4 rounded-xl bg-surface-container-low border border-border">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Executive Summary
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed">
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
                      className="flex-1 font-bold text-lg text-foreground bg-muted/40 px-3 py-1.5 rounded-md border border-border"
                    />
                    <button
                      onClick={() => removeSection(sIdx)}
                      className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md"
                      title="Delete section"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    <span>{section.heading}</span>
                  </h3>
                )}
              </div>

              {/* Bullet Subpoints */}
              <div className="pl-4 sm:pl-6 space-y-2 border-l-2 border-primary/20">
                {section.subpoints.map((subpoint, pIdx) => (
                  <div key={pIdx} className="flex items-start gap-2 text-sm text-foreground/90 leading-relaxed">
                    <span className="text-muted-foreground select-none mt-0.5">•</span>
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={subpoint}
                          onChange={(e) => handleSubpointChange(sIdx, pIdx, e.target.value)}
                          className="flex-1 bg-muted/40 px-2 py-1 rounded border border-border text-sm"
                        />
                        <button
                          onClick={() => removeSubpoint(sIdx, pIdx)}
                          className="text-muted-foreground hover:text-destructive p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span>{subpoint}</span>
                    )}
                  </div>
                ))}

                {isEditing && (
                  <button
                    onClick={() => addSubpoint(sIdx)}
                    className="text-xs text-primary font-semibold flex items-center gap-1 mt-2 hover:underline"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add bullet point</span>
                  </button>
                )}
              </div>

              {/* Key Terms Pill Grid */}
              {((section.key_terms && section.key_terms.length > 0) || isEditing) && (
                <div className="mt-3 pl-4 sm:pl-6">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Tag className="w-3 h-3 text-primary" />
                    <span>Key Terms & Definitions</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {section.key_terms?.map((kt, tIdx) => (
                      <div
                        key={tIdx}
                        className="p-3 rounded-lg bg-surface-container-low border border-border space-y-1"
                      >
                        {isEditing ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={kt.term}
                              onChange={(e) => handleKeyTermChange(sIdx, tIdx, 'term', e.target.value)}
                              className="w-full font-bold text-xs bg-card px-2 py-1 rounded border border-border text-primary"
                              placeholder="Term"
                            />
                            <textarea
                              value={kt.definition}
                              onChange={(e) => handleKeyTermChange(sIdx, tIdx, 'definition', e.target.value)}
                              rows={2}
                              className="w-full text-xs bg-card px-2 py-1 rounded border border-border text-muted-foreground resize-none"
                              placeholder="Definition"
                            />
                            <button
                              onClick={() => removeKeyTerm(sIdx, tIdx)}
                              className="text-destructive text-[10px] font-semibold hover:underline"
                            >
                              Remove Term
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="font-bold text-xs text-primary">{kt.term}</div>
                            <div className="text-xs text-muted-foreground leading-snug">{kt.definition}</div>
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
                      <Plus className="w-3 h-3" />
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
              className="w-full py-3 border-2 border-dashed border-border rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Section</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
