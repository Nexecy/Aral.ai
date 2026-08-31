# Aral.ai (Aral — "Study / Lesson")

**Aral.ai** is a modern cross-platform (Web, Mobile iOS/Android, Desktop Windows/macOS/Linux) study application engineered for deep conceptual learning, active recall, and exam mastery.

Built with **Next.js (Static Export) + TypeScript + Tailwind CSS + shadcn/ui**, **FastAPI + Google GenAI SDK (Gemini 1.5 Pro / Flash)**, **Supabase PostgreSQL & Storage**, **Capacitor**, and **Tauri**.

Adheres strictly to the **Notion Design System** — warm paper canvas (`#f6f5f4`), near-black `Inter` typography, single confident Notion Blue (`#0075de`), subtle hairlines, and playful multi-color sticker accents.

---

## 🌟 Key Features

1. **PDF Document Upload & PyMuPDF Extraction**
   - High-throughput PDF text and structural extraction with page count detection.
   - Saves to Supabase Storage (with local filesystem fallback).

2. **Structured Notes Generation & Review Step**
   - Gemini 1.5 native JSON-mode extraction generating headings, subpoints, and key terms.
   - **Editable Review Step**: Review and refine notes *before* triggering flashcards/quizzes to prevent error propagation.

3. **3D Active Recall Flashcards**
   - Flip card UI with 3D perspective and Web Audio sound feedback.
   - Keyboard navigation (`Space` to flip, `Arrow Keys` to navigate, `1` / `2` for mastery rating).
   - Shuffle deck and mastery analytics.

4. **Multi-Mode Quiz Evaluation Arena**
   - **Multiple Choice** (4 options with discriminator explanations).
   - **Identification** (free-form active term recall with fuzzy tolerance).
   - **Concept Matching** (interactive paired term/definition mapping).
   - Instant scoring breakdown, question explanations, and celebratory fanfare.

5. **Real-Time AI Study Assistant (SSE Stream)**
   - Token-by-token streaming via Server-Sent Events (SSE) from FastAPI.
   - Scoped to active study session context and reviewed notes.
   - Suggested prompt pills and note-updating actions.

6. **Omnipresent Pomodoro Focus Widget**
   - Persistent floating widget across all pages (25m study / 5m break cycles).
   - Minimizable floating pill vs expanded timer card.
   - Synthesizer chime audio alerts, browser notifications, and study cycle logging.

7. **Notion Design & Responsive Navigation**
   - Warm paper light theme by default (`#f6f5f4`) + dark slate mode toggle.
   - Vertical sidebar rail with auto-collapse below 1024px and responsive mobile bottom navigation.

8. **Cross-Platform Ready**
   - **Static Export**: 100% client-side compatible (`output: 'export'`).
   - **Capacitor**: Packaged for iOS and Android with `@capacitor/local-notifications`.
   - **Tauri**: Packaged for desktop (Windows, macOS, Linux).

---

## 🚀 Quick Start

### 1. Backend (FastAPI)
```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
# source venv/bin/activate

pip install -r requirements.txt

# Run server on http://localhost:8000
python -m uvicorn app.main:app --reload --port 8000
```

### 2. Frontend (Next.js)
```bash
cd frontend
npm install

# Run dev server on http://localhost:3000
npm run dev

# Or build static export bundle for Capacitor/Tauri:
npm run build
```

---

## 🧪 Running Automated Tests

```bash
cd backend
venv\Scripts\pytest
```

---

## 🗄️ Supabase PostgreSQL Setup

Copy the SQL statements in [`supabase/schema.sql`](file:///e:/2026%20Projects/Aral.ai/supabase/schema.sql) and run them inside your Supabase project's SQL Editor to set up tables, indexes, and Row Level Security (RLS) policies.
