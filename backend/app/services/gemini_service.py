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
        excerpt: Dict[str, Any] = {
            "title": notes_json.get("title"),
            "summary": notes_json.get("summary"),
            "document_type": notes_json.get("document_type", "general"),
            "sections": sections,
        }
        if notes_json.get("cases"):
            excerpt["cases"] = [
                {
                    "case_name": c.get("case_name"),
                    "citation": c.get("citation"),
                    "ponente": c.get("ponente"),
                    "issue": (c.get("issue") or "")[:200],
                    "ruling": (c.get("ruling") or "")[:350],
                    "doctrine_applied": c.get("doctrine_applied")
                }
                for c in notes_json.get("cases")[:10]
                if isinstance(c, dict) and c.get("case_name")
            ]
        if notes_json.get("doctrines"):
            excerpt["doctrines"] = [
                {
                    "name": d.get("name"),
                    "statement": (d.get("statement") or "")[:250],
                    "elements": (d.get("elements") or [])[:6],
                    "exceptions": (d.get("exceptions") or [])[:4],
                    "statutory_basis": d.get("statutory_basis"),
                    "supporting_cases": (d.get("supporting_cases") or [])[:4]
                }
                for d in notes_json.get("doctrines")[:10]
                if isinstance(d, dict) and d.get("name")
            ]
        return excerpt

    @staticmethod
    def _is_legal_material(text: str, title: str) -> bool:
        """
        Detect if document contains legal text, court jurisprudence, case digests,
        statutes, or law school review materials.
        """
        combined = f"{title}\n{text[:12000]}".lower()
        legal_keywords = [
            "g.r. no", "scra", "phil.", "v.", "vs.", "versus", "supreme court",
            "court of appeals", "sandiganbayan", "petitioner", "respondent",
            "appellant", "appellee", "plaintiff", "defendant", "ponente",
            "jurisprudence", "doctrine", "ratio decidendi", "stare decisis",
            "oblicon", "consti", "crimlaw", "remedial law", "taxation law",
            "statutory construction", "civil code", "penal code", "rules of court",
            "case digest", "facts:", "issue:", "held:", "ruling:", "dispositive",
            "intergenerational responsibility", "operative fact", "police power",
            "due process", "equal protection", "mens rea", "actus reus"
        ]
        match_count = sum(1 for term in legal_keywords if term in combined)
        has_gr_num = bool(re.search(r"\bg\.?r\.?\s*no\.?\s*[\w\-]+", combined, re.IGNORECASE))
        has_case_v = bool(re.search(r"\b[a-z0-9\.\'\-]+\s+(?:v\.|vs\.|versus)\s+[a-z0-9\.\'\-]+", combined, re.IGNORECASE))
        has_fir_block = bool(re.search(r"\b(?:facts|issue|held|ruling)\s*:", combined, re.IGNORECASE))

        return match_count >= 2 or has_gr_num or (has_case_v and has_fir_block)

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

    def transcribe_page_image_sync(self, image_bytes: bytes, mime_type: str = "image/png") -> Optional[str]:
        """
        Synchronously transcribes text from a document page image using Gemini Multimodal Vision.
        Used as OCR fallback when PDF streams lack /ToUnicode mappings or contain scanned content.
        """
        if not self._configured or not HAS_GOOGLE_GENAI:
            return None

        models = self._get_candidate_models()
        prompt = (
            "You are an expert OCR transcription engine. "
            "Transcribe all readable text from this document page image verbatim and completely. "
            "Preserve paragraphs, section headings, numbers, legal citations, case captions, and table structures exactly as formatted. "
            "Do NOT summarize, paraphrase, or add conversational preamble or markdown code fences. "
            "Output ONLY the transcribed document text."
        )

        image_part = {
            "mime_type": mime_type,
            "data": image_bytes
        }

        for model_name in models:
            try:
                model = genai.GenerativeModel(model_name=model_name)
                response = model.generate_content(
                    [prompt, image_part],
                    request_options={"timeout": 15}
                )
                if response and response.text:
                    cleaned = response.text.strip()
                    if cleaned:
                        return cleaned
            except Exception as e:
                print(f"[GeminiService] Vision OCR attempt on {model_name} failed: {e}")
                continue

        return None

    async def transcribe_page_image(self, image_bytes: bytes, mime_type: str = "image/png") -> Optional[str]:
        """
        Asynchronously transcribes text from a document page image using Gemini Multimodal Vision.
        """
        return await asyncio.to_thread(self.transcribe_page_image_sync, image_bytes, mime_type)

    async def generate_notes(self, text: str, document_title: str) -> Dict[str, Any]:
        """
        Generate structured notes (title, summary, sections with headings, subpoints, key terms,
        and for legal materials: case digests with FIRAC and legal doctrines with elements & exceptions)
        using Gemini JSON mode, falling back to dynamic document text extraction.
        """
        clean_title = document_title.replace(".pdf", "").replace(".docx", "").replace(".txt", "").strip()
        is_legal = self._is_legal_material(text, document_title)

        if is_legal:
            prompt = f"""You are an elite legal scholar and law school bar review tutor.
Analyze the following law study material from '{document_title}' and generate a comprehensive, structured legal reviewer tailored for law students and bar reviewees based strictly on the text.

Extract the following:
1. "cases": Any Supreme Court decisions, landmark cases, or case digests mentioned, with:
   - "case_name": Title of case (e.g. "Oposa v. Factoran, Jr." or "People v. Santos")
   - "citation": Official citation / docket (e.g. "G.R. No. 101083, July 30, 1993, 224 SCRA 792")
   - "date": Promulgation date if stated
   - "ponente": Authoring Justice (e.g. "Davide, Jr., J.")
   - "facts": Concise summary of essential operative facts and procedural history
   - "issue": The precise legal / constitutional issue resolved
   - "ruling": Definitive holding and ratio decidendi of the Court
   - "doctrine_applied": The legal doctrine, test, or rule established/applied

2. "doctrines": All legal doctrines, principles, and rules of law analyzed:
   - "name": Official doctrine name (e.g. "Doctrine of Intergenerational Responsibility", "Doctrine of Operative Fact", "Exclusionary Rule")
   - "statement": Authoritative statement and rule of law
   - "elements": Array of required elements / requisites to invoke or prove the doctrine
   - "exceptions": Array of recognized exceptions or limitations
   - "statutory_basis": Applicable constitutional, statutory, or codal article (e.g. "Art. II, Sec. 16, 1987 Constitution")
   - "supporting_cases": Array of case names cited for this doctrine

3. "sections": 3 to 8 structured sections covering all key legal concepts, statutory provisions, and principles:
   - "heading": Clear section title
   - "subpoints": 2 to 6 high-yield bullet points explaining legal mechanics and application
   - "key_terms": 1 to 4 key legal terms, maxims, or Latin phrases with definitions

Return JSON matching this schema:
{{
  "title": "Legal Study Notes: {clean_title}",
  "summary": "2-3 clear sentences summarizing core doctrines, cases, and principles in this material",
  "document_type": "law",
  "cases": [
    {{
      "id": "case-1",
      "case_name": "Full Case Name",
      "citation": "G.R. No. / Citation",
      "date": "Date",
      "ponente": "Ponente",
      "facts": "Concise operative facts...",
      "issue": "Legal issue...",
      "ruling": "Holding & ratio decidendi...",
      "doctrine_applied": "Applied doctrine..."
    }}
  ],
  "doctrines": [
    {{
      "id": "doc-1",
      "name": "Doctrine Name",
      "statement": "Rule of law statement...",
      "elements": ["Element 1", "Element 2"],
      "exceptions": ["Exception 1"],
      "statutory_basis": "Statute / Constitutional provision",
      "supporting_cases": ["Case Name"]
    }}
  ],
  "sections": [
    {{
      "heading": "Section Heading",
      "subpoints": ["Bullet 1", "Bullet 2"],
      "key_terms": [
        {{ "term": "Legal Concept", "definition": "Precise definition" }}
      ]
    }}
  ]
}}

Source Material:
{text[:45000]}
"""
        else:
            prompt = f"""You are an expert educational AI tutor. Analyze the following study material from '{document_title}' and generate comprehensive, structured study notes based strictly on the text.

Return JSON with this schema:
{{
  "title": "Study Notes: {clean_title}",
  "summary": "2-3 clear sentences summarizing the core concepts and key takeaways from the text",
  "document_type": "general",
  "cases": [],
  "doctrines": [],
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
{text[:28000]}
"""
        parsed = await self._try_generate_json(prompt)
        if parsed and isinstance(parsed, dict) and "sections" in parsed and len(parsed["sections"]) > 0:
            if not parsed.get("title"):
                parsed["title"] = f"Study Guide: {clean_title}"
            if "cases" not in parsed or not isinstance(parsed["cases"], list):
                parsed["cases"] = []
            if "doctrines" not in parsed or not isinstance(parsed["doctrines"], list):
                parsed["doctrines"] = []
            if not parsed.get("document_type"):
                parsed["document_type"] = "law" if (parsed["cases"] or parsed["doctrines"] or is_legal) else "general"
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
        is_law = notes_content.get("document_type") == "law" or bool(notes_content.get("cases")) or bool(notes_content.get("doctrines"))
        legal_guidance = (
            "\nYou are tutoring a law student. When answering legal queries, provide structured legal reasoning using the IRAC method (Issue, Rule, Application, Conclusion). Accurately reference the jurisprudence, G.R. numbers, and doctrines in the notes."
            if is_law else ""
        )
        system_context = f"""You are Aral.ai, an encouraging, knowledgeable study assistant for '{session_title}'.{legal_guidance}
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

        # Extract legal insights (case briefs, doctrines, requisites) if present
        cases_data, doctrines_data = self._extract_legal_insights_heuristic(filtered_lines, clean_title)
        is_law = bool(cases_data or doctrines_data or self._is_legal_material(text, title))
        
        if is_law:
            summary_text += f" Law reviewer: synthesized {len(sections_data)} core topics, {len(cases_data)} jurisprudence case briefs, and {len(doctrines_data)} legal doctrines."
        else:
            summary_text += f" Synthesizes {len(sections_data)} major sections and {sum(len(s['key_terms']) for s in sections_data)} key definitions."

        return {
            "title": f"Study Notes: {clean_title}",
            "summary": summary_text,
            "document_type": "law" if is_law else "general",
            "sections": sections_data,
            "cases": cases_data,
            "doctrines": doctrines_data
        }

    def _extract_legal_insights_heuristic(self, lines: List[str], clean_title: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Heuristic extraction of legal cases (FIRAC format) and legal doctrines with elements.
        """
        cases: List[Dict[str, Any]] = []
        doctrines: List[Dict[str, Any]] = []

        current_case: Optional[Dict[str, Any]] = None
        active_field: Optional[str] = None
        case_v_pattern = re.compile(r"^([A-Z0-9\.\,\'\-\s]+(?:\s+(?:v\.|vs\.|versus)\s+)[A-Z0-9\.\,\'\-\s]+)", re.IGNORECASE)
        gr_pattern = re.compile(r"\b(G\.?R\.?\s*No\.?\s*[\w\-]+(?:,\s*[A-Za-z]+\s+\d+,\s+\d+)?(?:\s*,\s*\d+\s+SCRA\s+\d+)?)", re.IGNORECASE)
        ponente_pattern = re.compile(r"(?:Ponente|Justice|J\.)\s*:\s*([A-Za-z\.\,\s]+)", re.IGNORECASE)

        for line in lines:
            # Check for case caption
            m_v = case_v_pattern.match(line)
            if m_v and len(line) < 130 and not line.lower().startswith("in re"):
                if current_case and current_case.get("case_name") and (current_case.get("ruling") or current_case.get("facts") or current_case.get("citation")):
                    cases.append(current_case)
                c_name = m_v.group(1).strip(",;: ")
                if c_name.isupper():
                    c_name = c_name.title()
                current_case = {
                    "id": f"case-{len(cases) + 1}",
                    "case_name": c_name,
                    "citation": "",
                    "date": "",
                    "ponente": "",
                    "facts": "",
                    "issue": "",
                    "ruling": "",
                    "doctrine_applied": ""
                }
                active_field = None
                continue

            # Check for G.R. No. / citation
            m_gr = gr_pattern.search(line)
            if m_gr:
                if current_case:
                    current_case["citation"] = m_gr.group(1).strip()
                elif not cases:
                    current_case = {
                        "id": f"case-{len(cases) + 1}",
                        "case_name": clean_title,
                        "citation": m_gr.group(1).strip(),
                        "date": "",
                        "ponente": "",
                        "facts": "",
                        "issue": "",
                        "ruling": "",
                        "doctrine_applied": ""
                    }

            # Ponente
            m_pon = ponente_pattern.search(line)
            if m_pon and current_case:
                current_case["ponente"] = m_pon.group(1).strip()

            # FIRAC field headers
            if re.match(r"^(?:FACTS|FACTUAL ANTECEDENTS|STATEMENT OF FACTS)\s*:", line, re.IGNORECASE):
                active_field = "facts"
                content = re.sub(r"^(?:FACTS|FACTUAL ANTECEDENTS|STATEMENT OF FACTS)\s*:\s*", "", line, flags=re.IGNORECASE).strip()
                if current_case and content:
                    current_case["facts"] += content + " "
                continue
            elif re.match(r"^(?:ISSUE|ISSUES|LEGAL ISSUE)\s*:", line, re.IGNORECASE):
                active_field = "issue"
                content = re.sub(r"^(?:ISSUE|ISSUES|LEGAL ISSUE)\s*:\s*", "", line, flags=re.IGNORECASE).strip()
                if current_case and content:
                    current_case["issue"] += content + " "
                continue
            elif re.match(r"^(?:HELD|RULING|RATIO DECIDENDI|COURT RULING|DECISION)\s*:", line, re.IGNORECASE):
                active_field = "ruling"
                content = re.sub(r"^(?:HELD|RULING|RATIO DECIDENDI|COURT RULING|DECISION)\s*:\s*", "", line, flags=re.IGNORECASE).strip()
                if current_case and content:
                    current_case["ruling"] += content + " "
                continue
            elif re.match(r"^(?:DOCTRINE|DOCTRINE APPLIED|LEGAL PRINCIPLE)\s*:", line, re.IGNORECASE):
                active_field = "doctrine_applied"
                content = re.sub(r"^(?:DOCTRINE|DOCTRINE APPLIED|LEGAL PRINCIPLE)\s*:\s*", "", line, flags=re.IGNORECASE).strip()
                if current_case and content:
                    current_case["doctrine_applied"] += content + " "
                continue

            if current_case and active_field and len(current_case.get(active_field, "")) < 1200:
                if line and not line.startswith("#") and not line.startswith("---"):
                    current_case[active_field] = (current_case.get(active_field, "") + " " + line).strip()

        if current_case and current_case.get("case_name") and (current_case.get("ruling") or current_case.get("facts") or current_case.get("citation")):
            cases.append(current_case)

        # 2. Extract doctrines (e.g. "Doctrine of ...", "Principle of ...", "Rule on ...")
        doctrine_heading_re = re.compile(r"\b((?:Doctrine|Principle)\s+of\s+[A-Za-z\s\-]+|Rule\s+on\s+[A-Za-z\s\-]+|Void-for-Vagueness|Exclusionary Rule|Operative Fact|Command Responsibility|Stare Decisis)", re.IGNORECASE)

        for idx, line in enumerate(lines):
            m_doc = doctrine_heading_re.search(line)
            if m_doc and len(line) < 100:
                doc_name = m_doc.group(1).strip()
                if not any(d["name"].lower() == doc_name.lower() for d in doctrines):
                    current_doc = {
                        "id": f"doc-{len(doctrines) + 1}",
                        "name": doc_name.title(),
                        "statement": "",
                        "elements": [],
                        "exceptions": [],
                        "statutory_basis": "",
                        "supporting_cases": []
                    }
                    # Next lines might be the statement, requisites, and exceptions
                    active_sub = "elements"
                    for next_line in lines[idx + 1:idx + 16]:
                        if not next_line:
                            continue
                        if re.match(r"^(?:requisites|elements)\s*:", next_line, re.IGNORECASE):
                            active_sub = "elements"
                            continue
                        if re.match(r"^(?:exceptions?)\s*:", next_line, re.IGNORECASE):
                            active_sub = "exceptions"
                            continue
                        if re.match(r"^(?:\d+[\.\)]|[a-z][\.\)]|•|\-)\s*", next_line):
                            clean_elem = re.sub(r"^(?:\d+[\.\)]|[a-z][\.\)]|•|\-)\s*", "", next_line).strip()
                            if len(clean_elem) > 6:
                                if active_sub == "exceptions":
                                    current_doc["exceptions"].append(clean_elem)
                                else:
                                    current_doc["elements"].append(clean_elem)
                        elif not current_doc["statement"] and len(next_line) > 20 and not re.search(r"^(?:requisites|elements|exceptions)", next_line, re.IGNORECASE):
                            current_doc["statement"] = next_line.strip()

                    if not current_doc["statement"]:
                        current_doc["statement"] = f"Authoritative legal doctrine recognizing {doc_name} under applicable jurisprudence."
                    doctrines.append(current_doc)

        return cases, doctrines

    def _fallback_notes(self, title: str, text: str) -> Dict[str, Any]:
        """
        Dynamically extracts notes strictly from the uploaded document text.
        """
        return self._extract_document_insights(text, title)

    def _fallback_flashcards(self, notes: Dict[str, Any], count: int = 8) -> List[Dict[str, Any]]:
        """
        Dynamically builds flashcard pairs from actual key terms, subpoints,
        legal cases (holdings), and legal doctrines (elements & statements).
        """
        cards: List[Dict[str, Any]] = []
        sections = notes.get("sections", [])
        cases = notes.get("cases", [])
        doctrines = notes.get("doctrines", [])
        order = 0

        # 1. Jurisprudence Cases (Holdings & Doctrines)
        for c in cases:
            if order >= count:
                break
            c_name = c.get("case_name") or "Landmark Case"
            citation = f" ({c.get('citation')})" if c.get("citation") else ""
            if c.get("ruling"):
                issue_prompt = f" on the issue of: {c.get('issue')[:140]}" if c.get("issue") else ""
                cards.append({
                    "front": f"In {c_name}{citation}, what was the Court's ruling{issue_prompt}?",
                    "back": c.get("ruling"),
                    "order_index": order
                })
                order += 1
            if c.get("doctrine_applied") and order < count:
                cards.append({
                    "front": f"What doctrine or legal principle was established or applied in {c_name}{citation}?",
                    "back": c.get("doctrine_applied"),
                    "order_index": order
                })
                order += 1

        # 2. Legal Doctrines (Statements, Requisites, Exceptions)
        for d in doctrines:
            if order >= count:
                break
            d_name = d.get("name") or "Legal Doctrine"
            if d.get("statement") and order < count:
                cards.append({
                    "front": f"What is the {d_name} and its core statement under jurisprudence?",
                    "back": d.get("statement"),
                    "order_index": order
                })
                order += 1
            if d.get("elements") and len(d.get("elements")) > 0 and order < count:
                elements_text = "\n".join([f"{i + 1}. {e}" for i, e in enumerate(d.get("elements"))])
                cards.append({
                    "front": f"What are the essential requisites / elements of the {d_name}?",
                    "back": elements_text,
                    "order_index": order
                })
                order += 1
            if d.get("exceptions") and len(d.get("exceptions")) > 0 and order < count:
                exceptions_text = "\n".join([f"• {ex}" for ex in d.get("exceptions")])
                cards.append({
                    "front": f"What are the recognized exceptions or limits to the {d_name}?",
                    "back": exceptions_text,
                    "order_index": order
                })
                order += 1

        # 3. Key Terms & Definitions from sections
        for s in sections:
            for kt in s.get("key_terms", []):
                if order >= count:
                    break
                term = kt.get("term")
                definition = kt.get("definition")
                if term and definition:
                    cards.append({
                        "front": f"What is '{term}' according to the study material?",
                        "back": definition,
                        "order_index": order
                    })
                    order += 1

        # 4. Core Subpoints
        for s in sections:
            heading = s.get("heading", "Study Topic")
            clean_heading = re.sub(r"^\d+[\.\)]\s*", "", heading)
            for sp in s.get("subpoints", []):
                if order >= count:
                    break
                if len(sp) > 20:
                    cards.append({
                        "front": f"In '{clean_heading}', what is a critical takeaway?",
                        "back": sp,
                        "order_index": order
                    })
                    order += 1

        # Fallback if empty notes
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
        Dynamically generates quiz questions from actual terms, definitions,
        cases, and doctrines with distractors generated from the same document.
        """
        sections = notes.get("sections", [])
        cases = notes.get("cases", [])
        doctrines = notes.get("doctrines", [])
        
        all_terms_defs: List[Tuple[str, str, str]] = []
        all_subpoints: List[Tuple[str, str]] = []

        # Add legal doctrines and cases to pool
        for d in doctrines:
            if d.get("name") and d.get("statement"):
                all_terms_defs.append((d["name"], d["statement"], "Legal Doctrines"))
        for c in cases:
            if c.get("case_name") and c.get("ruling"):
                all_terms_defs.append((c["case_name"], c["ruling"], "Jurisprudence"))

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
                other_defs = [d for d in available_defs if d != definition]
                random.seed(i * 17)
                if len(other_defs) >= 3:
                    distractors = random.sample(other_defs, 3)
                else:
                    distractors = other_defs + [
                        f"A non-essential auxiliary doctrine superseded by {clean_heading}",
                        f"An inapplicable rule not recognized in this jurisdiction",
                        "An inverse presumption without statutory basis"
                    ][:3 - len(other_defs)]

                options = [definition] + distractors
                random.shuffle(options)

                prompt_question = (
                    f"Under jurisprudence, what was the Court's ruling in '{term}'?"
                    if heading == "Jurisprudence"
                    else f"Which of the following accurately states or defines the '{term}'?"
                )

                questions.append({
                    "id": f"q{i + 1}",
                    "type": "multiple_choice",
                    "question": prompt_question,
                    "options": options,
                    "correct_answer": definition,
                    "explanation": f"Under {clean_heading}, {term}: {definition}"
                })

            if len(questions) < count and all_subpoints:
                for j, (sp, heading) in enumerate(all_subpoints):
                    if len(questions) >= count:
                        break
                    clean_h = re.sub(r"^\d+[\.\)]\s*", "", heading)
                    other_sps = [s[0] for s in all_subpoints if s[0] != sp]
                    distractors = other_sps[:3] if len(other_sps) >= 3 else [
                        "It contradicts the established legal doctrine of this case.",
                        "It is inapplicable to the facts and procedural issues.",
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
                        "explanation": f"Under '{clean_h}', the key principle is: {sp}"
                    })

            return questions[:count]

        # IDENTIFICATION
        elif quiz_type == "identification":
            questions = []
            for i, (term, definition, heading) in enumerate(all_terms_defs[:count]):
                clean_h = re.sub(r"^\d+[\.\)]\s*", "", heading)
                clue = (
                    f"Identify the landmark case where the Supreme Court held: \"{definition}\""
                    if heading == "Jurisprudence"
                    else f"Identify the legal concept or doctrine described: \"{definition}\""
                )
                questions.append({
                    "id": f"q{i + 1}",
                    "type": "identification",
                    "question": clue,
                    "correct_answer": term,
                    "explanation": f"{term} is recognized in '{clean_h}' as: {definition}"
                })
            return questions[:count]

        # CONCEPT MATCHING
        elif quiz_type == "matching":
            pairs = []
            for term, definition, _ in all_terms_defs[:5]:
                concise_def = definition if len(definition) <= 90 else definition[:87] + "..."
                pairs.append({
                    "left": term,
                    "right": concise_def
                })

            if len(pairs) < 2:
                pairs.append({"left": "Core Principle", "right": notes.get("summary", "Primary study summary.")[:80]})

            return [
                {
                    "id": "q1",
                    "type": "matching",
                    "question": "Match each case or legal concept with its corresponding ruling or definition:",
                    "matching_pairs": pairs,
                    "correct_answer": "All pairs matched",
                    "explanation": f"Successfully connected all {len(pairs)} concepts directly extracted from your study notes."
                }
            ]

        return []

    def _generate_fallback_chat_reply(self, message: str, notes: Dict[str, Any]) -> str:
        """
        Generates context-aware chat replies grounded directly in the user's notes,
        jurisprudence case digests, and legal doctrines.
        """
        msg_lower = message.lower()
        title = notes.get("title", "Study Material")
        summary = notes.get("summary", "")
        sections = notes.get("sections", [])
        cases = notes.get("cases", [])
        doctrines = notes.get("doctrines", [])

        # 1. Check if user asks about a specific case
        for c in cases:
            c_name = c.get("case_name", "")
            if c_name and (c_name.lower() in msg_lower or any(part.lower() in msg_lower for part in c_name.split() if len(part) > 4)):
                citation = f" ({c.get('citation')})" if c.get("citation") else ""
                ponente = f" • Ponente: {c.get('ponente')}" if c.get("ponente") else ""
                return (
                    f"### Case Digest: **{c_name}**{citation}\n\n"
                    f"**Court:** Supreme Court{ponente}\n\n"
                    f"**Facts:**\n{c.get('facts') or 'Refer to case text in your notes.'}\n\n"
                    f"**Issue:**\n{c.get('issue') or 'Legal issue presented for adjudication.'}\n\n"
                    f"**Ruling / Ratio Decidendi:**\n{c.get('ruling') or 'Holding of the Court.'}\n\n"
                    f"**Doctrine Applied:**\n> {c.get('doctrine_applied') or 'Key precedent applied.'}"
                )

        # 2. Check if user asks about a specific doctrine
        for d in doctrines:
            d_name = d.get("name", "")
            if d_name and d_name.lower() in msg_lower:
                elements_str = "\n".join([f"{i + 1}. {e}" for i, e in enumerate(d.get("elements", []))]) or "See full reviewer."
                exceptions_str = "\n".join([f"• {ex}" for ex in d.get("exceptions", [])]) or "None noted."
                basis = f"\n\n**Statutory Basis:** {d.get('statutory_basis')}" if d.get("statutory_basis") else ""
                return (
                    f"### Legal Doctrine: **{d_name}**{basis}\n\n"
                    f"**Statement / Rule of Law:**\n> {d.get('statement')}\n\n"
                    f"**Requisites / Elements:**\n{elements_str}\n\n"
                    f"**Exceptions / Limitations:**\n{exceptions_str}"
                )

        # 3. Check if user is asking about a specific term in their notes
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
            parts = []
            if cases:
                parts.append(f"**Jurisprudence Cases ({len(cases)}):** " + ", ".join([c.get("case_name", "") for c in cases[:4]]))
            if doctrines:
                parts.append(f"**Legal Doctrines ({len(doctrines)}):** " + ", ".join([d.get("name", "") for d in doctrines[:4]]))
            section_list = "\n".join([f"- **{s.get('heading')}**: {len(s.get('subpoints', []))} key points" for s in sections[:4]])
            parts_str = "\n\n".join(parts) + "\n\n" if parts else ""
            return (
                f"### Summary: {title}\n\n"
                f"{summary}\n\n"
                f"{parts_str}"
                f"**Main Sections:**\n"
                f"{section_list}\n\n"
                f"Ask me about any specific case, doctrine, or section to dive deeper using the IRAC method!"
            )

        if "quiz" in msg_lower or "test" in msg_lower:
            return (
                f"You can test your understanding of **{title}** anytime in the **Quiz Arena** tab above! "
                f"We generate **Multiple Choice**, **Identification**, and **Concept Matching** questions derived directly from your notes."
            )

        if "flashcard" in msg_lower or "card" in msg_lower:
            return (
                f"You have active recall flashcards available in the **Flashcards** tab! "
                f"They test the key definitions, case rulings, and doctrine elements extracted from **{title}**."
            )

        return (
            f"I'm your AI tutor for **{title}**! "
            f"I can help explain any case brief, break down legal doctrines and their requisites, formulate IRAC practice questions, or synthesize specific sections. "
            f"What would you like to explore?"
        )


gemini_service = GeminiService()
