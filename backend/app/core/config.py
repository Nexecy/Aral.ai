import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    ENVIRONMENT: str = Field(default="development")
    PORT: int = Field(default=8000)
    HOST: str = Field(default="0.0.0.0")
    
    # Gemini
    GEMINI_API_KEY: str = Field(default="")
    GEMINI_MODEL: str = Field(default="gemini-flash-latest")
    
    # Supabase
    SUPABASE_URL: str = Field(default="")
    SUPABASE_KEY: str = Field(default="")
    SUPABASE_JWT_SECRET: str = Field(default="")
    
    FRONTEND_URL: str = Field(default="http://localhost:3000")
    # Used when the API is hosted (Render) but FRONTEND_URL was left on localhost.
    PRODUCTION_FRONTEND_URL: str = Field(default="https://aral-ai-three.vercel.app")

    # CORS
    CORS_ORIGINS: str = Field(
        default="http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001,tauri://localhost,capacitor://localhost"
    )

    @property
    def frontend_origin(self) -> str:
        url = (self.FRONTEND_URL or "").strip().rstrip("/")
        hosted = bool(os.getenv("RENDER") or os.getenv("RENDER_EXTERNAL_URL"))
        local = (not url) or ("localhost" in url) or ("127.0.0.1" in url)
        if hosted and local:
            return (self.PRODUCTION_FRONTEND_URL or "https://aral-ai-three.vercel.app").rstrip("/")
        return url or "http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        origins = [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        live = self.frontend_origin
        if live and live not in origins:
            origins.append(live)
        return origins

    @property
    def has_gemini_key(self) -> bool:
        return bool(self.GEMINI_API_KEY and len(self.GEMINI_API_KEY.strip()) > 5)

    @property
    def has_supabase_credentials(self) -> bool:
        return bool(
            self.SUPABASE_URL 
            and self.SUPABASE_KEY 
            and self.SUPABASE_URL.startswith("http")
        )

    model_config = SettingsConfigDict(
        env_file=[
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env"),
            ".env"
        ],
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
