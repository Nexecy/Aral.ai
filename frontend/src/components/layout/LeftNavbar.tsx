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
import { BrandLogo } from '@/components/brand/BrandLogo';
import { UserAvatar } from '@/components/brand/UserAvatar';

export function LeftNavbar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const { isRunning, formattedTime, toggleWidget } = usePomodoro();

  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

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

  // Auto-collapse below 1024px. A media query listener fires only when the
  // breakpoint is actually crossed, rather than on every resize frame.
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)');
    const apply = (matches: boolean) => {
      if (matches) setCollapsed(true);
    };
    apply(query.matches);

    const onChange = (e: MediaQueryListEvent) => apply(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const navItems = [
    {
      id: 'library',
      label: 'Library & Upload',
      href: '/',
      icon: BookOpen,
      badge: 'Hub',
      badgeColor: 'bg-sticker-purple/15 text-sticker-purple'
    },
    {
      id: 'workspace',
      label: 'Study Workspace',
      href: '/workspace/',
      activePrefix: '/session/',
      icon: Layers,
      badge: pathname.startsWith('/session/') ? 'Active' : undefined,
      badgeColor: 'bg-sticker-sky/15 text-sticker-sky'
    },
    {
      id: 'calendar',
      label: 'Exam Calendar',
      href: '/calendar/',
      icon: CalendarDays
    },
    {
      id: 'history',
      label: 'Session History',
      href: '/history/',
      icon: History
    },
    {
      id: 'settings',
      label: 'Settings & Keys',
      href: '/settings/',
      icon: Settings
    }
  ];

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b border-border z-40 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-1.5 rounded-md hover:bg-muted text-foreground"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <BrandLogo size={28} wordmarkClassName="text-sm" />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleWidget}
            className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 border transition-all ${
              isRunning 
                ? 'bg-sticker-orange/15 text-sticker-orange border-sticker-orange/30 animate-pulse'
                : 'bg-muted text-muted-foreground border-border'
            }`}
          >
            <Timer className="w-3.5 h-3.5" />
            <span>{formattedTime}</span>
          </button>

          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Rail (Desktop & Mobile Drawer) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 bg-card border-r border-border flex flex-col justify-between overflow-visible transition-all duration-300 ease-in-out ${
          // Desktop sizing
          collapsed ? 'lg:w-[72px]' : 'lg:w-[260px]'
        } ${
          // Mobile responsive slide-in
          mobileOpen ? 'translate-x-0 w-[260px]' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Branding & Navigation */}
        <div className={collapsed ? 'px-2 pt-4 pb-2' : 'p-4'}>
          {/* Header & Logo */}
          <div className={`relative mb-6 ${collapsed ? 'flex justify-center py-2' : 'flex items-center justify-between px-2 py-3'}`}>
            {collapsed ? (
              <BrandLogo href="/" size={28} showWordmark={false} />
            ) : (
              <BrandLogo size={40} subtitle="Study Assistant" />
            )}
          </div>

          {/* Navigation Links */}
          <nav className={collapsed ? 'space-y-1' : 'space-y-1.5'}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href)) ||
                (item.activePrefix ? pathname.startsWith(item.activePrefix) : false);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`group relative flex items-center rounded-xl text-sm font-medium transition-all ${
                    collapsed
                      ? `justify-center w-11 h-11 mx-auto ${
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                        }`
                      : `gap-3.5 px-3.5 py-3 ${
                          isActive
                            ? 'bg-primary/10 text-primary font-semibold shadow-none'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                        }`
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                  
                  {!collapsed && (
                    <div className="flex items-center justify-between w-full">
                      <span className="truncate">{item.label}</span>
                      {item.badge && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}

                  {isActive && !collapsed && (
                    <div className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-r-full" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Profile, Pomodoro Mini-pill & Theme Toggle */}
        <div className={`${collapsed ? 'px-2 py-3' : 'p-4'} border-t border-border space-y-2`}>
          {!collapsed ? (
            <div 
              onClick={toggleWidget}
              className="p-3 rounded-xl bg-surface-container-low border border-border flex items-center justify-between cursor-pointer hover:border-primary/40 transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <Timer className={`w-4 h-4 ${isRunning ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
                <span className="text-xs font-semibold text-foreground">Focus Timer</span>
              </div>
              <span className="text-xs font-mono font-bold text-primary">{formattedTime}</span>
            </div>
          ) : (
            <button
              onClick={toggleWidget}
              className="w-11 h-11 mx-auto flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
              title={`Focus Timer: ${formattedTime}`}
            >
              <Timer className={`w-5 h-5 ${isRunning ? 'text-primary' : ''}`} />
            </button>
          )}

          {collapsed ? (
            <div className="flex flex-col items-center gap-1">
              <div title={user?.display_name?.trim() || user?.email || 'Account'}>
                <UserAvatar user={user} size={32} />
              </div>
              <button
                onClick={toggleTheme}
                className="w-11 h-11 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
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
          ) : (
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2.5 overflow-hidden">
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
                  onClick={toggleTheme}
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                <button
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

      {/* Mobile Bottom Navigation Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border z-40 px-6 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href)) ||
            (item.activePrefix ? pathname.startsWith(item.activePrefix) : false);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex flex-col items-center gap-1 transition-colors ${
                isActive ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{item.label.split(' ')[0]}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
