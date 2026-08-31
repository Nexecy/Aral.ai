'use client';

import React, { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2, Timer } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { LeftNavbar } from './LeftNavbar';
import { PomodoroWidget } from './PomodoroWidget';
import { GlobalKnowledgeSearch } from './GlobalKnowledgeSearch';
import { SessionRecoveryPrompt } from './SessionRecoveryPrompt';
import { VerifyEmailBanner } from '@/components/auth/VerifyEmailBanner';
import { usePomodoro } from '@/context/PomodoroContext';
import { useAuth } from '@/context/AuthContext';
import { useHotkeys, isTypingTarget } from '@/hooks/useHotkeys';
import { useShortcutMap } from '@/hooks/useShortcuts';
import { TopNavMenus } from './TopNavMenus';

const AUTH_LAYOUT_PATHS = [
  '/login',
  '/login/',
  '/signup',
  '/signup/',
  '/forgot-password',
  '/forgot-password/',
  '/reset-password',
  '/reset-password/',
  '/confirm',
  '/confirm/',
  '/terms',
  '/terms/'
];

const GUEST_ONLY_PATHS = [
  '/login',
  '/login/',
  '/signup',
  '/signup/',
  '/forgot-password',
  '/forgot-password/'
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isRunning, formattedTime, toggleWidget } = usePomodoro();
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const { shortcuts } = useShortcutMap();
  const isAuthPage = AUTH_LAYOUT_PATHS.includes(pathname);
  const isGuestOnly = GUEST_ONLY_PATHS.includes(pathname);

  useEffect(() => {
    if (loading) return;
    if (!user && !isAuthPage) router.replace('/login/');
    if (user && isGuestOnly) router.replace('/');
  }, [loading, user, isAuthPage, isGuestOnly, router]);

  useHotkeys([
    {
      combo: shortcuts.focusSearch,
      allowInInput: true,
      handler: () => {
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    },
    {
      key: 'Escape',
      allowInInput: true,
      // Only unfocus fields here; view-level Esc behaviour is owned by each screen.
      handler: (e) => {
        if (isTypingTarget(e.target)) (e.target as HTMLElement).blur();
      },
      preventDefault: false
    }
  ]);

  if (isAuthPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <BrandLogo href={null} align="center" size={48} wordmarkClassName="text-xl" />
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <p className="text-sm font-semibold text-muted-foreground">Loading Aral.ai…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm font-semibold text-muted-foreground">Redirecting to sign in…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased selection:bg-primary/20">
      <LeftNavbar />

      {/* Top Header Bar for Desktop */}
      <header className="hidden lg:flex fixed top-0 left-[var(--sidebar-width,260px)] right-0 h-20 bg-background/80 backdrop-blur-xl z-40 px-10 items-center justify-between border-b border-border transition-all duration-300">
        <GlobalKnowledgeSearch ref={searchRef} />

        <div className="flex items-center gap-6">
          <button
            onClick={toggleWidget}
            className="flex items-center gap-2.5 bg-surface-container-low hover:bg-surface-container text-foreground px-5 py-2 rounded-full text-xs font-mono font-bold border border-border transition-colors group"
          >
            <Timer className={`w-4 h-4 ${isRunning ? 'text-primary animate-pulse' : 'text-primary'}`} />
            <span>{formattedTime}</span>
          </button>

          <TopNavMenus />
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 lg:pl-[var(--sidebar-width,260px)] pt-14 lg:pt-20 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-12 transition-all duration-300">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
          <VerifyEmailBanner />
          {children}
        </div>
      </main>

      <PomodoroWidget />
      <SessionRecoveryPrompt />
    </div>
  );
}
