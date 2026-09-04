import json
import re
import asyncio
import random
from typing import Dict, Any, List, AsyncGenerator, Optional, Tuple
from app.core.config import settings
from app.models.schemas import NoteContent, QuizQuestion

# Try to import Google GenAI / generativeai
try:
    import google.generativeai as genai
    HAS_GOOGLE_GENAI = True
except ImportError:
    HAS_GOOGLE_GENAI = False


class GeminiService:
    # Priority order of candidate models for fast and resilient generation
    CANDIDATE_MODELS = [
        "gemini-flash-latest",
        "gemini-3.1-flash-lite",
        "gemini-3.7-flash",
    ]

    def __init__(self):
        self._configured = False
        self._setup_client()

    def _setup_client(self):
        if HAS_GOOGLE_GENAI and settings.has_gemini_key:
            try:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                self._configured = True
            except Exception as e:
                print(f"[GeminiService] Warning: Failed to configure Gemini SDK: {e}")
                self._configured = False
        else:
            self._configured = False

    def _get_candidate_models(self) -> List[str]:
        models = []
        if settings.GEMINI_MODEL:
            models.append(settings.GEMINI_MODEL.strip())
        for m in self.CANDIDATE_MODELS:
            if m not in models:
                models.append(m)
        return models

    @staticmethod
    def _parse_json_safely(raw_text: str) -> Optional[Any]:
        """
        Safely extracts and parses JSON even when enclosed in markdown code fences or conversational text.
        """
        if not raw_text or not isinstance(raw_text, str):
            return None

        cleaned = raw_text.strip()

        # 1. Strip markdown fences
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()

        # 2. Try direct parse
        try:
            return json.loads(cleaned)
        except Exception:
            pass

        # 3. Search for JSON object {...} or array [...] boundaries
        first_brace = cleaned.find("{")
        first_bracket = cleaned.find("[")

        if first_brace != -1 and (first_bracket == -1 or first_brace < first_bracket):
            last_brace = cleaned.rfind("}")
            if last_brace > first_brace:
                try:
                    return json.loads(cleaned[first_brace:last_brace + 1])
                except Exception:
                    pass
        elif first_bracket != -1:
            last_bracket = cleaned.rfind("]")
            if last_bracket > first_bracket:
                try:
                    return json.loads(cleaned[first_bracket:last_bracket + 1])
                except Exception:
                    pass

        return None

    @staticmethod
    def _compact(data: Any, limit: int) -> str:
        return json.dumps(data, separators=(",", ":"), ensure_ascii=False)[:limit]

    @staticmethod
    def _notes_excerpt(notes_json: Dict[str, Any]) -> Dict[str, Any]:
        sections = []
        for section in (notes_json.get("sections") or [])[:12]:
            sections.append({
                "heading": section.get("heading"),
                "subpoints": (section.get("subpoints") or [])[:8],
                "key_terms": [
                    {"term": term.get("term"), "definition": term.get("definition")}
                    for term in (section.get("key_terms") or [])[:8]
                    if isinstance(term, dict) and term.get("term")
                ],
            })
        return {
            "title": notes_json.get("title"),
            "summary": notes_json.get("summary"),
            "sections": sections,
        }

    async def _try_generate_json(self, prompt: str) -> Optional[Any]:
        """
        Tries calling Gemini with JSON mode across candidate models in priority order.
        """
        if not self._configured or not HAS_GOOGLE_GENAI:
            return None

        models = self._get_candidate_models()
        last_error = None

        for model_name in models:
            try:
                model = genai.GenerativeModel(
                    model_name=model_name,
                    generation_config={
                        "response_mime_type": "application/json",
                        "max_output_tokens": 4096,
                    }
                )
                response = await asyncio.to_thread(
                    model.generate_content,
                    prompt,
                    request_options={"timeout": 6}
                )
                if response and response.text:
                    parsed = self._parse_json_safely(response.text)
                    if parsed is not None:
                        return parsed
            except Exception as e:
                last_error = e
                # Continue trying next candidate model on 404, 429, timeout, or parsing error
                continue

        if last_error:
            print(f"[GeminiService] All Gemini models attempted. Last error: {last_error}")
        return None

    async def generate_notes(self, text: str, document_title: str) -> Dict[str, Any]:
        """
        Generate structured notes (title, summary, sections with headings, subpoints, key terms)
        using Gemini JSON mode, falling back to dynamic document text extraction.
        """
        clean_title = document_title.replace(".pdf", "").replace(".docx", "").replace(".txt", "").strip()
        
        prompt = f"""You are an expert educational AI tutor. Analyze the following study material from '{document_title}' and generate comprehensive, structured study notes based strictly on the text.

Return JSON with this schema:
{{
  "title": "Study Notes: {clean_title}",
  "summary": "2-3 clear sentences summarizing the core concepts and key takeaways from the text",
  "sections": [
    {{
      "heading": "Clear Section Heading",
      "subpoints": [
        "Concise, high-yield bullet point explaining a key principle or mechanism",
        "Another informative bullet point from the material"
      ],
      "key_terms": [
        {{
          "term": "Exact Concept / Term",
          "definition": "Precise, clear definition directly from the context"
        }}
      ]
    }}
  ]
}}

Requirements:
1. Extract 3 to 8 high-yield sections covering all main topics in the material.
2. Every section must have 2 to 6 informative subpoints and 1 to 4 key terms with clear definitions.
3. Base everything strictly on the provided source content. Return valid JSON only with no preamble.

Source Material:
{text[:25000]}
"""
        parsed = await self._try_generate_json(prompt)
        if parsed and isinstance(parsed, dict) and "sections" in parsed and len(parsed["sections"]) > 0:
            if not parsed.get("title"):
                parsed["title"] = f"Study Guide: {clean_title}"
            return parsed

        # Dynamic fallback parser extracting real concepts from PDF text
        return self._fallback_notes(document_title, text)

    async def generate_flashcards(self, notes_json: Dict[str, Any], count: int = 8) -> List[Dict[str, Any]]:
        """
        Generate flashcard pairs {front, back} from reviewed structured notes.
        """
        notes_str = self._compact(self._notes_excerpt(notes_json), 10000)
        prompt = f"""You are an expert memory tutor. Create {count} high-yield flashcards from these reviewed notes.
Each card must test a distinct concept, key term, mechanism, or principle from the notes.
Return a JSON array of objects with keys "front" and "back":
[
  {{"front": "Question testing a specific concept or definition?", "back": "Clear, concise answer"}},
  ...
]

Return valid JSON only. No preamble or markdown wrapper.

Notes:
{notes_str}
"""
        parsed = await self._try_generate_json(prompt)
        if parsed:
            if isinstance(parsed, dict) and "flashcards" in parsed:
                parsed = parsed["flashcards"]
            elif isinstance(parsed, dict) and "cards" in parsed:
                parsed = parsed["cards"]

            if isinstance(parsed, list) and len(parsed) > 0:
                # Add order_index and ensure structure
                cards = []
                for i, item in enumerate(parsed):
                    if isinstance(item, dict) and "front" in item and "back" in item:
                        cards.append({
                            "front": str(item["front"]),
                            "back": str(item["back"]),
                            "order_index": i
                        })
                if cards:
                    return cards

        return self._fallback_flashcards(notes_json, count=count)

    async def generate_quiz(self, notes_json: Dict[str, Any], quiz_type: str = "multiple_choice", count: int = 5) -> List[Dict[str, Any]]:
        """
        Generate quiz questions matching the selected quiz_type:
        - 'multiple_choice': question, options (4), correct_answer, explanation
        - 'identification': question (prompt/clue), correct_answer, explanation
        - 'matching': matching_pairs [{left, right}], explanation
        """
        notes_str = self._compact(self._notes_excerpt(notes_json), 10000)

        type_instructions = {
            "multiple_choice": """
Format as a JSON array of objects:
[
  {
    "id": "q1",
    "type": "multiple_choice",
    "question": "Challenging question testing understanding of a key concept from the notes",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": "Exact text of the correct option matching one of the options",
    "explanation": "Clear explanation of why this answer is correct based on the notes"
  }
]
""",
            "identification": """
Format as a JSON array of objects:
[
  {
    "id": "q1",
    "type": "identification",
    "question": "Descriptive clue, definition, or function requiring the exact term/name",
    "correct_answer": "Target Term or Concept Name",
    "explanation": "Detailed context and explanation of the term from the notes"
  }
]
""",
            "matching": """
Format as a JSON array of objects:
[
  {
    "id": "q1",
    "type": "matching",
    "question": "Match the following concepts from the study notes with their corresponding definitions or roles:",
    "matching_pairs": [
      {"left": "Concept 1", "right": "Matching Definition or Application 1"},
      {"left": "Concept 2", "right": "Matching Definition or Application 2"},
      {"left": "Concept 3", "right": "Matching Definition or Application 3"},
      {"left": "Concept 4", "right": "Matching Definition or Application 4"}
    ],
    "correct_answer": "All pairs matched",
    "explanation": "Summary of conceptual connections and relationships"
  }
]
"""
        }

        instructions = type_instructions.get(quiz_type, type_instructions["multiple_choice"])
        prompt = f"""You are a senior academic tutor. Create a high-quality {quiz_type} quiz with {count} questions derived strictly from these reviewed notes.

{instructions}

Requirements:
1. Base all questions strictly on facts, terms, and principles in the notes.
2. For multiple choice, ensure exactly 4 options per question with 1 unambiguous correct answer and 3 plausible distractors.
3. Return valid JSON only.

Notes:
{notes_str}
"""
        parsed = await self._try_generate_json(prompt)
        if parsed:
            if isinstance(parsed, dict) and "questions" in parsed:
                parsed = parsed["questions"]
            if isinstance(parsed, list) and len(parsed) > 0:
                validated = []
                for i, q in enumerate(parsed):
                    if isinstance(q, dict) and "question" in q:
                        q_obj = {
                            "id": q.get("id") or f"q{i + 1}",
                            "type": quiz_type,
                            "question": q["question"],
                            "explanation": q.get("explanation", "Derived from reviewed notes.")
                        }
                        if quiz_type == "multiple_choice":
                            options = q.get("options") or []
                            correct = q.get("correct_answer") or (options[0] if options else "Option A")
                            if correct not in options and options:
                                options[0] = correct
                            while len(options) < 4:
                                options.append(f"Alternative {len(options) + 1}")
                            q_obj["options"] = options[:4]
                            q_obj["correct_answer"] = correct
                        elif quiz_type == "identification":
                            q_obj["correct_answer"] = q.get("correct_answer", "Target Term")
                        elif quiz_type == "matching":
                            pairs = q.get("matching_pairs") or []
                            clean_pairs = []
                            for p in pairs:
                                if isinstance(p, dict) and "left" in p and "right" in p:
                                    clean_pairs.append({"left": str(p["left"]), "right": str(p["right"])})
                            q_obj["matching_pairs"] = clean_pairs or [
                                {"left": "Concept A", "right": "Definition A"},
                                {"left": "Concept B", "right": "Definition B"}
                            ]
                            q_obj["correct_answer"] = "All pairs matched"

                        validated.append(q_obj)
                if validated:
                    return validated

        return self._fallback_quiz(notes_json, quiz_type, count=count)

    async def stream_chat_response(
        self,
        session_title: str,
        notes_content: Dict[str, Any],
        chat_history: List[Dict[str, str]],
        user_message: str
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat assistant response via Server-Sent Events (SSE).
        Uses resilient model cascading and falls back to context-grounded simulated streaming.
        """
        notes_summary = self._compact(self._notes_excerpt(notes_content), 8000)
        system_context = f"""You are Aral.ai, an encouraging, knowledgeable study assistant for '{session_title}'.
Notes Reference: {notes_summary}
Answer clearly in Markdown with rich formatting. Use bolding and bullet points.
Write formulas in plain text or Unicode (e.g. 1.01^365 = 37.78, Cue -> Craving). Never wrap math in $...$ or use LaTeX commands.
If the student asks to change or add notes, you may include a [NOTE_UPDATE] JSON block at the end."""

        if self._configured and HAS_GOOGLE_GENAI:
            models = self._get_candidate_models()
            for model_name in models:
                try:
                    chat_model = genai.GenerativeModel(model_name=model_name)
                    history = []
                    for msg in chat_history[-6:]:
                        role = "user" if msg["role"] == "user" else "model"
                        history.append({"role": role, "parts": [msg["content"]]})

                    chat = chat_model.start_chat(history=history)
                    response = await asyncio.to_thread(
                        chat.send_message,
                        f"{system_context}\n\nStudent Question: {user_message}",
                        stream=True,
                        request_options={"timeout": 6}
                    )
                    for chunk in response:
                        if chunk.text:
                            yield chunk.text
                            await asyncio.sleep(0)
                    return
                except Exception as e:
                    print(f"[GeminiService] Chat model {model_name} failed: {e}. Trying next.")
                    continue

        # Grounded contextual fallback streaming
        response_text = self._generate_fallback_chat_reply(user_message, notes_content)
        words = response_text.split(" ")
        for i in range(0, len(words), 4):
            chunk = " ".join(words[i:i + 4])
            suffix = " " if i + 4 < len(words) else ""
            yield chunk + suffix
            await asyncio.sleep(0.02)

    # --------------------------------------------------------------------------
    # Dynamic Document Intelligence & Heuristic Extraction (NO HARDCODED MOCKS)
    # --------------------------------------------------------------------------
    def _extract_document_insights(self, text: str, title: str) -> Dict[str, Any]:
        """
        Heuristic extraction engine that extracts real sections, headings, definitions,
        and key terms directly from the raw PDF/document text.
        """
        clean_title = title.replace(".pdf", "").replace(".docx", "").replace(".txt", "").replace("_", " ").strip()
        
        # Clean page markers and normalize lines
        raw_lines = [l.strip() for l in text.split("\n")]
        filtered_lines = []
        for line in raw_lines:
            if not line:
                continue
            # Skip page headers/footers like --- [Page 1] ---
            if re.match(r"^---\s*\[Page\s*\d+\]\s*---$", line, re.IGNORECASE):
                continue
            filtered_lines.append(line)

        # 1. Identify Headings & Paragraph Clusters
        sections_data: List[Dict[str, Any]] = []
        current_heading = f"1. Overview & Fundamentals of {clean_title}"
        current_bullets: List[str] = []
        current_terms: List[Dict[str, str]] = []
        seen_terms = set()

        def commit_section():
            nonlocal current_heading, current_bullets, current_terms
            if current_bullets or current_terms:
                sections_data.append({
                    "heading": current_heading,
                    "subpoints": current_bullets[:6] if current_bullets else [f"Core insights regarding {current_heading}."],
                    "key_terms": current_terms[:6]
                })
            current_bullets = []
            current_terms = []

        # Patterns for key terms: "Term: Definition", "Term - Definition", or "Term is defined as Definition"
        term_pattern_colon = re.compile(r"^([A-Z0-9][A-Za-z0-9\s\-\(\)\/\']{1,50})\s*:\s*(.{12,350})$")
        term_pattern_dash = re.compile(r"^([A-Z0-9][A-Za-z0-9\s\-\(\)\/\']{1,50})\s+[–—\-]\s+(.{12,350})$")
        term_pattern_phrase = re.compile(r"\b([A-Z][A-Za-z0-9\s\-\(\)]{2,40})\s+(?:is defined as|refers to|is the process of|means|represents)\s+(.{15,250})", re.IGNORECASE)

        buffer_text = []
        for line in filtered_lines:
            # Check if line is a chapter or major section marker first
            is_chapter_marker = bool(re.match(r"^(?:Chapter|Section|Part|Module|Unit)\s+\d+", line, re.IGNORECASE))
            if is_chapter_marker:
                commit_section()
                clean_h = line.strip()
                current_heading = clean_h if re.match(r"^\d+", clean_h) else f"{len(sections_data) + 1}. {clean_h}"
                buffer_text = []
                continue

            # Check for Key Term definition in line
            m_term = term_pattern_colon.match(line) or term_pattern_dash.match(line)
            if m_term:
                term_word = m_term.group(1).strip()
                term_def = m_term.group(2).strip()
                if len(term_word) < 55 and term_word.lower() not in seen_terms:
                    seen_terms.add(term_word.lower())
                    current_terms.append({"term": term_word, "definition": term_def})
                    current_bullets.append(f"{term_word}: {term_def}")
                    continue

            m_term2 = term_pattern_phrase.search(line)
            if m_term2:
                term_word = m_term2.group(1).strip()
                term_def = m_term2.group(2).strip()
                if len(term_word) < 55 and term_word.lower() not in seen_terms:
                    seen_terms.add(term_word.lower())
                    current_terms.append({"term": term_word, "definition": term_def})

            # Check if line looks like a distinct section heading
            is_explicit_header = line.startswith("#") or bool(re.match(r"^(?:\d+[\.\)]|[A-Z]\.)\s+[A-Z]", line))
            is_short_title = (
                len(line) <= 50 
                and line.istitle() 
                and not line.endswith(".") 
                and len(buffer_text) >= 3
            )

            if (is_explicit_header or is_short_title) and (current_bullets or current_terms):
                commit_section()
                clean_h = re.sub(r"^#+\s*", "", line).strip()
                current_heading = f"{len(sections_data) + 1}. {clean_h}"
                buffer_text = []
                continue

            # Accumulate sentence / bullet points
            sentences = re.split(r"(?<=[.!?])\s+", line)
            for s in sentences:
                s_clean = s.strip()
                if len(s_clean) >= 25:
                    if len(current_bullets) < 6:
                        current_bullets.append(s_clean)
                    buffer_text.append(s_clean)

            # Auto-split into a new section if accumulated enough content
            if len(current_bullets) >= 5:
                commit_section()
                current_heading = f"{len(sections_data) + 1}. Key Principles & Mechanisms"

        commit_section()

        # Fallback if no sections were parsed (e.g. short document)
        if not sections_data:
            sample_sentences = [l for l in filtered_lines if len(l) > 20]
            if not sample_sentences:
                sample_sentences = [f"Study notes and primary material for {clean_title}."]
            
            sections_data = [
                {
                    "heading": f"1. Core Concepts of {clean_title}",
                    "subpoints": sample_sentences[:5],
                    "key_terms": [
                        {"term": clean_title, "definition": f"Primary subject topic and material from {title}."}
                    ]
                }
            ]

        # Ensure every section has at least 1 key term
        for i, s in enumerate(sections_data):
            if not s["key_terms"]:
                first_bullet = s["subpoints"][0] if s["subpoints"] else clean_title
                # Pick first 2-3 words as term
                words = first_bullet.split()
                term_name = " ".join(words[:3]).strip(",:;.")
                if not term_name:
                    term_name = f"Concept {i + 1}"
                s["key_terms"].append({
                    "term": term_name,
                    "definition": first_bullet
                })

        # Synthesize summary from first section
        first_subpoints = sections_data[0]["subpoints"]
        summary_text = " ".join(first_subpoints[:2]) if first_subpoints else f"Comprehensive review and study guide for {clean_title}."
        if not summary_text.endswith("."):
            summary_text += "."
        summary_text += f" Synthesizes {len(sections_data)} major sections and {sum(len(s['key_terms']) for s in sections_data)} key definitions."

        return {
            "title": f"Study Notes: {clean_title}",
            "summary": summary_text,
            "sections": sections_data
        }

    def _fallback_notes(self, title: str, text: str) -> Dict[str, Any]:
        """
        Dynamically extracts notes strictly from the uploaded document text.
        """
        return self._extract_document_insights(text, title)

    def _fallback_flashcards(self, notes: Dict[str, Any], count: int = 8) -> List[Dict[str, Any]]:
        """
        Dynamically builds flashcard pairs from the actual key terms and subpoints in notes.
        """
        cards: List[Dict[str, Any]] = []
        sections = notes.get("sections", [])
        order = 0

        # 1. Primary source: Key Terms & Definitions from actual notes
        for s in sections:
            heading = s.get("heading", "Key Concept")
            for kt in s.get("key_terms", []):
                term = kt.get("term")
                definition = kt.get("definition")
                if term and definition:
                    cards.append({
                        "front": f"What is '{term}' according to the study material?",
                        "back": definition,
                        "order_index": order
                    })
                    order += 1

        # 2. Secondary source: Core Subpoints
        for s in sections:
            heading = s.get("heading", "Study Topic")
            clean_heading = re.sub(r"^\d+[\.\)]\s*", "", heading)
            for sp in s.get("subpoints", []):
                if order >= count * 2:
                    break
                if len(sp) > 20:
                    cards.append({
                        "front": f"In '{clean_heading}', what is a critical takeaway?",
                        "back": sp,
                        "order_index": order
                    })
                    order += 1

        # 3. Fallback if empty notes
        if not cards:
            title = notes.get("title", "Study Material")
            summary = notes.get("summary", "Key concepts and review guide.")
            cards = [
                {
                    "front": f"What is the main focus of '{title}'?",
                    "back": summary,
                    "order_index": 0
                }
            ]

        return cards[:count]

    def _fallback_quiz(self, notes: Dict[str, Any], quiz_type: str, count: int = 5) -> List[Dict[str, Any]]:
        """
        Dynamically generates quiz questions from the actual terms, definitions,
        and subpoints in notes with distractors generated from the same document.
        """
        sections = notes.get("sections", [])
        
        # Collect all real terms and definitions from the notes
        all_terms_defs: List[Tuple[str, str, str]] = [] # (term, definition, heading)
        all_subpoints: List[Tuple[str, str]] = [] # (subpoint, heading)

        for s in sections:
            heading = s.get("heading", "Core Topic")
            for kt in s.get("key_terms", []):
                if kt.get("term") and kt.get("definition"):
                    all_terms_defs.append((kt["term"], kt["definition"], heading))
            for sp in s.get("subpoints", []):
                if len(sp) > 15:
                    all_subpoints.append((sp, heading))

        if not all_terms_defs:
            title = notes.get("title", "Study Guide")
            all_terms_defs.append((title, notes.get("summary", "Core concept review."), "Overview"))

        # MULTIPLE CHOICE
        if quiz_type == "multiple_choice":
            questions = []
            available_defs = [td[1] for td in all_terms_defs] + [sp[0] for sp in all_subpoints]

            for i, (term, definition, heading) in enumerate(all_terms_defs[:count]):
                clean_heading = re.sub(r"^\d+[\.\)]\s*", "", heading)
                
                # Pick 3 unique distractors from other definitions/subpoints in the document
                other_defs = [d for d in available_defs if d != definition]
                random.seed(i * 17)
                if len(other_defs) >= 3:
                    distractors = random.sample(other_defs, 3)
                else:
                    distractors = other_defs + [
                        f"A non-essential auxiliary process unrelated to {term}",
                        f"An outdated theoretical framework superseded by {clean_heading}",
                        "An inverse inverse operation with negative feedback loop"
                    ][:3 - len(other_defs)]

                options = [definition] + distractors
                random.shuffle(options)

                questions.append({
                    "id": f"q{i + 1}",
                    "type": "multiple_choice",
                    "question": f"Which of the following best defines or describes '{term}'?",
                    "options": options,
                    "correct_answer": definition,
                    "explanation": f"In '{clean_heading}', {term} is defined as: {definition}"
                })

            # If we need more questions, create from subpoints
            if len(questions) < count and all_subpoints:
                for j, (sp, heading) in enumerate(all_subpoints):
                    if len(questions) >= count:
                        break
                    clean_h = re.sub(r"^\d+[\.\)]\s*", "", heading)
                    other_sps = [s[0] for s in all_subpoints if s[0] != sp]
                    distractors = other_sps[:3] if len(other_sps) >= 3 else [
                        "It contradicts the core findings of this section.",
                        "It is irrelevant to the overall subject matter.",
                        "It applies exclusively in hypothetical conditions."
                    ]
                    opts = [sp] + distractors[:3]
                    random.shuffle(opts)
                    questions.append({
                        "id": f"q{len(questions) + 1}",
                        "type": "multiple_choice",
                        "question": f"According to the notes on '{clean_h}', which statement is accurate?",
                        "options": opts,
                        "correct_answer": sp,
                        "explanation": f"Under '{clean_h}', the key finding is: {sp}"
                    })

            return questions[:count]

        # IDENTIFICATION
        elif quiz_type == "identification":
            questions = []
            for i, (term, definition, heading) in enumerate(all_terms_defs[:count]):
                clean_h = re.sub(r"^\d+[\.\)]\s*", "", heading)
                questions.append({
                    "id": f"q{i + 1}",
                    "type": "identification",
                    "question": f"Identify the concept or term described: \"{definition}\"",
                    "correct_answer": term,
                    "explanation": f"{term} is defined in '{clean_h}' as: {definition}"
                })
            return questions[:count]

        # CONCEPT MATCHING
        elif quiz_type == "matching":
            pairs = []
            for term, definition, _ in all_terms_defs[:5]:
                # Keep matching definitions concise (under 80 chars) for clean UI layout
                concise_def = definition if len(definition) <= 90 else definition[:87] + "..."
                pairs.append({
                    "left": term,
                    "right": concise_def
                })

            if len(pairs) < 2:
                pairs.append({"left": "Core Concept", "right": notes.get("summary", "Primary study summary.")[:80]})

            return [
                {
                    "id": "q1",
                    "type": "matching",
                    "question": "Match each concept from the study notes with its corresponding definition or role:",
                    "matching_pairs": pairs,
                    "correct_answer": "All pairs matched",
                    "explanation": f"Successfully connected all {len(pairs)} concepts directly extracted from your study notes."
                }
            ]

        return []

    def _generate_fallback_chat_reply(self, message: str, notes: Dict[str, Any]) -> str:
        """
        Generates context-aware chat replies grounded directly in the user's notes and document.
        """
        msg_lower = message.lower()
        title = notes.get("title", "Study Material")
        summary = notes.get("summary", "")
        sections = notes.get("sections", [])

        # Check if user is asking about a specific term in their notes
        for s in sections:
            for kt in s.get("key_terms", []):
                term = kt.get("term", "")
                if term and term.lower() in msg_lower:
                    definition = kt.get("definition", "")
                    heading = s.get("heading", "")
                    return (
                        f"### {term}\n\n"
                        f"Based on **{title}** (Section: *{heading}*):\n\n"
                        f"**Definition / Mechanism:**\n> {definition}\n\n"
                        f"**Key context:** This is a central concept for your review. Would you like me to generate a practice question or mnemonic for this?"
                    )

        if "summary" in msg_lower or "explain" in msg_lower or "overview" in msg_lower:
            section_list = "\n".join([f"- **{s.get('heading')}**: {len(s.get('subpoints', []))} key points, {len(s.get('key_terms', []))} terms" for s in sections[:4]])
            return (
                f"### Summary: {title}\n\n"
                f"{summary}\n\n"
                f"**Main Sections Covered:**\n"
                f"{section_list}\n\n"
                f"Ask me about any specific section or term to dive deeper!"
            )

        if "quiz" in msg_lower or "test" in msg_lower:
            return (
                f"You can test your understanding of **{title}** anytime in the **Quiz Arena** tab above! "
                f"We generate **Multiple Choice**, **Identification**, and **Concept Matching** questions derived directly from your notes."
            )

        if "flashcard" in msg_lower or "card" in msg_lower:
            return (
                f"You have active recall flashcards available in the **Flashcards** tab! "
                f"They test the key definitions and core takeaways extracted from **{title}**."
            )

        return (
            f"I'm your AI tutor for **{title}**! "
            f"I can help explain any concept from your notes, formulate custom review questions, break down complex definitions, or summarize specific sections. "
            f"What would you like to explore?"
        )


gemini_service = GeminiService()
