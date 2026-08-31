'use client';

import React, { useEffect, useState } from 'react';
import {
  Settings as SettingsIcon,
  Key,
  Sun,
  Moon,
  Volume2,
  Smartphone,
  Monitor,
  Check,
  Database,
  Keyboard,
  Palette,
  UserRound
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { usePomodoro } from '@/context/PomodoroContext';
import { sound } from '@/lib/sound';
import { ShortcutsManager } from '@/components/settings/ShortcutsManager';
import { ProfileSettings } from '@/components/settings/ProfileSettings';

type SettingsTab = 'profile' | 'appearance' | 'engine' | 'focus' | 'shortcuts' | 'platforms';

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'engine', label: 'AI & Backend', icon: Key },
  { id: 'focus', label: 'Focus', icon: Volume2 },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  { id: 'platforms', label: 'Platforms', icon: Monitor }
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { systemStatus } = useAuth();
  const pomodoro = usePomodoro();
  const [tab, setTab] = useState<SettingsTab>('appearance');

  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (TABS.some((item) => item.id === hash)) {
        setTab(hash as SettingsTab);
      }
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  const selectTab = (next: SettingsTab) => {
    setTab(next);
    window.history.replaceState(null, '', `#${next}`);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page Title */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-notion-soft">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
              Settings & Preferences
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Theme, profile, tutor engine, focus defaults, and keyboard shortcuts
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-1 overflow-x-auto no-scrollbar p-1 rounded-xl bg-surface-container-low border border-border">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => selectTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                tab === id
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'profile' && <ProfileSettings />}

      {tab === 'appearance' && (
      <div className="p-6 rounded-2xl bg-card border border-border shadow-notion-soft space-y-4">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <span>Design Theme & Aesthetic</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            onClick={() => setTheme('light')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              theme === 'light'
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-border bg-card hover:bg-muted/30'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                <Sun className="w-4 h-4 text-sticker-orange" />
                <span>Notion Warm Paper</span>
              </div>
              {theme === 'light' && <Check className="w-4 h-4 text-primary" />}
            </div>
            <p className="text-xs text-muted-foreground">
              Off-white #f6f5f4 warm canvas, near-black Inter typography, and Notion blue accents.
            </p>
          </div>

          <div
            onClick={() => setTheme('dark')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              theme === 'dark'
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-border bg-card hover:bg-muted/30'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                <Moon className="w-4 h-4 text-sticker-sky" />
                <span>Calm Dark Slate</span>
              </div>
              {theme === 'dark' && <Check className="w-4 h-4 text-primary" />}
            </div>
            <p className="text-xs text-muted-foreground">
              Deep slate & charcoal surfaces designed for night-time study sessions.
            </p>
          </div>
        </div>
      </div>
      )}

      {tab === 'engine' && (
      <div className="p-6 rounded-2xl bg-card border border-border shadow-notion-soft space-y-4">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" />
          <span>AI Engine & Integration Mode</span>
        </h2>

        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-surface-container-low border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="font-bold text-xs text-foreground flex items-center gap-2">
                <span>Google GenAI SDK (Gemini 1.5)</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  systemStatus?.has_gemini ? 'bg-sticker-green/15 text-sticker-green' : 'bg-sticker-sky/15 text-sticker-sky'
                }`}>
                  {systemStatus?.has_gemini ? 'Live API Connected' : 'Hybrid Auto-Generator'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Model: <strong>{systemStatus?.gemini_model || 'gemini-1.5-flash'}</strong> with Native JSON schemas
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-surface-container-low border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="font-bold text-xs text-foreground flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                <span>Supabase PostgreSQL & Auth</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  systemStatus?.has_supabase ? 'bg-sticker-green/15 text-sticker-green' : 'bg-sticker-sky/15 text-sticker-sky'
                }`}>
                  {systemStatus?.has_supabase ? 'Live Supabase Connected' : 'Hybrid Local Store'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tables: Documents, Sessions, Notes, Flashcards, QuizAttempts, ChatMessages, PomodoroLogs, Exams
              </p>
            </div>
          </div>
        </div>
      </div>
      )}

      {tab === 'focus' && (
      <div className="p-6 rounded-2xl bg-card border border-border shadow-notion-soft space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-primary" />
            <span>Pomodoro Focus Settings</span>
          </h2>
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-1 rounded-full">
            Single Source of Truth
          </span>
        </div>

        <div className="space-y-4">
          {/* Durations Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-surface-container-low border border-border space-y-1.5">
              <label className="text-xs font-bold text-foreground block">Study Duration</label>
              <select
                value={pomodoro.settings.study_minutes}
                onChange={(e) => pomodoro.updateSettings({ study_minutes: parseInt(e.target.value) })}
                className="w-full text-xs font-semibold bg-card border border-border rounded-lg p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value={15}>15 Minutes</option>
                <option value={20}>20 Minutes</option>
                <option value={25}>25 Minutes (Standard)</option>
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes (Extended)</option>
                <option value={60}>60 Minutes</option>
              </select>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-container-low border border-border space-y-1.5">
              <label className="text-xs font-bold text-foreground block">Short Break</label>
              <select
                value={pomodoro.settings.short_break_minutes}
                onChange={(e) => pomodoro.updateSettings({ short_break_minutes: parseInt(e.target.value) })}
                className="w-full text-xs font-semibold bg-card border border-border rounded-lg p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value={3}>3 Minutes</option>
                <option value={5}>5 Minutes (Standard)</option>
                <option value={8}>8 Minutes</option>
                <option value={10}>10 Minutes</option>
              </select>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-container-low border border-border space-y-1.5">
              <label className="text-xs font-bold text-foreground block">Long Break</label>
              <select
                value={pomodoro.settings.long_break_minutes}
                onChange={(e) => pomodoro.updateSettings({ long_break_minutes: parseInt(e.target.value) })}
                className="w-full text-xs font-semibold bg-card border border-border rounded-lg p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value={10}>10 Minutes</option>
                <option value={15}>15 Minutes (Standard)</option>
                <option value={20}>20 Minutes</option>
                <option value={30}>30 Minutes</option>
              </select>
            </div>
          </div>

          {/* Sound choice and Auto-start */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-surface-container-low border border-border space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground">Completion Chime</label>
                <button
                  onClick={() => sound.playPomodoroChime(pomodoro.settings.sound_choice)}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Test Chime
                </button>
              </div>
              <select
                value={pomodoro.settings.sound_choice}
                onChange={(e) => pomodoro.updateSettings({ sound_choice: e.target.value })}
                className="w-full text-xs font-semibold capitalize bg-card border border-border rounded-lg p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="zen">Zen 4-Note Ambient</option>
                <option value="bell">Classic Meditation Bell</option>
                <option value="digital">Digital Double Beep</option>
                <option value="harp">Gentle Ascending Harp</option>
              </select>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-container-low border border-border flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-foreground">Auto-Start Intervals</div>
                <p className="text-[11px] text-muted-foreground">Skip manual start click between study & break</p>
              </div>
              <button
                onClick={() => pomodoro.updateSettings({ auto_start_next: !pomodoro.settings.auto_start_next })}
                className={`w-10 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                  pomodoro.settings.auto_start_next ? 'bg-primary justify-end' : 'bg-surface-container-highest justify-start'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {tab === 'shortcuts' && <ShortcutsManager />}

      {tab === 'platforms' && (
      <div className="p-6 rounded-2xl bg-card border border-border shadow-notion-soft space-y-4">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Monitor className="w-4 h-4 text-primary" />
          <span>Cross-Platform Deployment Specs</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-4 rounded-xl bg-surface-container-low border border-border space-y-1.5">
            <div className="font-bold text-foreground flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-primary" />
              <span>Capacitor (iOS & Android)</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Static export in <code className="text-primary font-mono text-[11px]">out/</code> with native local notifications plugin for background Pomodoro alerts.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-surface-container-low border border-border space-y-1.5">
            <div className="font-bold text-foreground flex items-center gap-1.5">
              <Monitor className="w-4 h-4 text-primary" />
              <span>Tauri (Windows / macOS / Linux)</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Lightweight desktop bundle configured with native system tray and custom desktop window chrome.
            </p>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
