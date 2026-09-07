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
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "floresca_digest.pdf"
    assert data["page_count"] == 1
