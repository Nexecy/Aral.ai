from fastapi import APIRouter, Depends, Query
from typing import Dict, Any, Optional
from app.core.auth import get_current_user
from app.services.db_service import db_service
from app.models.schemas import (
    PomodoroLogCreate,
    PomodoroLogResponse,
    PomodoroStats,
    PomodoroSettingsUpdate,
    PomodoroSettingsResponse
)

router = APIRouter(prefix="/pomodoro", tags=["pomodoro"])

@router.post("/log", response_model=PomodoroLogResponse)
async def log_pomodoro_cycle(
    payload: PomodoroLogCreate,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Log a completed Pomodoro cycle linked to user and optional study session.
    """
    return await db_service.log_pomodoro(
        user_id=user["id"],
        duration_minutes=payload.duration_minutes,
        session_id=payload.session_id,
        completed=payload.completed
    )

@router.get("/stats", response_model=PomodoroStats)
async def get_pomodoro_stats(
    session_id: Optional[str] = Query(None, description="Optional session ID to get specific study minutes"),
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieve cumulative Pomodoro study metrics and cycle stats.
    """
    return await db_service.get_pomodoro_stats(
        user_id=user["id"],
        session_id=session_id
    )

@router.get("/settings", response_model=PomodoroSettingsResponse)
async def get_pomodoro_settings(
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieve user Pomodoro custom settings (durations, cycles, sounds).
    """
    return await db_service.get_pomodoro_settings(user["id"])

@router.put("/settings", response_model=PomodoroSettingsResponse)
async def update_pomodoro_settings(
    payload: PomodoroSettingsUpdate,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Update user Pomodoro custom settings.
    """
    return await db_service.update_pomodoro_settings(
        user_id=user["id"],
        updates=payload.model_dump(exclude_none=True)
    )
