import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

# Configure CORS for Next.js, Capacitor mobile, and Tauri desktop
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for seamless cross-platform local & device dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
