# Changelog

All notable changes to Aral.ai are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
