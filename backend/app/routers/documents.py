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

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Upload reference study PDF/document, extract text via PyMuPDF, store in Supabase Storage, and save database metadata.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    content_bytes = await file.read()
    if len(content_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # 1. Extract text and metadata via PyMuPDF
    extracted = pdf_service.extract_text_and_metadata(content_bytes, file.filename)
    
    # 2. Upload file to Supabase / local storage
    storage_path = await storage_service.upload_file(
        user_id=user["id"],
        filename=file.filename,
        file_bytes=content_bytes,
        content_type=file.content_type or "application/pdf"
    )

    # 3. Store in DB
    doc_record = await db_service.create_document(
        user_id=user["id"],
        filename=file.filename,
        storage_path=storage_path,
        page_count=extracted["page_count"],
        extracted_text=extracted["extracted_text"],
        file_size_bytes=extracted["file_size_bytes"]
    )

    # The client only needs the id to create a session. Keep the extract in the
    # database; don't ship tens of KB back on the upload response.
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
