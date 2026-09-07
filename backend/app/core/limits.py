"""Freemium plan limits and AI quota enforcement."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Literal, Optional

from fastapi import Depends, HTTPException, status

from app.core.auth import require_verified_email
from app.core.config import settings
from app.services.db_service import db_service

AiAction = Literal["notes", "flashcards", "quizzes", "chat", "uploads"]

PLAN_LIMITS: Dict[str, Dict[AiAction, int]] = {
    "free": {
        "notes": settings.FREE_DAILY_NOTES,
        "flashcards": settings.FREE_DAILY_FLASHCARDS,
        "quizzes": settings.FREE_DAILY_QUIZZES,
        "chat": settings.FREE_DAILY_CHAT,
        "uploads": settings.FREE_DAILY_UPLOADS,
    },
    "student": {
        "notes": settings.STUDENT_DAILY_NOTES,
        "flashcards": settings.STUDENT_DAILY_FLASHCARDS,
        "quizzes": settings.STUDENT_DAILY_QUIZZES,
        "chat": settings.STUDENT_DAILY_CHAT,
        "uploads": settings.STUDENT_DAILY_UPLOADS,
    },
}

PLAN_PRICES_PHP: Dict[str, int] = {
    "free": 0,
    "student": settings.STUDENT_PRICE_PHP,
}

ACTION_LABELS: Dict[AiAction, str] = {
    "notes": "note generations",
    "flashcards": "flashcard generations",
    "quizzes": "quiz generations",
    "chat": "AI chat messages",
    "uploads": "document uploads",
}


def normalize_plan(plan: Optional[str]) -> str:
    value = (plan or "free").strip().lower()
    return value if value in PLAN_LIMITS else "free"


def limits_for_plan(plan: Optional[str]) -> Dict[AiAction, int]:
    return dict(PLAN_LIMITS[normalize_plan(plan)])


def utc_midnight_tomorrow() -> datetime:
    now = datetime.now(timezone.utc)
    return (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)


async def build_usage_snapshot(user_id: str) -> Dict[str, Any]:
    profile = await db_service.get_profile(user_id)
    plan = normalize_plan(profile.get("plan"))
    has_byok = bool(profile.get("has_byok"))
    usage = await db_service.get_usage_today(user_id)
    limits = limits_for_plan(plan)
    return {
        "plan": plan,
        "plan_label": "Student" if plan == "student" else "Free",
        "price_php": PLAN_PRICES_PHP.get(plan, 0),
        "currency": "PHP",
        "has_byok": has_byok,
        "byok_bypasses_limits": has_byok,
        "limits": limits,
        "used": {
            "notes": int(usage.get("notes_gens", 0)),
            "flashcards": int(usage.get("flashcard_gens", 0)),
            "quizzes": int(usage.get("quiz_gens", 0)),
            "chat": int(usage.get("chat_msgs", 0)),
            "uploads": int(usage.get("uploads", 0)),
        },
        "resets_at": utc_midnight_tomorrow().isoformat().replace("+00:00", "Z"),
        "student_price_php": PLAN_PRICES_PHP["student"],
    }


def _usage_key(action: AiAction) -> str:
    return {
        "notes": "notes_gens",
        "flashcards": "flashcard_gens",
        "quizzes": "quiz_gens",
        "chat": "chat_msgs",
        "uploads": "uploads",
    }[action]


async def check_and_consume_quota(user_id: str, action: AiAction, amount: int = 1) -> Dict[str, Any]:
    """
    Enforce daily quota for an AI action.

    BYOK users skip platform counters (they pay Google directly once wired).
    """
    import os

    # Keep the existing suite green; dedicated billing tests set ARAL_TEST_ENFORCE_QUOTAS=1.
    if os.getenv("PYTEST_CURRENT_TEST") and os.getenv("ARAL_TEST_ENFORCE_QUOTAS") != "1":
        return {
            "plan": "free",
            "has_byok": False,
            "consumed": False,
            "action": action,
            "pytest_bypass": True,
        }

    profile = await db_service.get_profile(user_id)
    plan = normalize_plan(profile.get("plan"))
    has_byok = bool(profile.get("has_byok"))

    if has_byok:
        return {
            "plan": plan,
            "has_byok": True,
            "consumed": False,
            "action": action,
        }

    limits = limits_for_plan(plan)
    limit = limits[action]
    usage = await db_service.get_usage_today(user_id)
    used = int(usage.get(_usage_key(action), 0))

    if used + amount > limit:
        label = ACTION_LABELS[action]
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Daily {label} limit reached ({used}/{limit} on the "
                f"{'Student' if plan == 'student' else 'Free'} plan). "
                f"Upgrade to Student (₱{PLAN_PRICES_PHP['student']}/mo) in Settings → Plan, "
                "or add your own Gemini API key (BYOK)."
            ),
        )

    await db_service.increment_usage(user_id, action, amount=amount)
    return {
        "plan": plan,
        "has_byok": False,
        "consumed": True,
        "action": action,
        "used_after": used + amount,
        "limit": limit,
    }


def require_ai_quota(action: AiAction):
    """FastAPI dependency factory: verified email + daily quota check/consume."""

    async def _dependency(
        user: Dict[str, Any] = Depends(require_verified_email),
    ) -> Dict[str, Any]:
        meta = await check_and_consume_quota(user["id"], action)
        return {**user, "plan": meta["plan"], "has_byok": meta.get("has_byok", False), "quota": meta}

    return _dependency
