'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, LogOut, Moon, Settings, Sun, Type } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useNotifications } from '@/context/NotificationContext';
import { UserAvatar } from '@/components/brand/UserAvatar';

type OpenMenu = 'bell' | 'avatar' | null;

export function TopNavMenus({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, toggleTheme, fontSize, cycleFontSize } = useTheme();
  const { items, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState<OpenMenu>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const displayName = user?.display_name?.trim() || user?.email || 'Signed in';

  return (
    <div ref={rootRef} className={`flex items-center ${compact ? 'gap-1' : 'gap-3'}`}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => (current === 'bell' ? null : 'bell'))}
          className={`relative rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-container transition-colors ${
            compact ? 'w-9 h-9' : 'w-10 h-10'
          }`}
          title="Notifications"
          aria-expanded={open === 'bell'}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
          )}
        </button>
        {open === 'bell' && (
          <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-border bg-card shadow-notion-elevated overflow-hidden z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-xs font-bold text-foreground">Notifications</p>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted-foreground text-center">
                No notifications yet
              </p>
            ) : (
              <div className="max-h-80 overflow-auto">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      markRead(item.id);
                      setOpen(null);
                      if (item.href) router.push(item.href);
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-border last:border-b-0 hover:bg-surface-container-low transition-colors ${
                      item.read ? '' : 'bg-primary/5'
                    }`}
                  >
                    <p className="text-xs font-bold text-foreground">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{item.body}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => (current === 'avatar' ? null : 'avatar'))}
          className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          title={displayName}
          aria-expanded={open === 'avatar'}
        >
          <UserAvatar user={user} size={compact ? 32 : 40} />
        </button>
        {open === 'avatar' && (
          <div className="absolute right-0 mt-2 w-[min(16rem,calc(100vw-1.5rem))] rounded-2xl border border-border bg-card shadow-notion-elevated overflow-hidden z-50">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <UserAvatar user={user} size={40} />
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{displayName}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <Link
              href="/settings/#profile"
              onClick={() => {
                setOpen(null);
                if (typeof window !== 'undefined') window.location.hash = 'profile';
              }}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-surface-container-low"
            >
              <Settings className="w-4 h-4 text-muted-foreground" />
              Settings / Profile
            </Link>
            <button
              type="button"
              onClick={() => {
                toggleTheme();
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-surface-container-low"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
              {theme === 'dark' ? 'Notion Warm Paper' : 'Calm Dark Slate'}
            </button>
            <button
              type="button"
              onClick={() => {
                cycleFontSize();
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-foreground hover:bg-surface-container-low"
            >
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-muted-foreground" />
                <span>Font Size</span>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">
                {fontSize}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(null);
                logout();
                router.replace('/login/');
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-destructive hover:bg-surface-container-low border-t border-border"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
