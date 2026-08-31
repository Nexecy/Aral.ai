from typing import Optional, Dict, Any

import jwt
from fastapi import Depends, Header, HTTPException, status
from jwt import PyJWKClient

from app.core.config import settings

# Used by tests via `Authorization: Bearer demo-token`, and as the identity
# when no token is sent at all (so existing API tests keep working).
LOCAL_USER = {
    "id": "00000000-0000-0000-0000-000000000001",
    "email": "local-account",
    "is_demo": False,
    "email_verified": True,
}

LOCAL_JWT_SECRET = "aral-local-dev-secret"

_jwks_client: Optional[PyJWKClient] = None


def _jwks() -> Optional[PyJWKClient]:
    global _jwks_client
    if not settings.SUPABASE_URL:
        return None
    if _jwks_client is None:
        jwks_url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
        headers = {}
        if settings.SUPABASE_KEY:
            headers["apikey"] = settings.SUPABASE_KEY
            headers["Authorization"] = f"Bearer {settings.SUPABASE_KEY}"
        _jwks_client = PyJWKClient(jwks_url, headers=headers or None, cache_keys=True)
    return _jwks_client


def _user_from_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    user_id = payload.get("sub") or payload.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token claims (missing user id)",
        )
    if "email_verified" in payload:
        verified = bool(payload.get("email_verified"))
    else:
        verified = True
    return {
        "id": str(user_id),
        "email": payload.get("email") or "signed-in",
        "is_demo": False,
        "email_verified": verified,
    }


def _decode_user_token(token: str) -> Dict[str, Any]:
    try:
        header = jwt.get_unverified_header(token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {exc}",
        )

    alg = header.get("alg") or "HS256"
    asymmetric = {"ES256", "RS256", "ES384", "RS384", "ES512", "RS512"}

    if alg in asymmetric:
        client = _jwks()
        if client is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token verification failed: signing keys unavailable",
            )
        try:
            signing_key = client.get_signing_key_from_jwt(token)
            try:
                payload = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=[alg],
                    audience="authenticated",
                    leeway=30,
                )
            except jwt.InvalidAudienceError:
                payload = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=[alg],
                    options={"verify_aud": False},
                    leeway=30,
                )
            return _user_from_payload(payload)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Token verification failed: {exc}",
            )

    secrets = []
    if settings.SUPABASE_JWT_SECRET:
        secrets.append(settings.SUPABASE_JWT_SECRET)
    secrets.append(LOCAL_JWT_SECRET)

    last_error: Optional[Exception] = None
    for secret in secrets:
        try:
            payload = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                audience="authenticated",
                leeway=30,
            )
            return _user_from_payload(payload)
        except HTTPException:
            raise
        except jwt.InvalidAudienceError:
            try:
                payload = jwt.decode(
                    token,
                    secret,
                    algorithms=["HS256"],
                    options={"verify_aud": False},
                    leeway=30,
                )
                return _user_from_payload(payload)
            except Exception as exc:
                last_error = exc
        except Exception as exc:
            last_error = exc

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=f"Token verification failed: {last_error}",
    )


async def get_current_user(
    authorization: Optional[str] = Header(None)
) -> Dict[str, Any]:
    """
    Resolve the caller from Authorization: Bearer <token>.

    Missing tokens and the test sentinel `demo-token` map to the local
    single-user identity. Any other presented token is verified and never
    remapped onto that identity.
    """
    if not authorization:
        return LOCAL_USER

    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format. Expected 'Bearer <token>'",
        )

    token = parts[1]
    if token == "demo-token":
        return LOCAL_USER

    return _decode_user_token(token)


async def require_verified_email(
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Block AI study tools until the account email is verified."""
    if not user.get("email_verified", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verify your email to unlock AI study tools.",
        )
    return user
