'use client';

import React, { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  Award, 
  RotateCcw, 
  Sparkles, 
  Loader2,
  Check,
  ArrowRight,
  ListChecks,
  Search,
  Grid,
  Lightbulb
} from 'lucide-react';
import { QuizQuestion, QuizAttempt } from '@/lib/types';
import { sound } from '@/lib/sound';
import { api } from '@/lib/api';
import { useEmailGate } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';

interface QuizArenaProps {
  sessionId: string;
  initialAttempts: QuizAttempt[];
  onAttemptSaved?: (attempt: QuizAttempt) => void;
}

export function QuizArena({
  sessionId,
  initialAttempts,
  onAttemptSaved
}: QuizArenaProps) {
  const { allowed: aiAllowed, message: aiLockMessage } = useEmailGate();
  const { addNotification } = useNotifications();
  const [selectedType, setSelectedType] = useState<string>('multiple_choice');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [generating, setGenerating] = useState<boolean>(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [currentAttempt, setCurrentAttempt] = useState<QuizAttempt | null>(
    initialAttempts && initialAttempts.length > 0 ? initialAttempts[0] : null
  );
  const [matchingSelections, setMatchingSelections] = useState<Record<string, string>>({});

  const quizTypes = [
    {
      id: 'multiple_choice',
      label: 'Multiple Choice',
      desc: 'Standard 4-option questions testing conceptual discrimination.',
      icon: ListChecks,
      accent: 'text-primary bg-sticker-sky/15'
    },
    {
      id: 'identification',
      label: 'Identification',
      desc: 'Recall exact terminology or definitions without clues.',
      icon: Search,
      accent: 'text-sticker-orange bg-sticker-orange/15'
    },
    {
      id: 'matching',
      label: 'Concept Matching',
      desc: 'Pair related terms with their definitions and mechanisms.',
      icon: Grid,
      accent: 'text-sticker-teal bg-sticker-teal/15'
    }
  ];

  const handleGenerateQuiz = async () => {
    if (!aiAllowed) {
      alert(aiLockMessage);
      return;
    }
    setGenerating(true);
    setCurrentAttempt(null);
    setUserAnswers({});
    setMatchingSelections({});
    try {
      const res = await api.generateQuiz(sessionId, selectedType, questionCount);
      setQuestions(res.questions);
    } catch (e: any) {
      alert(`Quiz generation failed: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectOption = (qId: string, option: string) => {
    setUserAnswers({ ...userAnswers, [qId]: option });
  };

  const handleIdentificationInput = (qId: string, text: string) => {
    setUserAnswers({ ...userAnswers, [qId]: text });
  };

  const handleMatchSelect = (qId: string, leftItem: string, rightItem: string) => {
    const currentMatches = { ...(userAnswers[qId] || {}) };
    currentMatches[leftItem] = rightItem;
    setUserAnswers({ ...userAnswers, [qId]: currentMatches });
  };

  const handleSubmitQuiz = async () => {
    if (questions.length === 0) return;
    setSubmitting(true);
    try {
      const attempt = await api.submitQuiz(sessionId, selectedType, questions, userAnswers);
      setCurrentAttempt(attempt);
      
      if (attempt.score >= 70) {
        sound.playSuccessFanfare();
        void import('canvas-confetti').then(({ default: confetti }) => {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });
        });
      }

      if (onAttemptSaved) onAttemptSaved(attempt);
      addNotification({
        id: `quiz-${attempt.id}`,
        kind: 'quiz',
        title: 'Quiz graded',
        body: `Score: ${Math.round(attempt.score)}% · ${attempt.total_questions} ${
          attempt.total_questions === 1 ? 'question' : 'questions'
        }`,
        href: `/session/${sessionId}/`
      });
    } catch (e: any) {
      alert(`Submission failed: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Quiz Configuration Selector */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-notion-soft space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">Quiz Evaluation Arena</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select assessment format and test your mastery directly from reviewed notes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <span>Questions:</span>
              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="bg-muted/60 text-foreground px-2.5 py-1 rounded-md border border-border text-xs focus:outline-none"
              >
                <option value={3}>3 questions</option>
                <option value={5}>5 questions</option>
                <option value={8}>8 questions</option>
                <option value={10}>10 questions</option>
              </select>
            </div>

            <button
              onClick={handleGenerateQuiz}
              disabled={generating || !aiAllowed}
              title={!aiAllowed ? aiLockMessage : undefined}
              className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center gap-2 hover:bg-primary-active shadow-sm transition-all disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{generating ? 'Generating Questions...' : 'Generate New Quiz'}</span>
            </button>
          </div>
        </div>

        {/* Quiz Type Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {quizTypes.map((t) => {
            const Icon = t.icon;
            const isSelected = selectedType === t.id;
            return (
              <div
                key={t.id}
                onClick={() => setSelectedType(t.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary'
                    : 'border-border bg-card hover:bg-muted/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-8 h-8 rounded-lg ${t.accent} flex items-center justify-center`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-primary" />}
                </div>
                <div className="font-bold text-sm text-foreground">{t.label}</div>
                <div className="text-xs text-muted-foreground mt-1 leading-snug">{t.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Results View */}
      {currentAttempt && (
        <div className="p-6 rounded-2xl bg-card border border-border shadow-notion-soft space-y-6 animate-in fade-in">
          {/* Score Header */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-border">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl shadow-sm ${
                currentAttempt.score >= 80 
                  ? 'bg-sticker-green/15 text-sticker-green' 
                  : currentAttempt.score >= 60 
                  ? 'bg-sticker-orange/15 text-sticker-orange' 
                  : 'bg-destructive/20 text-destructive'
              }`}>
                {currentAttempt.score}%
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {currentAttempt.score >= 80 ? 'Outstanding Comprehension!' : currentAttempt.score >= 60 ? 'Good Effort!' : 'Needs Review'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Completed on {new Date(currentAttempt.completed_at).toLocaleTimeString()} • {currentAttempt.total_questions} Questions Scored
                </p>
              </div>
            </div>

            <button
              onClick={() => { setCurrentAttempt(null); setQuestions([]); }}
              className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted font-semibold text-xs flex items-center gap-1.5 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retake / New Quiz</span>
            </button>
          </div>

          {/* Question-by-Question Breakdown */}
          <div className="space-y-4">
            <h4 className="font-bold text-sm text-foreground uppercase tracking-wider text-muted-foreground">
              Detailed Breakdown & Explanations
            </h4>

            {currentAttempt.results?.map((res, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border transition-all ${
                  res.is_correct
                    ? 'bg-sticker-green/10 border-sticker-green/30'
                    : 'bg-destructive/5 border-destructive/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    {res.is_correct ? (
                      <CheckCircle2 className="w-5 h-5 text-sticker-green shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <div className="font-bold text-sm text-foreground">
                        {idx + 1}. {res.question}
                      </div>
                      <div className="text-xs space-y-0.5">
                        <div className="text-muted-foreground">
                          Your Answer: <strong className={res.is_correct ? 'text-sticker-green' : 'text-destructive'}>
                            {typeof res.user_answer === 'object' ? JSON.stringify(res.user_answer) : res.user_answer || '(Empty)'}
                          </strong>
                        </div>
                        {!res.is_correct && (
                          <div className="text-muted-foreground">
                            Correct Answer: <strong className="text-primary">{typeof res.correct_answer === 'object' ? JSON.stringify(res.correct_answer) : res.correct_answer}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {res.explanation && (
                  <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground leading-relaxed pl-7">
                    <Lightbulb className="w-3.5 h-3.5 inline-block mr-1 text-foreground" />
                    <strong className="text-foreground">Explanation:</strong> {res.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Quiz Answering Sheet */}
      {!currentAttempt && questions.length > 0 && (
        <div className="p-6 rounded-2xl bg-card border border-border shadow-notion-soft space-y-8 animate-in fade-in">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Active Assessment ({questions.length} Questions)
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              Format: {selectedType.replace('_', ' ')}
            </span>
          </div>

          <div className="space-y-8">
            {questions.map((q, qIdx) => (
              <div key={q.id || qIdx} className="space-y-3 pb-6 border-b border-border last:border-b-0">
                <div className="font-bold text-base text-foreground flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-mono text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {qIdx + 1}
                  </span>
                  <span>{q.question}</span>
                </div>

                {/* Multiple Choice Options */}
                {q.type === 'multiple_choice' && q.options && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-8">
                    {q.options.map((opt, oIdx) => {
                      const isSelected = userAnswers[q.id] === opt;
                      return (
                        <div
                          key={oIdx}
                          onClick={() => handleSelectOption(q.id, opt)}
                          className={`p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                              : 'border-border bg-surface-container-low hover:bg-muted text-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                              isSelected ? 'border-primary bg-primary text-on-primary' : 'border-border'
                            }`}>
                              {String.fromCharCode(65 + oIdx)}
                            </span>
                            <span>{opt}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Identification Input */}
                {q.type === 'identification' && (
                  <div className="pl-8">
                    <input
                      type="text"
                      value={userAnswers[q.id] || ''}
                      onChange={(e) => handleIdentificationInput(q.id, e.target.value)}
                      placeholder="Type the exact term or concept name..."
                      className="w-full max-w-md text-sm bg-muted/40 p-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}

                {/* Matching Pairs */}
                {q.type === 'matching' && q.matching_pairs && (
                  <div className="space-y-2.5 pl-8">
                    {q.matching_pairs.map((pair, pIdx) => {
                      const currentSelection = (userAnswers[q.id] || {})[pair.left] || '';
                      return (
                        <div key={pIdx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl bg-surface-container-low border border-border">
                          <div className="font-bold text-xs text-foreground flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-primary" />
                            <span>{pair.left}</span>
                          </div>
                          
                          <select
                            value={currentSelection}
                            onChange={(e) => handleMatchSelect(q.id, pair.left, e.target.value)}
                            className="bg-card text-foreground px-3 py-1.5 rounded-lg border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary max-w-xs"
                          >
                            <option value="">Select matching definition...</option>
                            {q.matching_pairs?.map((p, idx) => (
                              <option key={idx} value={p.right}>
                                {p.right}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="pt-4 flex justify-end">
            <button
              onClick={handleSubmitQuiz}
              disabled={submitting}
              className="px-8 py-3 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center gap-2 hover:bg-primary-active shadow-md transition-all"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{submitting ? 'Evaluating Submission...' : 'Submit Answers & View Score'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
