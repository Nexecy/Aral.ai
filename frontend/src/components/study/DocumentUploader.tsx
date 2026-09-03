'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Image as ImageIcon, File, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Document, Session } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useEmailGate } from '@/context/AuthContext';
import { UploadProgressBar, UploadFileMeta } from './UploadProgressBar';

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff'
];

const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tiff', '.tif'];

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
  const [selectedFile, setSelectedFile] = useState<UploadFileMeta | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [uploadStage, setUploadStage] = useState<string>('');
  const [byteProgress, setByteProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'uploading' | 'processing' | 'success' | 'error'>('uploading');
  const [error, setError] = useState<string | null>(null);

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

  const resetState = () => {
    setUploading(false);
    setSelectedFile(null);
    setUploadPercent(0);
    setUploadStage('');
    setByteProgress(null);
    setUploadStatus('uploading');
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
    setSelectedFile({ name: file.name, size: file.size });
    setUploading(true);
    setUploadStatus('uploading');
    setUploadPercent(5);
    setUploadStage('Uploading document to storage...');
    setByteProgress({ loaded: 0, total: file.size });

    try {
      // 1. Upload & Extract Text with PyMuPDF (tracks real XHR byte upload progress up to 70%)
      const doc = await api.uploadDocument(file, (prog) => {
        // Map network upload 0..100% to UI 5..70%
        const mappedPercent = Math.min(70, Math.max(5, Math.round(5 + (prog.percent * 0.65))));
        setUploadPercent(mappedPercent);
        setByteProgress({ loaded: prog.loaded, total: prog.total });
        setUploadStage(`Uploading document... ${prog.percent}%`);
      });

      // 2. Server parsing & structure extraction phase
      setUploadStatus('processing');
      setUploadPercent(75);
      setUploadStage('Extracting text & structure with PyMuPDF...');

      // 3. Create Study Session Workspace
      setUploadPercent(88);
      setUploadStage('Initializing study session workspace...');
      const sessionTitle = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
      const session = await api.createSession(sessionTitle, doc.id);

      // Kick off notes in the background
      if (aiAllowed) {
        void api.generateNotes(session.id).catch(() => {});
      }

      // 4. Ready & Redirect
      setUploadPercent(100);
      setUploadStatus('success');
      setUploadStage('Ready! Opening study workspace...');

      setTimeout(() => {
        if (onUploadSuccess) {
          onUploadSuccess(doc, session);
        } else {
          router.push(`/session/${session.id}/`);
        }
      }, 400);
    } catch (err: any) {
      setUploadStatus('error');
      setError(err.message || 'Failed to upload and process document.');
    }
  };

  return (
    <div className="w-full">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all duration-200 ${
          uploading ? 'cursor-default' : 'cursor-pointer'
        } ${
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
          disabled={uploading && uploadStatus !== 'error'}
        />

        {uploading && selectedFile ? (
          <div className="py-2 flex flex-col items-center justify-center">
            <UploadProgressBar
              file={selectedFile}
              percent={uploadPercent}
              stage={uploadStage}
              byteProgress={byteProgress}
              status={uploadStatus}
              errorMessage={error}
              onRetry={resetState}
            />
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

      {error && !uploading && (
        <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
