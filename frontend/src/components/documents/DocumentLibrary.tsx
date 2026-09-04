'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  CalendarDays,
  Clock,
  Eye,
  File,
  FileText,
  Filter,
  Image as ImageIcon,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UploadCloud
} from 'lucide-react';
import { Document, Session } from '@/lib/types';
import { api } from '@/lib/api';
import { formatFileSize, getPreviewKind, getPreviewKindLabel } from '@/lib/fileTypes';
import { DocumentEditDialog } from './DocumentEditDialog';
import { DocumentDeleteDialog } from './DocumentDeleteDialog';
import { DocumentPreviewModal } from './DocumentPreviewModal';

interface DocumentLibraryProps {
  documents: Document[];
  sessions?: Session[];
  onDocumentUpdated?: (doc: Document) => void;
  onDocumentDeleted?: (docId: string) => void;
  onUploadClick?: () => void;
}

export function DocumentLibrary({
  documents,
  sessions = [],
  onDocumentUpdated,
  onDocumentDeleted,
  onUploadClick
}: DocumentLibraryProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKind, setSelectedKind] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'name' | 'size' | 'pages'>('newest');

  // Modals state
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [editDoc, setEditDoc] = useState<Document | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<Document | null>(null);

  // Filter and sort documents
  const filteredDocuments = useMemo(() => {
    return documents
      .filter((doc) => {
        const matchesSearch = doc.filename.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return false;

        if (selectedKind === 'all') return true;
        const kind = getPreviewKind(doc.filename);
        if (selectedKind === 'pdf') return kind === 'pdf';
        if (selectedKind === 'image') return kind === 'image';
        if (selectedKind === 'doc') return kind === 'document' || kind === 'text' || kind === 'markdown';
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
        }
        if (sortBy === 'name') {
          return a.filename.localeCompare(b.filename);
        }
        if (sortBy === 'size') {
          return (b.file_size_bytes || 0) - (a.file_size_bytes || 0);
        }
        if (sortBy === 'pages') {
          return (b.page_count || 1) - (a.page_count || 1);
        }
        return 0;
      });
  }, [documents, searchQuery, selectedKind, sortBy]);

  // Find linked session for a document
  const getSessionForDoc = (docId: string) => {
    const matches = sessions.filter((s) => s.document_id === docId || s.document?.id === docId);
    if (matches.length === 0) return null;
    return matches[0];
  };

  const handleStartStudy = async (doc: Document) => {
    const existing = getSessionForDoc(doc.id);
    if (existing) {
      router.push(`/session/${existing.id}/`);
      return;
    }
    try {
      const title = doc.filename.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      const session = await api.createSession(title, doc.id);
      router.push(`/session/${session.id}/`);
    } catch (err) {
      console.error('Failed to create or open session from document:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border p-3 rounded-2xl">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-surface-container-low px-3 py-1.5 rounded-xl border border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search uploaded files…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-muted-foreground hover:text-foreground font-bold"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
          {/* Format Tabs */}
          <div className="flex items-center bg-surface-container-low p-1 rounded-xl border border-border text-xs">
            <button
              onClick={() => setSelectedKind('all')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                selectedKind === 'all'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({documents.length})
            </button>
            <button
              onClick={() => setSelectedKind('pdf')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                selectedKind === 'pdf'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              PDFs
            </button>
            <button
              onClick={() => setSelectedKind('doc')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                selectedKind === 'doc'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Docs
            </button>
            <button
              onClick={() => setSelectedKind('image')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                selectedKind === 'image'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Images
            </button>
          </div>

          {/* Sort Menu */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-xs font-semibold bg-surface-container-low border border-border rounded-xl px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="newest">Newest First</option>
            <option value="name">Name (A–Z)</option>
            <option value="size">File Size</option>
            <option value="pages">Page Count</option>
          </select>
        </div>
      </div>

      {/* Document Grid / List */}
      {filteredDocuments.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-2xl bg-card border border-border space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {searchQuery ? 'No matching documents found' : 'No documents in your library'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {searchQuery ? 'Try adjusting your search keywords or filters.' : 'Upload reference PDFs, Word files, or images to begin studying.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc) => {
            const kind = getPreviewKind(doc.filename);
            const linkedSession = getSessionForDoc(doc.id);

            return (
              <div
                key={doc.id}
                className="group relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-card border border-border hover:border-primary/40 hover:shadow-notion-soft transition-all duration-200"
              >
                {/* Card Top */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      {kind === 'image' ? (
                        <ImageIcon className="w-5 h-5 text-sticker-teal" />
                      ) : kind === 'pdf' ? (
                        <FileText className="w-5 h-5 text-primary" />
                      ) : (
                        <File className="w-5 h-5 text-sticker-sky" />
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(doc)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-container transition-colors"
                        title="Quick preview"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditDoc(doc)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-surface-container transition-colors"
                        title="Rename document"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteDoc(doc)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-surface-container transition-colors"
                        title="Delete document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3
                    onClick={() => setPreviewDoc(doc)}
                    className="text-sm font-bold text-foreground line-clamp-2 hover:text-primary cursor-pointer transition-colors"
                    title={doc.filename}
                  >
                    {doc.filename}
                  </h3>

                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground font-medium flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-surface-container text-[11px] font-semibold text-foreground">
                      {getPreviewKindLabel(kind)}
                    </span>
                    <span>• {doc.page_count} {doc.page_count === 1 ? 'page' : 'pages'}</span>
                    <span>• {formatFileSize(doc.file_size_bytes)}</span>
                  </div>
                </div>

                {/* Card Bottom */}
                <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(doc.uploaded_at).toLocaleDateString()}
                  </span>

                  <button
                    onClick={() => handleStartStudy(doc)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-bold hover:bg-primary hover:text-on-primary transition-all active:scale-95 shadow-2xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{linkedSession ? 'Open Study' : 'Study'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      <DocumentEditDialog
        document={editDoc}
        open={Boolean(editDoc)}
        onClose={() => setEditDoc(null)}
        onUpdated={(updated) => {
          onDocumentUpdated?.(updated);
        }}
      />

      {/* Delete Modal */}
      <DocumentDeleteDialog
        document={deleteDoc}
        open={Boolean(deleteDoc)}
        onClose={() => setDeleteDoc(null)}
        onDeleted={(docId) => {
          onDocumentDeleted?.(docId);
        }}
      />

      {/* Preview Modal */}
      <DocumentPreviewModal
        document={previewDoc}
        open={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
}
