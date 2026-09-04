import os
import traceback
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.core.config import settings

from app.routers import (
    auth,
    documents,
    sessions,
    notes,
    flashcards,
    quizzes,
    chat,
    pomodoro,
    exams
)

app = FastAPI(
    title="Aral.ai API",
    description="Cross-platform AI Study Application Backend with Google Gemini, Supabase, and PyMuPDF",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable automatic gzip compression for responses >= 500 bytes
app.add_middleware(GZipMiddleware, minimum_size=500)

# Configure CORS for Next.js, Capacitor mobile, Tauri desktop, and Vercel
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3005",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3005",
        "capacitor://localhost",
        "http://localhost",
        "https://aral-ai.vercel.app",
        "https://aral-ai-three.vercel.app",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$|^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler ensures 500 responses retain CORS headers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
    )

# Include API Routers
app.include_router(auth.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(notes.router, prefix="/api")
app.include_router(flashcards.router, prefix="/api")
app.include_router(quizzes.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(pomodoro.router, prefix="/api")
app.include_router(exams.router, prefix="/api")

@app.get("/")
@app.get("/api/health")
async def root():
    return {
        "app": "Aral.ai API",
        "version": "1.0.0",
        "status": "operational",
        "docs": "/docs",
        "mode": "hybrid",
        "gemini_active": settings.has_gemini_key,
        "supabase_active": settings.has_supabase_credentials
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)

