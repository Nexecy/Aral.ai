'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  File,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Search,
  Sparkles,
  UploadCloud
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Document } from '@/lib/types';
import { api } from '@/lib/api';
import { useEmailGate } from '@/context/AuthContext';
import {
  formatFileSize,
  getPreviewKind,
  getPreviewKindLabel,
  shouldRenderMarkdown,
  PreviewKind
} from '@/lib/fileTypes';
import { useTextSelection } from '@/hooks/useTextSelection';
import { SelectionActionMenu } from '@/components/study/SelectionActionMenu';
import { ImageViewer } from '@/components/study/viewers/ImageViewer';
import { TextReader } from '@/components/study/viewers/TextReader';
import { PdfViewer } from '@/components/study/viewers/PdfViewer';
import { PageNavigatorPopover } from '@/components/study/PageNavigatorPopover';
import { UploadProgressBar, UploadFileMeta } from '@/components/study/UploadProgressBar';

export const ACCEPTED_EXTENSIONS = [
  '.pdf', '.docx', '.doc', '.txt', '.md',
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tiff', '.tif'
];

const ACCEPT_ATTR =
  '.pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tiff,.tif,' +
  'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/msword,text/plain,text/markdown,image/*';

type ViewFormat = 'original' | 'text';

interface DocumentViewerProps {
  document: Document | null | undefined;
  sessionTitle: string;
  height?: number;
  /** Append the excerpt to the tutor composer as an @context tag. */
  onAskTutor?: (text: string) => void;
  /** Open the flashcard composer pre-filled with the excerpt. */
  onCreateFlashcard?: (text: string) => void;
  /** Immediately query the tutor to explain the excerpt. */
  onExplainConcept?: (text: string) => void;
  /** Fired once the raw file has been fetched, so callers can cache it offline. */
  onFileFetched?: (blob: Blob) => void;
}

const KIND_ICON: Record<PreviewKind, typeof FileText> = {
  pdf: FileText,
  image: ImageIcon,
  markdown: File,
  text: AlignLeft,
  document: File
};

/**
 * Multi-format preview engine. Picks the renderer from the uploaded file type:
 * native PDF canvas, an interactive image stage, or a typography reader for
 * text/markdown/Word content.
 */
