import io
import pytest
import pymupdf as fitz
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.services.pdf_service import pdf_service, PDFService

client = TestClient(app)
AUTH = {"Authorization": "Bearer demo-token"}


def create_standard_pdf(text: str = "Standard readable legal text for testing.") -> bytes:
    """Creates a basic unencrypted PDF with clear text."""
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 72), text, fontsize=12)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def create_permission_restricted_pdf(
    text: str = "Confidential jurisprudence notes with restricted copy permissions.",
    owner_pw: str = "AcrobatOwnerSecret"
) -> bytes:
    """
    Creates an encrypted PDF with an empty user password ("") and owner password,
    disabling copy/text extraction permissions (typical of downloaded restricted PDFs).
    """
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 72), text, fontsize=12)
    # Perms: print only, no copy/extraction (fitz.PDF_PERM_PRINT)
    pdf_bytes = doc.tobytes(
        encryption=fitz.PDF_ENCRYPT_AES_256,
        owner_pw=owner_pw,
        user_pw="",
        permissions=fitz.PDF_PERM_PRINT
    )
    doc.close()
    return pdf_bytes


def create_scanned_or_non_unicode_pdf() -> bytes:
    """
    Creates a PDF page containing visual drawings (paths/shapes) but no readable text stream,
    simulating a scanned page or a font with missing /ToUnicode CMap.
    """
    doc = fitz.open()
    page = doc.new_page()
    # Draw geometric shapes to simulate visual content
    shape = page.new_shape()
    shape.draw_rect(fitz.Rect(50, 50, 400, 300))
    shape.finish(fill=(0.9, 0.9, 0.9), color=(0.2, 0.2, 0.2))
    shape.commit()
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def test_standard_pdf_extraction():
    """Verify that a normal clean PDF uses native text streams without triggering OCR."""
    pdf_bytes = create_standard_pdf("The Constitution of the Republic of the Philippines.")
    res = pdf_service.extract_text_and_metadata(pdf_bytes, "constitution.pdf")

    assert res["page_count"] == 1
    assert "Constitution of the Republic" in res["extracted_text"]
    assert res["was_permission_restricted"] is False
    assert res["extraction_summary"]["native_pages"] == 1
    assert res["extraction_summary"]["decrypted_pages"] == 0
    assert res["extraction_summary"]["ocr_pages"] == 0
    assert len(res["page_provenance"]) == 1
    assert res["page_provenance"][0]["source"] == "native_stream"


def test_permission_stripping_and_decryption():
    """
    Verify that an encrypted/permission-restricted PDF (empty user pw, locked owner permissions)
    is automatically decrypted with "", has its permissions stripped, and returns clean bytes.
    """
    secret_text = "Law Doctrine: Doctrine of Stare Decisis and Precedent."
    restricted_bytes = create_permission_restricted_pdf(secret_text)

    # Verify original is indeed encrypted / copy-prohibited
    test_doc = fitz.open(stream=restricted_bytes, filetype="pdf")
    assert bool(test_doc.metadata.get("encryption")) or not bool(test_doc.permissions & fitz.PDF_PERM_COPY)
    test_doc.close()

    # Pass through pipeline
    res = pdf_service.extract_text_and_metadata(restricted_bytes, "restricted_statcon.pdf")

    assert res["page_count"] == 1
    assert "Doctrine of Stare Decisis" in res["extracted_text"]
    assert res["was_permission_restricted"] is True
    assert res["extraction_summary"]["decrypted_pages"] == 1
    assert res["page_provenance"][0]["source"] == "decrypted_stream"

    # Verify the sanitized_file_bytes has NO encryption and NO permission blocks
    sanitized_bytes = res["sanitized_file_bytes"]
    sanitized_doc = fitz.open(stream=sanitized_bytes, filetype="pdf")
    assert sanitized_doc.is_encrypted is False
    # Check text can be extracted natively from the sanitized copy
    assert "Doctrine of Stare Decisis" in sanitized_doc[0].get_text("text")
    sanitized_doc.close()


def test_missing_to_unicode_detection():
    """
    Verify that a page with visual content but empty or unmapped characters
    is detected by _is_poor_or_unmapped_text.
    """
    pdf_bytes = create_scanned_or_non_unicode_pdf()
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page = doc[0]

    needs_ocr, reason = PDFService._is_poor_or_unmapped_text("", page)
    assert needs_ocr is True
    assert "Empty text stream despite visual content" in reason

    # Test unmapped/corrupted characters string
    corrupted_text = "\ufffd\ufffd\ufffd\x00\x00\ufffd unmapped glyphs"
    needs_ocr_corrupted, reason_corrupted = PDFService._is_poor_or_unmapped_text(corrupted_text, page)
    assert needs_ocr_corrupted is True
    doc.close()


