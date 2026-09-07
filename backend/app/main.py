import traceback
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.core.config import settings
from app.core.stack_health import APP_VERSION, build_health_payload

from app.routers import (
    auth,
    documents,
    sessions,
    notes,
    flashcards,
    quizzes,
    chat,
    pomodoro,
    exams,
    contact
)

app = FastAPI(
    title="Aral.ai API",
    description="Cross-platform AI Study Application Backend with Google Gemini, Supabase, and PyMuPDF",
    version=APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable automatic gzip compression for responses >= 500 bytes
app.add_middleware(GZipMiddleware, minimum_size=500)

# Configure CORS from settings so Vercel, custom domains, and local ports stay in sync.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=86400,
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
app.include_router(contact.router, prefix="/api")

@app.get("/")
@app.get("/api/health")
async def root():
    return build_health_payload()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)

