from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_user
from app.models.schemas import (
    DashboardSummary,
    ExamCreate,
    ExamResponse,
    ExamUpdate,
)
from app.services.db_service import db_service

router = APIRouter(tags=["exams"])


async def _owned_exam(exam_id: str, user_id: str) -> Dict[str, Any]:
    """Load an exam, refusing to disclose whether another user's exam exists."""
    exam = await db_service.get_exam(exam_id)
    if not exam or exam.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Exam not found")
    return exam


@router.get("/exams", response_model=List[ExamResponse])
async def list_exams(user: Dict[str, Any] = Depends(get_current_user)):
    """Every exam for the signed-in user, soonest first. Past exams are kept."""
    return await db_service.get_exams(user["id"])


@router.post("/exams", response_model=ExamResponse, status_code=201)
async def create_exam(
    payload: ExamCreate,
    user: Dict[str, Any] = Depends(get_current_user)
):
    if payload.document_id:
        document = await db_service.get_document(payload.document_id)
        if not document or document.get("user_id") != user["id"]:
            raise HTTPException(status_code=404, detail="Linked document not found")

    return await db_service.create_exam(
        user_id=user["id"],
        title=payload.title.strip(),
        exam_date=payload.exam_date,
        document_id=payload.document_id,
        color=payload.color,
        notes=payload.notes
    )


@router.get("/exams/{exam_id}", response_model=ExamResponse)
async def get_exam(exam_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    return await _owned_exam(exam_id, user["id"])


@router.patch("/exams/{exam_id}", response_model=ExamResponse)
async def update_exam(
    exam_id: str,
    payload: ExamUpdate,
    user: Dict[str, Any] = Depends(get_current_user)
):
    await _owned_exam(exam_id, user["id"])

    updates = payload.model_dump(exclude_unset=True)
    if updates.get("document_id"):
        document = await db_service.get_document(updates["document_id"])
        if not document or document.get("user_id") != user["id"]:
            raise HTTPException(status_code=404, detail="Linked document not found")
    if "title" in updates and updates["title"]:
        updates["title"] = updates["title"].strip()

    updated = await db_service.update_exam(exam_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Exam not found")
    return updated


@router.delete("/exams/{exam_id}")
async def delete_exam(exam_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    await _owned_exam(exam_id, user["id"])
    await db_service.delete_exam(exam_id)
    return {"status": "success", "message": "Exam deleted"}


@router.get("/dashboard/summary", response_model=DashboardSummary)
async def get_dashboard_summary(user: Dict[str, Any] = Depends(get_current_user)):
    """Real, user-scoped counters for the dashboard. Zeroed out for new users."""
    return await db_service.get_dashboard_summary(user["id"])
