from datetime import date, datetime
from typing import List, Literal, Optional, Dict, Any, Union
from pydantic import BaseModel, Field, ConfigDict
import uuid

# ==============================================================================
# User Schemas
# ==============================================================================
class UserBase(BaseModel):
    email: str

class UserResponse(UserBase):
    id: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AuthCredentials(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=8, max_length=128)


class AuthSessionResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: str = "bearer"
    user: Dict[str, Any]
    requires_confirmation: bool = False
    email_verified: bool = True
    message: Optional[str] = None


class AuthEmailRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)


class AuthPasswordUpdate(BaseModel):
    password: str = Field(..., min_length=8, max_length=128)


class AuthCodeExchange(BaseModel):
    code: str = Field(..., min_length=8, max_length=2048)


class AuthGoogleToken(BaseModel):
    credential: str = Field(..., min_length=10)


class AuthPasswordChange(BaseModel):
    current_password: str = Field(..., min_length=8, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=80)
    bio: Optional[str] = Field(default=None, max_length=280)
    gender: Optional[str] = Field(default=None, max_length=40)
    theme: Optional[str] = Field(default=None, max_length=16)


# ==============================================================================
# Document Schemas
# ==============================================================================
class DocumentBase(BaseModel):
    filename: str
    page_count: int = 1
    file_size_bytes: int = 0

class DocumentCreate(DocumentBase):
    storage_path: str
    extracted_text: str = ""

class DocumentResponse(DocumentBase):
    id: str
    user_id: str
    storage_path: str
    uploaded_at: datetime
    extracted_text: Optional[str] = ""
    model_config = ConfigDict(from_attributes=True)

class DocumentUpdate(BaseModel):
    filename: Optional[str] = Field(default=None, min_length=1, max_length=255)


# ==============================================================================
# Session Schemas
# ==============================================================================
SessionStatus = Literal["active", "inactive", "completed"]

class SessionBase(BaseModel):
    title: str
    document_id: Optional[str] = None

class SessionCreate(SessionBase):
    pass

class SessionUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[SessionStatus] = None

class SessionEndRequest(BaseModel):
    """Final metrics synced from the workspace when the user exits a session."""
    status: SessionStatus = "inactive"
    total_focus_seconds: int = Field(default=0, ge=0)
    cards_reviewed: int = Field(default=0, ge=0)

class SessionResponse(SessionBase):
    id: str
    user_id: str
    status: SessionStatus = "active"
    created_at: datetime
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    last_accessed_at: datetime
    total_focus_seconds: int = 0
    cards_reviewed: int = 0
    document: Optional[DocumentResponse] = None
    model_config = ConfigDict(from_attributes=True)


# ==============================================================================
# Notes Schemas
# ==============================================================================
class KeyTerm(BaseModel):
    term: str
    definition: str

class NoteSection(BaseModel):
    heading: str
    subpoints: List[str] = Field(default_factory=list)
    key_terms: List[KeyTerm] = Field(default_factory=list)

class NoteContent(BaseModel):
    title: str = "Extracted Notes"
    summary: str = ""
    sections: List[NoteSection] = Field(default_factory=list)

class NotesUpdate(BaseModel):
    content: NoteContent
    scope: Optional[str] = None

class NotesResponse(BaseModel):
    id: str
    session_id: str
    content: NoteContent
    scope: str = "full document"
    generated_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ==============================================================================
# Flashcard Schemas
# ==============================================================================
class FlashcardBase(BaseModel):
    front: str
    back: str
    order_index: int = 0

class FlashcardCreate(FlashcardBase):
    pass

class FlashcardUpdate(BaseModel):
    front: Optional[str] = None
    back: Optional[str] = None
    order_index: Optional[int] = None

class FlashcardResponse(FlashcardBase):
    id: str
    session_id: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ==============================================================================
# Quiz Schemas
# ==============================================================================
class MatchingPair(BaseModel):
    left: str
    right: str

class QuizQuestion(BaseModel):
    id: str
    type: str = "multiple_choice" # multiple_choice, identification, matching
    question: str
    options: Optional[List[str]] = None
    correct_answer: Union[str, Dict[str, str], List[str]]
    explanation: Optional[str] = ""
    matching_pairs: Optional[List[MatchingPair]] = None

class QuizGenerationRequest(BaseModel):
    quiz_type: str = "multiple_choice" # 'multiple_choice' | 'identification' | 'matching'
    question_count: int = 5

class QuizSubmission(BaseModel):
    answers: Dict[str, Any] # question_id -> user answer

