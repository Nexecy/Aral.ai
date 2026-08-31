import json
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from fastapi.responses import StreamingResponse
from typing import Dict, Any, Optional
from app.core.auth import get_current_user, require_verified_email
from app.core.ownership import require_session_owner
from app.services.db_service import db_service
from app.services.gemini_service import gemini_service
from app.models.schemas import NotesResponse, NotesUpdate, NoteContent

router = APIRouter(prefix="/sessions/{session_id}/notes", tags=["notes"])

@router.post("/generate")
async def generate_notes(
    session_id: str,
    stream: bool = Query(False, description="Whether to stream SSE progress updates"),
    scope: str = Query("full document", description="Extraction scope"),
    user: Dict[str, Any] = Depends(require_verified_email)
):
    """
    Generate structured notes from document via Gemini JSON mode.
    Returns editable notes for the user review step.
    """
    session = await require_session_owner(session_id, user["id"])

    document = None
    if session.get("document_id"):
        document = await db_service.get_document(session["document_id"])

    source_text = document.get("extracted_text", "") if document else "Foundational study notes."
    doc_title = document.get("filename", session.get("title", "Study Material")) if document else session.get("title", "Study Material")

    if stream:
        async def progress_generator():
            yield f"data: {json.dumps({'step': 'extracting', 'progress': 25, 'message': 'Extracting document structure...'})}\n\n"
            await asyncio.sleep(0.3)
            yield f"data: {json.dumps({'step': 'analyzing', 'progress': 50, 'message': 'Gemini analyzing key concepts and terms...'})}\n\n"
            await asyncio.sleep(0.3)
            yield f"data: {json.dumps({'step': 'structuring', 'progress': 75, 'message': 'Synthesizing structured notes & definitions...'})}\n\n"
            
            raw_notes = await gemini_service.generate_notes(source_text, doc_title)
            saved_notes = await db_service.upsert_notes(session_id, raw_notes, scope=scope)
            
            yield f"data: {json.dumps({'step': 'completed', 'progress': 100, 'message': 'Ready for review!', 'result': saved_notes})}\n\n"

        return StreamingResponse(progress_generator(), media_type="text/event-stream")
    else:
        raw_notes = await gemini_service.generate_notes(source_text, doc_title)
        saved_notes = await db_service.upsert_notes(session_id, raw_notes, scope=scope)
        return saved_notes

@router.get("", response_model=Optional[NotesResponse])
async def get_notes(
    session_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get current structured notes for the session.
    """
    await require_session_owner(session_id, user["id"])
    notes = await db_service.get_notes(session_id)
    if not notes:
        raise HTTPException(status_code=404, detail="Notes not yet generated for this session")
    return notes

@router.put("", response_model=NotesResponse)
async def update_notes(
    session_id: str,
    payload: NotesUpdate,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Save user edits to the structured notes during the review step.
    """
    session = await require_session_owner(session_id, user["id"])

    content_dict = payload.content.model_dump()
    saved = await db_service.upsert_notes(
        session_id=session_id,
        content=content_dict,
        scope=payload.scope or "custom edit"
    )
    return saved
