"""
Contact & Support router for Aral.ai.
Handles student inquiries, delivers branded HTML notification emails, and auto-responds to users.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, status

from app.services.email_service import email_service
from app.services.db_service import db_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/contact", tags=["Contact"])


class ContactRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120, description="Full name of student/sender")
    email: str = Field(..., min_length=4, max_length=254, description="Email address for replies")
    topic: str = Field(default="General Inquiry", max_length=100, description="Inquiry category")
    message: str = Field(..., min_length=2, max_length=5000, description="Inquiry body")
    platform: Optional[str] = Field(default="Web Client", max_length=60)


@router.post("", status_code=status.HTTP_200_OK)
@router.post("/", status_code=status.HTTP_200_OK)
async def submit_contact_form(payload: ContactRequest) -> Dict[str, Any]:
    name = payload.name.strip()
    email = payload.email.strip()
    topic = payload.topic.strip() or "General Inquiry"
    message = payload.message.strip()
    platform = (payload.platform or "Web Client").strip()

    if not name or not email or not message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name, email, and message are required fields.",
        )

    # 1. Optionally log to Supabase if configured (safe fallback if table doesn't exist)
    if db_service.supabase:
        try:
            db_service.supabase.table("contact_messages").insert({
                "name": name,
                "email": email,
                "topic": topic,
                "message": message,
                "platform": platform,
            }).execute()
        except Exception as db_exc:
            logger.debug("Database store for contact message skipped/ignored: %s", db_exc)

    # 2. Dispatch branded HTML email notifications + student auto-reply
    delivery_result = await email_service.send_contact_inquiry(
        name=name,
        email=email,
        topic=topic,
        message=message,
        platform=platform,
    )

    return {
        "ok": True,
        "message": "Thank you for reaching out! We received your message and sent a confirmation to your email.",
        "delivery": delivery_result,
    }
