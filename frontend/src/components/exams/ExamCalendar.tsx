'use client';

import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Exam } from '@/lib/types';
import { examColor, toDateKey } from '@/lib/examColors';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface ExamCalendarProps {
  /** Any date inside the month being displayed. */
  month: Date;
  exams: Exam[];
  selectedDate: string | null;
  onMonthChange: (month: Date) => void;
  onSelectDate: (dateKey: string) => void;
}

interface DayCell {
  key: string;
  date: Date;
  inMonth: boolean;
}

/** Six full weeks so the grid height never jumps between months. */
function buildGrid(month: Date): DayCell[] {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    return {
      key: toDateKey(date),
      date,
      inMonth: date.getMonth() === month.getMonth()
    };
  });
}

export function ExamCalendar({
  month,
  exams,
  selectedDate,
  onMonthChange,
  onSelectDate
}: ExamCalendarProps) {
  const cells = useMemo(() => buildGrid(month), [month]);
  const todayKey = toDateKey(new Date());

  const examsByDate = useMemo(() => {
    const map = new Map<string, Exam[]>();
    for (const exam of exams) {
      const key = exam.exam_date.slice(0, 10);
      const bucket = map.get(key);
      if (bucket) bucket.push(exam);
      else map.set(key, [exam]);
    }
    return map;
  }, [exams]);

  const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const shiftMonth = (delta: number) =>
    onMonthChange(new Date(month.getFullYear(), month.getMonth() + delta, 1));

  return (
    <div className="rounded-2xl bg-card border border-border shadow-notion-soft overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-border">
        <h2 className="text-sm sm:text-base font-bold text-foreground">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-container transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onMonthChange(new Date())}
            className="px-3 h-8 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-container transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-container transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-border bg-surface-container-low">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
          >
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{day.charAt(0)}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const dayExams = examsByDate.get(cell.key) ?? [];
          const isToday = cell.key === todayKey;
          const isSelected = cell.key === selectedDate;
          // Past dates stay visible but recede — exams are a record, not deleted.
          const isPast = cell.key < todayKey;

          return (
            <button
              key={cell.key}
              onClick={() => onSelectDate(cell.key)}
              aria-label={`${cell.date.toDateString()}${dayExams.length ? `, ${dayExams.length} exam${dayExams.length > 1 ? 's' : ''}` : ''}`}
              aria-current={isToday ? 'date' : undefined}
              className={`relative min-h-[76px] sm:min-h-[92px] p-1.5 sm:p-2 border-b border-r border-border text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50 ${
                isSelected ? 'bg-primary/10' : 'hover:bg-surface-container-low'
              } ${cell.inMonth ? '' : 'bg-surface-container-low/50'}`}
            >
              <span
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold ${
                  isToday
                    ? 'bg-primary text-on-primary'
                    : cell.inMonth
                      ? isPast
                        ? 'text-muted-foreground'
                        : 'text-foreground'
                      : 'text-muted-foreground/50'
                }`}
              >
                {cell.date.getDate()}
              </span>

              <div className="mt-1 space-y-0.5">
                {dayExams.slice(0, 2).map((exam) => {
                  const palette = examColor(exam.color);
                  return (
                    <div
                      key={exam.id}
                      className={`flex items-center gap-1 px-1 py-0.5 rounded ${palette.tint} ${
                        isPast ? 'opacity-50' : ''
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${palette.dot}`} />
                      <span className={`text-[9px] font-semibold truncate ${palette.text}`}>
                        {exam.title}
                      </span>
                    </div>
                  );
                })}
                {dayExams.length > 2 && (
                  <span className="text-[9px] font-semibold text-muted-foreground pl-1">
                    +{dayExams.length - 2} more
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
