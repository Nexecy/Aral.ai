export interface User {
  id: string;
  email: string;
  is_demo?: boolean;
  email_verified?: boolean;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  gender?: string | null;
}

export interface AuthSession {
  access_token: string | null;
  token_type: string;
  user: User;
  requires_confirmation: boolean;
  email_verified?: boolean;
  message?: string | null;
}

export interface Document {
  id: string;
  user_id: string;
  filename: string;
  storage_path: string;
  uploaded_at: string;
  page_count: number;
  extracted_text?: string;
  file_size_bytes?: number;
}

export type SessionStatus = 'active' | 'inactive' | 'completed';

export interface Session {
  id: string;
  user_id: string;
  document_id?: string | null;
  title: string;
  status: SessionStatus;
  created_at: string;
  started_at?: string | null;
  ended_at?: string | null;
  last_accessed_at: string;
  total_focus_seconds: number;
  cards_reviewed: number;
  document?: Document | null;
}

export interface SessionEndPayload {
  status?: SessionStatus;
  total_focus_seconds?: number;
  cards_reviewed?: number;
}

export interface KeyTerm {
  term: string;
  definition: string;
}

export interface NoteSection {
  heading: string;
  subpoints: string[];
  key_terms: KeyTerm[];
}

export interface NoteContent {
  title: string;
  summary: string;
  sections: NoteSection[];
}

export interface Notes {
  id: string;
  session_id: string;
  content: NoteContent;
  scope: string;
  generated_at: string;
  updated_at: string;
}

export interface Flashcard {
  id: string;
  session_id: string;
  front: string;
  back: string;
  order_index: number;
  rating?: 'again' | 'hard' | 'good' | 'easy';
  ease_factor?: number;
  review_count?: number;
  next_review_at?: string;
  created_at: string;
}

export interface MatchingPair {
  left: string;
  right: string;
}

export interface QuizQuestion {
  id: string;
  type: 'multiple_choice' | 'identification' | 'matching';
  question: string;
  options?: string[];
  correct_answer: string | Record<string, string> | string[];
  explanation?: string;
  matching_pairs?: MatchingPair[];
}

export interface QuestionResult {
  question_id: string;
  question: string;
  user_answer: any;
  correct_answer: any;
  is_correct: boolean;
  explanation: string;
}

export interface QuizAttempt {
  id: string;
  session_id: string;
  quiz_type: string;
  questions: QuizQuestion[];
  user_answers: Record<string, any>;
  score: number;
  total_questions: number;
  completed_at: string;
  results?: QuestionResult[];
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface PomodoroLog {
  id: string;
  user_id: string;
  session_id?: string | null;
  started_at: string;
  duration_minutes: number;
  completed: boolean;
}

export interface PomodoroStats {
  total_cycles_completed: number;
  total_study_minutes: number;
  session_study_minutes: number;
}

export interface PomodoroSettings {
  id: string;
  user_id: string;
  study_minutes: number;
  short_break_minutes: number;
  long_break_minutes: number;
  cycles_before_long_break: number;
  auto_start_next: boolean;
  sound_enabled: boolean;
  sound_choice: string;
}

export type ExamColor = 'blue' | 'purple' | 'pink' | 'orange' | 'teal' | 'green';

export interface Exam {
  id: string;
  user_id: string;
  title: string;
  /** ISO calendar date (YYYY-MM-DD), not a timestamp. */
  exam_date: string;
  document_id?: string | null;
  color: ExamColor;
  notes?: string | null;
  created_at: string;
  /** Negative once the exam date has passed. */
  days_remaining: number;
}

export interface ExamInput {
  title: string;
  exam_date: string;
  document_id?: string | null;
  color?: ExamColor;
  notes?: string | null;
}

export interface DashboardSummary {
  has_data: boolean;
  total_sessions: number;
  active_sessions: number;
  total_documents: number;
  total_focus_minutes: number;
  total_cycles_completed: number;
  study_streak_days: number;
  latest_session_id: string | null;
  latest_session_title: string | null;
  nearest_exam: Exam | null;
  days_until_nearest_exam: number | null;
}

export interface KnowledgeResult {
  type: 'note' | 'flashcard' | 'session';
  title: string;
  snippet: string;
  session_id: string;
  session_title: string;
}

export interface SessionSnapshot {
  session: Session;
  document?: Document | null;
  notes?: Notes | null;
  flashcards: Flashcard[];
  quiz_attempts: QuizAttempt[];
  chat_history: ChatMessage[];
}

export interface JobProgressEvent {
  step: string;
  progress: number;
  message: string;
  result?: any;
}
