'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  CalendarPlus,
  FileText,
  Loader2,
  Pencil
} from 'lucide-react';
import { ExamCalendar } from '@/components/exams/ExamCalendar';
import { ExamFormDialog } from '@/components/exams/ExamFormDialog';
import { Document, Exam, ExamInput, Session } from '@/lib/types';
import { api } from '@/lib/api';
import {
  examColor,
  formatCountdown,
  formatExamDate,
  fromDateKey,
  toDateKey
} from '@/lib/examColors';

export default function CalendarPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);

  const load = useCallback(async () => {
    try {
      const [examData, docData, sessionData] = await Promise.all([
        api.getExams(),
        api.getDocuments(),
        api.getSessions()
      ]);
      setExams(examData);
      setDocuments(docData);
      setSessions(sessionData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your exams.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const todayKey = toDateKey(new Date());
  const upcoming = useMemo(() => exams.filter((e) => e.days_remaining >= 0), [exams]);
  const past = useMemo(
    () => exams.filter((e) => e.days_remaining < 0).reverse(),
    [exams]
  );

  const selectedExams = useMemo(
    () => (selectedDate ? exams.filter((e) => e.exam_date.slice(0, 10) === selectedDate) : []),
    [exams, selectedDate]
  );

  /** Session that opens the document an exam is linked to, if one exists. */
  const sessionForDocument = useCallback(
    (documentId?: string | null) =>
      documentId ? sessions.find((s) => s.document_id === documentId) ?? null : null,
    [sessions]
  );

  const openCreate = (dateKey?: string) => {
    setEditingExam(null);
    setSelectedDate(dateKey ?? selectedDate ?? todayKey);
    setDialogOpen(true);
  };

  const openEdit = (exam: Exam) => {
    setEditingExam(exam);
    setDialogOpen(true);
  };

  const handleSubmit = async (payload: ExamInput) => {
    if (editingExam) await api.updateExam(editingExam.id, payload);
    else await api.createExam(payload);
    await load();
  };

  const handleDelete = async (exam: Exam) => {
    await api.deleteExam(exam.id);
    await load();
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm font-semibold text-muted-foreground">Loading your exam calendar…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap p-5 sm:p-6 rounded-2xl bg-card border border-border shadow-notion-soft">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
              Exam Calendar
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {upcoming.length > 0
                ? `${upcoming.length} upcoming ${upcoming.length === 1 ? 'exam' : 'exams'}`
                : 'No upcoming exams scheduled'}
            </p>
          </div>
        </div>

        <button
          onClick={() => openCreate()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-on-primary text-xs font-bold hover:bg-primary-container transition-colors shadow-sm"
        >
          <CalendarPlus className="w-4 h-4" />
          Add exam
        </button>
      </div>

      {error && (
        <p className="text-xs text-destructive font-medium bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2">
          <ExamCalendar
            month={month}
            exams={exams}
            selectedDate={selectedDate}
            onMonthChange={setMonth}
            onSelectDate={(key) => {
              setSelectedDate(key);
              const asDate = fromDateKey(key);
              if (asDate.getMonth() !== month.getMonth()) setMonth(asDate);
            }}
          />
        </div>

        <div className="space-y-5">
          {/* Details for the selected day */}
          {selectedDate && (
            <section className="p-5 rounded-2xl bg-card border border-border shadow-notion-soft space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-foreground">
                  {formatExamDate(selectedDate)}
                </h2>
                <button
                  onClick={() => openCreate(selectedDate)}
                  className="text-[11px] font-bold text-primary hover:underline"
                >
                  Add here
                </button>
              </div>

              {selectedExams.length === 0 ? (
                <p className="text-xs text-muted-foreground">No exams on this date.</p>
              ) : (
                selectedExams.map((exam) => {
                  const palette = examColor(exam.color);
                  const linkedSession = sessionForDocument(exam.document_id);
                  const linkedDocument = documents.find((d) => d.id === exam.document_id);

                  return (
                    <div
                      key={exam.id}
                      className={`p-3.5 rounded-xl border ${palette.border} ${palette.tint} space-y-2 ${
                        exam.days_remaining < 0 ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className={`text-sm font-bold truncate ${palette.text}`}>
                            {exam.title}
                          </h3>
                          <p className="text-[11px] font-semibold text-muted-foreground">
                            {formatCountdown(exam.days_remaining)}
                          </p>
                        </div>
                        <button
                          onClick={() => openEdit(exam)}
                          aria-label={`Edit ${exam.title}`}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card transition-colors shrink-0"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {exam.notes && (
                        <p className="text-xs text-foreground/80 leading-relaxed">{exam.notes}</p>
                      )}

                      {linkedDocument && (
                        <div className="pt-1">
                          {linkedSession ? (
                            <Link
                              href={`/session/${linkedSession.id}/`}
                              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary hover:underline"
                            >
                              <FileText className="w-3 h-3" />
                              Open {linkedDocument.filename}
                            </Link>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                              <FileText className="w-3 h-3" />
                              {linkedDocument.filename}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </section>
          )}

          {/* Upcoming list */}
          <section className="p-5 rounded-2xl bg-card border border-border shadow-notion-soft space-y-3">
            <h2 className="text-sm font-bold text-foreground">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nothing scheduled yet. Add your first exam to start a countdown.
              </p>
            ) : (
              upcoming.map((exam) => {
                const palette = examColor(exam.color);
                return (
                  <button
                    key={exam.id}
                    onClick={() => {
                      setSelectedDate(exam.exam_date.slice(0, 10));
                      setMonth(fromDateKey(exam.exam_date));
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-container-low transition-colors text-left"
                  >
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${palette.dot}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-foreground truncate">
                        {exam.title}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {formatExamDate(exam.exam_date)}
                      </span>
                    </span>
                    <span className="text-[11px] font-bold text-muted-foreground shrink-0">
                      {formatCountdown(exam.days_remaining)}
                    </span>
                  </button>
                );
              })
            )}
          </section>

          {/* Past exams are kept as a record */}
          {past.length > 0 && (
            <section className="p-5 rounded-2xl bg-card border border-border shadow-notion-soft space-y-3">
              <h2 className="text-sm font-bold text-muted-foreground">Past</h2>
              {past.map((exam) => (
                <button
                  key={exam.id}
                  onClick={() => {
                    setSelectedDate(exam.exam_date.slice(0, 10));
                    setMonth(fromDateKey(exam.exam_date));
                  }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-container-low transition-colors text-left opacity-60"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-outline" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-muted-foreground truncate">
                      {exam.title}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {formatExamDate(exam.exam_date)}
                    </span>
                  </span>
                </button>
              ))}
            </section>
          )}
        </div>
      </div>

      <ExamFormDialog
        open={dialogOpen}
        exam={editingExam}
        initialDate={selectedDate}
        documents={documents}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        onDocumentsChanged={load}
      />
    </div>
  );
}