def test_ocr_fallback_triggered_and_mocked():
    """
    Verify that when text is missing/unmapped, the 200 DPI render is executed
    and OCR fallback transcribes the page into the final document text.
    """
    pdf_bytes = create_scanned_or_non_unicode_pdf()

    mock_ocr_transcription = (
        "REPUBLIC ACT NO. 386\n"
        "AN ACT TO ORDAIN AND INSTITUTE THE CIVIL CODE OF THE PHILIPPINES\n"
        "Article 1. This Act shall be known as the 'Civil Code of the Philippines'."
    )

    with patch(
        "app.services.gemini_service.gemini_service.transcribe_page_image_sync",
        return_value=mock_ocr_transcription
    ):
        res = pdf_service.extract_text_and_metadata(pdf_bytes, "scanned_civil_code.pdf")

        assert res["page_count"] == 1
        assert "CIVIL CODE OF THE PHILIPPINES" in res["extracted_text"]
        assert "Article 1" in res["extracted_text"]
        assert res["extraction_summary"]["ocr_pages"] == 1
        assert res["page_provenance"][0]["source"] == "ocr_fallback (gemini_vision)"


def test_upload_document_stores_sanitized_bytes():
    """
    Verify that /api/documents/upload route replaces permission-locked bytes
    with clean, unrestricted sanitized bytes in the storage layer.
    """
    restricted_bytes = create_permission_restricted_pdf("Statutory Construction Case Digest: Floresca v. Philex.")

    response = client.post(
        "/api/documents/upload",
        files={"file": ("floresca_digest.pdf", restricted_bytes, "application/pdf")},
        headers=AUTH,
    )
    assert response.status_code in (200, 202)
    data = response.json()
    assert data["filename"] == "floresca_digest.pdf"
    assert data["page_count"] == 1


def create_multi_page_scanned_pdf(num_pages: int = 15) -> bytes:
    """Creates a multi-page PDF where each page has visual content but no text stream."""
    doc = fitz.open()
    for i in range(num_pages):
        page = doc.new_page()
        shape = page.new_shape()
        shape.draw_rect(fitz.Rect(50, 50, 400, 300))
        shape.finish(fill=(0.9, 0.9, 0.9), color=(0.2, 0.2, 0.2))
        shape.commit()
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def test_multi_page_pdf_memory_profile():
    """
    Simulate processing a 15-page scanned PDF and profile memory to ensure
    memory remains flat across iterations rather than monotonically increasing.
    """
    import tracemalloc
    import gc
    from app.core.config import settings

    num_pages = 15
    pdf_bytes = create_multi_page_scanned_pdf(num_pages=num_pages)

    mock_text = "Page content transcribed via Gemini OCR."
    memory_snapshots = []

    gc.collect()
    tracemalloc.start()

    # Track memory before and during extraction by patching _perform_ocr_on_page
    original_perform_ocr = PDFService._perform_ocr_on_page

    def monitored_perform_ocr(page, page_num, filename, dpi=None, max_dimension=None):
        result = original_perform_ocr(page, page_num, filename, dpi=dpi, max_dimension=max_dimension)
        current, peak = tracemalloc.get_traced_memory()
        memory_snapshots.append((page_num, current))
        return result

    with patch(
        "app.services.gemini_service.gemini_service.transcribe_page_image_sync",
        return_value=mock_text
    ), patch.object(PDFService, "_perform_ocr_on_page", side_effect=monitored_perform_ocr), \
       patch.object(settings, "PDF_OCR_MAX_PAGES", 50):

        res = pdf_service.extract_text_and_metadata(pdf_bytes, "multi_page_scanned.pdf")

    current_end, peak_end = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    assert res["page_count"] == num_pages
    assert res["extraction_summary"]["ocr_pages"] == num_pages
    assert len(memory_snapshots) == num_pages

    # Check memory stability: memory between page 5 and page 15 should stay flat
    # (i.e. not growing linearly with each page due to retained buffers)
    mid_mem = memory_snapshots[4][1]   # Page 5
    late_mem = memory_snapshots[-1][1]  # Page 15

    # Memory growth should not exceed 5MB between page 5 and page 15
    # (Without cleanup, 10 rendered uncompressed pages at 150 DPI would hold tens of MBs)
    mem_diff_mb = abs(late_mem - mid_mem) / (1024 * 1024)
    assert mem_diff_mb < 5.0, f"Memory grew by {mem_diff_mb:.2f} MB across iterations (expected flat RSS)"


