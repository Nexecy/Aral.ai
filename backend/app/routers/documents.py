import os
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from typing import List, Dict, Any
from app.core.auth import get_current_user
from app.services.pdf_service import pdf_service
from app.services.storage_service import storage_service
from app.services.db_service import db_service
from app.models.schemas import DocumentResponse

router = APIRouter(prefix="/documents", tags=["documents"])

# Extension -> media type for inline browser rendering. Anything unmapped is served
# as a PDF because the placeholder renderer below emits PDF bytes.
MEDIA_TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

def _media_type_for(filename: str) -> str:
    ext = os.path.splitext(filename or "")[1].lower()
    return MEDIA_TYPES.get(ext, "application/pdf")

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, BackgroundTasks
import logging
import gc

logger = logging.getLogger("documents_router")


async def _process_document_background(
    doc_id: str,
    content_bytes: bytes,
    filename: str,
    user_id: str
):
    try:
        async def on_page_resolved(page_num: int, current_text: str, current_page_count: int):
            await db_service.update_document(doc_id, {
                "extracted_text": current_text,
                "page_count": current_page_count,
                "status": "processing"
            })

        extracted = await pdf_service.extract_text_and_metadata_async(
            file_bytes=content_bytes,
            filename=filename,
            on_page_callback=on_page_resolved
        )

        # If sanitized/unrestricted bytes were produced (e.g. stripped permissions), re-upload clean file
        if extracted.get("sanitized_file_bytes") and extracted.get("was_permission_restricted"):
            try:
                await storage_service.upload_file(
                    user_id=user_id,
                    filename=filename,
                    file_bytes=extracted["sanitized_file_bytes"],
                    content_type="application/pdf"
                )
            except Exception as store_err:
                logger.debug(f"[DocumentProcessing] Notice re-saving sanitized file: {store_err}")

        # Mark ready with complete extracted text and final page count
        await db_service.update_document(doc_id, {
            "extracted_text": extracted.get("extracted_text", ""),
            "page_count": extracted.get("page_count", 1),
            "status": "ready"
        })
        logger.info(f"[DocumentProcessing] Completed background parsing for '{filename}' ({doc_id})")
    except Exception as e:
        logger.error(f"[DocumentProcessing] Error in background parsing for '{filename}' ({doc_id}): {e}")
        await db_service.update_document(doc_id, {"status": "error"})
    finally:
        del content_bytes
        gc.collect()


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Upload reference study PDF/document non-blocking: stores raw file in storage, creates record with status 'processing',
    returns HTTP 202 Accepted immediately, and parses document text via high-throughput bounded async pipeline in background.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    content_bytes = await file.read()
    if len(content_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # 1. Upload raw file to Supabase / local storage immediately
    storage_path = await storage_service.upload_file(
        user_id=user["id"],
        filename=file.filename,
        file_bytes=content_bytes,
        content_type=file.content_type or _media_type_for(file.filename)
    )

    # Fast initial page count detection
    initial_page_count = 1
    if file.filename.lower().endswith(".pdf"):
        try:
            import pymupdf as fitz
            with fitz.open(stream=content_bytes, filetype="pdf") as quick_doc:
                initial_page_count = max(len(quick_doc), 1)
        except Exception:
            initial_page_count = 1

    # 2. Create document record with status 'processing'
    doc_record = await db_service.create_document(
        user_id=user["id"],
        filename=file.filename,
        storage_path=storage_path,
        page_count=initial_page_count,
        extracted_text="",
        file_size_bytes=len(content_bytes),
        status="processing"
    )

    # 3. Schedule async background worker for text extraction & progressive persistence
    background_tasks.add_task(
        _process_document_background,
        doc_id=doc_record["id"],
        content_bytes=content_bytes,
        filename=file.filename,
        user_id=user["id"]
    )

    # Return HTTP 202 immediately
    return {**doc_record, "extracted_text": ""}

@router.get("", response_model=List[DocumentResponse])
async def list_documents(user: Dict[str, Any] = Depends(get_current_user)):
    """
    List all uploaded documents for the current user.
    """
    return await db_service.get_documents(user["id"])

async def _owned_document(document_id: str, user_id: str) -> Dict[str, Any]:
    """Load a document, hiding the existence of other users' records behind a 404."""
    doc = await db_service.get_document(document_id)
    if not doc or doc.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    """
    Retrieve document metadata and extracted text.
    """
    return await _owned_document(document_id, user["id"])

@router.get("/{document_id}/file")
async def get_document_file(
    document_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Stream the raw uploaded bytes. The viewer fetches this with an auth header and
    renders it from an object URL, so the route stays user-scoped.
    """
    doc = await _owned_document(document_id, user["id"])

    storage_path = doc.get("storage_path")
    if not storage_path:
        raise HTTPException(status_code=404, detail="Document file path missing")

    filename = doc.get("filename", "document.pdf")
    media_type = _media_type_for(filename)

    file_bytes = await storage_service.get_file(storage_path)
    if not file_bytes:
        # Stored bytes are unavailable — fall back to a rendered PDF of the extracted text
        # so the viewer still has something meaningful to display.
        from reportlab.pdfgen import canvas
        import io
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer)
        p.setFont("Helvetica-Bold", 16)
        p.drawString(100, 750, filename)
        p.setFont("Helvetica", 11)
        text_lines = (doc.get("extracted_text", "") or "No text content available.").split("\n")
        y = 710
        for line in text_lines[:45]:
            if line.strip():
                p.drawString(100, y, line.strip()[:85])
                y -= 14
                if y < 60:
                    break
        p.save()
        file_bytes = buffer.getvalue()
        media_type = "application/pdf"

    from fastapi.responses import Response
    return Response(
        content=file_bytes,
        media_type=media_type,
        headers={
            "Content-Disposition": f"inline; filename=\"{filename}\"",
            "Cache-Control": "public, max-age=3600"
        }
    )

from app.models.schemas import DocumentResponse, DocumentUpdate

@router.patch("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: str,
    payload: DocumentUpdate,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Update document metadata (e.g. rename filename).
    """
    await _owned_document(document_id, user["id"])
    updates = payload.model_dump(exclude_unset=True)
    updated = await db_service.update_document(document_id, updates)
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update document")
    return updated

@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Delete document from storage and database, unlinking from sessions & exams.
    """
    doc = await _owned_document(document_id, user["id"])
    storage_path = doc.get("storage_path")
    if storage_path:
        await storage_service.delete_file(storage_path)

    success = await db_service.delete_document(document_id)
    return {"ok": success, "message": "Document deleted successfully"}

