'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Image as ImageIcon, File, CheckCircle2, AlertCircle, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Document, Session } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useEmailGate } from '@/context/AuthContext';

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff'
];

const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tiff', '.tif'];

function getFileIcon(filename: string) {
  const ext = filename.toLowerCase();
  if (ext.endsWith('.pdf')) return FileText;
  if (ext.endsWith('.docx') || ext.endsWith('.doc')) return File;
  return ImageIcon;
}

function isValidFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const hasValidExt = ACCEPTED_EXTENSIONS.some(ext => name.endsWith(ext));
  const hasValidType = ACCEPTED_TYPES.includes(file.type) || file.type === '';
  return hasValidExt || hasValidType;
}

interface DocumentUploaderProps {
  onUploadSuccess?: (doc: Document, session: Session) => void;
}

export function DocumentUploader({ onUploadSuccess }: DocumentUploaderProps) {
  const router = useRouter();
  const { allowed: aiAllowed } = useEmailGate();
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [progressStep, setProgressStep] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    if (!isValidFile(file)) {
      setError('Unsupported file type. Please upload a PDF, Word document (.docx), or image file (PNG, JPG, WEBP, GIF, BMP, TIFF).');
      return;
    }

    if (file.size > 30 * 1024 * 1024) {
      setError('File size exceeds 30MB limit. Please upload a smaller document.');
      return;
    }

    setError(null);
    setUploading(true);
    setProgressStep('Uploading document to storage...');

    try {
      // 1. Upload & Extract Text with PyMuPDF
      setProgressStep('Extracting text & structure with PyMuPDF...');
      const doc = await api.uploadDocument(file);

      // 2. Create Study Session
      setProgressStep('Initializing study session workspace...');
      const sessionTitle = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
      const session = await api.createSession(sessionTitle, doc.id);

      // Kick off notes in the background so the workspace can open immediately.
      if (aiAllowed) {
        void api.generateNotes(session.id).catch(() => {});
      }

      setProgressStep('Opening workspace...');
      if (onUploadSuccess) {
        onUploadSuccess(doc, session);
      } else {
        router.push(`/session/${session.id}/`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload and process document.');
    } finally {
      setUploading(false);
      setProgressStep('');
    }
  };

  return (
    <div className="w-full">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
          dragActive
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-border bg-card hover:border-primary/50 hover:bg-muted/30 shadow-notion-soft'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tiff,.tif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain,image/*"
          className="hidden"
          onChange={handleChange}
          disabled={uploading}
        />

        {uploading ? (
          <div className="py-4 flex flex-col items-center justify-center space-y-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin flex items-center justify-center" />
              <Sparkles className="w-6 h-6 text-primary absolute inset-0 m-auto animate-pulse" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-lg text-foreground">Processing Study Material</h4>
              <p className="text-sm text-muted-foreground animate-pulse">{progressStep}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center shadow-sm">
              <UploadCloud className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-bold tracking-tight text-foreground">
                Drop your study material here
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Aral.ai extracts structured notes, flashcards, and quizzes from your documents and images.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low border border-border text-xs font-semibold text-foreground">
                <FileText className="w-3.5 h-3.5 text-primary" />
                <span>PDF</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low border border-border text-xs font-semibold text-foreground">
                <File className="w-3.5 h-3.5 text-sticker-sky" />
                <span>Word / TXT</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low border border-border text-xs font-semibold text-foreground">
                <ImageIcon className="w-3.5 h-3.5 text-sticker-teal" />
                <span>Images</span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">Up to 30MB per file</p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