class QuestionResult(BaseModel):
    question_id: str
    question: str
    user_answer: Any
    correct_answer: Any
    is_correct: bool
    explanation: str

class QuizAttemptResponse(BaseModel):
    id: str
    session_id: str
    quiz_type: str
    questions: List[QuizQuestion]
    user_answers: Dict[str, Any]
    score: float
    total_questions: int
    completed_at: datetime
    results: Optional[List[QuestionResult]] = None
    model_config = ConfigDict(from_attributes=True)


# ==============================================================================
# Chat Schemas
# ==============================================================================
class ChatMessageBase(BaseModel):
    role: str # user, assistant, system
    content: str

class ChatMessageCreate(BaseModel):
    content: str

class ChatMessageResponse(ChatMessageBase):
    id: str
    session_id: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ==============================================================================
# Pomodoro Schemas
# ==============================================================================
class PomodoroLogCreate(BaseModel):
    session_id: Optional[str] = None
    duration_minutes: int = 25
    completed: bool = True

class PomodoroLogResponse(BaseModel):
    id: str
    user_id: str
    session_id: Optional[str] = None
    started_at: datetime
    duration_minutes: int
    completed: bool
    model_config = ConfigDict(from_attributes=True)

class PomodoroStats(BaseModel):
    total_cycles_completed: int
    total_study_minutes: int
    session_study_minutes: int

class PomodoroSettingsBase(BaseModel):
    study_minutes: int = 25
    short_break_minutes: int = 5
    long_break_minutes: int = 15
    cycles_before_long_break: int = 4
    auto_start_next: bool = False
    sound_enabled: bool = True
    sound_choice: str = "zen"

class PomodoroSettingsUpdate(BaseModel):
    study_minutes: Optional[int] = None
    short_break_minutes: Optional[int] = None
    long_break_minutes: Optional[int] = None
    cycles_before_long_break: Optional[int] = None
    auto_start_next: Optional[bool] = None
    sound_enabled: Optional[bool] = None
    sound_choice: Optional[str] = None

class PomodoroSettingsResponse(PomodoroSettingsBase):
    id: str
    user_id: str
    model_config = ConfigDict(from_attributes=True)

class FlashcardReviewRequest(BaseModel):
    rating: str # 'again' | 'hard' | 'good' | 'easy'

class FlashcardReviewResponse(BaseModel):
    id: str
    session_id: str
    front: str
    back: str
    order_index: int
    rating: Optional[str] = None
    ease_factor: float = 2.5
    review_count: int = 0
    next_review_at: Optional[datetime] = None

class KnowledgeSearchResult(BaseModel):
    type: str # 'note' | 'flashcard' | 'session'
    title: str
    snippet: str
    session_id: str
    session_title: str

# ==============================================================================
# Exam Schemas
# ==============================================================================
ExamColor = Literal["blue", "purple", "pink", "orange", "teal", "green"]

class ExamBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    exam_date: date
    document_id: Optional[str] = None
    color: ExamColor = "blue"
    notes: Optional[str] = None

class ExamCreate(ExamBase):
    pass

class ExamUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    exam_date: Optional[date] = None
    document_id: Optional[str] = None
    color: Optional[ExamColor] = None
    notes: Optional[str] = None

class ExamResponse(ExamBase):
    id: str
    user_id: str
    created_at: datetime
    # Negative once the exam date has passed, so the UI can grey out old entries.
    days_remaining: int = 0
    model_config = ConfigDict(from_attributes=True)


# ==============================================================================
# Dashboard Summary Schema
# ==============================================================================
class DashboardSummary(BaseModel):
    """Aggregated, user-scoped counters that back the dashboard stat cards."""
    has_data: bool = False
    total_sessions: int = 0
    active_sessions: int = 0
    total_documents: int = 0
    total_focus_minutes: int = 0
    total_cycles_completed: int = 0
    study_streak_days: int = 0
    latest_session_id: Optional[str] = None
    latest_session_title: Optional[str] = None
    nearest_exam: Optional[ExamResponse] = None
    days_until_nearest_exam: Optional[int] = None


# ==============================================================================
# Complete Session Snapshot Schema
# ==============================================================================
class SessionDetailResponse(BaseModel):
    session: SessionResponse
    document: Optional[DocumentResponse] = None
    notes: Optional[NotesResponse] = None
    flashcards: List[FlashcardResponse] = Field(default_factory=list)
    quiz_attempts: List[QuizAttemptResponse] = Field(default_factory=list)
    chat_history: List[ChatMessageResponse] = Field(default_factory=list)
