export type PreviewKind = 'pdf' | 'image' | 'markdown' | 'text' | 'document';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tiff', '.tif', '.svg'];
const MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.mdx'];
const TEXT_EXTENSIONS = ['.txt', '.text', '.log', '.csv'];
const DOCUMENT_EXTENSIONS = ['.docx', '.doc', '.rtf', '.odt'];

export function getFileExtension(filename?: string | null): string {
  if (!filename) return '';
  const match = /\.[^./\\]+$/.exec(filename.trim().toLowerCase());
  return match ? match[0] : '';
}

/**
 * Which viewer should render this file.
 *
 * `document` (.docx and friends) can't be rendered natively by the browser, so it
 * falls through to the typography reader backed by the server-extracted text.
 */
export function getPreviewKind(filename?: string | null): PreviewKind {
  const ext = getFileExtension(filename);
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (MARKDOWN_EXTENSIONS.includes(ext)) return 'markdown';
  if (TEXT_EXTENSIONS.includes(ext)) return 'text';
  if (DOCUMENT_EXTENSIONS.includes(ext)) return 'document';
  return 'pdf';
}

export function getPreviewKindLabel(kind: PreviewKind): string {
  switch (kind) {
    case 'image': return 'Image';
    case 'markdown': return 'Markdown';
    case 'text': return 'Text';
    case 'document': return 'Document';
    case 'pdf':
    default: return 'PDF';
  }
}

/** True when the reader should apply markdown formatting rather than plain paragraphs. */
export function shouldRenderMarkdown(kind: PreviewKind): boolean {
  return kind === 'markdown';
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