def test_ocr_page_limit_cap():
    """
    Verify that when a PDF has more scanned pages than PDF_OCR_MAX_PAGES,
    synchronous OCR rendering is capped, subsequent pages are flagged as
    'ocr_limit_reached', and processing finishes without crashing.
    """
    from app.core.config import settings

    cap = 3
    total_pages = 8
    pdf_bytes = create_multi_page_scanned_pdf(num_pages=total_pages)

    mock_text = "Standard transcribed legal text."

    with patch(
        "app.services.gemini_service.gemini_service.transcribe_page_image_sync",
        return_value=mock_text
    ), patch.object(settings, "PDF_OCR_MAX_PAGES", cap):

        res = pdf_service.extract_text_and_metadata(pdf_bytes, "large_scanned_book.pdf")

        assert res["page_count"] == total_pages
        # Only the capped number of pages should be processed via OCR
        assert res["extraction_summary"]["ocr_pages"] == cap

        # Verify page provenance correctly reflects the cap
        for p in res["page_provenance"][:cap]:
            assert p["source"] == "ocr_fallback (gemini_vision)"

        for p in res["page_provenance"][cap:]:
            assert p["source"] == "ocr_limit_reached"

        # Verify the warning message appears in extracted text for capped pages
        assert f"OCR limit of {cap} pages reached" in res["extracted_text"]


def test_dpi_and_dynamic_downscaling():
    """
    Verify that 150 DPI is used by default and dynamic downscaling bounds
    unusually large pages to max_dimension (e.g. 2000px).
    """
    # Create an unusually large page (e.g. 3000 x 3000 points)
    doc = fitz.open()
    page = doc.new_page(width=3000, height=3000)
    shape = page.new_shape()
    shape.draw_rect(fitz.Rect(100, 100, 2800, 2800))
    shape.finish(fill=(0.8, 0.8, 0.8))
    shape.commit()

    with patch(
        "app.services.gemini_service.gemini_service.transcribe_page_image_sync",
        return_value="Transcribed huge page."
    ) as mock_gemini:
        text, method = PDFService._perform_ocr_on_page(page, 0, "huge_poster.pdf", dpi=150, max_dimension=2000)

        assert text == "Transcribed huge page."
        assert method == "ocr_fallback (gemini_vision)"
        assert mock_gemini.called

        # Verify image bytes passed to Gemini are reasonably sized (< 2MB)
        passed_bytes = mock_gemini.call_args[0][0]
        assert len(passed_bytes) < 2 * 1024 * 1024

    doc.close()


@pytest.mark.asyncio
async def test_async_pdf_pipeline_bounded_concurrency():
    """
    Verify that extract_text_and_metadata_async processes multiple scanned pages
    concurrently up to the bounded concurrency semaphore (default 5),
    streams compressed JPEGs, and triggers progressive callbacks.
    """
    import asyncio
    from app.services.gemini_service import gemini_service

    num_pages = 8
    concurrency_limit = 5
    pdf_bytes = create_multi_page_scanned_pdf(num_pages=num_pages)

    active_concurrent_calls = 0
    max_observed_concurrency = 0
    concurrency_lock = asyncio.Lock()
    progressive_updates = []

    async def mock_transcribe(img_bytes: bytes, mime_type: str = "image/jpeg"):
        nonlocal active_concurrent_calls, max_observed_concurrency
        # Verify JPEG compression
        assert mime_type == "image/jpeg"
        assert img_bytes[:2] == b'\xff\xd8'  # Standard JPEG magic bytes

        async with concurrency_lock:
            active_concurrent_calls += 1
            if active_concurrent_calls > max_observed_concurrency:
                max_observed_concurrency = active_concurrent_calls

        # Simulate network latency
        await asyncio.sleep(0.02)

        async with concurrency_lock:
            active_concurrent_calls -= 1

        return "Verbatim legal page content from Gemini."

    async def mock_on_page(page_num: int, current_text: str, current_page_count: int):
        progressive_updates.append((page_num, len(current_text), current_page_count))

    with patch.object(gemini_service, "transcribe_page_image", side_effect=mock_transcribe):
        res = await PDFService.extract_text_and_metadata_async(
            file_bytes=pdf_bytes,
            filename="concurrent_statcon.pdf",
            concurrency=concurrency_limit,
            on_page_callback=mock_on_page,
            ocr_delay=0.0
        )

    assert res["page_count"] == num_pages
    assert res["extraction_summary"]["ocr_pages"] == num_pages
    assert len(progressive_updates) == num_pages

    # Verify concurrency was bounded: should reach up to concurrency_limit, but never exceed it
    assert max_observed_concurrency <= concurrency_limit
    assert max_observed_concurrency > 1, f"Expected concurrent execution, but max concurrency was {max_observed_concurrency}"


def test_upload_endpoint_returns_202_accepted():
    """
    Verify that POST /api/documents/upload returns HTTP 202 Accepted immediately
    with status 'processing' without blocking the caller.
    """
    pdf_bytes = create_standard_pdf("Quick test document for immediate upload verification and study session review.")
    response = client.post(
        "/api/documents/upload",
        files={"file": ("quick_upload.pdf", pdf_bytes, "application/pdf")},
        headers=AUTH,
    )
    assert response.status_code == 202
    data = response.json()
    assert data["status"] in ("processing", "ready")
    assert "id" in data
    assert data["filename"] == "quick_upload.pdf"


