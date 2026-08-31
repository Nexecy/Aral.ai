"""Sign-up and log-in.

Uses Supabase Auth when credentials are configured so user ids match RLS.
Falls back to a local password store + JWT when running offline.

Unconfirmed accounts still get a local JWT so they can enter the app with
limited access until they verify their email.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

import jwt
from fastapi import HTTPException, status

from app.core.config import settings

LOCAL_USERS_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    ".local_users.json",
)
LOCAL_JWT_SECRET = settings.SUPABASE_JWT_SECRET or "aral-local-dev-secret"
PBKDF2_ROUNDS = 120_000


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _frontend_path(path: str) -> str:
    base = (settings.FRONTEND_URL or "http://localhost:3000").rstrip("/")
    if not path.startswith("/"):
        path = f"/{path}"
    if not path.endswith("/"):
        path = f"{path}/"
    return f"{base}{path}"


def _hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ROUNDS
    ).hex()


def _load_local_users() -> Dict[str, Dict[str, Any]]:
    if not os.path.exists(LOCAL_USERS_PATH):
        return {}
    try:
        with open(LOCAL_USERS_PATH, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _save_local_users(users: Dict[str, Dict[str, Any]]) -> None:
    with open(LOCAL_USERS_PATH, "w", encoding="utf-8") as handle:
        json.dump(users, handle, indent=2)


def _profile(user_id: str, email: str, verified: bool) -> Dict[str, Any]:
    return {
        "id": user_id,
        "email": email,
        "is_demo": False,
        "email_verified": verified,
    }


def _session(
    user: Dict[str, Any],
    token: Optional[str],
    *,
    requires_confirmation: bool = False,
    message: Optional[str] = None,
) -> Dict[str, Any]:
    verified = bool(user.get("email_verified", True))
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
        "requires_confirmation": requires_confirmation,
        "email_verified": verified,
        "message": message,
    }


def issue_access_token(user_id: str, email: str, email_verified: bool = True) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "aud": "authenticated",
        "role": "authenticated",
        "email_verified": email_verified,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=14)).timestamp()),
    }
    return jwt.encode(payload, LOCAL_JWT_SECRET, algorithm="HS256")


def _supabase_client():
    from app.services.db_service import db_service

    return db_service.supabase


def _supabase_error_message(exc: Exception) -> str:
    text = str(exc)
    lowered = text.lower()
    if "already registered" in lowered or "already been registered" in lowered:
        return "An account with this email already exists."
    if "invalid login" in lowered or "invalid credentials" in lowered:
        return "Incorrect email or password."
    if "email not confirmed" in lowered:
        return "email not confirmed"
    return text or "Authentication failed."


def _remember_password(email: str, password: str, user_id: str) -> None:
    users = _load_local_users()
    salt = uuid.uuid4().hex
    users[email] = {
        "id": user_id,
        "email": email,
        "salt": salt,
        "password_hash": _hash_password(password, salt),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _save_local_users(users)


def _verify_remembered_password(email: str, password: str) -> Optional[Dict[str, Any]]:
    record = _load_local_users().get(email)
    if not record:
        return None
    expected = record.get("password_hash", "")
    actual = _hash_password(password, record.get("salt", ""))
    if not expected or not hmac.compare_digest(expected, actual):
        return None
    return record


def _signup_local(email: str, password: str) -> Tuple[Dict[str, Any], str]:
    users = _load_local_users()
    if email in users:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user_id = str(uuid.uuid4())
    salt = uuid.uuid4().hex
    users[email] = {
        "id": user_id,
        "email": email,
        "salt": salt,
        "password_hash": _hash_password(password, salt),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _save_local_users(users)
    profile = _profile(user_id, email, True)
    return profile, issue_access_token(user_id, email, email_verified=True)


def _login_local(email: str, password: str) -> Tuple[Dict[str, Any], str]:
    record = _verify_remembered_password(email, password)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    user_id = str(record["id"])
    profile = _profile(user_id, email, True)
    return profile, issue_access_token(user_id, email, email_verified=True)


def _use_local_auth() -> bool:
    return bool(os.getenv("PYTEST_CURRENT_TEST")) or _supabase_client() is None


def signup(email: str, password: str) -> Dict[str, Any]:
    email = _normalize_email(email)
    client = None if _use_local_auth() else _supabase_client()

    if client:
        try:
            result = client.auth.sign_up(
                {
                    "email": email,
                    "password": password,
                    "options": {"email_redirect_to": _frontend_path("/confirm/")},
                }
            )
            user = result.user
            session = result.session
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Could not create that account. Try a different email.",
                )

            user_id = str(user.id)
            _remember_password(email, password, user_id)
            if session and session.access_token:
                profile = _profile(user_id, user.email or email, True)
                return _session(profile, session.access_token)

            token = issue_access_token(user_id, email, email_verified=False)
            profile = _profile(user_id, user.email or email, False)
            return _session(
                profile,
                token,
                requires_confirmation=True,
                message="You're in. Confirm your email to unlock AI study tools.",
            )
        except HTTPException:
            raise
        except Exception as exc:
            message = _supabase_error_message(exc)
            if "already exists" in message.lower():
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)

    user, token = _signup_local(email, password)
    return _session(user, token)


def login(email: str, password: str) -> Dict[str, Any]:
    email = _normalize_email(email)
    client = None if _use_local_auth() else _supabase_client()

    if client:
        try:
            result = client.auth.sign_in_with_password({"email": email, "password": password})
            user = result.user
            session = result.session
            if not user or not session or not session.access_token:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect email or password.",
                )
            profile = _profile(str(user.id), user.email or email, True)
            return _session(profile, session.access_token)
        except HTTPException:
            raise
        except Exception as exc:
            message = _supabase_error_message(exc)
            if message == "email not confirmed":
                record = _verify_remembered_password(email, password)
                if not record:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Incorrect email or password.",
                    )
                user_id = str(record["id"])
                profile = _profile(user_id, email, False)
                token = issue_access_token(user_id, email, email_verified=False)
                return _session(
                    profile,
                    token,
                    requires_confirmation=True,
                    message="You're signed in with limited access. Confirm your email to unlock AI study tools.",
                )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=message if message != "email not confirmed" else "Incorrect email or password.",
            )

    user, token = _login_local(email, password)
    return _session(user, token)


def forgot_password(email: str) -> Dict[str, Any]:
    email = _normalize_email(email)
    client = None if _use_local_auth() else _supabase_client()
    if client:
        try:
            client.auth.reset_password_for_email(
                email,
                {"redirect_to": _frontend_path("/reset-password/")},
            )
        except Exception:
            pass
    return {
        "ok": True,
        "message": "If that email is registered, we sent a reset link.",
    }


def resend_confirmation(email: str) -> Dict[str, Any]:
    email = _normalize_email(email)
    client = None if _use_local_auth() else _supabase_client()
    if client:
        try:
            client.auth.resend({"type": "signup", "email": email})
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=_supabase_error_message(exc),
            )
    return {
        "ok": True,
        "message": "If this account still needs verifying, we sent another confirmation email.",
    }


def reset_password(user_id: str, email: str, password: str) -> Dict[str, Any]:
    client = None if _use_local_auth() else _supabase_client()
    if client:
        try:
            client.auth.admin.update_user_by_id(user_id, {"password": password})
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=_supabase_error_message(exc),
            )

    users = _load_local_users()
    record = users.get(_normalize_email(email))
    if record and str(record.get("id")) == str(user_id):
        salt = uuid.uuid4().hex
        record["salt"] = salt
        record["password_hash"] = _hash_password(password, salt)
        _save_local_users(users)
    else:
        _remember_password(_normalize_email(email), password, user_id)

    return {"ok": True, "message": "Password updated. You can sign in with your new password."}


def exchange_code(code: str) -> Dict[str, Any]:
    client = _supabase_client()
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot complete that confirmation link right now.",
        )
    try:
        result = client.auth.exchange_code_for_session({"auth_code": code})
        user = result.user
        session = result.session
        if not user or not session or not session.access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="That confirmation link is invalid or has expired.",
            )
        profile = _profile(str(user.id), user.email or "signed-in", True)
        return _session(profile, session.access_token)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=_supabase_error_message(exc),
        )


def change_password(user_id: str, email: str, current_password: str, new_password: str) -> Dict[str, Any]:
    email = _normalize_email(email)
    client = None if _use_local_auth() else _supabase_client()
    if client:
        try:
            client.auth.sign_in_with_password({"email": email, "password": current_password})
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Current password is incorrect.",
            )
        try:
            client.auth.admin.update_user_by_id(user_id, {"password": new_password})
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=_supabase_error_message(exc),
            )
        _remember_password(email, new_password, user_id)
        return {"ok": True, "message": "Password updated."}

    record = _verify_remembered_password(email, current_password)
    if not record or str(record.get("id")) != str(user_id):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect.",
        )
    _remember_password(email, new_password, user_id)
    return {"ok": True, "message": "Password updated."}


def change_email(user_id: str, current_email: str, new_email: str) -> Dict[str, Any]:
    new_email = _normalize_email(new_email)
    current_email = _normalize_email(current_email)
    if new_email == current_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That is already your email address.",
        )
    client = None if _use_local_auth() else _supabase_client()
    if client:
        try:
            client.auth.admin.update_user_by_id(user_id, {"email": new_email})
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=_supabase_error_message(exc),
            )
        return {
            "ok": True,
            "message": "Check your inbox to confirm the new email address.",
        }

    users = _load_local_users()
    record = users.pop(current_email, None)
    if record:
        record["email"] = new_email
        users[new_email] = record
        _save_local_users(users)
    return {"ok": True, "message": "Email updated."}
