import {
  User,
  Document,
  Session,
  SessionEndPayload,
  SessionStatus,
  Notes,
  Flashcard,
  QuizAttempt,
  ChatMessage,
  PomodoroStats,
  PomodoroSettings,
  KnowledgeResult,
  SessionSnapshot,
  NoteContent,
  QuizQuestion,
  Exam,
  ExamInput,
  DashboardSummary,
  AuthSession
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
}

class ApiClient {
  private cache = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<unknown>>();

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('aral_auth_token');
  }

  private getHeaders(contentType: string | null = 'application/json'): HeadersInit {
    const headers: Record<string, string> = {};
    const token = this.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    return headers;
  }

  /** Invalidate in-memory cache entries matching prefix, or all if no prefix provided. */
  public invalidateCache(prefix?: string): void {
    if (!prefix) {
      this.cache.clear();
      return;
    }
    this.cache.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    });
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      ...this.getHeaders(options.body instanceof FormData ? null : 'application/json'),
      ...options.headers
    };

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), 60000);
    const signal = options.signal || controller.signal;

    let res: Response;
    try {
      res = await fetch(url, {
        ...options,
        headers,
        signal
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Request timed out while connecting to ${url}`);
      }
      if (
        err instanceof TypeError ||
        (err?.message && /failed to fetch|networkerror|load failed/i.test(err.message))
      ) {
        throw new Error(
          `Unable to connect to Aral.ai API at ${API_BASE}. If running locally, please ensure the backend is started (e.g. run "python start_dev.py" or "python -m uvicorn app.main:app --port 8000").`
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutTimer);
    }

    if (!res.ok) {
      let errorMessage = `API Error: ${res.status} ${res.statusText}`;
      try {
        const errorData = await res.json();
        if (typeof errorData.detail === 'string') errorMessage = errorData.detail;
        else if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail
            .map((item: { msg?: string }) => item?.msg)
            .filter(Boolean)
            .join(' ');
        }
      } catch (e) {
        // use default
      }
      throw new Error(errorMessage);
    }

    return res.json() as Promise<T>;
  }

  /**
   * Cached GET request with in-flight deduplication and short TTL.
   * Eliminates redundant network queries across page navigation.
   */
  private async cachedRequest<T>(endpoint: string, ttlMs = 20000): Promise<T> {
    const now = Date.now();
    const existing = this.cache.get(endpoint);
    if (existing && now - existing.timestamp < existing.ttl) {
      return existing.data as T;
    }

    if (this.inFlight.has(endpoint)) {
      return this.inFlight.get(endpoint) as Promise<T>;
    }

    const promise = (async () => {
      try {
        const data = await this.request<T>(endpoint);
        this.cache.set(endpoint, { data, timestamp: Date.now(), ttl: ttlMs });
        return data;
      } finally {
        this.inFlight.delete(endpoint);
      }
    })();

    this.inFlight.set(endpoint, promise as Promise<unknown>);
    return promise;
  }

  // ---------------------------------------------------------------------------
  // Auth & System Status
  // ---------------------------------------------------------------------------
  async getMe(): Promise<User & { has_supabase: boolean; has_gemini: boolean; gemini_model: string }> {
    return this.cachedRequest('/auth/me', 15000);
  }

  async updateProfile(payload: {
    display_name?: string | null;
    bio?: string | null;
    gender?: string | null;
    theme?: string | null;
  }): Promise<User & { has_supabase: boolean; has_gemini: boolean; gemini_model: string }> {
    this.invalidateCache('/auth');
    return this.request('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  }

  async uploadAvatar(file: File): Promise<User & { has_supabase: boolean; has_gemini: boolean; gemini_model: string }> {
    this.invalidateCache('/auth');
    const formData = new FormData();
    formData.append('file', file);
    return this.request('/auth/avatar', {
      method: 'POST',
      body: formData
    });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean; message: string }> {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
    });
  }

  async changeEmail(email: string): Promise<{ ok: boolean; message: string }> {
    return this.request('/auth/change-email', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  async signup(email: string, password: string): Promise<AuthSession> {
    return this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  async login(email: string, password: string): Promise<AuthSession> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  async loginWithGoogle(credential: string): Promise<AuthSession> {
    return this.request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential })
    });
  }

  async forgotPassword(email: string): Promise<{ ok: boolean; message: string }> {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  async resendConfirmation(email: string): Promise<{ ok: boolean; message: string }> {
    return this.request('/auth/resend-confirmation', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  async resetPassword(password: string): Promise<{ ok: boolean; message: string }> {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
  }

  async exchangeCode(code: string): Promise<AuthSession> {
    return this.request('/auth/exchange-code', {
      method: 'POST',
      body: JSON.stringify({ code })
    });
  }

  async getSystemStatus(): Promise<any> {
    return this.request('/auth/status');
  }

  async uploadDocument(
    file: File,
    onProgress?: (progress: { percent: number; loaded: number; total: number }) => void
  ): Promise<Document> {
    this.invalidateCache('/documents');
    return new Promise<Document>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${API_BASE}/documents/upload`;
      xhr.open('POST', url);

      const token = this.getToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && event.total > 0) {
            const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
            onProgress({
              percent,
              loaded: event.loaded,
              total: event.total
            });
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText) as Document;
            this.invalidateCache('/documents');
            resolve(data);
          } catch {
            reject(new Error('Invalid JSON response from server'));
          }
        } else {
          let errorMessage = `API Error: ${xhr.status} ${xhr.statusText}`;
          try {
            const errorData = JSON.parse(xhr.responseText);
            if (typeof errorData.detail === 'string') errorMessage = errorData.detail;
            else if (Array.isArray(errorData.detail)) {
              errorMessage = errorData.detail
                .map((item: { msg?: string }) => item?.msg)
                .filter(Boolean)
                .join(' ');
            }
          } catch {
            // keep fallback
          }
          reject(new Error(errorMessage));
        }
      };

      xhr.onerror = () => {
        reject(
          new Error(
            `Unable to connect to Aral.ai API at ${API_BASE}. If running locally, please ensure the backend is started (e.g. run "python start_dev.py" or "python -m uvicorn app.main:app --port 8000"). If using a remote backend, verify NEXT_PUBLIC_API_URL in frontend/.env.local.`
          )
        );
      };

      xhr.ontimeout = () => {
        reject(new Error('Document upload request timed out. Please try again.'));
      };

      const formData = new FormData();
      formData.append('file', file);
      xhr.send(formData);
    });
  }

  async getDocuments(): Promise<Document[]> {
    return this.cachedRequest<Document[]>('/documents', 15000);
  }

  async getDocument(id: string): Promise<Document> {
    return this.cachedRequest<Document>(`/documents/${id}`, 30000);
  }

  /**
   * Raw file bytes. The route is user-scoped, so it needs the auth header —
   * callers render the result through an object URL rather than a bare `src`.
   */
  async fetchDocumentFile(documentId: string): Promise<Blob> {
    const res = await fetch(`${API_BASE}/documents/${documentId}/file`, {
      headers: this.getHeaders(null)
    });
    if (!res.ok) throw new Error(`Failed to load document file (${res.status})`);
    return res.blob();
  }

  async updateDocument(documentId: string, updates: { filename?: string }): Promise<Document> {
    this.invalidateCache('/documents');
    this.invalidateCache(`/documents/${documentId}`);
    this.invalidateCache('/sessions');
    this.invalidateCache('/dashboard');
    this.invalidateCache('/exams');
    return this.request<Document>(`/documents/${documentId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  async deleteDocument(documentId: string): Promise<{ ok: boolean; message: string }> {
    this.invalidateCache('/documents');
    this.invalidateCache(`/documents/${documentId}`);
    this.invalidateCache('/sessions');
    this.invalidateCache('/dashboard');
    this.invalidateCache('/exams');
    return this.request<{ ok: boolean; message: string }>(`/documents/${documentId}`, {
      method: 'DELETE'
    });
  }

  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------
  async createSession(title: string, documentId?: string | null): Promise<Session> {
    this.invalidateCache('/sessions');
    this.invalidateCache('/dashboard');
    return this.request<Session>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ title, document_id: documentId || null })
    });
  }

  async getSessions(query?: string): Promise<Session[]> {
    const q = query ? `?q=${encodeURIComponent(query)}` : '';
    if (!query) {
      return this.cachedRequest<Session[]>('/sessions', 15000);
    }
    return this.request<Session[]>(`/sessions${q}`);
  }

  async getSessionSnapshot(sessionId: string): Promise<SessionSnapshot> {
    return this.request<SessionSnapshot>(`/sessions/${sessionId}/snapshot`);
  }

  async updateSession(sessionId: string, updates: { title?: string; status?: SessionStatus }): Promise<Session> {
    this.invalidateCache('/sessions');
    this.invalidateCache('/dashboard');
    return this.request<Session>(`/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  /** Close out a session: flip status, stamp ended_at, and sync final focus/review metrics. */
  async endSession(sessionId: string, payload: SessionEndPayload = {}): Promise<Session> {
    this.invalidateCache('/sessions');
    this.invalidateCache('/dashboard');
    return this.request<Session>(`/sessions/${sessionId}/end`, {
      method: 'POST',
      body: JSON.stringify({
        status: payload.status || 'inactive',
        total_focus_seconds: Math.max(0, Math.round(payload.total_focus_seconds || 0)),
        cards_reviewed: Math.max(0, Math.round(payload.cards_reviewed || 0))
      })
    });
  }

  async deleteSession(sessionId: string): Promise<{ status: string; message: string }> {
    this.invalidateCache('/sessions');
    this.invalidateCache('/dashboard');
    return this.request<{ status: string; message: string }>(`/sessions/${sessionId}`, {
      method: 'DELETE'
    });
  }

  async searchKnowledge(query: string): Promise<KnowledgeResult[]> {
    return this.request<KnowledgeResult[]>(`/sessions/search/knowledge?q=${encodeURIComponent(query)}`);
  }

  // ---------------------------------------------------------------------------
  // Notes
  // ---------------------------------------------------------------------------
  async generateNotes(sessionId: string, scope = 'full document'): Promise<Notes> {
    this.invalidateCache('/sessions');
    return this.request<Notes>(`/sessions/${sessionId}/notes/generate?scope=${encodeURIComponent(scope)}`, {
      method: 'POST'
    });
  }

  async updateNotes(sessionId: string, content: NoteContent, scope = 'custom edit'): Promise<Notes> {
    return this.request<Notes>(`/sessions/${sessionId}/notes`, {
      method: 'PUT',
      body: JSON.stringify({ content, scope })
    });
  }

  // ---------------------------------------------------------------------------
  // Flashcards
  // ---------------------------------------------------------------------------
  async generateFlashcards(sessionId: string, count = 8): Promise<Flashcard[]> {
    return this.request<Flashcard[]>(`/sessions/${sessionId}/flashcards/generate?count=${count}`, {
      method: 'POST'
    });
  }

  async getFlashcards(sessionId: string): Promise<Flashcard[]> {
    return this.request<Flashcard[]>(`/sessions/${sessionId}/flashcards`);
  }

  async createFlashcard(sessionId: string, front: string, back: string): Promise<Flashcard> {
    return this.request<Flashcard>(`/sessions/${sessionId}/flashcards`, {
      method: 'POST',
      body: JSON.stringify({ front, back })
    });
  }

  async reviewFlashcard(sessionId: string, cardId: string, rating: string): Promise<Flashcard> {
    return this.request<Flashcard>(`/sessions/${sessionId}/flashcards/${cardId}/review?rating=${rating}`, {
      method: 'POST'
    });
  }

  // ---------------------------------------------------------------------------
  // Quizzes
  // ---------------------------------------------------------------------------
  async generateQuiz(sessionId: string, quizType: string, questionCount = 5): Promise<{ quiz_type: string; questions: QuizQuestion[] }> {
    return this.request(`/sessions/${sessionId}/quizzes/generate`, {
      method: 'POST',
      body: JSON.stringify({ quiz_type: quizType, question_count: questionCount })
    });
  }

  async submitQuiz(
    sessionId: string,
    quizType: string,
    questions: QuizQuestion[],
    answers: Record<string, any>
  ): Promise<QuizAttempt> {
    return this.request<QuizAttempt>(`/sessions/${sessionId}/quizzes/submit?quiz_type=${quizType}`, {
      method: 'POST',
      body: JSON.stringify({ questions, submission: { answers } })
    });
  }

  // ---------------------------------------------------------------------------
  // Real-time Chat (SSE Stream)
  // ---------------------------------------------------------------------------
  async streamChat(
    sessionId: string,
    message: string,
    onToken: (token: string) => void,
    onComplete: (msg: ChatMessage) => void,
    onError: (err: any) => void
  ) {
    const url = `${API_BASE}/sessions/${sessionId}/chat`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.getHeaders('application/json'),
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({ content: message })
      });

      if (!response.ok || !response.body) {
        let message = `Chat stream error: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (typeof errorData.detail === 'string') message = errorData.detail;
        } catch {
          // keep default
        }
        throw new Error(message);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.token) {
                onToken(data.token);
              }
              if (data.done && data.message) {
                onComplete(data.message);
              }
              if (data.error) {
                onError(data.error);
              }
            } catch (e) {
              // ignore json parse chunk
            }
          }
        }
      }
    } catch (err: any) {
      if (
        err instanceof TypeError ||
        (err?.message && /failed to fetch|networkerror|load failed/i.test(err.message))
      ) {
        onError(
          new Error(
            `Unable to connect to Aral.ai API at ${API_BASE}. If running locally, please ensure the backend is started (e.g. run "python start_dev.py" or "python -m uvicorn app.main:app --port 8000"). If using a remote backend, verify NEXT_PUBLIC_API_URL in frontend/.env.local.`
          )
        );
      } else {
        onError(err);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Pomodoro
  // ---------------------------------------------------------------------------
  async logPomodoro(durationMinutes: number, sessionId?: string | null, completed = true) {
    this.invalidateCache('/pomodoro');
    this.invalidateCache('/dashboard');
    return this.request('/pomodoro/log', {
      method: 'POST',
      body: JSON.stringify({ duration_minutes: durationMinutes, session_id: sessionId || null, completed })
    });
  }

  async getPomodoroStats(sessionId?: string): Promise<PomodoroStats> {
    const q = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : '';
    return this.request<PomodoroStats>(`/pomodoro/stats${q}`);
  }

  async getPomodoroSettings(): Promise<PomodoroSettings> {
    return this.cachedRequest<PomodoroSettings>('/pomodoro/settings', 60000);
  }

  async updatePomodoroSettings(settings: Partial<PomodoroSettings>): Promise<PomodoroSettings> {
    this.invalidateCache('/pomodoro');
    return this.request<PomodoroSettings>('/pomodoro/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  }

  // ---------------------------------------------------------------------------
  // Exams & Dashboard
  // ---------------------------------------------------------------------------
  async getExams(): Promise<Exam[]> {
    return this.cachedRequest<Exam[]>('/exams', 20000);
  }

  async createExam(payload: ExamInput): Promise<Exam> {
    this.invalidateCache('/exams');
    this.invalidateCache('/dashboard');
    return this.request<Exam>('/exams', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async updateExam(examId: string, payload: Partial<ExamInput>): Promise<Exam> {
    this.invalidateCache('/exams');
    this.invalidateCache('/dashboard');
    return this.request<Exam>(`/exams/${examId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  }

  async deleteExam(examId: string): Promise<{ status: string; message: string }> {
    this.invalidateCache('/exams');
    this.invalidateCache('/dashboard');
    return this.request(`/exams/${examId}`, { method: 'DELETE' });
  }

  async getDashboardSummary(): Promise<DashboardSummary> {
    return this.cachedRequest<DashboardSummary>('/dashboard/summary', 15000);
  }
}

export const api = new ApiClient();
