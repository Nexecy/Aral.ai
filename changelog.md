# Changelog

All notable changes to Aral.ai are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.4] — 2026-09-12

### Added
- Google Cloud Run deploy path for the FastAPI API: `backend/Dockerfile`, `backend/cloudrun.yaml`, and `python scripts/deploy_cloudrun.py`.
- Hosted-runtime detection for Cloud Run (`K_SERVICE` / `CLOUD_RUN_JOB`) so anonymous `demo-token` auth stays disabled off-localhost.

### Changed
- Cloud Run service defaults: 2 GiB RAM, 900s timeout, CPU always allocated (so PDF parse after HTTP 202 can finish), scale-to-zero, `us-central1` free-tier region.
- Public Cloud Run access uses `--no-invoker-iam-check` instead of `allUsers` IAM, so org domain-restricted sharing does not block the deploy.
- Production API origin is `https://aral-ai-api-686935671952.us-central1.run.app`.

## [1.0.3] — 2026-09-08

### Added
- Stack health endpoint fields (`environment`, `hosted`, `anonymous_auth`, `frontend_origin`) and `scripts/check_stack.py` for local and hosted pass/fail checks.
- GitHub Actions CI: backend pytest plus a Vercel-mode Next.js production build.
- `render.yaml` with `/api/health` as the Render health check path.

### Changed
- CORS now uses `settings.cors_origins_list` (localhost 3000/3005, custom domains, production frontend) plus a `*.vercel.app` regex for preview deployments.
- Dev frontend port is consistently **3005** (README, Tauri `devUrl`, env examples, `start_dev.py`).
- Production Vercel builds fall back to the hosted Render API instead of `localhost` when `NEXT_PUBLIC_API_URL` is missing.
- `start_dev.py` waits for API health before considering the stack ready.

### Security
- Hosted/production APIs no longer accept missing Bearer tokens or the local `demo-token` identity.

## [1.0.2] — 2026-09-07

### Added
- Law school & jurisprudence note extractor:
  - Automatic classification of legal material (court jurisprudence, case digests, statutes, codal outlines).
  - Case identification with FIRAC digest extraction: Case Name, Citation / G.R. No., Ponente, Date, Facts, Issue, Ruling / Ratio Decidendi, and Doctrine Applied.
  - Legal doctrine extraction: Statement of rule of law, numbered Requisites / Elements, recognized Exceptions, statutory basis, and landmark supporting cases.
  - Dynamic heuristic fallback parsing for offline/local extraction of case briefs and doctrines from raw legal texts.
  - Dedicated Law Reviewer UI in `NotesReviewEditor`: Case brief cards, 1-click Copy Digest to clipboard, numbered Requisites checklist, and law school sub-tabs.
  - Law-specific flashcards testing case holdings and doctrine elements, bar-style scenario quizzes, and IRAC-guided AI tutor chat.
  - Automated test suite in `tests/test_law_notes.py` validating legal detection, heuristic extraction, flashcards/quiz generation, and API review roundtrip.

## [1.0.1] — 2026-09-05

### Added
- Dedicated Google API Services and User Data Policy compliance disclosures in `/privacy`
- Added Google Account access revocation instructions via Google Security Settings
- Exposed public access to `/privacy` without authentication requirement
- Linked Privacy Policy and Terms of Service directly on auth and social login interfaces
- Google Search Console site ownership verification asset

## [1.0.0] — 2026-08-31

Initial public-scale release of Aral.ai: a Next.js + FastAPI study app for notes, flashcards, quizzes, tutoring, focus timing, and exam tracking.

### Added

#### Study pipeline
- Document upload with text extraction for PDF, Word/TXT, Markdown, and images (OCR), stored in Supabase Storage with a local filesystem fallback
- Gemini JSON-mode structured notes (title, summary, headings, subpoints, key terms)
- Editable notes review before flashcards or quizzes are unlocked
- 3D flip flashcards with keyboard navigation, shuffle, mastery rating, and sound feedback
- Quiz arena with multiple choice, identification, and concept matching, plus scoring, explanations, and completion fanfare
- Session-scoped AI tutor chat over Server-Sent Events (token streaming)
- Study sessions with active / inactive / completed lifecycle, focus time, and cards-reviewed totals
- Session history and workspace snapshot (notes, cards, quizzes, chat)

#### Focus and exams
- Global Pomodoro widget (study / short break / long break), chimes, browser notifications, and cycle logging
- Exam calendar with colour-coded dates, countdowns, and document linking
- Dashboard summary: streak, focus minutes, session count, nearest-exam countdown
- Returning-user dashboard layout: welcome strip, stats row, start-new-pass uploader, upcoming exams list
- Empty-state dashboard: brand hero, first-upload drop zone, add-exam call to action

#### Auth and account
- Email/password signup and login via Supabase Auth (local auth fallback for development)
- Email confirmation, resend confirmation, forgot password, and reset password
- Terms of use acceptance on signup
- Unverified accounts can sign in but AI study tools stay gated until the address is confirmed
- Profile under Settings: display name, optional bio, optional gender (including “prefer not to say”), avatar upload
- Change password (current + new + confirm) and change email (re-verification handled by Supabase)
- Custom HTML email templates for signup, magic link, invite, reset, change-email, and change notifications
- JWKS verification of Supabase ES256 access tokens

#### Shell and preferences
- Collapsible sidebar with pill-tab toggle on the rail edge; auto-collapse below 1024px; mobile bottom nav
- Top-nav notification bell (Pomodoro complete, quiz graded, exam reminders; empty state: “No notifications yet”)
- Top-nav avatar menu: picture + display name, Settings/Profile, theme toggle, sign out
- Notion Warm Paper and Calm Dark Slate themes
- Global knowledge search, keyboard shortcuts, and settings for appearance, AI/backend status, focus defaults, and platforms
- Cross-platform packaging path: Next.js static export, Capacitor (iOS/Android), Tauri (desktop)

#### Data
- Supabase schema and RLS for documents, sessions, notes, flashcards, quiz attempts, chat, Pomodoro logs, and exams
- `profiles` table (`display_name`, `avatar_url`, `bio`, `gender`) and public `avatars` storage bucket
- In-memory / local fallbacks when Supabase is not configured
- Backend API tests covering auth, sessions, notes, and profile updates

### Fixed

- Session recovery only restores sessions that belong to the signed-in user
- Auth email redirects come from the backend `redirect_to` / `email_redirect_to` values instead of hardcoded URLs in templates
- Collapsed sidebar icons sit centered in the rail
- Exam colour swatches are safelisted so Tailwind does not strip them from the calendar
- Notification bell and profile avatar in the top nav are interactive (they were decorative)
- Uploaded avatars replace the initials circle in the top-right nav and sidebar
- Empty display name does not block the rest of the app; it is only required when saving the profile form
- AI generate/chat/quiz routes reject unverified emails on both the API and the UI

### Security

- Row Level Security on user-owned tables; avatar objects are readable publicly and writable only in the owner’s folder
- Passwords are updated only after the current password is verified
- Email changes require confirmation of the new address
