import pytest

from app.services.notes_terms import is_credible_glossary_term
from app.services.gemini_service import gemini_service

STORY_TEXT = """
Illustrated by Triska Wasser What does this blustering wolf want?
Once upon a time there were three piglet siblings, two
When they were grown, their parents gave them each a little money
Sticks are more expensive than straw, but the house will still be
I'll have some money left over and most of the day
"""


def test_rejects_sentence_fragments_as_glossary_terms():
    assert is_credible_glossary_term("Once upon a", "Once upon a time there were three piglet siblings, two") is False
    assert is_credible_glossary_term("Sticks are more", "Sticks are more expensive than straw") is False
    assert is_credible_glossary_term("gather sticks off", "gather sticks off the ground.") is False
    assert is_credible_glossary_term('little pig, "Straw', 'little pig, "Straw is very inexpensive.') is False
    assert is_credible_glossary_term("Illustrated by Triska Wasser", "Illustrated by Triska Wasser") is False


def test_accepts_defined_concepts_and_case_names():
    assert is_credible_glossary_term("Photosynthesis", "Process of converting light energy into chemical energy") is True
    assert is_credible_glossary_term("Cellular Respiration", "Biochemical process converting glucose into ATP") is True
    assert is_credible_glossary_term("Oposa v. Factoran", "Philippine Supreme Court environmental standing case") is True
    assert is_credible_glossary_term("Doctrine of Intergenerational Responsibility", "Duty to preserve nature for future generations") is True
    assert is_credible_glossary_term("ATP", "Adenosine triphosphate, the cell's energy currency") is True


def test_story_heuristic_does_not_invent_key_terms_from_bullet_prefixes():
    notes = gemini_service._extract_document_insights(STORY_TEXT, "ThreeLittlePigs.txt")
    invented = []
    for section in notes["sections"]:
        for kt in section.get("key_terms") or []:
            term = kt["term"].strip().lower()
            definition = (kt.get("definition") or "").strip().lower()
            if definition.startswith(term) and len(definition) > len(term) + 4:
                invented.append(kt["term"])
            words = kt["term"].split()
            if len(words) <= 3:
                first_bullet = (section.get("subpoints") or [""])[0]
                if first_bullet.lower().startswith(term):
                    invented.append(kt["term"])
    assert invented == []
