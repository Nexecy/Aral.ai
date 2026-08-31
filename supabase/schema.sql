-- ==============================================================================
-- Aral.ai — Database Schema (Supabase PostgreSQL)
-- ==============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Documents Table
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    page_count INT DEFAULT 1,
    extracted_text TEXT DEFAULT '',
    file_size_bytes BIGINT DEFAULT 0
);

-- 2. Sessions Table
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    started_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    ended_at TIMESTAMPTZ,
    last_accessed_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    total_focus_seconds INT NOT NULL DEFAULT 0,
    cards_reviewed INT NOT NULL DEFAULT 0
);

-- 2b. Sessions lifecycle migration (idempotent — safe on pre-existing databases)
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS total_focus_seconds INT NOT NULL DEFAULT 0;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS cards_reviewed INT NOT NULL DEFAULT 0;

DO $$
BEGIN
    ALTER TABLE public.sessions
        ADD CONSTRAINT sessions_status_check CHECK (status IN ('active', 'inactive', 'completed'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

-- 3. Notes Table
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    scope TEXT DEFAULT 'full document',
    generated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Flashcards Table
CREATE TABLE IF NOT EXISTS public.flashcards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. Quiz Attempts Table
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    quiz_type TEXT NOT NULL, -- 'multiple_choice', 'identification', 'matching'
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    user_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    score NUMERIC(5, 2) DEFAULT 0.0,
    total_questions INT DEFAULT 0,
    completed_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. Chat Messages Table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 7. Pomodoro Logs Table
CREATE TABLE IF NOT EXISTS public.pomodoro_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 25,
    completed BOOLEAN NOT NULL DEFAULT TRUE
);

-- 8. Exams Table
CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    exam_date DATE NOT NULL,
    color TEXT NOT NULL DEFAULT 'blue',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ==============================================================================
-- Indexes for High Performance Querying
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_exams_user_date ON public.exams(user_id, exam_date ASC);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_accessed ON public.sessions(last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notes_session_id ON public.notes(session_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_session_id ON public.flashcards(session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_session_id ON public.quiz_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON public.chat_messages(session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_pomodoro_logs_user_id ON public.pomodoro_logs(user_id, started_at DESC);

-- ==============================================================================
-- Row Level Security (RLS) Policies
-- ==============================================================================
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pomodoro_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

-- Postgres has no CREATE POLICY ... IF NOT EXISTS, so each policy is dropped
-- first to keep this whole file safely re-runnable.

-- Documents RLS
DROP POLICY IF EXISTS "Users can manage own documents" ON public.documents;
CREATE POLICY "Users can manage own documents" ON public.documents
    FOR ALL USING (auth.uid() = user_id);

-- Sessions RLS
DROP POLICY IF EXISTS "Users can manage own sessions" ON public.sessions;
CREATE POLICY "Users can manage own sessions" ON public.sessions
    FOR ALL USING (auth.uid() = user_id);

-- Notes RLS (via session ownership)
DROP POLICY IF EXISTS "Users can manage notes of own sessions" ON public.notes;
CREATE POLICY "Users can manage notes of own sessions" ON public.notes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.sessions 
            WHERE public.sessions.id = public.notes.session_id 
            AND public.sessions.user_id = auth.uid()
        )
    );

-- Flashcards RLS (via session ownership)
DROP POLICY IF EXISTS "Users can manage flashcards of own sessions" ON public.flashcards;
CREATE POLICY "Users can manage flashcards of own sessions" ON public.flashcards
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.sessions 
            WHERE public.sessions.id = public.flashcards.session_id 
            AND public.sessions.user_id = auth.uid()
        )
    );

-- Quiz Attempts RLS (via session ownership)
DROP POLICY IF EXISTS "Users can manage quiz attempts of own sessions" ON public.quiz_attempts;
CREATE POLICY "Users can manage quiz attempts of own sessions" ON public.quiz_attempts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.sessions 
            WHERE public.sessions.id = public.quiz_attempts.session_id 
            AND public.sessions.user_id = auth.uid()
        )
    );

-- Chat Messages RLS (via session ownership)
DROP POLICY IF EXISTS "Users can manage chat messages of own sessions" ON public.chat_messages;
CREATE POLICY "Users can manage chat messages of own sessions" ON public.chat_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.sessions 
            WHERE public.sessions.id = public.chat_messages.session_id 
            AND public.sessions.user_id = auth.uid()
        )
    );

-- Pomodoro Logs RLS
DROP POLICY IF EXISTS "Users can manage own pomodoro logs" ON public.pomodoro_logs;
CREATE POLICY "Users can manage own pomodoro logs" ON public.pomodoro_logs
    FOR ALL USING (auth.uid() = user_id);

-- Exams RLS
DROP POLICY IF EXISTS "Users can manage own exams" ON public.exams;
CREATE POLICY "Users can manage own exams" ON public.exams
    FOR ALL USING (auth.uid() = user_id);

-- 9. Profiles Table (1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    gender TEXT,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
CREATE POLICY "Users can manage own profile" ON public.profiles
    FOR ALL
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Avatar images are publicly readable" ON storage.objects;
CREATE POLICY "Avatar images are publicly readable"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
