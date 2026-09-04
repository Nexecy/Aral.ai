'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen,
  CalendarDays,
  Layers,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Timer,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { usePomodoro } from '@/context/PomodoroContext';
import { api } from '@/lib/api';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { UserAvatar } from '@/components/brand/UserAvatar';
import { TopNavMenus } from './TopNavMenus';

function MobileNavTimerButton() {
  const { isRunning, formattedTime, toggleWidget } = usePomodoro();
  return (
    <button
      type="button"
      onClick={toggleWidget}
      className={`px-2.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 border transition-all ${
        isRunning
          ? 'bg-sticker-orange/15 text-sticker-orange border-sticker-orange/30 animate-pulse'
          : 'bg-muted text-muted-foreground border-border'
      }`}
      aria-label="Toggle Focus Timer"
    >
      <Timer className="w-3.5 h-3.5" />
      <span className="font-mono font-bold">{formattedTime}</span>
    </button>
  );
}

function SidebarTimerButton({ showLabels }: { showLabels: boolean }) {
  const { isRunning, formattedTime, toggleWidget } = usePomodoro();
  if (showLabels) {
    return (
      <button
        type="button"
        onClick={toggleWidget}
        className="w-full p-3 rounded-xl bg-surface-container-low border border-border flex items-center justify-between cursor-pointer hover:border-primary/40 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Timer className={`w-4 h-4 ${isRunning ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
          <span className="text-xs font-semibold text-foreground">Focus Timer</span>
        </div>
        <span className="text-xs font-mono font-bold text-primary">{formattedTime}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleWidget}
      className="w-11 h-11 mx-auto flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
      title={`Focus Timer: ${formattedTime}`}
      aria-label={`Focus Timer: ${formattedTime}`}
    >
      <Timer className={`w-5 h-5 ${isRunning ? 'text-primary' : ''}`} />
    </button>
  );
}

