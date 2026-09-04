from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile, status
from fastapi.responses import Response

from app.core.auth import get_current_user
from app.core.config import settings
from app.models.schemas import (
    AuthCodeExchange,
    AuthCredentials,
    AuthEmailRequest,
    AuthGoogleToken,
    AuthPasswordChange,
    AuthPasswordUpdate,
    AuthSessionResponse,
    ProfileUpdate,
)
from app.services import auth_service
from app.services.db_service import db_service
from app.services.storage_service import storage_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _me_payload(user: Dict[str, Any], profile: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    profile = profile or {}
    return {
        "id": user["id"],
        "email": user["email"],
        "is_demo": user.get("is_demo", False),
        "email_verified": user.get("email_verified", True),
        "display_name": profile.get("display_name"),
        "avatar_url": profile.get("avatar_url"),
        "bio": profile.get("bio"),
        "gender": profile.get("gender"),
        "theme": profile.get("theme"),
        "has_supabase": settings.has_supabase_credentials,
        "has_gemini": settings.has_gemini_key,
        "gemini_model": settings.GEMINI_MODEL,
    }


@router.post("/signup", response_model=AuthSessionResponse)
async def signup(payload: AuthCredentials):
    return auth_service.signup(payload.email, payload.password)


@router.post("/login", response_model=AuthSessionResponse)
async def login(payload: AuthCredentials):
    return auth_service.login(payload.email, payload.password)


@router.post("/forgot-password")
async def forgot_password(payload: AuthEmailRequest):
    return auth_service.forgot_password(payload.email)


@router.post("/resend-confirmation")
async def resend_confirmation(payload: AuthEmailRequest):
    return auth_service.resend_confirmation(payload.email)


@router.post("/reset-password")
async def reset_password(
    payload: AuthPasswordUpdate,
    authorization: Optional[str] = Header(None),
    user: Dict[str, Any] = Depends(get_current_user),
):
    token = (authorization or "").split(" ")[-1] if authorization else ""
    if not token or token == "demo-token":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Open the reset link from your email to choose a new password.",
        )
    return auth_service.reset_password(user["id"], user.get("email") or "", payload.password)


@router.post("/exchange-code", response_model=AuthSessionResponse)
async def exchange_code(payload: AuthCodeExchange):
    return auth_service.exchange_code(payload.code)


@router.post("/google", response_model=AuthSessionResponse)
async def login_google(payload: AuthGoogleToken):
    return auth_service.login_with_google(payload.credential)



@router.get("/me")
async def get_me(user: Dict[str, Any] = Depends(get_current_user)):
    profile = await db_service.get_profile(user["id"])
    return _me_payload(user, profile)


@router.patch("/profile")
async def update_profile(
    payload: ProfileUpdate,
    user: Dict[str, Any] = Depends(get_current_user),
):
    patch: Dict[str, Any] = {}
    data = payload.model_dump(exclude_unset=True)
    if "display_name" in data:
        display_name = (data["display_name"] or "").strip()
        if not display_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Display name cannot be empty.",
            )
        patch["display_name"] = display_name
    if "bio" in data:
        patch["bio"] = (data["bio"] or "").strip() or None
    if "gender" in data:
        patch["gender"] = (data["gender"] or "").strip() or None
    if "theme" in data:
        theme = (data["theme"] or "").strip()
        if theme and theme not in ("light", "dark"):
            raise HTTPException(status_code=400, detail="Theme must be light or dark.")
        patch["theme"] = theme or None
    try:
        profile = await db_service.upsert_profile(user["id"], patch)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return _me_payload(user, profile)


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    user: Dict[str, Any] = Depends(get_current_user),
):
    content_type = (file.content_type or "image/png").lower()
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Upload an image file.")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Avatar must be 5MB or smaller.")
    ext = "png"
    if "jpeg" in content_type or "jpg" in content_type:
        ext = "jpg"
    elif "webp" in content_type:
        ext = "webp"
    try:
        url = await storage_service.upload_avatar(user["id"], data, content_type, ext)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    try:
        profile = await db_service.upsert_profile(user["id"], {"avatar_url": url})
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Picture uploaded but was not saved to your profile: {exc}",
        )
    if not profile.get("avatar_url"):
        raise HTTPException(
            status_code=500,
            detail="Picture uploaded but was not saved to the profiles table.",
        )
    return _me_payload(user, profile)


@router.get("/avatar-file")
async def get_avatar_file(u: str = Query(...)):
    data = await storage_service.get_avatar(u)
    if not data:
        raise HTTPException(status_code=404, detail="No avatar uploaded.")
    return Response(content=data, media_type="image/png")


@router.post("/change-password")
async def change_password(
    payload: AuthPasswordChange,
    user: Dict[str, Any] = Depends(get_current_user),
):
    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current one.",
        )
    return auth_service.change_password(
        user["id"], user.get("email") or "", payload.current_password, payload.new_password
    )


@router.post("/change-email")
async def change_email(
    payload: AuthEmailRequest,
    user: Dict[str, Any] = Depends(get_current_user),
):
    return auth_service.change_email(user["id"], user.get("email") or "", payload.email)


@router.get("/status")
async def get_auth_status():
    return {
        "status": "online",
        "environment": settings.ENVIRONMENT,
        "supabase_configured": settings.has_supabase_credentials,
        "gemini_configured": settings.has_gemini_key,
        "timestamp": datetime.utcnow().isoformat(),
    }
