import json
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any
from app.core.auth import get_current_user, require_verified_email
from app.core.ownership import require_session_owner
from app.services.db_service import db_service
from app.services.gemini_service import gemini_service
from app.models.schemas import ChatMessageResponse, ChatMessageCreate

router = APIRouter(prefix="/sessions/{session_id}/chat", tags=["chat"])

@router.post("")
async def stream_chat(
    session_id: str,
    payload: ChatMessageCreate,
    user: Dict[str, Any] = Depends(require_verified_email)
):
    """
    Real-time AI Chat assistant scoped to study session. Streams response token-by-token via Server-Sent Events (SSE).
    """
    session = await require_session_owner(session_id, user["id"])

    # 1. Store user message in database
    await db_service.add_chat_message(
        session_id=session_id,
        role="user",
        content=payload.content
    )

    # 2. Get notes & chat history for context
    notes_record = await db_service.get_notes(session_id)
    notes_content = notes_record.get("content", {}) if notes_record else {}
    history = await db_service.get_chat_history(session_id)

    async def sse_event_stream():
        full_reply_buffer = []
        try:
            async for token in gemini_service.stream_chat_response(
                session_title=session.get("title", "Study Session"),
                notes_content=notes_content,
                chat_history=history,
                user_message=payload.content
            ):
                full_reply_buffer.append(token)
                # Send SSE data event
                yield f"data: {json.dumps({'token': token})}\n\n"

            # Once stream is complete, persist assistant message
            full_reply = "".join(full_reply_buffer)
            assistant_msg = await db_service.add_chat_message(
                session_id=session_id,
                role="assistant",
                content=full_reply
            )
            yield f"data: {json.dumps({'done': True, 'message': assistant_msg})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        sse_event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.get("", response_model=List[ChatMessageResponse])
async def get_chat_history(
    session_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieve all conversation messages in this study session.
    """
    await require_session_owner(session_id, user["id"])
    return await db_service.get_chat_history(session_id)
