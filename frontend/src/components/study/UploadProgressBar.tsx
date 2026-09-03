'use client';

import React from 'react';
import {
  FileText,
  File,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  RefreshCw
} from 'lucide-react';

export interface UploadFileMeta {
  name: string;
  size: number;
}

export interface UploadProgressBarProps {
  file: UploadFileMeta;
  percent: number; // 0 to 100
  stage: string;
  byteProgress?: { loaded: number; total: number } | null;
  status: 'uploading' | 'processing' | 'success' | 'error';
  errorMessage?: string | null;
  onRetry?: () => void;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function getFileIcon(filename: string) {
  const ext = filename.toLowerCase();
  if (ext.endsWith('.pdf')) return { icon: FileText, color: 'text-primary bg-primary/10 border-primary/20' };
  if (ext.endsWith('.docx') || ext.endsWith('.doc')) return { icon: File, color: 'text-sticker-sky bg-sticker-sky/10 border-sticker-sky/20' };
  return { icon: ImageIcon, color: 'text-sticker-teal bg-sticker-teal/10 border-sticker-teal/20' };
}

export function UploadProgressBar({
  file,
  percent,
  stage,
  byteProgress,
  status,
  errorMessage,
  onRetry
}: UploadProgressBarProps) {
  const safePercent = Math.min(100, Math.max(0, Math.round(percent)));
  const { icon: FileIcon, color: iconColor } = getFileIcon(file.name);

  return (
    <div className="w-full max-w-lg mx-auto p-5 sm:p-6 bg-card rounded-2xl border border-border/80 shadow-notion-soft space-y-4 text-left animate-in fade-in-50 duration-200">
      {/* File Info & Percentage Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${iconColor}`}>
            <FileIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate max-w-[200px] sm:max-w-xs" title={file.name}>
              {file.name}
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              {formatBytes(file.size)}
              {byteProgress && byteProgress.total > 0 && status === 'uploading' && (
                <span className="ml-1.5 text-muted-foreground/80">
                  • {formatBytes(byteProgress.loaded)} sent
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          {status === 'success' ? (
            <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" /> 100%
            </span>
          ) : status === 'error' ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-destructive">
              Failed
            </span>
          ) : (
            <span className="text-base font-bold font-mono text-primary tracking-tight">
              {safePercent}%
            </span>
          )}
        </div>
      </div>

      {/* Progress Track & Bar */}
      <div className="relative w-full h-2.5 bg-muted/70 dark:bg-muted/40 rounded-full overflow-hidden">
        <div
          role="progressbar"
          aria-valuenow={safePercent}
          aria-valuemin={0}
          aria-valuemax={100}
          className={`h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden ${
            status === 'error'
              ? 'bg-destructive'
              : status === 'success'
              ? 'bg-emerald-500'
              : 'bg-gradient-to-r from-primary via-sticker-sky to-primary bg-[length:200%_100%] animate-pulse'
          }`}
          style={{ width: `${status === 'error' ? 100 : Math.max(4, safePercent)}%` }}
        />
      </div>

      {/* Stage Status / Messaging */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
        <div className="flex items-center gap-2 min-w-0">
          {status === 'error' ? (
            <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
          ) : status === 'success' ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          ) : status === 'processing' ? (
            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 animate-pulse" />
          ) : (
            <Loader2 className="w-3.5 h-3.5 text-primary shrink-0 animate-spin" />
          )}

          <span
            className={`truncate ${
              status === 'error'
                ? 'text-destructive font-medium'
                : status === 'success'
                ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                : 'text-foreground/90 font-medium'
            }`}
          >
            {errorMessage || stage}
          </span>
        </div>

        {status === 'error' && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline ml-2 shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" /> Try again
          </button>
        )}
      </div>
    </div>
  );
}
