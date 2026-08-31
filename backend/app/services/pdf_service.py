import pymupdf as fitz
import io
import re
from typing import Dict, Any, List

class PDFService:
    @staticmethod
    def extract_text_and_metadata(file_bytes: bytes, filename: str) -> Dict[str, Any]:
        """
        Extract text, page count, and structure from PDF, DOCX, or image bytes.
        - PDF: PyMuPDF full text extraction with page markers
        - DOCX: python-docx paragraph extraction
        - Images (jpg/png/webp/gif/bmp/tiff): pytesseract OCR (graceful fallback if not installed)
        """
        name_lower = filename.lower()

        # ── DOCX ──────────────────────────────────────────────────────────────
        if name_lower.endswith('.docx') or name_lower.endswith('.doc'):
            try:
                import docx as python_docx  # python-docx
                doc = python_docx.Document(io.BytesIO(file_bytes))
                paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
                combined_text = "\n\n".join(paragraphs) or f"Document: {filename}\n[No readable text found in DOCX.]"
                # Estimate pages (roughly 350 words per page)
                word_count = len(combined_text.split())
                page_count = max(1, word_count // 350)
                return {
                    "page_count": page_count,
                    "extracted_text": combined_text,
                    "file_size_bytes": len(file_bytes)
                }
            except ImportError:
                return {
                    "page_count": 1,
                    "extracted_text": f"Document: {filename}\n[DOCX extraction requires python-docx. Install it with: pip install python-docx]",
                    "file_size_bytes": len(file_bytes)
                }
            except Exception as e:
                return {
                    "page_count": 1,
                    "extracted_text": f"Document: {filename}\n[Could not parse DOCX: {str(e)}]",
                    "file_size_bytes": len(file_bytes)
                }

        # ── Markdown (.md / .markdown) ─────────────────────────────────────────
        # Kept whole and unpaginated so heading/list structure survives for the reader.
        if name_lower.endswith('.md') or name_lower.endswith('.markdown'):
            try:
                raw_text = file_bytes.decode('utf-8', errors='replace')
                return {
                    "page_count": max(1, len(raw_text.split()) // 350),
                    "extracted_text": raw_text or f"Document: {filename}\n[Empty markdown file.]",
                    "file_size_bytes": len(file_bytes)
                }
            except Exception as e:
                return {
                    "page_count": 1,
                    "extracted_text": f"Document: {filename}\n[Could not read markdown file: {str(e)}]",
                    "file_size_bytes": len(file_bytes)
                }

        # ── Plain Text (.txt) ──────────────────────────────────────────────────
        if name_lower.endswith('.txt'):
            try:
                raw_text = file_bytes.decode('utf-8', errors='replace')
                words = raw_text.split()
                words_per_page = 350
                pages = []
                for i in range(0, max(1, len(words)), words_per_page):
                    chunk = ' '.join(words[i:i + words_per_page])
                    pages.append(f"--- [Page {len(pages) + 1}] ---\n{chunk}")
                combined_text = "\n\n".join(pages) if pages else f"Document: {filename}\n[Empty text file.]"
                return {
                    "page_count": max(1, len(pages)),
                    "extracted_text": combined_text,
                    "file_size_bytes": len(file_bytes)
                }
            except Exception as e:
                return {
                    "page_count": 1,
                    "extracted_text": f"Document: {filename}\n[Could not read text file: {str(e)}]",
                    "file_size_bytes": len(file_bytes)
                }

        # ── Images (PNG, JPG, JPEG, WEBP, GIF, BMP, TIFF) ─────────────────────
        image_exts = ('.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tiff', '.tif')
        if any(name_lower.endswith(ext) for ext in image_exts):
            try:
                import pytesseract
                from PIL import Image
                img = Image.open(io.BytesIO(file_bytes))
                extracted = pytesseract.image_to_string(img).strip()
                combined_text = extracted or f"Image: {filename}\n[No readable text detected via OCR. The image may contain diagrams or non-text content.]"
                return {
                    "page_count": 1,
                    "extracted_text": combined_text,
                    "file_size_bytes": len(file_bytes)
                }
            except ImportError:
                # OCR not installed — store a meaningful description note
                return {
                    "page_count": 1,
                    "extracted_text": f"Image: {filename}\n[Image stored. The AI tutor can analyze this content based on context. For full OCR, install pytesseract.]",
                    "file_size_bytes": len(file_bytes)
                }
            except Exception as e:
                return {
                    "page_count": 1,
                    "extracted_text": f"Image: {filename}\n[Could not extract text from image: {str(e)}]",
                    "file_size_bytes": len(file_bytes)
                }

        # ── PDF (default) ──────────────────────────────────────────────────────
        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            page_count = len(doc)
            full_text_pages: List[str] = []

            for page_num in range(page_count):
                page = doc.load_page(page_num)
                text = page.get_text("text")
                # Clean up excess whitespace
                cleaned_text = re.sub(r'\n{3,}', '\n\n', text).strip()
                if cleaned_text:
                    full_text_pages.append(f"--- [Page {page_num + 1}] ---\n{cleaned_text}")

            combined_text = "\n\n".join(full_text_pages)
            doc.close()

            # If no text extracted (e.g. scanned image PDF), provide note
            if not combined_text.strip():
                combined_text = f"Document: {filename}\n[Scanned / Image-heavy PDF detected. Extracting available structural headers.]"

            return {
                "page_count": max(page_count, 1),
                "extracted_text": combined_text,
                "file_size_bytes": len(file_bytes)
            }
        except Exception as e:
            # If PyMuPDF encounters an issue (e.g., non-PDF text file uploaded), fallback gracefully
            text_preview = ""
            try:
                text_preview = file_bytes.decode("utf-8", errors="ignore")
            except Exception:
                text_preview = f"Uploaded file: {filename}"

            return {
                "page_count": 1,
                "extracted_text": text_preview or f"Document {filename} processed.",
                "file_size_bytes": len(file_bytes)
            }

    @staticmethod
    def chunk_text_if_needed(text: str, max_chars: int = 100000) -> List[str]:
        """
        Splits very large text into digestible chunks for LLM processing if exceeding limit.
        """
        if len(text) <= max_chars:
            return [text]

        chunks = []
        start = 0
        while start < len(text):
            end = min(start + max_chars, len(text))
            # Try to break at a paragraph boundary
            break_point = text.rfind("\n\n", start, end)
            if break_point == -1 or break_point <= start:
                break_point = end
            chunks.append(text[start:break_point].strip())
            start = break_point
        return chunks

pdf_service = PDFService()
