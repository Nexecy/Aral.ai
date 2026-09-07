import pymupdf as fitz
import io
import re
import gc
import asyncio
import logging
from typing import Dict, Any, List, Optional, Tuple
from app.core.config import settings

logger = logging.getLogger("pdf_service")
if not logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("[%(levelname)s] %(message)s"))
    logger.addHandler(_handler)
    logger.setLevel(logging.INFO)


class PDFService:
    """
    Core document and PDF extraction engine for Aral.ai.
    - Stack: Python backend powered by PyMuPDF (fitz) with multimodal vision OCR fallback.
    - Capabilities:
      1. Permission Stripping & Decryption (empty-password unlock + PDF_ENCRYPT_NONE re-save).
      2. Missing /ToUnicode & non-Unicode glyph detection.
      3. 200 DPI page image rendering and OCR fallback (Gemini Vision + pytesseract).
      4. Per-page provenance tracking (native, decrypted, or ocr).
    """

    @staticmethod
    def _is_poor_or_unmapped_text(text: str, page: fitz.Page) -> Tuple[bool, str]:
        """
        Evaluates extracted text quality to detect missing /ToUnicode mappings,
        non-Unicode encodings, or scanned/image pages.
        """
        clean = text.strip()
        if not clean:
            # Check if page has visual content (drawings, images, vector paths)
            has_visuals = (
                len(page.get_drawings()) > 0
                or len(page.get_images()) > 0
                or page.rect.width > 0
            )
            if has_visuals:
                return True, "Empty text stream despite visual content on page"
            return False, "Blank page"

        # Count valid printable alphanumeric and common punctuation characters
        valid_printable = sum(
            1 for c in clean
            if c.isalnum() or c in ",.?!:;'-–—\"'()[]{}/@#$%&*+=\\<>~"
        )

        # Count unmapped artifacts: null bytes, Unicode replacement character, Private Use Area
        unmapped_chars = (
            text.count("\ufffd")
            + text.count("\x00")
            + sum(1 for c in text if "\ue000" <= c <= "\uf8ff")
        )

        # 1. Very low printable character density on a non-empty page
        if valid_printable < 20:
            return True, f"Low character density ({valid_printable} printable characters)"

        # 2. High ratio of unmapped / replacement glyphs indicating missing /ToUnicode CMap
        unmapped_ratio = unmapped_chars / max(len(clean), 1)
        if unmapped_chars > 5 and unmapped_ratio > 0.25:
            return True, f"Unmapped/non-Unicode glyphs detected ({unmapped_chars} unmapped glyphs, {unmapped_ratio:.1%})"

        return False, "Valid native text stream"

    @staticmethod
    def _run_pytesseract_ocr(img_bytes: bytes) -> Optional[str]:
        bio = None
        img = None
        try:
            import pytesseract
            from PIL import Image
            bio = io.BytesIO(img_bytes)
            img = Image.open(bio)
            tess_text = pytesseract.image_to_string(img).strip()
            if tess_text and len(tess_text) > 10:
                return tess_text
        except Exception:
            pass
        finally:
            if img is not None:
                try:
                    img.close()
                except Exception:
                    pass
                del img
            if bio is not None:
                try:
                    bio.close()
                except Exception:
                    pass
                del bio
        return None

    @staticmethod
    def _perform_ocr_on_page(
        page: fitz.Page,
        page_num: int,
        filename: str,
        dpi: Optional[int] = None,
        max_dimension: Optional[int] = None
    ) -> Tuple[Optional[str], str]:
        """
        Renders the page at ~130-150 DPI directly to a compressed JPEG byte buffer
        and invokes OCR fallback with immediate pixmap memory release.
        Priority:
        1. Gemini Multimodal Vision API (high-accuracy layout & text transcription).
        2. Local pytesseract (if installed and working).
        """
        pix = None
        img_bytes = None
        try:
            # Render page directly to compressed JPEG buffer (~130-150 DPI via Matrix(1.5, 1.5))
            pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
            img_bytes = pix.tobytes("jpeg")
        except Exception as e:
            logger.warning(f"[PDFService] Failed to render page {page_num + 1} of '{filename}' to image: {e}")
            return None, "render_failed"
        finally:
            # Immediately release C pixmap memory
            if pix is not None:
                del pix

        ocr_result_text = None
        ocr_source_method = "ocr_unavailable"

        # 1. Gemini Multimodal Vision OCR
        try:
            from app.services.gemini_service import gemini_service
            if hasattr(gemini_service, "transcribe_page_image_sync"):
                ocr_result = gemini_service.transcribe_page_image_sync(img_bytes, mime_type="image/jpeg")
                if ocr_result and len(ocr_result.strip()) > 10:
                    ocr_result_text = ocr_result.strip()
                    ocr_source_method = "ocr_fallback (gemini_vision)"
        except Exception as e:
            logger.debug(f"[PDFService] Gemini Vision OCR attempt for page {page_num + 1} skipped/failed: {e}")

        # 2. Local pytesseract fallback
        if not ocr_result_text:
            tess = PDFService._run_pytesseract_ocr(img_bytes)
            if tess:
                ocr_result_text = tess
                ocr_source_method = "ocr_fallback (pytesseract)"

        # Explicitly release image byte buffer and trigger collection
        del img_bytes
        gc.collect()

        return ocr_result_text, ocr_source_method

    @staticmethod
    async def extract_text_and_metadata_async(
        file_bytes: bytes,
        filename: str,
        concurrency: Optional[int] = None,
        on_page_callback: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Asynchronously parses and transcribes documents using bounded concurrency (asyncio.Semaphore),
        in-memory JPEG streaming, immediate pixmap drops, progressive database persistence, and GC.
        """
        name_lower = filename.lower()
        if not name_lower.endswith(".pdf"):
            return await asyncio.to_thread(PDFService.extract_text_and_metadata, file_bytes, filename)

        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")

            # 1. Permission Stripping / Decryption
            is_encrypted_doc = bool(doc.is_encrypted or doc.needs_pass or doc.metadata.get("encryption"))
            is_copy_prohibited = not bool(doc.permissions & fitz.PDF_PERM_COPY)
            was_encrypted = is_encrypted_doc or is_copy_prohibited
            unlocked_with_empty_pass = False
            sanitized_bytes = None

            if is_encrypted_doc or doc.needs_pass:
                auth_status = doc.authenticate("")
                if auth_status > 0:
                    unlocked_with_empty_pass = True
                    logger.info(f"[PDFService] '{filename}' unlocked with empty password.")
                else:
                    logger.warning(f"[PDFService] '{filename}' could not be unlocked with empty string.")

            if was_encrypted or is_copy_prohibited:
                try:
                    clean_stream = doc.tobytes(encryption=fitz.PDF_ENCRYPT_NONE, garbage=3, deflate=True)
                    if clean_stream and len(clean_stream) > 100:
                        sanitized_bytes = clean_stream
                        doc.close()
                        doc = fitz.open(stream=sanitized_bytes, filetype="pdf")
                        logger.info(f"[PDFService] '{filename}' permission flags stripped. Unrestricted streams loaded.")
                except Exception as e:
                    logger.debug(f"[PDFService] Permission stripping notice for '{filename}': {e}")

            page_count = len(doc)
            max_concurrency = concurrency or getattr(settings, "PDF_OCR_CONCURRENCY", 5)
            semaphore = asyncio.Semaphore(max_concurrency)
            render_lock = asyncio.Lock()

            page_results: Dict[int, Dict[str, Any]] = {}

            async def _process_page_async(page_num: int):
                async with semaphore:
                    img_bytes = None
                    cleaned_text = ""
                    needs_ocr = False
                    reason = ""

                    # Synchronize PyMuPDF page loading and JPEG rendering under lock
                    async with render_lock:
                        page = doc.load_page(page_num)
                        try:
                            raw_text = page.get_text("text")
                            cleaned_text = re.sub(r"\n{3,}", "\n\n", raw_text).strip()
                            needs_ocr, reason = PDFService._is_poor_or_unmapped_text(cleaned_text, page)

                            if needs_ocr:
                                # Render page at ~130-150 DPI directly to compressed JPEG byte buffer
                                pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
                                img_bytes = pix.tobytes("jpeg")
                                del pix  # Drop raw uncompressed pixmap immediately!
                        finally:
                            del page

                    if not needs_ocr:
                        page_text = cleaned_text
                        source_type = "decrypted_stream" if (was_encrypted or unlocked_with_empty_pass) else "native_stream"
                    else:
                        page_text = cleaned_text
                        source_type = "ocr_unavailable"
                        if img_bytes:
                            try:
                                from app.services.gemini_service import gemini_service
                                ocr_result = await gemini_service.transcribe_page_image(img_bytes, mime_type="image/jpeg")
                                if ocr_result and len(ocr_result.strip()) > 10:
                                    page_text = ocr_result.strip()
                                    source_type = "ocr_fallback (gemini_vision)"
                                else:
                                    tess = await asyncio.to_thread(PDFService._run_pytesseract_ocr, img_bytes)
                                    if tess and len(tess.strip()) > 10:
                                        page_text = tess.strip()
                                        source_type = "ocr_fallback (pytesseract)"
                            except Exception as e:
                                logger.debug(f"[PDFService] OCR error on page {page_num + 1}: {e}")
                            finally:
                                del img_bytes
                                gc.collect()

                    page_results[page_num] = {
                        "page_number": page_num + 1,
                        "text": page_text,
                        "source": source_type,
                        "character_count": len(page_text)
                    }

                    # Persist extracted text progressively to Supabase as each page resolves
                    if on_page_callback:
                        try:
                            current_texts = [
                                f"--- [Page {idx + 1}] ---\n{page_results[idx]['text']}"
                                for idx in sorted(page_results.keys())
                                if page_results[idx]["text"].strip()
                            ]
                            await on_page_callback(
                                page_num=page_num + 1,
                                current_text="\n\n".join(current_texts),
                                current_page_count=page_count
                            )
                        except Exception as cb_err:
                            logger.debug(f"[PDFService] Progressive update callback notice: {cb_err}")

                    gc.collect()

            # Process all pages concurrently (bounded by semaphore to max 5 concurrent)
            await asyncio.gather(*(_process_page_async(i) for i in range(page_count)))

            full_text_pages = []
            page_provenance = []
            native_count = 0
            decrypted_count = 0
            ocr_count = 0

            for i in range(page_count):
                info = page_results.get(i, {"page_number": i + 1, "text": "", "source": "unmapped_fallback", "character_count": 0})
                page_provenance.append({
                    "page_number": info["page_number"],
                    "source": info["source"],
                    "character_count": info["character_count"]
                })
                if "gemini_vision" in info["source"] or "ocr" in info["source"]:
                    ocr_count += 1
                elif "decrypted" in info["source"]:
                    decrypted_count += 1
                else:
                    native_count += 1

                if info["text"].strip():
                    full_text_pages.append(f"--- [Page {i + 1}] ---\n{info['text']}")

            combined_text = "\n\n".join(full_text_pages)
            doc.close()
            del doc
            gc.collect()

            if not combined_text.strip():
                combined_text = f"Document: {filename}\n[Scanned / Image-heavy PDF detected. Extracting available structural headers.]"

            logger.info(
                f"[PDFService] Async extraction completed for '{filename}': {native_count} native, "
                f"{decrypted_count} decrypted, {ocr_count} OCR fallback across {page_count} pages."
            )

            return {
                "page_count": max(page_count, 1),
                "extracted_text": combined_text,
                "file_size_bytes": len(file_bytes),
                "sanitized_file_bytes": sanitized_bytes or file_bytes,
                "was_permission_restricted": was_encrypted,
                "page_provenance": page_provenance,
                "extraction_summary": {
                    "native_pages": native_count,
                    "decrypted_pages": decrypted_count,
                    "ocr_pages": ocr_count
                }
            }
        except Exception as e:
            logger.error(f"[PDFService] Error during async PDF extraction for '{filename}': {e}")
            return PDFService.extract_text_and_metadata(file_bytes, filename)

    @staticmethod
    def extract_text_and_metadata(file_bytes: bytes, filename: str) -> Dict[str, Any]:
        """
        Extract text, page count, and structure from PDF, DOCX, or image bytes.
        Handles:
        - Permission-restricted PDFs: empty-password decryption and permission flag stripping.
        - Non-Unicode PDFs: missing /ToUnicode CMap detection with 200 DPI OCR fallback.
        - DOCX & Text files.
        - Images with OCR.
        """
        name_lower = filename.lower()

        # ── DOCX ──────────────────────────────────────────────────────────────
        if name_lower.endswith(".docx") or name_lower.endswith(".doc"):
            try:
                import docx as python_docx
                doc = python_docx.Document(io.BytesIO(file_bytes))
                paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
                combined_text = "\n\n".join(paragraphs) or f"Document: {filename}\n[No readable text found in DOCX.]"
                word_count = len(combined_text.split())
                page_count = max(1, word_count // 350)
                return {
                    "page_count": page_count,
                    "extracted_text": combined_text,
                    "file_size_bytes": len(file_bytes),
                    "sanitized_file_bytes": file_bytes,
                    "extraction_summary": {"native_pages": page_count, "decrypted_pages": 0, "ocr_pages": 0},
                }
            except ImportError:
                return {
                    "page_count": 1,
                    "extracted_text": f"Document: {filename}\n[DOCX extraction requires python-docx. Install it with: pip install python-docx]",
                    "file_size_bytes": len(file_bytes),
                    "sanitized_file_bytes": file_bytes,
                    "extraction_summary": {"native_pages": 1, "decrypted_pages": 0, "ocr_pages": 0},
                }
            except Exception as e:
                return {
                    "page_count": 1,
                    "extracted_text": f"Document: {filename}\n[Could not parse DOCX: {str(e)}]",
                    "file_size_bytes": len(file_bytes),
                    "sanitized_file_bytes": file_bytes,
                    "extraction_summary": {"native_pages": 1, "decrypted_pages": 0, "ocr_pages": 0},
                }

        # ── Markdown (.md / .markdown) ─────────────────────────────────────────
        if name_lower.endswith(".md") or name_lower.endswith(".markdown"):
            try:
                raw_text = file_bytes.decode("utf-8", errors="replace")
                return {
                    "page_count": max(1, len(raw_text.split()) // 350),
                    "extracted_text": raw_text or f"Document: {filename}\n[Empty markdown file.]",
                    "file_size_bytes": len(file_bytes),
                    "sanitized_file_bytes": file_bytes,
                    "extraction_summary": {"native_pages": 1, "decrypted_pages": 0, "ocr_pages": 0},
                }
            except Exception as e:
                return {
                    "page_count": 1,
                    "extracted_text": f"Document: {filename}\n[Could not read markdown file: {str(e)}]",
                    "file_size_bytes": len(file_bytes),
                    "sanitized_file_bytes": file_bytes,
                    "extraction_summary": {"native_pages": 1, "decrypted_pages": 0, "ocr_pages": 0},
                }

        # ── Plain Text (.txt) ──────────────────────────────────────────────────
        if name_lower.endswith(".txt"):
            try:
                raw_text = file_bytes.decode("utf-8", errors="replace")
                words = raw_text.split()
                words_per_page = 350
                pages = []
                for i in range(0, max(1, len(words)), words_per_page):
                    chunk = " ".join(words[i:i + words_per_page])
                    pages.append(f"--- [Page {len(pages) + 1}] ---\n{chunk}")
                combined_text = "\n\n".join(pages) if pages else f"Document: {filename}\n[Empty text file.]"
                return {
                    "page_count": max(1, len(pages)),
                    "extracted_text": combined_text,
                    "file_size_bytes": len(file_bytes),
                    "sanitized_file_bytes": file_bytes,
                    "extraction_summary": {"native_pages": max(1, len(pages)), "decrypted_pages": 0, "ocr_pages": 0},
                }
            except Exception as e:
                return {
                    "page_count": 1,
                    "extracted_text": f"Document: {filename}\n[Could not read text file: {str(e)}]",
                    "file_size_bytes": len(file_bytes),
                    "sanitized_file_bytes": file_bytes,
                    "extraction_summary": {"native_pages": 1, "decrypted_pages": 0, "ocr_pages": 0},
                }

        # ── Images (PNG, JPG, JPEG, WEBP, GIF, BMP, TIFF) ─────────────────────
        image_exts = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tiff", ".tif")
        if any(name_lower.endswith(ext) for ext in image_exts):
            # Try Gemini Multimodal Vision first, then pytesseract
            try:
                from app.services.gemini_service import gemini_service
                if hasattr(gemini_service, "transcribe_page_image_sync"):
                    vision_text = gemini_service.transcribe_page_image_sync(file_bytes, mime_type=f"image/{name_lower.split('.')[-1]}")
                    if vision_text and len(vision_text.strip()) > 10:
                        logger.info(f"[PDFService] Image '{filename}' successfully transcribed via Gemini Vision OCR ({len(vision_text)} chars).")
                        return {
                            "page_count": 1,
                            "extracted_text": vision_text.strip(),
                            "file_size_bytes": len(file_bytes),
                            "sanitized_file_bytes": file_bytes,
                            "extraction_summary": {"native_pages": 0, "decrypted_pages": 0, "ocr_pages": 1},
                        }
            except Exception as e:
                logger.debug(f"[PDFService] Vision OCR attempt on raw image failed: {e}")

            bio = None
            img = None
            try:
                import pytesseract
                from PIL import Image
                bio = io.BytesIO(file_bytes)
                img = Image.open(bio)
                extracted = pytesseract.image_to_string(img).strip()
                combined_text = extracted or f"Image: {filename}\n[No readable text detected via OCR. The image may contain diagrams or non-text content.]"
                return {
                    "page_count": 1,
                    "extracted_text": combined_text,
                    "file_size_bytes": len(file_bytes),
                    "sanitized_file_bytes": file_bytes,
                    "extraction_summary": {"native_pages": 0, "decrypted_pages": 0, "ocr_pages": 1 if extracted else 0},
                }
            except ImportError:
                return {
                    "page_count": 1,
                    "extracted_text": f"Image: {filename}\n[Image stored. The AI tutor can analyze this content based on context. For full OCR, install pytesseract.]",
                    "file_size_bytes": len(file_bytes),
                    "sanitized_file_bytes": file_bytes,
                    "extraction_summary": {"native_pages": 0, "decrypted_pages": 0, "ocr_pages": 0},
                }
            except Exception as e:
                return {
                    "page_count": 1,
                    "extracted_text": f"Image: {filename}\n[Could not extract text from image: {str(e)}]",
                    "file_size_bytes": len(file_bytes),
                    "sanitized_file_bytes": file_bytes,
                    "extraction_summary": {"native_pages": 0, "decrypted_pages": 0, "ocr_pages": 0},
                }
            finally:
                if img is not None:
                    try:
                        img.close()
                    except Exception:
                        pass
                    del img
                if bio is not None:
                    try:
                        bio.close()
                    except Exception:
                        pass
                    del bio
                gc.collect()

        # ── PDF (default) ──────────────────────────────────────────────────────
        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")

            # ── 1. Permission Stripping / Decryption ───────────────────────────
            is_encrypted_doc = bool(doc.is_encrypted or doc.needs_pass or doc.metadata.get("encryption"))
            is_copy_prohibited = not bool(doc.permissions & fitz.PDF_PERM_COPY)
            was_encrypted = is_encrypted_doc or is_copy_prohibited
            unlocked_with_empty_pass = False
            sanitized_bytes = None

            if is_encrypted_doc or doc.needs_pass:
                # Attempt decryption using empty password ("")
                auth_status = doc.authenticate("")
                if auth_status > 0:
                    unlocked_with_empty_pass = True
                    logger.info(
                        f"[PDFService] '{filename}' has encryption/owner locks. "
                        f"Successfully decrypted using empty password."
                    )
                else:
                    logger.warning(
                        f"[PDFService] '{filename}' is password-encrypted and could not be unlocked with empty string."
                    )

            # Strip all Acrobat owner permission flags so streams are unrestricted
            if was_encrypted or is_copy_prohibited:
                try:
                    clean_stream = doc.tobytes(encryption=fitz.PDF_ENCRYPT_NONE, garbage=3, deflate=True)
                    if clean_stream and len(clean_stream) > 100:
                        sanitized_bytes = clean_stream
                        doc.close()
                        # Re-open the sanitized, completely unrestricted document
                        doc = fitz.open(stream=sanitized_bytes, filetype="pdf")
                        logger.info(f"[PDFService] '{filename}' permission flags successfully stripped. Unrestricted streams loaded.")
                except Exception as e:
                    logger.debug(f"[PDFService] Permission stripping notice for '{filename}': {e}")

            # ── 2. Per-Page Extraction & Fallback OCR ──────────────────────────
            page_count = len(doc)
            full_text_pages: List[str] = []
            page_provenance: List[Dict[str, Any]] = []
            native_count = 0
            decrypted_count = 0
            ocr_count = 0
            ocr_pages_rendered = 0

            max_ocr_pages = getattr(settings, "PDF_OCR_MAX_PAGES", 50)
            ocr_dpi = getattr(settings, "PDF_OCR_DPI", 150)
            max_dimension = getattr(settings, "PDF_OCR_MAX_DIMENSION", 2000)

            for page_num in range(page_count):
                page = doc.load_page(page_num)
                try:
                    raw_text = page.get_text("text")
                    cleaned_text = re.sub(r"\n{3,}", "\n\n", raw_text).strip()

                    needs_ocr, reason = PDFService._is_poor_or_unmapped_text(cleaned_text, page)

                    if needs_ocr:
                        if ocr_pages_rendered >= max_ocr_pages:
                            logger.warning(
                                f"[PDFService] Page {page_num + 1}/{page_count} in '{filename}': OCR safety cap "
                                f"reached ({max_ocr_pages} pages). Skipping image rendering to prevent OOM."
                            )
                            page_text = cleaned_text or f"[Page {page_num + 1}: OCR limit of {max_ocr_pages} pages reached for this request. Scanned text extraction capped.]"
                            source_type = "ocr_limit_reached"
                        else:
                            logger.info(
                                f"[PDFService] Page {page_num + 1}/{page_count} in '{filename}': {reason}. "
                                f"Rendering at {ocr_dpi} DPI for OCR fallback..."
                            )
                            ocr_text, ocr_method = PDFService._perform_ocr_on_page(
                                page, page_num, filename, dpi=ocr_dpi, max_dimension=max_dimension
                            )
                            ocr_pages_rendered += 1
                            gc.collect()

                            if ocr_text:
                                page_text = ocr_text
                                source_type = ocr_method
                                ocr_count += 1
                                logger.info(f"[PDFService] Page {page_num + 1}/{page_count}: processed via {source_type} ({len(page_text)} chars)")
                            else:
                                page_text = cleaned_text or f"[Page {page_num + 1}: Scanned or non-Unicode content detected. Text stream unavailable.]"
                                source_type = "unmapped_fallback"
                                logger.warning(f"[PDFService] Page {page_num + 1}/{page_count}: OCR fallback unavailable.")
                    else:
                        page_text = cleaned_text
                        if was_encrypted or unlocked_with_empty_pass:
                            source_type = "decrypted_stream"
                            decrypted_count += 1
                        else:
                            source_type = "native_stream"
                            native_count += 1
                        logger.info(f"[PDFService] Page {page_num + 1}/{page_count}: processed via {source_type} ({len(page_text)} chars)")

                    page_provenance.append({
                        "page_number": page_num + 1,
                        "source": source_type,
                        "character_count": len(page_text)
                    })

                    if page_text.strip():
                        full_text_pages.append(f"--- [Page {page_num + 1}] ---\n{page_text}")
                finally:
                    del page
                    if (page_num + 1) % 10 == 0:
                        gc.collect()

            combined_text = "\n\n".join(full_text_pages)
            doc.close()
            del doc
            gc.collect()

            if not combined_text.strip():
                combined_text = f"Document: {filename}\n[Scanned / Image-heavy PDF detected. Extracting available structural headers.]"

            logger.info(
                f"[PDFService] Completed '{filename}': {native_count} native, "
                f"{decrypted_count} decrypted, {ocr_count} OCR fallback across {page_count} pages."
            )

            return {
                "page_count": max(page_count, 1),
                "extracted_text": combined_text,
                "file_size_bytes": len(file_bytes),
                "sanitized_file_bytes": sanitized_bytes or file_bytes,
                "was_permission_restricted": was_encrypted,
                "page_provenance": page_provenance,
                "extraction_summary": {
                    "native_pages": native_count,
                    "decrypted_pages": decrypted_count,
                    "ocr_pages": ocr_count
                }
            }
        except Exception as e:
            logger.error(f"[PDFService] Error during PDF extraction for '{filename}': {e}")
            text_preview = ""
            try:
                text_preview = file_bytes.decode("utf-8", errors="ignore")
            except Exception:
                text_preview = f"Uploaded file: {filename}"

            return {
                "page_count": 1,
                "extracted_text": text_preview or f"Document {filename} processed.",
                "file_size_bytes": len(file_bytes),
                "sanitized_file_bytes": file_bytes,
                "was_permission_restricted": False,
                "page_provenance": [{"page_number": 1, "source": "fallback_decode", "character_count": len(text_preview)}],
                "extraction_summary": {"native_pages": 0, "decrypted_pages": 0, "ocr_pages": 0}
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