export function LeftNavbar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { currentSessionId } = usePomodoro();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [hasUnfinishedHistory, setHasUnfinishedHistory] = useState<boolean>(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem('aral_sidebar_collapsed') === 'true') {
        setCollapsed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const width = collapsed ? '72px' : '260px';
    document.documentElement.style.setProperty('--sidebar-width', width);
    return () => {
      document.documentElement.style.setProperty('--sidebar-width', '260px');
    };
  }, [collapsed]);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem('aral_sidebar_collapsed', String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)');
    const apply = (matches: boolean) => {
      if (matches) {
        setCollapsed(true);
        setMobileOpen(false);
      }
    };
    apply(query.matches);

    const onChange = (e: MediaQueryListEvent) => apply(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Check for unfinished sessions with progress & handle history navigation badge clear
  useEffect(() => {
    if (pathname.startsWith('/history')) {
      try {
        window.localStorage.setItem('aral_history_badge_dismissed_at', Date.now().toString());
      } catch {
        /* ignore */
      }
      setHasUnfinishedHistory(false);
      return;
    }

    let cancelled = false;

    async function checkUnfinished() {
      if (!user?.id) {
        setHasUnfinishedHistory(false);
        return;
      }
      try {
        const dismissedStr = window.localStorage.getItem('aral_history_badge_dismissed_at');
        const dismissedAt = dismissedStr ? parseInt(dismissedStr, 10) : 0;

        const sessions = await api.getSessions();
        if (cancelled) return;

        const hasUnfinished = sessions.some((s) => {
          const isNotCompleted = s.status !== 'completed' && !s.ended_at;
          const hasProgress = (s.total_focus_seconds && s.total_focus_seconds > 0) || (s.cards_reviewed && s.cards_reviewed > 0);
          const lastAccessed = s.last_accessed_at ? new Date(s.last_accessed_at).getTime() : 0;
          return isNotCompleted && hasProgress && lastAccessed > dismissedAt;
        });

        if (!cancelled) setHasUnfinishedHistory(hasUnfinished);
      } catch {
        /* ignore */
      }
    }

    void checkUnfinished();

    const onSessionEnded = () => {
      void checkUnfinished();
    };

    window.addEventListener('aral:session-ended', onSessionEnded);
    return () => {
      cancelled = true;
      window.removeEventListener('aral:session-ended', onSessionEnded);
    };
  }, [pathname, user?.id]);

  const navItems = [
    {
      id: 'library',
      label: 'Library & Upload',
      shortLabel: 'Library',
      href: '/',
      icon: BookOpen,
      badge: 'Hub',
      badgeColor: 'bg-sticker-purple/15 text-sticker-purple'
    },
    {
      id: 'workspace',
      label: 'Study Workspace',
      shortLabel: 'Study',
      href: currentSessionId ? `/session/${currentSessionId}/` : '/workspace/',
      activePrefix: '/session/',
      icon: Layers,
      badge: currentSessionId ? 'Active' : undefined,
      badgeColor: 'bg-sticker-sky/15 text-sticker-sky'
    },
    {
      id: 'calendar',
      label: 'Exam Calendar',
      shortLabel: 'Exams',
      href: '/calendar/',
      icon: CalendarDays
    },
    {
      id: 'history',
      label: 'Session History',
      shortLabel: 'History',
      href: '/history/',
      icon: History,
      dotBadge: hasUnfinishedHistory
    },
    {
      id: 'settings',
      label: 'Settings & Keys',
      shortLabel: 'Settings',
      href: '/settings/',
      icon: Settings
    }
  ];

  const isItemActive = (item: (typeof navItems)[number]) =>
    pathname === item.href ||
    (item.href !== '/' && !item.href.startsWith('/session/') && pathname.startsWith(item.href)) ||
    (item.activePrefix ? pathname.startsWith(item.activePrefix) : false);

  const showLabels = mobileOpen || !collapsed;

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card/95 backdrop-blur-xl border-b border-border z-40 px-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            className="p-2 rounded-xl hover:bg-muted text-foreground"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <BrandLogo size={26} wordmarkClassName="text-sm" />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <MobileNavTimerButton />
          <TopNavMenus compact />
        </div>
      </div>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 bg-card border-r border-border flex flex-col justify-between overflow-visible transition-all duration-300 ease-in-out ${
          collapsed ? 'lg:w-[72px]' : 'lg:w-[260px]'
        } ${
          mobileOpen
            ? 'translate-x-0 w-[min(20rem,86vw)]'
            : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className={`${showLabels ? 'p-4' : 'px-2 pt-4 pb-2'} ${mobileOpen ? 'pt-[4.5rem] lg:pt-4' : ''}`}>
          <div className={`relative mb-6 hidden lg:flex ${collapsed ? 'justify-center py-2' : 'items-center justify-between px-2 py-3'}`}>
            {collapsed ? (
              <BrandLogo href="/" size={28} showWordmark={false} />
            ) : (
              <BrandLogo size={40} subtitle="Study Assistant" />
            )}
          </div>

          <nav className={showLabels ? 'space-y-1.5' : 'space-y-1'}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = isItemActive(item);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  draggable={false}
                  onClick={() => setMobileOpen(false)}
                  className={`group relative flex items-center rounded-xl text-sm font-medium transition-all select-none ${
                    showLabels
                      ? `gap-3.5 px-3.5 py-3 ${
                          isActive
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                        }`
                      : `justify-center w-11 h-11 mx-auto ${
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                        }`
                  }`}
                  title={!showLabels ? item.label : undefined}
                >
                  <div className="relative shrink-0 flex items-center justify-center">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                    {!showLabels && item.dotBadge && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary ring-2 ring-card" />
                    )}
                  </div>
                  {showLabels && (
                    <div className="flex items-center justify-between w-full min-w-0">
                      <span className="truncate">{item.label}</span>
                      {item.dotBadge ? (
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0 ml-2 animate-pulse" />
                      ) : item.badge ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      ) : null}
                    </div>
                  )}
                  {isActive && showLabels && (
                    <div className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-r-full" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div
          className={`${showLabels ? 'p-4' : 'px-2 py-3'} border-t border-border space-y-2`}
          style={mobileOpen ? { paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' } : undefined}
        >
          <SidebarTimerButton showLabels={showLabels} />

          {showLabels ? (
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                <UserAvatar user={user} size={32} />
                <div className="truncate">
                  <div className="text-xs font-semibold text-foreground truncate">
                    {user?.display_name?.trim() || user?.email || 'Connecting…'}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-medium truncate">
                    {user?.display_name?.trim() ? user.email : user ? 'Signed in' : 'Connecting'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    router.replace('/login/');
                  }}
                  className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div title={user?.display_name?.trim() || user?.email || 'Account'}>
                <UserAvatar user={user} size={32} />
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="w-11 h-11 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  logout();
                  router.replace('/login/');
                }}
                className="w-11 h-11 flex items-center justify-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={toggleCollapsed}
          className="hidden lg:flex group absolute top-1/2 -translate-y-1/2 right-0 translate-x-1/2 z-20 h-14 w-7 items-center justify-center rounded-full bg-card border border-border shadow-md text-muted-foreground hover:text-primary transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full group-hover:bg-primary/10">
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </span>
        </button>
      </aside>

      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-xl border-t border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="h-16 px-1 flex items-stretch justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isItemActive(item);
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-1 transition-colors ${
                  isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                  {item.dotBadge && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary ring-2 ring-card animate-pulse" />
                  )}
                </div>
                <span className="text-[10px] leading-tight truncate max-w-full">{item.shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
