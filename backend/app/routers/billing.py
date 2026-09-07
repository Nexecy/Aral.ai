"""Billing, plan upgrades, usage meters, and BYOK Gemini key management."""

from __future__ import annotations

import base64
import hashlib
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.limits import PLAN_PRICES_PHP, build_usage_snapshot, normalize_plan
from app.services.db_service import db_service

router = APIRouter(prefix="/billing", tags=["billing"])


class PlanUpgradeRequest(BaseModel):
    plan: str = Field(default="student", description="Target plan: student")
    payment_reference: Optional[str] = Field(
        default=None,
        description="PayMongo payment intent / checkout id when BILLING_MODE=paymongo",
    )


class ByokKeyRequest(BaseModel):
    api_key: Optional[str] = Field(
        default=None,
        description="Gemini API key. Omit or send empty string to clear BYOK.",
        max_length=256,
    )


def _obfuscate_key(raw: str) -> str:
    """Lightweight reversible obfuscation for local/stub storage (not production HSM)."""
    secret = (settings.BYOK_ENCRYPTION_SECRET or "aral-local-byok-secret").encode("utf-8")
    key_bytes = raw.encode("utf-8")
    digest = hashlib.sha256(secret).digest()
    xored = bytes(b ^ digest[i % len(digest)] for i, b in enumerate(key_bytes))
    return base64.urlsafe_b64encode(xored).decode("ascii")


def _deobfuscate_key(token: str) -> str:
    secret = (settings.BYOK_ENCRYPTION_SECRET or "aral-local-byok-secret").encode("utf-8")
    digest = hashlib.sha256(secret).digest()
    raw = base64.urlsafe_b64decode(token.encode("ascii"))
    return bytes(b ^ digest[i % len(digest)] for i, b in enumerate(raw)).decode("utf-8")


@router.get("/plans")
async def list_plans():
    """Public plan catalog (PHP)."""
    from app.core.limits import PLAN_LIMITS

    return {
        "currency": "PHP",
        "plans": [
            {
                "id": "free",
                "name": "Free",
                "price_php": 0,
                "description": "Start studying with daily AI caps. No card required.",
                "limits": PLAN_LIMITS["free"],
            },
            {
                "id": "student",
                "name": "Student",
                "price_php": PLAN_PRICES_PHP["student"],
                "description": "Higher daily AI limits for serious exam prep.",
                "limits": PLAN_LIMITS["student"],
            },
        ],
        "billing_mode": settings.BILLING_MODE,
    }


@router.get("/usage")
async def get_usage(user: Dict[str, Any] = Depends(get_current_user)):
    return await build_usage_snapshot(user["id"])


@router.post("/upgrade")
async def upgrade_plan(
    payload: PlanUpgradeRequest,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Upgrade to Student.

    BILLING_MODE=stub activates immediately (dev / early launch).
    paymongo mode will validate payment_reference later.
    """
    plan = normalize_plan(payload.plan)
    if plan != "student":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only the Student plan can be purchased right now.",
        )

    mode = (settings.BILLING_MODE or "stub").strip().lower()
    if mode == "paymongo":
        if not payload.payment_reference:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="PayMongo payment_reference is required when BILLING_MODE=paymongo.",
            )
        # Placeholder until PayMongo checkout + webhook are wired.
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="PayMongo checkout is not wired yet. Set BILLING_MODE=stub for early launch.",
        )

    profile = await db_service.set_user_plan(user["id"], "student")
    usage = await build_usage_snapshot(user["id"])
    return {
        "ok": True,
        "message": f"Student plan activated (₱{PLAN_PRICES_PHP['student']}/mo stub checkout).",
        "plan": profile.get("plan"),
        "usage": usage,
    }


@router.post("/cancel")
async def cancel_plan(user: Dict[str, Any] = Depends(get_current_user)):
    """Downgrade to Free (stub)."""
    profile = await db_service.set_user_plan(user["id"], "free")
    usage = await build_usage_snapshot(user["id"])
    return {
        "ok": True,
        "message": "Switched back to the Free plan.",
        "plan": profile.get("plan"),
        "usage": usage,
    }


@router.put("/byok")
async def set_byok_key(
    payload: ByokKeyRequest,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Save or clear a personal Gemini API key.

    When set, daily platform quotas are bypassed (you pay Google directly once
    per-request key routing is fully wired; until then BYOK still unlocks limits).
    """
    raw = (payload.api_key or "").strip()
    if not raw:
        await db_service.upsert_profile(user["id"], {"byok_gemini_key": None})
        usage = await build_usage_snapshot(user["id"])
        return {"ok": True, "has_byok": False, "message": "BYOK key cleared.", "usage": usage}

    if len(raw) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That does not look like a valid Gemini API key.",
        )

    await db_service.upsert_profile(user["id"], {"byok_gemini_key": _obfuscate_key(raw)})
    usage = await build_usage_snapshot(user["id"])
    return {
        "ok": True,
        "has_byok": True,
        "message": "Gemini key saved. Daily platform limits are bypassed for your account.",
        "usage": usage,
    }


def decode_byok_key(stored: Optional[str]) -> Optional[str]:
    if not stored:
        return None
    try:
        return _deobfuscate_key(stored)
    except Exception:
        return None