function DocumentViewerImpl({
  document,
  sessionTitle,
  height = 580,
  onAskTutor,
  onCreateFlashcard,
  onExplainConcept,
  onFileFetched
}: DocumentViewerProps) {
  const router = useRouter();
  const { allowed: aiAllowed } = useEmailGate();

  const kind = getPreviewKind(document?.filename);
  // Only PDFs and images have a meaningful "original" rendering; Word/text files
  // are always read through the extracted-text reader.
  const supportsOriginal = kind === 'pdf' || kind === 'image';

  const [viewFormat, setViewFormat] = useState<ViewFormat>(supportsOriginal ? 'original' : 'text');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showPageNavigator, setShowPageNavigator] = useState<boolean>(false);

  const [pdfTotalPages, setPdfTotalPages] = useState<number>(document?.page_count || 1);

  const readerRef = useRef<HTMLDivElement | null>(null);
  const { selection, clearSelection } = useTextSelection(readerRef, true);

  // The file route is user-scoped, so the bytes are fetched with the auth header
  // and rendered from an object URL rather than pointing `src` at the API.
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    setViewFormat(supportsOriginal ? 'original' : 'text');
    setCurrentPage(1);
    setZoomLevel(100);
  }, [document?.id, supportsOriginal]);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  // Fetch once per document, mirroring the bytes so the session survives offline.
  const onFileFetchedRef = useRef(onFileFetched);
  onFileFetchedRef.current = onFileFetched;

  useEffect(() => {
    const documentId = document?.id;
    if (!documentId) {
      setFileUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setFileError(null);

    api
      .fetchDocumentFile(documentId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setFileUrl(objectUrl);
        onFileFetchedRef.current?.(blob);
      })
      .catch((err: Error) => {
        if (!cancelled) setFileError(err.message || 'Could not load this file.');
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [document?.id]);

  const isMarkdown = shouldRenderMarkdown(kind);

  // Split extracted text into pages on the backend's page markers. Markdown is
  // kept whole so its document structure survives.
  const [extractedText, setExtractedText] = useState<string>(document?.extracted_text || '');

  useEffect(() => {
    setExtractedText(document?.extracted_text || '');
  }, [document?.id, document?.extracted_text]);

  const needsExtract = viewFormat === 'text' || !supportsOriginal;

  useEffect(() => {
    const documentId = document?.id;
    if (!documentId || !needsExtract) return;
    if ((extractedText || '').trim()) return;

    let cancelled = false;
    api
      .getDocument(documentId)
      .then((full) => {
        if (!cancelled && full.extracted_text) setExtractedText(full.extracted_text);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [document?.id, needsExtract, extractedText]);

  const pages = useMemo(() => {
    const raw = extractedText || '';
    if (!raw.trim()) return [''];
    if (isMarkdown) return [raw];

    const chunks = raw
      .split(/--- \[Page \d+\] ---/g)
      .map((p) => p.trim())
      .filter(Boolean);
    return chunks.length > 0 ? chunks : [raw];
  }, [extractedText, isMarkdown]);

  const totalPages = viewFormat === 'original' && kind === 'pdf'
    ? (pdfTotalPages || document?.page_count || 1)
    : pages.length;
  const activePage = pages[Math.min(currentPage, pages.length || 1) - 1] || '';

  // ── Upload flow (shown when the session has no document yet) ────────────────
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadDragging, setUploadDragging] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [selectedUploadFile, setSelectedUploadFile] = useState<UploadFileMeta | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [uploadStep, setUploadStep] = useState<string>('');
  const [uploadByteProgress, setUploadByteProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'uploading' | 'processing' | 'success' | 'error'>('uploading');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const resetUploadState = useCallback(() => {
    setUploading(false);
    setSelectedUploadFile(null);
    setUploadPercent(0);
    setUploadStep('');
    setUploadByteProgress(null);
    setUploadStatus('uploading');
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleUploadFile = useCallback(async (file: File) => {
    const name = file.name.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      setUploadError('Unsupported file. Upload a PDF, Word document, markdown/text file, or image.');
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setUploadError('File exceeds the 30MB limit.');
      return;
    }

    setUploadError(null);
    setSelectedUploadFile({ name: file.name, size: file.size });
    setUploading(true);
    setUploadStatus('uploading');
    setUploadPercent(5);
    setUploadStep('Uploading document...');
    setUploadByteProgress({ loaded: 0, total: file.size });

    try {
      const doc = await api.uploadDocument(file, (prog) => {
        const mapped = Math.min(70, Math.max(5, Math.round(5 + (prog.percent * 0.65))));
        setUploadPercent(mapped);
        setUploadByteProgress({ loaded: prog.loaded, total: prog.total });
        setUploadStep(`Uploading document... ${prog.percent}%`);
      });

      setUploadStatus('processing');
      setUploadPercent(75);
      setUploadStep('Extracting text & structure with PyMuPDF...');

      setUploadPercent(88);
      setUploadStep('Creating study session...');
      const title = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      const session = await api.createSession(title, doc.id);
      if (aiAllowed) {
        void api.generateNotes(session.id).catch(() => {});
      }

      setUploadPercent(100);
      setUploadStatus('success');
      setUploadStep('Ready! Opening workspace...');

      setTimeout(() => {
        router.push(`/session/${session.id}/`);
      }, 400);
    } catch (err: any) {
      setUploadStatus('error');
      setUploadError(err.message || 'Failed to process document.');
    }
  }, [router, aiAllowed]);

  if (!document) {
    return (
      <div
        className="flex flex-col bg-surface-container-lowest border border-outline-variant rounded-3xl overflow-hidden"
        style={{ height: `${height}px` }}
      >
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-outline-variant">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-on-surface">No Document</h2>
              <p className="text-xs text-on-surface-variant">Upload a file to begin studying</p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div
            onDragEnter={(e) => { e.preventDefault(); setUploadDragging(true); }}
            onDragOver={(e) => { e.preventDefault(); setUploadDragging(true); }}
            onDragLeave={() => setUploadDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setUploadDragging(false);
              if (e.dataTransfer.files[0]) handleUploadFile(e.dataTransfer.files[0]);
            }}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`w-full max-w-lg border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all duration-200 ${
              uploading ? 'cursor-default' : 'cursor-pointer'
            } ${
              uploadDragging
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : 'border-outline-variant hover:border-primary/50 hover:bg-surface-container'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTR}
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleUploadFile(e.target.files[0]); }}
              disabled={uploading && uploadStatus !== 'error'}
            />

            {uploading && selectedUploadFile ? (
              <div className="py-2 flex flex-col items-center justify-center">
                <UploadProgressBar
                  file={selectedUploadFile}
                  percent={uploadPercent}
                  stage={uploadStep}
                  byteProgress={uploadByteProgress}
                  status={uploadStatus}
                  errorMessage={uploadError}
                  onRetry={resetUploadState}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-lg font-bold text-on-surface">Drop your study material here</p>
                  <p className="text-sm text-on-surface-variant mt-1 max-w-xs mx-auto">
                    Aral.ai will extract structured notes, flashcards, and quizzes automatically.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container border border-outline-variant text-xs font-semibold text-on-surface">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    PDF
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container border border-outline-variant text-xs font-semibold text-on-surface">
                    <File className="w-3.5 h-3.5 text-sticker-sky" />
                    Word / TXT / MD
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container border border-outline-variant text-xs font-semibold text-on-surface">
                    <ImageIcon className="w-3.5 h-3.5 text-sticker-teal" />
                    Images
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant">Up to 30MB per file</p>
              </div>
            )}

            {uploadError && !uploading && (
              <p className="mt-4 text-xs text-destructive font-medium bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {uploadError}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const displayFilename = document.filename || sessionTitle;
  const KindIcon = KIND_ICON[kind];
  const showControls = viewFormat === 'text' || (viewFormat === 'original' && kind === 'pdf');

  const handleSelectionAction = (run?: (text: string) => void) => (text: string) => {
    run?.(text);
    clearSelection();
  };

  return (
    <div
      className={`flex flex-col bg-surface-container-lowest border border-outline-variant rounded-3xl overflow-hidden relative transition-all duration-300 ${
        isFullscreen ? 'fixed inset-4 z-50 shadow-2xl' : ''
      }`}
      style={isFullscreen ? undefined : { height: `${height}px` }}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5 border-b border-outline-variant bg-surface-container-lowest z-10 gap-2.5">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-sm">
            <KindIcon className="w-5 h-5" />
          </div>
          <div className="max-w-[180px] sm:max-w-xs truncate">
            <h2 className="text-sm sm:text-base text-on-surface line-clamp-1 font-bold">
              {displayFilename}
            </h2>
            <p className="text-xs text-on-surface-variant font-medium">
              {getPreviewKindLabel(kind)}
              {kind !== 'image' && ` • ${totalPages} ${totalPages === 1 ? 'Page' : 'Pages'}`}
              {` • ${formatFileSize(document.file_size_bytes)}`}
            </p>
          </div>
        </div>

        {/* Original vs extracted-text toggle (only where an original rendering exists) */}
        {supportsOriginal && (
          <div className="flex items-center bg-surface-container p-1 rounded-full border border-outline-variant/60">
            <button
              onClick={() => setViewFormat('original')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                viewFormat === 'original'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{kind === 'image' ? 'Image' : 'Original PDF'}</span>
            </button>
            <button
              onClick={() => setViewFormat('text')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                viewFormat === 'text'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <AlignLeft className="w-3.5 h-3.5" />
              <span>Text Layer</span>
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          {showControls && (
            <>
              {totalPages > 1 && (
                <div className="flex items-center gap-1 bg-surface-container rounded-full px-2.5 py-1.5 border border-outline-variant/60">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowPageNavigator(true)}
                    className="font-mono text-xs font-bold text-on-surface hover:text-primary hover:bg-surface-container-highest px-2 py-0.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer group"
                    title="Click to preview all pages & jump"
                  >
                    <span>{currentPage} / {totalPages}</span>
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {showSearch ? (
                <div className="flex items-center gap-1.5 bg-surface-container px-3 py-1 rounded-full border border-outline-variant">
                  <Search className="w-3.5 h-3.5 text-on-surface-variant" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.stopPropagation();
                        setSearchTerm('');
                        setShowSearch(false);
                      }
                    }}
                    placeholder="Find in page..."
                    className="w-24 text-xs bg-transparent text-on-surface focus:outline-none placeholder:text-outline"
                    autoFocus
                  />
                  <button
                    onClick={() => { setSearchTerm(''); setShowSearch(false); }}
                    className="text-xs text-on-surface-variant hover:text-on-surface font-bold px-1"
                    aria-label="Close search"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSearch(true)}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
                  title="Search in document"
                >
                  <Search className="w-4 h-4" />
                </button>
              )}

              <div className="flex items-center gap-1 bg-surface-container rounded-full px-2 py-1 border border-outline-variant/60">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(z - 10, 70))}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest transition-colors"
                  title="Zoom out"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setZoomLevel(100)}
                  className="font-mono text-xs font-bold text-on-surface w-10 text-center"
                  title="Reset zoom"
                >
                  {zoomLevel}%
                </button>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(z + 10, 160))}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest transition-colors"
                  title="Zoom in"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}

          {fileUrl && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
              title="Open original file in a new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
            title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen reader'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── Renderer ─────────────────────────────────────────────────────────── */}

      {viewFormat === 'original' && supportsOriginal && !fileUrl && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-surface-container-low p-6 text-center">
          {fileError ? (
            <>
              <p className="text-sm font-semibold text-on-surface">Couldn&apos;t load this file</p>
              <p className="text-xs text-on-surface-variant max-w-xs">{fileError}</p>
              <button
                onClick={() => setViewFormat('text')}
                className="px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-bold"
              >
                Read the text layer instead
              </button>
            </>
          ) : (
            <>
              <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              <p className="text-xs text-on-surface-variant">Loading document…</p>
            </>
          )}
        </div>
      )}

      {viewFormat === 'original' && kind === 'pdf' && fileUrl && (
        <PdfViewer
          fileUrl={fileUrl}
          title={displayFilename}
          currentPage={currentPage}
          onTotalPagesLoaded={(count) => {
            if (count > 0) setPdfTotalPages(count);
          }}
          onPageChange={(page) => setCurrentPage(page)}
          zoomLevel={zoomLevel}
          searchTerm={searchTerm}
          selectionContainerRef={readerRef}
        />
      )}

      {viewFormat === 'original' && kind === 'image' && fileUrl && (
        <ImageViewer src={fileUrl} alt={displayFilename} />
      )}

      {viewFormat === 'text' && (
        <div
          ref={readerRef}
          className="flex-1 p-6 sm:p-10 overflow-y-auto bg-surface-container-low select-text custom-scrollbar"
        >
          <TextReader
            content={activePage}
            title={sessionTitle}
            filename={displayFilename}
            pageLabel={totalPages > 1 ? `Page ${currentPage} / ${totalPages}` : undefined}
            markdown={isMarkdown}
            zoomLevel={zoomLevel}
            searchTerm={searchTerm}
          />
        </div>
      )}

      <SelectionActionMenu
        selection={selection}
        onAskTutor={handleSelectionAction(onAskTutor)}
        onCreateFlashcard={handleSelectionAction(onCreateFlashcard)}
        onExplainConcept={handleSelectionAction(onExplainConcept)}
        onDismiss={clearSelection}
      />

      <PageNavigatorPopover
        isOpen={showPageNavigator}
        onClose={() => setShowPageNavigator(false)}
        currentPage={currentPage}
        totalPages={totalPages}
        onSelectPage={(page) => setCurrentPage(page)}
        fileUrl={fileUrl}
        isPdf={viewFormat === 'original' && kind === 'pdf'}
        extractedPages={pages}
        sessionTitle={sessionTitle}
      />
    </div>
  );
}

/**
 * Memoised at the component boundary: the workspace re-renders on every timer
 * tick and chat token, and without this the PDF iframe and the extracted-text
 * reader would be reconciled each time.
 */
export const DocumentViewer = React.memo(DocumentViewerImpl);
