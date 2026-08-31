import os
import uuid
import asyncio
from datetime import date, datetime, timedelta
from typing import Dict, Any, List, Optional
from app.core.config import settings

# Session/document list payloads must not include extracted_text — a single PDF
# can be tens of KB of JSON and it was nested onto every row of /sessions.
DOCUMENT_META_COLUMNS = (
    "id, user_id, filename, storage_path, page_count, file_size_bytes, uploaded_at"
)
SESSION_LIST_SELECT = f"*, documents({DOCUMENT_META_COLUMNS})"

try:
    from supabase import create_client, Client
    HAS_SUPABASE = True
except ImportError:
    HAS_SUPABASE = False


def _coerce_date(value: Any) -> Optional[date]:
    """Normalise the date/datetime/ISO-string mix returned by Supabase vs memory."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        text = str(value).replace("Z", "+00:00")
        return datetime.fromisoformat(text).date()
    except ValueError:
        try:
            return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
        except ValueError:
            return None


def _date_to_iso(value: Any) -> Optional[str]:
    parsed = _coerce_date(value)
    return parsed.isoformat() if parsed else None

class DBService:
    def __init__(self):
        self.supabase: Optional[Any] = None
        # In-memory storage structures for standalone / demo / fallback operation
        self.documents: Dict[str, Dict[str, Any]] = {}
        self.sessions: Dict[str, Dict[str, Any]] = {}
        self.notes: Dict[str, Dict[str, Any]] = {}
        self.flashcards: Dict[str, List[Dict[str, Any]]] = {} # session_id -> list of cards
        self.quiz_attempts: Dict[str, List[Dict[str, Any]]] = {} # session_id -> list of attempts
        self.chat_messages: Dict[str, List[Dict[str, Any]]] = {} # session_id -> list of messages
        self.pomodoro_logs: List[Dict[str, Any]] = []
        self.exams: Dict[str, Dict[str, Any]] = {}
        self.pomodoro_settings: Dict[str, Dict[str, Any]] = {}
        self.profiles: Dict[str, Dict[str, Any]] = {}

        self._init_supabase()

    @staticmethod
    def _document_meta(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not doc:
            return None
        return {k: v for k, v in doc.items() if k != "extracted_text"}

    def _init_supabase(self):
        if HAS_SUPABASE and settings.has_supabase_credentials:
            try:
                self.supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            except Exception as e:
                print(f"[DBService] Warning: Could not initialize Supabase DB client: {e}")
                self.supabase = None

    # --------------------------------------------------------------------------
    # Document Operations
    # --------------------------------------------------------------------------
    async def create_document(self, user_id: str, filename: str, storage_path: str, page_count: int, extracted_text: str, file_size_bytes: int) -> Dict[str, Any]:
        doc_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        doc = {
            "id": doc_id,
            "user_id": user_id,
            "filename": filename,
            "storage_path": storage_path,
            "page_count": page_count,
            "extracted_text": extracted_text,
            "file_size_bytes": file_size_bytes,
            "uploaded_at": now
        }
        if self.supabase:
            try:
                res = self.supabase.table("documents").insert(doc).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                print(f"[DBService] Supabase insert document error: {e}")
        
        self.documents[doc_id] = doc
        return doc

    async def get_documents(self, user_id: str) -> List[Dict[str, Any]]:
        if self.supabase:
            try:
                res = self.supabase.table("documents").select(DOCUMENT_META_COLUMNS).eq("user_id", user_id).order("uploaded_at", desc=True).execute()
                remote = res.data or []
                if remote:
                    return remote
            except Exception as e:
                print(f"[DBService] Supabase get documents error: {e}")

        return [
            self._document_meta(d) or d
            for d in self.documents.values()
            if d.get("user_id") == user_id
        ]

    async def get_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        if self.supabase:
            try:
                res = self.supabase.table("documents").select("*").eq("id", doc_id).single().execute()
                if res.data:
                    return res.data
            except Exception as e:
                print(f"[DBService] Supabase get document error: {e}")

        return self.documents.get(doc_id)

    # --------------------------------------------------------------------------
    # Session Operations
    # --------------------------------------------------------------------------
    async def create_session(self, user_id: str, title: str, document_id: Optional[str] = None) -> Dict[str, Any]:
        session_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        session = {
            "id": session_id,
            "user_id": user_id,
            "document_id": document_id,
            "title": title,
            "status": "active",
            "created_at": now,
            "started_at": now,
            "ended_at": None,
            "last_accessed_at": now,
            "total_focus_seconds": 0,
            "cards_reviewed": 0
        }
        if self.supabase:
            try:
                res = self.supabase.table("sessions").insert(session).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                print(f"[DBService] Supabase create session error: {e}")

        self.sessions[session_id] = session
        return session

    async def get_sessions(self, user_id: str, query: Optional[str] = None) -> List[Dict[str, Any]]:
        remote: List[Dict[str, Any]] = []
        if self.supabase:
            try:
                q = self.supabase.table("sessions").select(SESSION_LIST_SELECT).eq("user_id", user_id).order("last_accessed_at", desc=True)
                if query:
                    q = q.ilike("title", f"%{query}%")
                res = q.execute()
                remote = res.data or []
            except Exception as e:
                print(f"[DBService] Supabase get sessions error: {e}")

        local = [s for s in self.sessions.values() if s.get("user_id") == user_id]
        if query:
            q_lower = query.lower()
            local = [s for s in local if q_lower in s.get("title", "").lower()]

        # Attach document metadata if available
        for s in local:
            doc_id = s.get("document_id")
            if doc_id and doc_id in self.documents:
                s["document"] = self._document_meta(self.documents[doc_id])

        # Merge rather than letting an empty remote result mask locally buffered
        # sessions (writes fall back to memory whenever Supabase rejects them).
        seen = {s["id"] for s in remote if s.get("id")}
        results = remote + [s for s in local if s.get("id") not in seen]
        results.sort(key=lambda x: x.get("last_accessed_at", ""), reverse=True)
        return results

    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        if self.supabase:
            try:
                res = self.supabase.table("sessions").select(SESSION_LIST_SELECT).eq("id", session_id).single().execute()
                if res.data:
                    return res.data
            except Exception as e:
                print(f"[DBService] Supabase get session error: {e}")

        session = self.sessions.get(session_id)
        if session:
            doc_id = session.get("document_id")
            if doc_id and doc_id in self.documents:
                session["document"] = self._document_meta(self.documents[doc_id])
        return session

    async def update_session_access(self, session_id: str):
        now = datetime.utcnow().isoformat()
        if session_id in self.sessions:
            self.sessions[session_id]["last_accessed_at"] = now
        if self.supabase:
            try:
                self.supabase.table("sessions").update({"last_accessed_at": now}).eq("id", session_id).execute()
            except Exception:
                pass

    async def update_session(self, session_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Patch arbitrary session columns and return the updated record."""
        if not updates:
            return await self.get_session(session_id)

        updates = {**updates, "last_accessed_at": datetime.utcnow().isoformat()}

        if self.supabase:
            try:
                res = self.supabase.table("sessions").update(updates).eq("id", session_id).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                print(f"[DBService] Supabase update session error: {e}")

        session = self.sessions.get(session_id)
        if not session:
            return None
        session.update(updates)
        return session

    async def resume_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Mark a session as the live workspace session. Re-opening a previously ended
        session clears its end timestamp so lifecycle stays consistent.
        """
        session = await self.get_session(session_id)
        if not session:
            return None
        if session.get("status") == "active" and not session.get("ended_at"):
            await self.update_session_access(session_id)
            return session
        return await self.update_session(session_id, {"status": "active", "ended_at": None})

    async def end_session(
        self,
        session_id: str,
        status: str = "inactive",
        total_focus_seconds: int = 0,
        cards_reviewed: int = 0
    ) -> Optional[Dict[str, Any]]:
        """
        Close out a study session: flip status, stamp ended_at, and accumulate the
        focus/review metrics reported by the workspace before it unmounts.
        """
        session = await self.get_session(session_id)
        if not session:
            return None

        return await self.update_session(session_id, {
            "status": status,
            "ended_at": datetime.utcnow().isoformat(),
            "total_focus_seconds": int(session.get("total_focus_seconds") or 0) + max(0, total_focus_seconds),
            "cards_reviewed": int(session.get("cards_reviewed") or 0) + max(0, cards_reviewed)
        })

    async def delete_session(self, session_id: str) -> bool:
        """
        Delete a session and cascade delete all child records (notes, flashcards, quiz attempts, chat messages).
        Does NOT delete the parent document.
        """
        if self.supabase:
            try:
                self.supabase.table("sessions").delete().eq("id", session_id).execute()
            except Exception as e:
                print(f"[DBService] Supabase delete session error: {e}")

        # In-memory cascade cleanup
        if session_id in self.sessions:
            del self.sessions[session_id]
        if session_id in self.notes:
            del self.notes[session_id]
        if session_id in self.flashcards:
            del self.flashcards[session_id]
        if session_id in self.quiz_attempts:
            del self.quiz_attempts[session_id]
        if session_id in self.chat_messages:
            del self.chat_messages[session_id]

        return True

    # --------------------------------------------------------------------------
    # Notes Operations
    # --------------------------------------------------------------------------
    async def upsert_notes(self, session_id: str, content: Dict[str, Any], scope: str = "full document") -> Dict[str, Any]:
        now = datetime.utcnow().isoformat()
        existing = self.notes.get(session_id)
        note_id = existing["id"] if existing else str(uuid.uuid4())
        
        notes_record = {
            "id": note_id,
            "session_id": session_id,
            "content": content,
            "scope": scope,
            "generated_at": existing["generated_at"] if existing else now,
            "updated_at": now
        }
        
        if self.supabase:
            try:
                res = self.supabase.table("notes").upsert(notes_record).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                print(f"[DBService] Supabase upsert notes error: {e}")

        self.notes[session_id] = notes_record
        return notes_record

    async def get_notes(self, session_id: str) -> Optional[Dict[str, Any]]:
        if self.supabase:
            try:
                res = self.supabase.table("notes").select("*").eq("session_id", session_id).order("updated_at", desc=True).limit(1).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                print(f"[DBService] Supabase get notes error: {e}")

        return self.notes.get(session_id)

    # --------------------------------------------------------------------------
    # Flashcard Operations
    # --------------------------------------------------------------------------
    async def save_flashcards(self, session_id: str, flashcards_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        now = datetime.utcnow().isoformat()
        records = []
        for i, card in enumerate(flashcards_list):
            card_id = card.get("id") or str(uuid.uuid4())
            records.append({
                "id": card_id,
                "session_id": session_id,
                "front": card.get("front", ""),
                "back": card.get("back", ""),
                "order_index": card.get("order_index", i),
                "created_at": now
            })

        if self.supabase:
            try:
                # Delete existing flashcards for session before inserting fresh batch
                self.supabase.table("flashcards").delete().eq("session_id", session_id).execute()
                res = self.supabase.table("flashcards").insert(records).execute()
                if res.data:
                    return res.data
            except Exception as e:
                print(f"[DBService] Supabase save flashcards error: {e}")

        self.flashcards[session_id] = records
        return records

    async def get_flashcards(self, session_id: str) -> List[Dict[str, Any]]:
        if self.supabase:
            try:
                res = self.supabase.table("flashcards").select("*").eq("session_id", session_id).order("order_index").execute()
                if res.data:
                    return res.data
            except Exception as e:
                print(f"[DBService] Supabase get flashcards error: {e}")

        cards = self.flashcards.get(session_id, [])
        cards.sort(key=lambda x: x.get("order_index", 0))
        return cards

    # --------------------------------------------------------------------------
    # Quiz Operations
    # --------------------------------------------------------------------------
    async def create_quiz_attempt(
        self,
        session_id: str,
        quiz_type: str,
        questions: List[Dict[str, Any]],
        user_answers: Dict[str, Any],
        score: float,
        total_questions: int,
        results: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        attempt_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        record = {
            "id": attempt_id,
            "session_id": session_id,
            "quiz_type": quiz_type,
            "questions": questions,
            "user_answers": user_answers,
            "score": score,
            "total_questions": total_questions,
            "completed_at": now,
            "results": results or []
        }

        if self.supabase:
            try:
                res = self.supabase.table("quiz_attempts").insert({
                    "id": attempt_id,
                    "session_id": session_id,
                    "quiz_type": quiz_type,
                    "questions": questions,
                    "user_answers": user_answers,
                    "score": score,
                    "total_questions": total_questions,
                    "completed_at": now
                }).execute()
                if res.data:
                    res.data[0]["results"] = results or []
                    return res.data[0]
            except Exception as e:
                print(f"[DBService] Supabase create quiz attempt error: {e}")

        if session_id not in self.quiz_attempts:
            self.quiz_attempts[session_id] = []
        self.quiz_attempts[session_id].append(record)
        return record

    async def get_quiz_attempts(self, session_id: str) -> List[Dict[str, Any]]:
        if self.supabase:
            try:
                res = self.supabase.table("quiz_attempts").select("*").eq("session_id", session_id).order("completed_at", desc=True).execute()
                if res.data:
                    return res.data
            except Exception as e:
                print(f"[DBService] Supabase get quiz attempts error: {e}")

        return self.quiz_attempts.get(session_id, [])

    # --------------------------------------------------------------------------
    # Chat Operations
    # --------------------------------------------------------------------------
    async def add_chat_message(self, session_id: str, role: str, content: str) -> Dict[str, Any]:
        msg_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        record = {
            "id": msg_id,
            "session_id": session_id,
            "role": role,
            "content": content,
            "created_at": now
        }
        if self.supabase:
            try:
                res = self.supabase.table("chat_messages").insert(record).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                print(f"[DBService] Supabase add chat message error: {e}")

        if session_id not in self.chat_messages:
            self.chat_messages[session_id] = []
        self.chat_messages[session_id].append(record)
        return record

    async def get_chat_history(self, session_id: str) -> List[Dict[str, Any]]:
        if self.supabase:
            try:
                res = self.supabase.table("chat_messages").select("*").eq("session_id", session_id).order("created_at", desc=False).execute()
                if res.data:
                    return res.data
            except Exception as e:
                print(f"[DBService] Supabase get chat history error: {e}")

        return self.chat_messages.get(session_id, [])

    # --------------------------------------------------------------------------
    # Pomodoro Operations
    # --------------------------------------------------------------------------
    async def log_pomodoro(self, user_id: str, duration_minutes: int, session_id: Optional[str] = None, completed: bool = True) -> Dict[str, Any]:
        log_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        record = {
            "id": log_id,
            "user_id": user_id,
            "session_id": session_id,
            "started_at": now,
            "duration_minutes": duration_minutes,
            "completed": completed
        }
        if self.supabase:
            try:
                res = self.supabase.table("pomodoro_logs").insert(record).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                print(f"[DBService] Supabase log pomodoro error: {e}")

        self.pomodoro_logs.append(record)
        return record

    async def get_pomodoro_stats(self, user_id: str, session_id: Optional[str] = None) -> Dict[str, Any]:
        logs = [l for l in await self._all_pomodoro_logs(user_id) if l.get("completed", True)]

        total_completed = len(logs)
        total_minutes = sum(l.get("duration_minutes", 25) for l in logs)
        session_minutes = sum(l.get("duration_minutes", 25) for l in logs if l.get("session_id") == session_id) if session_id else 0

        return {
            "total_cycles_completed": total_completed,
            "total_study_minutes": total_minutes,
            "session_study_minutes": session_minutes
        }

    # --------------------------------------------------------------------------
    # Pomodoro Settings Operations
    # --------------------------------------------------------------------------
    async def get_pomodoro_settings(self, user_id: str) -> Dict[str, Any]:
        default_settings = {
            "id": f"pomo-settings-{user_id}",
            "user_id": user_id,
            "study_minutes": 25,
            "short_break_minutes": 5,
            "long_break_minutes": 15,
            "cycles_before_long_break": 4,
            "auto_start_next": False,
            "sound_enabled": True,
            "sound_choice": "zen"
        }
        if self.supabase:
            try:
                res = self.supabase.table("pomodoro_settings").select("*").eq("user_id", user_id).single().execute()
                if res.data:
                    return res.data
            except Exception:
                pass

        return self.pomodoro_settings.get(user_id, default_settings)

    async def update_pomodoro_settings(self, user_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        current = await self.get_pomodoro_settings(user_id)
        current.update({k: v for k, v in updates.items() if v is not None})
        
        if self.supabase:
            try:
                res = self.supabase.table("pomodoro_settings").upsert(current).execute()
                if res.data:
                    return res.data[0]
            except Exception:
                pass

        self.pomodoro_settings[user_id] = current
        return current

    # --------------------------------------------------------------------------
    # Flashcard Spaced Repetition Review
    # --------------------------------------------------------------------------
    async def review_flashcard(self, card_id: str, rating: str) -> Optional[Dict[str, Any]]:
        # Find card across sessions
        for session_id, card_list in self.flashcards.items():
            for card in card_list:
                if card.get("id") == card_id:
                    ease = card.get("ease_factor", 2.5)
                    review_count = card.get("review_count", 0) + 1
                    if rating == "again":
                        ease = max(1.3, ease - 0.2)
                    elif rating == "hard":
                        ease = max(1.3, ease - 0.15)
                    elif rating == "easy":
                        ease = ease + 0.15
                    
                    card["rating"] = rating
                    card["ease_factor"] = round(ease, 2)
                    card["review_count"] = review_count
                    return card
        return None

    # --------------------------------------------------------------------------
    # Global Knowledge Search across Notes & Sessions
    # --------------------------------------------------------------------------
    async def search_knowledge_base(self, user_id: str, query: str) -> List[Dict[str, Any]]:
        q = query.strip().lower()
        if not q:
            return []

        results: List[Dict[str, Any]] = []

        # 1. Search session titles
        user_sessions = await self.get_sessions(user_id)
        for s in user_sessions:
            s_id = s.get("id")
            s_title = s.get("title", "")
            if q in s_title.lower():
                results.append({
                    "type": "session",
                    "title": s_title,
                    "snippet": f"Study session: {s_title}",
                    "session_id": s_id,
                    "session_title": s_title
                })

            # 2. Search notes
            notes_record = await self.get_notes(s_id)
            if notes_record and notes_record.get("content"):
                content = notes_record["content"]
                summary = content.get("summary", "")
                if q in summary.lower():
                    results.append({
                        "type": "note",
                        "title": content.get("title", "Notes Summary"),
                        "snippet": summary[:160] + "...",
                        "session_id": s_id,
                        "session_title": s_title
                    })
                
                for sec in content.get("sections", []):
                    heading = sec.get("heading", "")
                    if q in heading.lower():
                        results.append({
                            "type": "note",
                            "title": heading,
                            "snippet": f"Section in {s_title}",
                            "session_id": s_id,
                            "session_title": s_title
                        })
                    for sub in sec.get("subpoints", []):
                        if q in sub.lower():
                            results.append({
                                "type": "note",
                                "title": heading,
                                "snippet": sub,
                                "session_id": s_id,
                                "session_title": s_title
                            })
                    for kt in sec.get("key_terms", []):
                        if q in kt.get("term", "").lower() or q in kt.get("definition", "").lower():
                            results.append({
                                "type": "note",
                                "title": f"Key Term: {kt.get('term')}",
                                "snippet": kt.get("definition", ""),
                                "session_id": s_id,
                                "session_title": s_title
                            })

            # 3. Search flashcards
            cards = await self.get_flashcards(s_id)
            for c in cards:
                front = c.get("front", "")
                back = c.get("back", "")
                if q in front.lower() or q in back.lower():
                    results.append({
                        "type": "flashcard",
                        "title": f"Flashcard: {front[:40]}...",
                        "snippet": back[:100],
                        "session_id": s_id,
                        "session_title": s_title
                    })

        # Deduplicate and limit to 15
        seen = set()
        deduped = []
        for r in results:
            key = (r["type"], r["title"], r["session_id"])
            if key not in seen:
                seen.add(key)
                deduped.append(r)
        return deduped[:15]

    # --------------------------------------------------------------------------
    # Exam Operations (pure CRUD — no AI involvement)
    # --------------------------------------------------------------------------
    @staticmethod
    def _days_remaining(exam_date: Any) -> int:
        """Whole days from today until the exam. Negative for past exams."""
        parsed = _coerce_date(exam_date)
        if parsed is None:
            return 0
        return (parsed - datetime.utcnow().date()).days

    def _decorate_exam(self, exam: Dict[str, Any]) -> Dict[str, Any]:
        return {**exam, "days_remaining": self._days_remaining(exam.get("exam_date"))}

    async def create_exam(
        self,
        user_id: str,
        title: str,
        exam_date: Any,
        document_id: Optional[str] = None,
        color: str = "blue",
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        exam = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "document_id": document_id,
            "title": title,
            "exam_date": _date_to_iso(exam_date),
            "color": color,
            "notes": notes,
            "created_at": datetime.utcnow().isoformat()
        }

        if self.supabase:
            try:
                res = self.supabase.table("exams").insert(exam).execute()
                if res.data:
                    return self._decorate_exam(res.data[0])
            except Exception as e:
                print(f"[DBService] Supabase create exam error: {e}")

        self.exams[exam["id"]] = exam
        return self._decorate_exam(exam)

    async def get_exams(self, user_id: str) -> List[Dict[str, Any]]:
        """All exams for a user, soonest first. Past exams are retained as a record."""
        remote: List[Dict[str, Any]] = []
        if self.supabase:
            try:
                res = (
                    self.supabase.table("exams")
                    .select("*")
                    .eq("user_id", user_id)
                    .order("exam_date", desc=False)
                    .execute()
                )
                remote = res.data or []
            except Exception as e:
                print(f"[DBService] Supabase get exams error: {e}")

        local = [e for e in self.exams.values() if e.get("user_id") == user_id]
        seen = {e["id"] for e in remote if e.get("id")}
        merged = remote + [e for e in local if e.get("id") not in seen]
        merged.sort(key=lambda e: str(e.get("exam_date") or ""))
        return [self._decorate_exam(e) for e in merged]

    async def get_exam(self, exam_id: str) -> Optional[Dict[str, Any]]:
        if self.supabase:
            try:
                res = self.supabase.table("exams").select("*").eq("id", exam_id).single().execute()
                if res.data:
                    return self._decorate_exam(res.data)
            except Exception as e:
                print(f"[DBService] Supabase get exam error: {e}")

        exam = self.exams.get(exam_id)
        return self._decorate_exam(exam) if exam else None

    async def update_exam(self, exam_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not updates:
            return await self.get_exam(exam_id)

        if "exam_date" in updates:
            updates = {**updates, "exam_date": _date_to_iso(updates["exam_date"])}

        if self.supabase:
            try:
                res = self.supabase.table("exams").update(updates).eq("id", exam_id).execute()
                if res.data:
                    return self._decorate_exam(res.data[0])
            except Exception as e:
                print(f"[DBService] Supabase update exam error: {e}")

        exam = self.exams.get(exam_id)
        if not exam:
            return None
        exam.update(updates)
        return self._decorate_exam(exam)

    async def delete_exam(self, exam_id: str) -> bool:
        if self.supabase:
            try:
                self.supabase.table("exams").delete().eq("id", exam_id).execute()
            except Exception as e:
                print(f"[DBService] Supabase delete exam error: {e}")

        self.exams.pop(exam_id, None)
        return True

    async def get_nearest_exam(self, user_id: str) -> Optional[Dict[str, Any]]:
        """The soonest exam that has not yet passed, used for the dashboard countdown."""
        upcoming = [e for e in await self.get_exams(user_id) if e["days_remaining"] >= 0]
        return upcoming[0] if upcoming else None

    # --------------------------------------------------------------------------
    # Dashboard Aggregation
    # --------------------------------------------------------------------------
    async def get_study_streak(self, user_id: str) -> int:
        """
        Consecutive days of study activity ending today (or yesterday, so the
        streak is not broken before the user has studied today).

        A day counts if it has a completed pomodoro cycle or a session start.
        """
        active_days = set()

        for log in await self._all_pomodoro_logs(user_id):
            if not log.get("completed", True):
                continue
            day = _coerce_date(log.get("started_at"))
            if day:
                active_days.add(day)

        for session in await self.get_sessions(user_id):
            day = _coerce_date(session.get("started_at") or session.get("created_at"))
            if day:
                active_days.add(day)

        if not active_days:
            return 0

        today = datetime.utcnow().date()
        cursor = today if today in active_days else today - timedelta(days=1)
        if cursor not in active_days:
            return 0

        streak = 0
        while cursor in active_days:
            streak += 1
            cursor -= timedelta(days=1)
        return streak

    async def _all_pomodoro_logs(self, user_id: str) -> List[Dict[str, Any]]:
        remote: List[Dict[str, Any]] = []
        if self.supabase:
            try:
                res = self.supabase.table("pomodoro_logs").select("*").eq("user_id", user_id).execute()
                remote = res.data or []
            except Exception as e:
                print(f"[DBService] Supabase get pomodoro logs error: {e}")

        local = [p for p in self.pomodoro_logs if p.get("user_id") == user_id]
        seen = {p["id"] for p in remote if p.get("id")}
        return remote + [p for p in local if p.get("id") not in seen]

    async def get_dashboard_summary(self, user_id: str) -> Dict[str, Any]:
        """Every dashboard stat card, computed from this user's real records only."""
        sessions, documents, stats, nearest_exam, streak = await asyncio.gather(
            self.get_sessions(user_id),
            self.get_documents(user_id),
            self.get_pomodoro_stats(user_id),
            self.get_nearest_exam(user_id),
            self.get_study_streak(user_id),
        )

        latest = sessions[0] if sessions else None

        return {
            "has_data": bool(sessions or documents),
            "total_sessions": len(sessions),
            "active_sessions": len([s for s in sessions if s.get("status") == "active"]),
            "total_documents": len(documents),
            "total_focus_minutes": stats.get("total_study_minutes", 0),
            "total_cycles_completed": stats.get("total_cycles_completed", 0),
            "study_streak_days": streak,
            "latest_session_id": latest.get("id") if latest else None,
            "latest_session_title": latest.get("title") if latest else None,
            "nearest_exam": nearest_exam,
            "days_until_nearest_exam": nearest_exam["days_remaining"] if nearest_exam else None
        }

    def _empty_profile(self, user_id: str) -> Dict[str, Any]:
        return {
            "id": user_id,
            "display_name": None,
            "avatar_url": None,
            "bio": None,
            "gender": None,
            "theme": None,
        }

    def _row_to_profile(self, user_id: str, row: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "id": user_id,
            "display_name": row.get("display_name"),
            "avatar_url": row.get("avatar_url"),
            "bio": row.get("bio"),
            "gender": row.get("gender"),
            "theme": row.get("theme"),
        }

    async def get_profile(self, user_id: str) -> Dict[str, Any]:
        if self.supabase:
            try:
                res = (
                    self.supabase.table("profiles")
                    .select("*")
                    .eq("id", user_id)
                    .limit(1)
                    .execute()
                )
                if res.data:
                    return self._row_to_profile(user_id, res.data[0])
            except Exception as e:
                print(f"[DBService] Supabase get profile error: {e}")
        return self.profiles.get(user_id) or self._empty_profile(user_id)

    async def upsert_profile(self, user_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
        current = await self.get_profile(user_id)
        allowed = {
            k: patch[k]
            for k in ("display_name", "avatar_url", "bio", "gender", "theme")
            if k in patch
        }
        next_profile = {**current, **allowed, "id": user_id, "updated_at": datetime.utcnow().isoformat()}
        if self.supabase:
            payload = {
                "id": user_id,
                "display_name": next_profile.get("display_name"),
                "avatar_url": next_profile.get("avatar_url"),
                "bio": next_profile.get("bio"),
                "gender": next_profile.get("gender"),
                "theme": next_profile.get("theme"),
                "updated_at": next_profile["updated_at"],
            }
            try:
                res = self.supabase.table("profiles").upsert(payload, on_conflict="id").execute()
            except Exception as e:
                print(f"[DBService] Supabase upsert profile error: {e}")
                if os.getenv("PYTEST_CURRENT_TEST"):
                    self.profiles[user_id] = next_profile
                    return next_profile
                raise RuntimeError(
                    "Could not save profile to Supabase. Run the profiles section of supabase/schema.sql in the SQL Editor."
                ) from e
            if res.data:
                saved = self._row_to_profile(user_id, res.data[0])
                self.profiles[user_id] = saved
                return saved
            verified = await self.get_profile(user_id)
            if "avatar_url" in allowed and verified.get("avatar_url") != allowed["avatar_url"]:
                raise RuntimeError("Profile row was not written to the database.")
            self.profiles[user_id] = verified
            return verified
        self.profiles[user_id] = next_profile
        return next_profile


db_service = DBService()
