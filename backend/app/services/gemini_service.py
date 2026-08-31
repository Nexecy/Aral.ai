import json
import re
import asyncio
from typing import Dict, Any, List, AsyncGenerator, Optional
from app.core.config import settings
from app.models.schemas import NoteContent, QuizQuestion

# Try to import Google GenAI / generativeai
try:
    import google.generativeai as genai
    HAS_GOOGLE_GENAI = True
except ImportError:
    HAS_GOOGLE_GENAI = False

class GeminiService:
    def __init__(self):
        self._configured = False
        self._json_model = None
        self._chat_model = None
        self._setup_client()

    def _setup_client(self):
        if HAS_GOOGLE_GENAI and settings.has_gemini_key:
            try:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                self._json_model = genai.GenerativeModel(
                    model_name=settings.GEMINI_MODEL,
                    generation_config={
                        "response_mime_type": "application/json",
                        "max_output_tokens": 4096,
                    },
                )
                self._chat_model = genai.GenerativeModel(model_name=settings.GEMINI_MODEL)
                self._configured = True
            except Exception as e:
                print(f"[GeminiService] Warning: Failed to configure Gemini SDK: {e}")
                self._configured = False
        else:
            self._configured = False

    @staticmethod
    def _compact(data: Any, limit: int) -> str:
        return json.dumps(data, separators=(",", ":"), ensure_ascii=False)[:limit]

    @staticmethod
    def _notes_excerpt(notes_json: Dict[str, Any]) -> Dict[str, Any]:
        sections = []
        for section in (notes_json.get("sections") or [])[:10]:
            sections.append({
                "heading": section.get("heading"),
                "subpoints": (section.get("subpoints") or [])[:6],
                "key_terms": [
                    {"term": term.get("term"), "definition": term.get("definition")}
                    for term in (section.get("key_terms") or [])[:6]
                ],
            })
        return {
            "title": notes_json.get("title"),
            "summary": notes_json.get("summary"),
            "sections": sections,
        }

    async def generate_notes(self, text: str, document_title: str) -> Dict[str, Any]:
        """
        Generate structured notes (title, summary, sections with headings, subpoints, key terms) using Gemini JSON mode.
        """
        prompt = f"""You are an expert educational AI tutor. Analyze the study material from '{document_title}' and generate structured study notes.

Return JSON with this schema:
{{"title":"string","summary":"2-3 sentences","sections":[{{"heading":"string","subpoints":["concise bullet"],"key_terms":[{{"term":"string","definition":"string"}}]}}]}}

Keep sections high-yield (4-8). No preamble.

Source:
{text[:18000]}
"""
        if self._configured and self._json_model:
            try:
                response = await asyncio.to_thread(self._json_model.generate_content, prompt)
                parsed = json.loads(response.text)
                return parsed
            except Exception as e:
                print(f"[GeminiService] Gemini API call failed: {e}. Using fallback generator.")

        # Fallback intelligent generation for demonstration / offline use
        return self._fallback_notes(document_title, text)

    async def generate_flashcards(self, notes_json: Dict[str, Any], count: int = 8) -> List[Dict[str, Any]]:
        """
        Generate flashcard pairs {front, back} from reviewed structured notes.
        """
        notes_str = self._compact(self._notes_excerpt(notes_json), 8000)
        prompt = f"""You are an expert memory tutor. Create {count} high-yield flashcards from these notes.
Each card tests a distinct concept. Return a JSON array of {{"front","back"}} objects. No preamble.

Notes:
{notes_str}
"""
        if self._configured and self._json_model:
            try:
                response = await asyncio.to_thread(self._json_model.generate_content, prompt)
                parsed = json.loads(response.text)
                if isinstance(parsed, dict) and "flashcards" in parsed:
                    parsed = parsed["flashcards"]
                if isinstance(parsed, list):
                    return parsed
            except Exception as e:
                print(f"[GeminiService] Flashcard generation API error: {e}. Using fallback generator.")

        return self._fallback_flashcards(notes_json)

    async def generate_quiz(self, notes_json: Dict[str, Any], quiz_type: str = "multiple_choice", count: int = 5) -> List[Dict[str, Any]]:
        """
        Generate quiz questions matching the selected quiz_type:
        - 'multiple_choice': question, options (4), correct_answer, explanation
        - 'identification': question (prompt/clue), correct_answer, explanation
        - 'matching': matching_pairs [{left, right}], explanation
        """
        notes_str = self._compact(self._notes_excerpt(notes_json), 8000)

        type_instructions = {
            "multiple_choice": """
Format as JSON array:
[
  {
    "id": "q1",
    "type": "multiple_choice",
    "question": "Clear, challenging question testing understanding",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": "Exact text of the correct option",
    "explanation": "Why this answer is correct and others are incorrect"
  }
]
""",
            "identification": """
Format as JSON array:
[
  {
    "id": "q1",
    "type": "identification",
    "question": "Descriptive definition or scenario requiring the exact term/name",
    "correct_answer": "Target Term or Name",
    "explanation": "Context and explanation"
  }
]
""",
            "matching": """
Format as JSON array:
[
  {
    "id": "q1",
    "type": "matching",
    "question": "Match the following concepts with their corresponding definitions/applications",
    "matching_pairs": [
      {"left": "Item 1", "right": "Matching definition 1"},
      {"left": "Item 2", "right": "Matching definition 2"},
      {"left": "Item 3", "right": "Matching definition 3"},
      {"left": "Item 4", "right": "Matching definition 4"}
    ],
    "correct_answer": "All pairs matched",
    "explanation": "Summary of concept connections"
  }
]
"""
        }

        instructions = type_instructions.get(quiz_type, type_instructions["multiple_choice"])
        prompt = f"""You are a senior professor. Create a {quiz_type} quiz with {count} questions from these notes.

{instructions}

Notes:
{notes_str}
"""
        if self._configured and self._json_model:
            try:
                response = await asyncio.to_thread(self._json_model.generate_content, prompt)
                parsed = json.loads(response.text)
                if isinstance(parsed, dict) and "questions" in parsed:
                    parsed = parsed["questions"]
                if isinstance(parsed, list):
                    return parsed
            except Exception as e:
                print(f"[GeminiService] Quiz generation API error: {e}. Using fallback generator.")

        return self._fallback_quiz(notes_json, quiz_type)

    async def stream_chat_response(
        self,
        session_title: str,
        notes_content: Dict[str, Any],
        chat_history: List[Dict[str, str]],
        user_message: str
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat assistant response via Server-Sent Events (SSE).
        Supports detecting commands to modify notes or regenerate sections.
        """
        notes_summary = self._compact(self._notes_excerpt(notes_content), 6000)
        system_context = f"""You are Aral.ai, an encouraging study assistant for '{session_title}'.
Notes: {notes_summary}
Answer clearly. If the student asks to change notes, optionally include a [NOTE_UPDATE] JSON block."""
        if self._configured and self._chat_model:
            try:
                history = []
                for msg in chat_history[-6:]:
                    role = "user" if msg["role"] == "user" else "model"
                    history.append({"role": role, "parts": [msg["content"]]})

                chat = self._chat_model.start_chat(history=history)
                response = await asyncio.to_thread(
                    chat.send_message,
                    f"{system_context}\n\nUser Question: {user_message}",
                    stream=True
                )
                for chunk in response:
                    if chunk.text:
                        yield chunk.text
                        await asyncio.sleep(0)
                return
            except Exception as e:
                print(f"[GeminiService] Chat stream API error: {e}. Falling back to simulated stream.")

        # Fallback simulated streaming response
        response_text = self._generate_fallback_chat_reply(user_message, notes_content)
        words = response_text.split(" ")
        for i in range(0, len(words), 4):
            chunk = " ".join(words[i:i + 4])
            suffix = " " if i + 4 < len(words) else ""
            yield chunk + suffix
            await asyncio.sleep(0)

    # --------------------------------------------------------------------------
    # Fallback / Demo Data Generators
    # --------------------------------------------------------------------------
    def _fallback_notes(self, title: str, text: str) -> Dict[str, Any]:
        # Extract potential lines or keywords from text
        lines = [l.strip() for l in text.split("\n") if l.strip() and not l.startswith("---")]
        preview = " ".join(lines[:6]) if lines else "Core foundational study guide."

        return {
            "title": f"Study Guide: {title.replace('.pdf', '')}",
            "summary": f"A comprehensive review of {title}. Synthesizes foundational principles, key mechanisms, and practical testable takeaways.",
            "sections": [
                {
                    "heading": "1. Core Foundations & Conceptual Framework",
                    "subpoints": [
                        "Primary definitions and underlying mechanisms governing the subject matter.",
                        "Architectural flow and core sequence of operations.",
                        "Critical dependencies and foundational assumptions required for deeper analysis."
                    ],
                    "key_terms": [
                        {"term": "Fundamental Axiom", "definition": "The baseline proposition that serves as the starting point for deductions."},
                        {"term": "Core Paradigm", "definition": "A standard perspective or set of ideas that defines the methodology."}
                    ]
                },
                {
                    "heading": "2. Detailed Mechanisms & Key Processes",
                    "subpoints": [
                        "Step-by-step breakdown of how state changes and data flows occur.",
                        "Error mitigation and handling edge conditions in practical scenarios.",
                        "Performance trade-offs and optimization strategies."
                    ],
                    "key_terms": [
                        {"term": "Throughput Efficiency", "definition": "Measure of successful operations processed per unit of time."},
                        {"term": "Latency Overhead", "definition": "The delay introduced by intermediate processing steps."}
                    ]
                },
                {
                    "heading": "3. Critical Applications & Exam Takeaways",
                    "subpoints": [
                        "Synthesizes theoretical models with real-world examination questions.",
                        "Common pitfalls and distinguishing subtle conceptual differences.",
                        "Summary of formulaic relationships and high-yield mnemonics."
                    ],
                    "key_terms": [
                        {"term": "Active Recall", "definition": "Testing yourself repeatedly to strengthen neural pathways for long-term retention."},
                        {"term": "Spaced Repetition", "definition": "Reviewing material at systematically increasing intervals."}
                    ]
                }
            ]
        }

    def _fallback_flashcards(self, notes: Dict[str, Any]) -> List[Dict[str, Any]]:
        cards = []
        sections = notes.get("sections", [])
        order = 0
        for s in sections:
            for kt in s.get("key_terms", []):
                cards.append({
                    "front": f"What is the definition and significance of '{kt.get('term')}'?",
                    "back": kt.get("definition", "Key concept definition from notes."),
                    "order_index": order
                })
                order += 1
            for sp in s.get("subpoints", []):
                if order < 8:
                    cards.append({
                        "front": f"Explain the core principle: {s.get('heading')}?",
                        "back": sp,
                        "order_index": order
                    })
                    order += 1

        if not cards:
            cards = [
                {"front": "What is the primary objective of Aral.ai?", "back": "To provide a seamless, structured study experience with AI notes, flashcards, quizzes, and live tutoring.", "order_index": 0},
                {"front": "What is Active Recall?", "back": "The principle of actively stimulating memory retrieval during the learning process.", "order_index": 1},
                {"front": "How does spaced repetition enhance retention?", "back": "By interrupting the forgetting curve at optimal intervals.", "order_index": 2}
            ]
        return cards[:10]

    def _fallback_quiz(self, notes: Dict[str, Any], quiz_type: str) -> List[Dict[str, Any]]:
        sections = notes.get("sections", [])
        
        if quiz_type == "multiple_choice":
            return [
                {
                    "id": "q1",
                    "type": "multiple_choice",
                    "question": "Which of the following best describes the primary role of the foundational framework?",
                    "options": [
                        "To serve as the baseline proposition for subsequent deductions and analysis",
                        "To store ephemeral logs without index caching",
                        "To increase network latency intentionally",
                        "To bypass validation checks during execution"
                    ],
                    "correct_answer": "To serve as the baseline proposition for subsequent deductions and analysis",
                    "explanation": "Foundational principles establish the baseline axioms that all downstream models rely upon."
                },
                {
                    "id": "q2",
                    "type": "multiple_choice",
                    "question": "What is the primary benefit of spaced repetition in active learning?",
                    "options": [
                        "It resets memory to zero every 24 hours",
                        "It interrupts the forgetting curve at optimal intervals to consolidate long-term memory",
                        "It replaces the need for comprehension with rote memorization",
                        "It minimizes the need for review sessions"
                    ],
                    "correct_answer": "It interrupts the forgetting curve at optimal intervals to consolidate long-term memory",
                    "explanation": "Spaced repetition strategically spaces out review sessions right before memory decay occurs."
                },
                {
                    "id": "q3",
                    "type": "multiple_choice",
                    "question": "How is throughput efficiency formally evaluated in this context?",
                    "options": [
                        "By counting total lines of unused configuration",
                        "Measure of successful operations processed per unit of time",
                        "The time spent waiting on offline backups",
                        "Random sampling without metric verification"
                    ],
                    "correct_answer": "Measure of successful operations processed per unit of time",
                    "explanation": "Throughput reflects capacity and execution rate of valid operations over time."
                }
            ]
        elif quiz_type == "identification":
            return [
                {
                    "id": "q1",
                    "type": "identification",
                    "question": "The cognitive learning technique that involves actively stimulating memory recall rather than passive reading is known as:",
                    "correct_answer": "Active Recall",
                    "explanation": "Active recall requires students to retrieve information from memory, creating stronger neural connections."
                },
                {
                    "id": "q2",
                    "type": "identification",
                    "question": "The metric defined as the delay introduced by intermediate processing steps is called:",
                    "correct_answer": "Latency Overhead",
                    "explanation": "Latency overhead quantifies the elapsed lag during request processing."
                }
            ]
        elif quiz_type == "matching":
            return [
                {
                    "id": "q1",
                    "type": "matching",
                    "question": "Match each core concept on the left with its defining property on the right:",
                    "matching_pairs": [
                        {"left": "Active Recall", "right": "Testing retrieval from memory"},
                        {"left": "Spaced Repetition", "right": "Systematic review intervals"},
                        {"left": "Throughput", "right": "Operations processed per second"},
                        {"left": "Axiom", "right": "Self-evident baseline proposition"}
                    ],
                    "correct_answer": "All pairs matched",
                    "explanation": "Each concept aligns directly with its formal definition and primary educational function."
                }
            ]
        return []

    def _generate_fallback_chat_reply(self, message: str, notes: Dict[str, Any]) -> str:
        msg_lower = message.lower()
        title = notes.get("title", "Study Material")
        
        if "summary" in msg_lower or "explain" in msg_lower or "what is" in msg_lower:
            return f"Great question! Based on **{title}**, here is a clear breakdown:\n\n1. **Core Concept**: The material focuses on establishing strong foundational axioms and systematic active learning.\n2. **Key Application**: When preparing for exams, focus on active recall over passive reading.\n3. **Practical Tip**: Use the Flashcard deck to test your retention on key terms!"
        
        if "quiz" in msg_lower or "test" in msg_lower:
            return f"You can test your mastery right now by clicking the **Quiz Arena** tab above! We offer **Multiple Choice**, **Identification**, and **Matching** formats generated directly from your reviewed notes."
        
        if "add" in msg_lower or "edit" in msg_lower or "update" in msg_lower:
            return f"You can edit any section directly in the **Notes Review** editor on the left! If you'd like, I can help you draft new bullet points or definitions to paste in."
        
        return f"I'm here to help you study **{title}**! You can ask me to clarify difficult concepts, generate custom mnemonics, explain formulas, or summarize any section."

gemini_service = GeminiService()
