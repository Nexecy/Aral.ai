import os
import uuid
import aiofiles
from typing import Optional, Any
from app.core.config import settings

# Try to import supabase client
try:
    from supabase import create_client, Client
    HAS_SUPABASE = True
except ImportError:
    HAS_SUPABASE = False

class StorageService:
    def __init__(self):
        self.supabase_client: Optional[Any] = None
        self.local_storage_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "storage", "uploads")
        os.makedirs(self.local_storage_dir, exist_ok=True)
        self._init_supabase()

    def _init_supabase(self):
        if HAS_SUPABASE and settings.has_supabase_credentials:
            try:
                self.supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            except Exception as e:
                print(f"[StorageService] Warning: Could not initialize Supabase client: {e}")
                self.supabase_client = None

    async def upload_file(self, user_id: str, filename: str, file_bytes: bytes, content_type: str = "application/pdf") -> str:
        """
        Store file in Supabase Storage under user_id/filename or local storage fallback.
        Returns the storage path.
        """
        unique_filename = f"{uuid.uuid4()}_{filename}"
        storage_path = f"{user_id}/{unique_filename}"

        if self.supabase_client:
            try:
                # Upload to Supabase bucket 'documents'
                res = self.supabase_client.storage.from_("documents").upload(
                    path=storage_path,
                    file=file_bytes,
                    file_options={"content-type": content_type, "upsert": "true"}
                )
                return storage_path
            except Exception as e:
                print(f"[StorageService] Supabase upload failed ({e}). Falling back to local storage.")

        # Fallback to local storage
        user_dir = os.path.join(self.local_storage_dir, user_id)
        os.makedirs(user_dir, exist_ok=True)
        file_path = os.path.join(user_dir, unique_filename)
        
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(file_bytes)

        return storage_path

    async def get_file(self, storage_path: str) -> Optional[bytes]:
        """
        Retrieve file bytes from Supabase Storage or local fallback.
        """
        if self.supabase_client:
            try:
                data = self.supabase_client.storage.from_("documents").download(storage_path)
                return data
            except Exception as e:
                print(f"[StorageService] Supabase download failed: {e}")

        # Fallback to local storage
        local_path = os.path.join(self.local_storage_dir, storage_path.replace("/", os.sep))
        if os.path.exists(local_path):
            async with aiofiles.open(local_path, "rb") as f:
                return await f.read()
        return None

    def _avatar_public_url(self, storage_path: str) -> str:
        public = self.supabase_client.storage.from_("avatars").get_public_url(storage_path)
        url = None
        if isinstance(public, str):
            url = public
        elif isinstance(public, dict):
            data = public.get("data") if isinstance(public.get("data"), dict) else {}
            url = public.get("publicUrl") or public.get("publicURL") or data.get("publicUrl")
        if isinstance(url, str) and url.startswith("http"):
            return url.split("?")[0]
        base = settings.SUPABASE_URL.rstrip("/")
        return f"{base}/storage/v1/object/public/avatars/{storage_path}"

    async def upload_avatar(self, user_id: str, file_bytes: bytes, content_type: str, extension: str) -> str:
        """Store an avatar in Supabase Storage and return a durable public URL."""
        filename = f"avatar.{extension.lstrip('.')}"
        storage_path = f"{user_id}/{filename}"

        if self.supabase_client:
            bucket = self.supabase_client.storage.from_("avatars")
            options = {"content-type": content_type, "upsert": "true"}
            last_error = None
            try:
                bucket.upload(path=storage_path, file=file_bytes, file_options=options)
            except Exception as upload_error:
                last_error = upload_error
                try:
                    bucket.remove([storage_path])
                except Exception:
                    pass
                try:
                    bucket.update(path=storage_path, file=file_bytes, file_options=options)
                    last_error = None
                except Exception as update_error:
                    last_error = update_error
            if last_error is None:
                return f"{self._avatar_public_url(storage_path)}?t={uuid.uuid4().hex[:8]}"
            print(f"[StorageService] Avatar upload failed ({last_error}).")
            raise RuntimeError(
                "Could not store the picture in the avatars bucket. "
                "Create the public 'avatars' bucket from supabase/schema.sql."
            )

        avatar_dir = os.path.join(self.local_storage_dir, "avatars", user_id)
        os.makedirs(avatar_dir, exist_ok=True)
        file_path = os.path.join(avatar_dir, filename)
        async with aiofiles.open(file_path, "wb") as handle:
            await handle.write(file_bytes)
        return f"/api/auth/avatar-file?u={user_id}&t={uuid.uuid4().hex[:8]}"

    async def get_avatar(self, user_id: str) -> Optional[bytes]:
        if self.supabase_client:
            for name in ("avatar.png", "avatar.jpg", "avatar.jpeg", "avatar.webp"):
                try:
                    return self.supabase_client.storage.from_("avatars").download(f"{user_id}/{name}")
                except Exception:
                    continue
        for name in ("avatar.png", "avatar.jpg", "avatar.jpeg", "avatar.webp"):
            local_path = os.path.join(self.local_storage_dir, "avatars", user_id, name)
            if os.path.exists(local_path):
                async with aiofiles.open(local_path, "rb") as handle:
                    return await handle.read()
        return None

storage_service = StorageService()
