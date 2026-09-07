import io
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.gemini_service import gemini_service
from app.models.schemas import NoteContent, LegalCase, LegalDoctrine

client = TestClient(app)
AUTH = {"Authorization": "Bearer demo-token"}

SAMPLE_LEGAL_CASE_TEXT = """
SUPREME COURT OF THE PHILIPPINES
EN BANC

OPOSA v. FACTORAN, JR.
G.R. No. 101083, July 30, 1993, 224 SCRA 792
Ponente: Davide, Jr., J.

FACTS:
The principal petitioners are minors represented by their parents. They instituted a taxpayer class suit against Fulgencio S. Factoran, Jr., then Secretary of the Department of Environment and Natural Resources (DENR). The complaint alleged that the defendant had granted Timber License Agreements (TLAs) to commercial logging operators covering 3.89 million hectares, while only 850,000 hectares of virgin rainforest remained, causing severe environmental degradation and natural calamities. Petitioners sought the cancellation of all existing TLAs and cessation of new licenses.

ISSUE:
Whether or not the petitioner minors have locus standi to file the class suit on their own behalf and on behalf of generations yet unborn.

RULING:
The Supreme Court ruled in favor of petitioners. Minors have locus standi to sue on behalf of future generations under the Doctrine of Intergenerational Responsibility. The right to a balanced and healthful ecology under Section 16, Article II of the 1987 Philippine Constitution is a self-executing fundamental right. Minors can represent themselves and generations yet unborn to ensure the rhythm and harmony of nature is preserved.

DOCTRINE APPLIED:
Doctrine of Intergenerational Responsibility. Every generation has a constitutional responsibility to the next to preserve the rhythm and harmony of nature.

Doctrine of Stare Decisis:
Courts must adhere to precedents and not unsettle things that are established.
Requisites:
1. Prior judicial decision by a court of competent jurisdiction
2. Similar question of law and facts involved
3. Applicable ratio decidendi

Exceptions:
1. When the precedent is contrary to law or public policy
2. When changing societal conditions require abandonment of the doctrine
"""

SAMPLE_GENERAL_TEXT = """
Cellular respiration is the biochemical process converting glucose into ATP.
Glycolysis occurs in the cytoplasm and yields two pyruvate molecules.
The citric acid cycle operates inside mitochondrial matrices.
"""


def test_is_legal_material_detection():
    """Verify smart classification of legal text vs general educational material."""
    assert gemini_service._is_legal_material(SAMPLE_LEGAL_CASE_TEXT, "Oposa_v_Factoran_Digest.pdf") is True
    assert gemini_service._is_legal_material(SAMPLE_GENERAL_TEXT, "cellular_biology.txt") is False


def test_heuristic_legal_extraction():
    """Verify that the dynamic heuristic engine accurately parses cases and doctrines from raw legal text."""
    notes = gemini_service._extract_document_insights(SAMPLE_LEGAL_CASE_TEXT, "Oposa_v_Factoran.txt")
    
    assert notes["document_type"] == "law"
    assert "cases" in notes and len(notes["cases"]) >= 1
    assert "doctrines" in notes and len(notes["doctrines"]) >= 1

    case = notes["cases"][0]
    assert "oposa" in case["case_name"].lower() and "factoran" in case["case_name"].lower()
    assert "101083" in case["citation"]
    assert "Davide" in case["ponente"]
    assert len(case["facts"]) > 20
    assert len(case["issue"]) > 20
    assert len(case["ruling"]) > 20

    # Doctrine checks
    doctrine_names = [d["name"] for d in notes["doctrines"]]
    assert any("Intergenerational" in d or "Stare Decisis" in d for d in doctrine_names)
    
    stare_decisis = next((d for d in notes["doctrines"] if "Stare Decisis" in d["name"]), None)
    if stare_decisis:
        assert len(stare_decisis["elements"]) >= 2
        assert len(stare_decisis["exceptions"]) >= 1


def test_legal_flashcards_generation():
    """Verify that flashcards generated from legal notes test case rulings and doctrine elements."""
    notes = gemini_service._extract_document_insights(SAMPLE_LEGAL_CASE_TEXT, "Oposa_v_Factoran.txt")
    cards = gemini_service._fallback_flashcards(notes, count=6)
    
    assert len(cards) >= 3
    # Check that at least one card tests a case ruling or doctrine
    has_case_card = any("ruling" in c["front"].lower() or "oposa" in c["front"].lower() for c in cards)
    has_doctrine_card = any("doctrine" in c["front"].lower() or "requisites" in c["front"].lower() for c in cards)
    assert has_case_card or has_doctrine_card


def test_legal_quiz_generation():
    """Verify quiz questions generated for legal notes."""
    notes = gemini_service._extract_document_insights(SAMPLE_LEGAL_CASE_TEXT, "Oposa_v_Factoran.txt")
    mc_questions = gemini_service._fallback_quiz(notes, quiz_type="multiple_choice", count=3)
    assert len(mc_questions) >= 1
    assert "question" in mc_questions[0]
    assert len(mc_questions[0]["options"]) == 4

    id_questions = gemini_service._fallback_quiz(notes, quiz_type="identification", count=3)
    assert len(id_questions) >= 1
    assert "correct_answer" in id_questions[0]


def test_legal_notes_api_roundtrip():
    """Test full upload -> session -> notes extraction and update with legal cases."""
    # 1. Upload legal document
    upload = client.post(
        "/api/documents/upload",
        files={"file": ("consti_case_digest.txt", io.BytesIO(SAMPLE_LEGAL_CASE_TEXT.encode()), "text/plain")},
        headers=AUTH,
    )
    assert upload.status_code == 200
    doc_id = upload.json()["id"]

    # 2. Create session
    session_res = client.post(
        "/api/sessions",
        json={"title": "Constitutional Law: Environmental Standing", "document_id": doc_id},
        headers=AUTH,
    )
    assert session_res.status_code == 200
    sess_id = session_res.json()["id"]

    # 3. Generate notes
    gen_res = client.post(f"/api/sessions/{sess_id}/notes/generate?force=true", headers=AUTH)
    assert gen_res.status_code == 200
    notes_record = gen_res.json()
    content = notes_record["content"]
    assert content["document_type"] == "law"
    assert len(content["cases"]) >= 1

    # 4. User reviews and edits notes
    updated_cases = content["cases"]
    updated_cases[0]["facts"] = "Updated facts during law student review."
    content["cases"] = updated_cases
    
    update_res = client.put(
        f"/api/sessions/{sess_id}/notes",
        json={"content": content, "scope": "student confirmed review"},
        headers=AUTH,
    )
    assert update_res.status_code == 200
    saved_content = update_res.json()["content"]
    assert saved_content["cases"][0]["facts"] == "Updated facts during law student review."
