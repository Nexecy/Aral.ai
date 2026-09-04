import json
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any, Optional
from app.core.auth import get_current_user, require_verified_email
from app.core.ownership import require_session_owner
from app.services.db_service import db_service
from app.services.gemini_service import gemini_service
from app.models.schemas import FlashcardResponse, FlashcardCreate

router = APIRouter(prefix="/sessions/{session_id}/flashcards", tags=["flashcards"])

@router.post("/generate")
async def generate_flashcards(
    session_id: str,
    count: int = Query(8, ge=3, le=25, description="Number of flashcards to generate"),
    stream: bool = Query(False, description="Whether to stream SSE progress updates"),
    user: Dict[str, Any] = Depends(require_verified_email)
):
    """
    Generate high-yield flashcards from the reviewed Notes (never raw text).
    """
    session = await require_session_owner(session_id, user["id"])
    notes = await db_service.get_notes(session_id)
    if not notes or not notes.get("content"):
        # Auto-generate notes if document is linked to this session
        if session.get("document_id"):
            document = await db_service.get_document(session["document_id"])
            if document:
                source_text = document.get("extracted_text", "") or "Study guide content."
                doc_title = document.get("filename", session.get("title", "Study Material"))
                raw_notes = await gemini_service.generate_notes(source_text, doc_title)
                notes = await db_service.upsert_notes(session_id, raw_notes, scope="auto-generated")

    if not notes or not notes.get("content"):
        raise HTTPException(
            status_code=400,
            detail="No study notes found for this session. Please upload a document or generate notes first."
        )

    if stream:
        async def progress_generator():
            yield f"data: {json.dumps({'step': 'reading_notes', 'progress': 20, 'message': 'Analyzing reviewed notes...'})}\n\n"
            yield f"data: {json.dumps({'step': 'generating', 'progress': 60, 'message': 'Generating active recall question-answer pairs with Gemini...'})}\n\n"
            
            cards_data = await gemini_service.generate_flashcards(notes["content"], count=count)
            saved_cards = await db_service.save_flashcards(session_id, cards_data)
            
            yield f"data: {json.dumps({'step': 'completed', 'progress': 100, 'message': f'Generated {len(saved_cards)} flashcards!', 'result': saved_cards})}\n\n"

        return StreamingResponse(progress_generator(), media_type="text/event-stream")
    else:
        cards_data = await gemini_service.generate_flashcards(notes["content"], count=count)
        saved_cards = await db_service.save_flashcards(session_id, cards_data)
        return saved_cards

@router.get("", response_model=List[FlashcardResponse])
async def get_flashcards(
    session_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieve all flashcards for this study session.
    """
    await require_session_owner(session_id, user["id"])
    return await db_service.get_flashcards(session_id)

@router.post("", response_model=FlashcardResponse)
async def create_flashcard(
    session_id: str,
    card: FlashcardCreate,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Add a manual flashcard to the deck.
    """
    await require_session_owner(session_id, user["id"])
    cards = await db_service.get_flashcards(session_id)
    new_card_dict = {
        "front": card.front,
        "back": card.back,
        "order_index": len(cards)
    }
    cards.append(new_card_dict)
    saved = await db_service.save_flashcards(session_id, cards)
    return saved[-1]

@router.post("/{card_id}/review")
async def review_flashcard_rating(
    session_id: str,
    card_id: str,
    rating: str = Query(..., description="Rating: 'again', 'hard', 'good', or 'easy'"),
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Record spaced repetition confidence rating on a flashcard.
    """
    await require_session_owner(session_id, user["id"])
    card = await db_service.review_flashcard(card_id, rating.lower())
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    return card
