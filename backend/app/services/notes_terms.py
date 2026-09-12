"""Quality gate for glossary-style terms used in notes auto-highlight.

Sentence prefixes and caption fragments are not study terms. Auto-highlight
and heuristic extraction must only keep phrases that look like defined
concepts, named doctrines, or case captions.
"""

from __future__ import annotations

import re

_TRAILING_STOP = {
    "a",
    "an",
    "the",
    "of",
    "off",
    "to",
    "for",
    "and",
    "or",
    "but",
    "with",
    "from",
    "by",
    "as",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "more",
    "than",
    "that",
    "this",
    "these",
    "those",
    "their",
    "his",
    "her",
    "its",
    "on",
    "in",
    "at",
    "into",
    "onto",
    "upon",
}

_LEADING_NOISE = re.compile(
    r"^(once upon|along the way|illustrated by|written by|adapted by|"
    r"translated by|published by|copyright|when they|if i|so the|"
    r"then the|after that|in the|on the|at the|there were)\b",
    re.IGNORECASE,
)

_BARE_WORD = re.compile(r"[^\w]+", re.UNICODE)


def _bare(word: str) -> str:
    return _BARE_WORD.sub("", word).lower()


def is_credible_glossary_term(phrase: str, definition: str = "") -> bool:
    cleaned = re.sub(r"\s+", " ", (phrase or "").strip())
    if len(cleaned) < 3 or len(cleaned) > 60:
        return False

    quotes = len(re.findall(r'["“”]', cleaned))
    if quotes % 2 == 1:
        return False

    words = [w for w in cleaned.split(" ") if w]
    if not words:
        return False

    last = _bare(words[-1])
    if last in _TRAILING_STOP:
        return False

    if _LEADING_NOISE.search(cleaned):
        return False

    definition_text = re.sub(r"\s+", " ", (definition or "").strip())
    if definition_text:
        term_l = cleaned.lower()
        def_l = definition_text.lower()
        if def_l == term_l:
            return False
        if def_l.startswith(term_l) and len(def_l) > len(term_l) + 2:
            return False

    if re.search(r"\bv\.?\s+[A-Z]", cleaned):
        return True
    if re.search(r"\b(doctrine|maxim|principle|theorem|lemma|law of|theory of)\b", cleaned, re.IGNORECASE):
        return True

    if len(words) == 1:
        token = words[0]
        if re.fullmatch(r"[A-Z]{2,8}", token):
            return True
        if re.fullmatch(r"[A-Z][A-Za-z-]{3,}", token):
            return True
        if len(token) >= 8 and re.search(r"[A-Za-z]{6,}", token):
            return True
        return False

    alpha_words = [w for w in words if re.search(r"[A-Za-z]", w)]
    content_words = [w for w in alpha_words if _bare(w) not in _TRAILING_STOP]
    if len(content_words) < 2:
        return False

    # "Sticks are more expensive" style: capitalised only as a sentence start.
    if re.fullmatch(r"[A-Z][a-z]+(?:\s+[a-z]+){1,6}", cleaned):
        return False

    title_case = True
    for word in alpha_words:
        bare = word.lstrip("“\"'")
        if _bare(bare) in _TRAILING_STOP:
            continue
        if not bare or not bare[0].isupper():
            title_case = False
            break
    return title_case


def sanitize_note_key_terms(content: dict) -> dict:
    """Drop sentence-prefix "key terms" so auto-highlight cannot replay them."""
    sections = content.get("sections") or []
    for section in sections:
        if not isinstance(section, dict):
            continue
        credible = []
        seen = set()
        for kt in section.get("key_terms") or []:
            if not isinstance(kt, dict):
                continue
            term_name = str(kt.get("term") or "").strip()
            term_def = str(kt.get("definition") or "").strip()
            key = term_name.lower()
            if not term_name or key in seen:
                continue
            if is_credible_glossary_term(term_name, term_def):
                seen.add(key)
                credible.append({**kt, "term": term_name, "definition": term_def})
        section["key_terms"] = credible
    return content


def flatten_note_fields(content: dict) -> dict:
    """Map reviewer field paths to plain text for grounded highlighting."""
    fields: dict = {}
    summary = str(content.get("summary") or "").strip()
    if summary:
        fields["summary"] = summary

    for s_idx, section in enumerate(content.get("sections") or []):
        if not isinstance(section, dict):
            continue
        heading = str(section.get("heading") or "").strip()
        if heading:
            fields[f"sections.{s_idx}.heading"] = heading
        for p_idx, point in enumerate(section.get("subpoints") or []):
            text = str(point or "").strip()
            if text:
                fields[f"sections.{s_idx}.subpoints.{p_idx}"] = text
        for t_idx, term in enumerate(section.get("key_terms") or []):
            if not isinstance(term, dict):
                continue
            definition = str(term.get("definition") or "").strip()
            if definition:
                fields[f"sections.{s_idx}.key_terms.{t_idx}.definition"] = definition

    for c_idx, case in enumerate(content.get("cases") or []):
        if not isinstance(case, dict):
            continue
        for field in ("facts", "issue", "ruling"):
            text = str(case.get(field) or "").strip()
            if text:
                fields[f"cases.{c_idx}.{field}"] = text

    for d_idx, doctrine in enumerate(content.get("doctrines") or []):
        if not isinstance(doctrine, dict):
            continue
        statement = str(doctrine.get("statement") or "").strip()
        if statement:
            fields[f"doctrines.{d_idx}.statement"] = statement
        for e_idx, element in enumerate(doctrine.get("elements") or []):
            text = str(element or "").strip()
            if text:
                fields[f"doctrines.{d_idx}.elements.{e_idx}"] = text
    return fields


def ground_highlights(content: dict, proposals: list, max_items: int = 36) -> list:
    """Keep only highlight phrases that appear verbatim in the notes."""
    fields = flatten_note_fields(content)
    grounded = []
    taken: dict = {}
    allowed_colors = {"yellow", "green", "pink", "sky"}

    for item in proposals or []:
        if not isinstance(item, dict):
            continue
        path = str(item.get("path") or "").strip()
        phrase = re.sub(r"\s+", " ", str(item.get("text") or "").strip())
        if path not in fields or len(phrase) < 4:
            continue
        haystack = fields[path]
        idx = haystack.lower().find(phrase.lower())
        if idx < 0:
            continue
        actual = haystack[idx : idx + len(phrase)]
        end = idx + len(actual)
        if len(actual) / max(len(haystack), 1) > 0.55:
            continue
        ranges = taken.setdefault(path, [])
        if any(not (end <= start or idx >= stop) for start, stop in ranges):
            continue
        ranges.append((idx, end))
        color = item.get("color") if item.get("color") in allowed_colors else "yellow"
        grounded.append(
            {
                "path": path,
                "start": idx,
                "end": end,
                "text": actual,
                "kind": "highlight",
                "color": color,
                "source": "auto",
            }
        )
        if len(grounded) >= max_items:
            break
    return grounded
