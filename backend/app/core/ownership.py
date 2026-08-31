from typing import Any, Dict

from fastapi import HTTPException

from app.services.db_service import db_service


async def require_session_owner(session_id: str, user_id: str) -> Dict[str, Any]:
    """Return the session only if it belongs to user_id; otherwise 404."""
    session = await db_service.get_session(session_id)
    if not session or session.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
