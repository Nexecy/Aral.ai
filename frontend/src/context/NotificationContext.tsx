'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatCountdown, formatExamDate } from '@/lib/examColors';

export type AppNotificationKind = 'pomodoro' | 'quiz' | 'exam';

export interface AppNotification {
  id: string;
  kind: AppNotificationKind;
  title: string;
  body: string;
  href?: string;
  createdAt: number;
  read: boolean;
}

interface NotificationContextType {
  items: AppNotification[];
  unreadCount: number;
  addNotification: (item: Omit<AppNotification, 'createdAt' | 'read'> & { createdAt?: number; read?: boolean }) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function storageKey(userId: string) {
  return `aral_notifications_${userId}`;
}

function load(userId: string): AppNotification[] {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(userId: string, items: AppNotification[]) {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(items.slice(0, 50)));
  } catch {
    /* ignore */
  }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!user?.id) {
      setItems([]);
      return;
    }
    setItems(load(user.id));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    persist(user.id, items);
  }, [items, user?.id]);

  const addNotification = useCallback(
    (item: Omit<AppNotification, 'createdAt' | 'read'> & { createdAt?: number; read?: boolean }) => {
      setItems((prev) => {
        if (prev.some((existing) => existing.id === item.id)) return prev;
        return [
          {
            ...item,
            createdAt: item.createdAt ?? Date.now(),
            read: item.read ?? false
          },
          ...prev
        ].slice(0, 50);
      });
    },
    []
  );

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    async function seedExamReminders() {
      try {
        const exams = await api.getExams();
        if (cancelled) return;
        exams
          .filter((exam) => exam.days_remaining >= 0 && exam.days_remaining <= 3)
          .forEach((exam) => {
            addNotification({
              id: `exam-${exam.id}-${exam.exam_date}`,
              kind: 'exam',
              title: 'Exam reminder',
              body: `${exam.title} · ${formatExamDate(exam.exam_date)} · ${formatCountdown(exam.days_remaining)}`,
              href: '/calendar/'
            });
          });
      } catch {
        /* ignore */
      }
    }
    void seedExamReminders();
    return () => {
      cancelled = true;
    };
  }, [user?.id, addNotification]);

  const markRead = useCallback((id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
  }, []);

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  return (
    <NotificationContext.Provider value={{ items, unreadCount, addNotification, markRead, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
}
