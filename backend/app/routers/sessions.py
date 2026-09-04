from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Dict, Any, Optional
import asyncio
from app.core.auth import get_current_user
from app.services.db_service import db_service
from app.models.schemas import (
    SessionCreate,
    SessionEndRequest,
    SessionUpdate,
    SessionResponse,
    SessionDetailResponse,
    NotesResponse,
    FlashcardResponse,
    QuizAttemptResponse,
    ChatMessageResponse
)

router = APIRouter(prefix="/sessions", tags=["sessions"])


async def _owned_session(session_id: str, user_id: str) -> Dict[str, Any]:
    """Load a session, hiding the existence of other users' records behind a 404."""
    session = await db_service.get_session(session_id)
    if not session or session.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("", response_model=SessionResponse)
async def create_session(
    payload: SessionCreate,
    force_new: bool = Query(False, description="Whether to create a new session rather than reusing existing"),
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Create a new study session linked to a document.
    Reuses the existing canonical session for the document if already present to prevent clashing and duplicates.
    """
    document = None
    if payload.document_id:
        document = await db_service.get_document(payload.document_id)
        if not document or document.get("user_id") != user["id"]:
            raise HTTPException(status_code=404, detail="Document not found")

    if not force_new and payload.document_id:
        existing = await db_service.get_session_by_document(user["id"], payload.document_id)
        if existing:
            await db_service.update_session_access(existing["id"])
            if document:
                existing["document"] = document
            return existing

    session = await db_service.create_session(
        user_id=user["id"],
        title=payload.title,
        document_id=payload.document_id
    )
    if document:
        session["document"] = document

    return session

@router.get("", response_model=List[SessionResponse])
async def list_sessions(
    q: Optional[str] = Query(None, description="Search query for session or document title"),
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    List user study sessions, filterable by title or document name, ordered by last accessed.
    """
    return await db_service.get_sessions(user["id"], query=q)

@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get session metadata and mark as accessed.
    """
    session = await _owned_session(session_id, user["id"])
    await db_service.update_session_access(session_id)
    return session

@router.patch("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: str,
    payload: SessionUpdate,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Patch session metadata (title and/or lifecycle status).
    """
    await _owned_session(session_id, user["id"])

    updated = await db_service.update_session(
        session_id,
        payload.model_dump(exclude_none=True)
    )
    return updated

@router.post("/{session_id}/end", response_model=SessionResponse)
async def end_session(
    session_id: str,
    payload: SessionEndRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Close a study session. Flips status to inactive/completed, stamps ended_at, and
    accumulates the focus duration and cards-reviewed metrics from the workspace.
    """
    await _owned_session(session_id, user["id"])
    return await db_service.end_session(
        session_id,
        status=payload.status,
        total_focus_seconds=payload.total_focus_seconds,
        cards_reviewed=payload.cards_reviewed
    )

@router.get("/{session_id}/snapshot", response_model=SessionDetailResponse)
async def get_session_snapshot(
    session_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieve full study snapshot: Session, Document text, Reviewed Notes, Flashcards, Quiz Attempts, and Chat.
    Opening the snapshot marks the session as the live active workspace session.
    """
    await _owned_session(session_id, user["id"])
    session = await db_service.resume_session(session_id)

    document_id = session.get("document_id") if session else None
    document, notes, flashcards, quiz_attempts, chat_history = await asyncio.gather(
        db_service.get_document(document_id) if document_id else asyncio.sleep(0),
        db_service.get_notes(session_id),
        db_service.get_flashcards(session_id),
        db_service.get_quiz_attempts(session_id),
        db_service.get_chat_history(session_id),
    )

    # Workspace loads the file bytes separately; skip shipping the full extract
    # in the snapshot JSON (it can dwarf notes + chat combined).
    if document:
        document = {**document, "extracted_text": ""}

    return {
        "session": session,
        "document": document,
        "notes": notes,
        "flashcards": flashcards,
        "quiz_attempts": quiz_attempts,
        "chat_history": chat_history
    }

@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Cascade-delete study session and all associated notes, flashcards, quizzes, and chat messages.
    Preserves original document.
    """
    await _owned_session(session_id, user["id"])
    await db_service.delete_session(session_id)
    return {"status": "success", "message": "Session deleted successfully"}

@router.get("/search/knowledge")
async def search_knowledge(
    q: str = Query(..., min_length=1),
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Global knowledge search across notes, key terms, flashcards, and sessions.
    """
    return await db_service.search_knowledge_base(user["id"], q)