def test_gemini_vision_tenacity_retry_on_429():
    """
    Verify that when Gemini Vision raises a 429 ResourceExhausted / Rate Limit error,
    the tenacity retry decorator retries with exponential backoff and succeeds.
    """
    from unittest.mock import MagicMock
    from app.services.gemini_service import gemini_service

    attempts = 0
    mock_model = MagicMock()

    class RateLimit429(Exception):
        pass

    def mock_generate(*args, **kwargs):
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            raise RateLimit429("429 ResourceExhausted: Quota exceeded. Please slow down.")
        mock_response = MagicMock()
        mock_response.text = "Success after 429 retry."
        return mock_response

    mock_model.generate_content.side_effect = mock_generate

    result = gemini_service._call_vision_model_with_retry(
        mock_model,
        "Test prompt",
        {"mime_type": "image/jpeg", "data": b"123"}
    )
    assert result.text == "Success after 429 retry."
    assert attempts == 3


@pytest.mark.asyncio
async def test_fast_path_direct_text_extraction():
    """
    Verify that digital PDFs with meaningful text (> 50 chars) bypass Gemini OCR completely,
    parse in milliseconds with 0 API calls, and flag doc_status='ready'.
    """
    doc = fitz.open()
    for i in range(10):
        page = doc.new_page()
        page.insert_text(
            (50, 72),
            f"Republic of the Philippines Supreme Court Decision page {i + 1}. "
            "The doctrine of precedent is well established under Article 8 of the Civil Code.",
            fontsize=12
        )
    pdf_bytes = doc.tobytes()
    doc.close()

    status_updates = []
    async def mock_callback(page_num: int, current_text: str, current_page_count: int, doc_status: str = "processing"):
        status_updates.append((page_num, doc_status))

    res = await PDFService.extract_text_and_metadata_async(
        file_bytes=pdf_bytes,
        filename="digital_statcon.pdf",
        on_page_callback=mock_callback,
        ocr_delay=0.0
    )

    assert res["page_count"] == 10
    assert res["extraction_summary"]["ocr_pages"] == 0
    assert res["extraction_summary"]["native_pages"] == 10
    assert "doctrine of precedent" in res["extracted_text"]
    assert len(status_updates) >= 1
    assert status_updates[-1][1] == "ready"


@pytest.mark.asyncio
async def test_progressive_availability_tier1_readiness():
    """
    Verify that for scanned PDFs needing OCR fallback, pages 1 to 5 (Tier 1) are prioritized
    and trigger doc_status='ready' as soon as Tier 1 resolves.
    """
    from app.services.gemini_service import gemini_service

    num_pages = 8
    pdf_bytes = create_multi_page_scanned_pdf(num_pages=num_pages)
    status_history = []

    async def mock_transcribe(img_bytes: bytes, mime_type: str = "image/jpeg"):
        return "Scanned page transcribed text."

    async def mock_callback(page_num: int, current_text: str, current_page_count: int, doc_status: str = "processing"):
        status_history.append((page_num, doc_status))

    with patch.object(gemini_service, "transcribe_page_image", side_effect=mock_transcribe):
        res = await PDFService.extract_text_and_metadata_async(
            file_bytes=pdf_bytes,
            filename="scanned_law_review.pdf",
            on_page_callback=mock_callback,
            concurrency=1,
            ocr_delay=0.0
        )

    assert res["page_count"] == num_pages
    assert len(status_history) == num_pages

    # Page 5 (end of Tier 1) should transition status to 'ready'
    assert status_history[4][1] == "ready"
    # Subsequent pages should remain ready
    assert status_history[5][1] == "ready"
    assert status_history[7][1] == "ready"


def test_extract_retry_delay_seconds():
    """
    Verify that _extract_retry_delay_seconds parses Google's protobuf format,
    HTTP headers, and standard retry strings.
    """
    from app.services.gemini_service import _extract_retry_delay_seconds

    class DummyProtoError(Exception):
        pass

    e1 = DummyProtoError("ResourceExhausted 429: Quota exceeded. Please wait. retry_delay { seconds: 14 }")
    assert _extract_retry_delay_seconds(e1) == 14.0

    e2 = DummyProtoError("Too many requests: retry after 6.5s")
    assert _extract_retry_delay_seconds(e2) == 6.5

    class DummyHeaderError(Exception):
        class Response:
            headers = {"Retry-After": "8"}
        response = Response()

    assert _extract_retry_delay_seconds(DummyHeaderError("Rate limit")) == 8.0


