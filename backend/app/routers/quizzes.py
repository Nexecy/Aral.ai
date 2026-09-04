import json
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any, Optional
from app.core.auth import get_current_user, require_verified_email
from app.core.ownership import require_session_owner
from app.services.db_service import db_service
from app.services.gemini_service import gemini_service
from app.models.schemas import (
    QuizGenerationRequest,
    QuizAttemptResponse,
    QuizSubmission,
    QuizQuestion,
    QuestionResult
)

router = APIRouter(prefix="/sessions/{session_id}/quizzes", tags=["quizzes"])

@router.post("/generate")
async def generate_quiz(
    session_id: str,
    payload: QuizGenerationRequest,
    stream: bool = Query(False, description="Whether to stream SSE progress updates"),
    user: Dict[str, Any] = Depends(require_verified_email)
):
    """
    Generate interactive quiz from reviewed notes for the chosen quiz type.
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
            yield f"data: {json.dumps({'step': 'parsing', 'progress': 20, 'message': f'Formatting {payload.quiz_type} schema...'})}\n\n"
            yield f"data: {json.dumps({'step': 'generating', 'progress': 60, 'message': f'Generating {payload.question_count} questions with Gemini...'})}\n\n"
            
            questions = await gemini_service.generate_quiz(
                notes["content"],
                quiz_type=payload.quiz_type,
                count=payload.question_count
            )
            yield f"data: {json.dumps({'step': 'completed', 'progress': 100, 'message': 'Quiz generated!', 'result': {'quiz_type': payload.quiz_type, 'questions': questions}})}\n\n"

        return StreamingResponse(progress_generator(), media_type="text/event-stream")
    else:
        questions = await gemini_service.generate_quiz(
            notes["content"],
            quiz_type=payload.quiz_type,
            count=payload.question_count
        )
        return {"quiz_type": payload.quiz_type, "questions": questions}

@router.post("/submit", response_model=QuizAttemptResponse)
async def submit_quiz(
    session_id: str,
    quiz_type: str = Query("multiple_choice"),
    questions: List[QuizQuestion] = Body(...),
    submission: QuizSubmission = Body(...),
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Score user answers, compile correct/incorrect breakdown with explanations, and record attempt.
    """
    await require_session_owner(session_id, user["id"])
    correct_count = 0
    results: List[Dict[str, Any]] = []

    for q in questions:
        user_ans = submission.answers.get(q.id)
        is_correct = False

        if q.type == "multiple_choice":
            is_correct = str(user_ans).strip().lower() == str(q.correct_answer).strip().lower()
        elif q.type == "identification":
            # Loose comparison ignoring casing and punctuation
            clean_user = "".join(c for c in str(user_ans).lower() if c.isalnum())
            clean_correct = "".join(c for c in str(q.correct_answer).lower() if c.isalnum())
            is_correct = clean_user == clean_correct or clean_correct in clean_user or (len(clean_user) > 3 and clean_user in clean_correct)
        elif q.type == "matching":
            # If user submitted matching map
            if isinstance(user_ans, dict) and q.matching_pairs:
                matched_correctly = 0
                for pair in q.matching_pairs:
                    if user_ans.get(pair.left) == pair.right:
                        matched_correctly += 1
                is_correct = (matched_correctly == len(q.matching_pairs))
            else:
                is_correct = True # fallback for demo if submitted

        if is_correct:
            correct_count += 1

        results.append({
            "question_id": q.id,
            "question": q.question,
            "user_answer": user_ans,
            "correct_answer": q.correct_answer,
            "is_correct": is_correct,
            "explanation": q.explanation or "Good effort!"
        })

    total = len(questions) if questions else 1
    score_percentage = round((correct_count / total) * 100, 1)

    attempt = await db_service.create_quiz_attempt(
        session_id=session_id,
        quiz_type=quiz_type,
        questions=[q.model_dump() for q in questions],
        user_answers=submission.answers,
        score=score_percentage,
        total_questions=total,
        results=results
    )

    return attempt

@router.get("", response_model=List[QuizAttemptResponse])
async def list_quiz_attempts(
    session_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    List all past quiz attempts and scores for this session.
    """
    await require_session_owner(session_id, user["id"])
    return await db_service.get_quiz_attempts(session_id)
