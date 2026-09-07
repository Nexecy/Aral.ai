'use client';

import React, { useEffect, useState } from 'react';
import {
  Settings as SettingsIcon,
  Sun,
  Moon,
  Volume2,
  Check,
  Keyboard,
  Palette,
  UserRound,
  Cookie,
  Pipette,
  Sparkles
} from 'lucide-react';
import { useTheme, FONT_SIZES, COLOR_SCHEMES } from '@/context/ThemeContext';
import { usePomodoro } from '@/context/PomodoroContext';
import { sound } from '@/lib/sound';
import { ShortcutsManager } from '@/components/settings/ShortcutsManager';
import { ProfileSettings } from '@/components/settings/ProfileSettings';
import { openCookiePreferences } from '@/components/common/CookieConsent';

type SettingsTab = 'profile' | 'appearance' | 'focus' | 'shortcuts';

interface TabItem {
  id: SettingsTab;
  label: string;
  icon: React.ElementType;
  desktopOnly?: boolean;
}

const TABS: TabItem[] = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'focus', label: 'Focus', icon: Volume2 },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard, desktopOnly: true }
];

export default function SettingsPage() {
  const {
    theme,
    setTheme,
    fontSize,
    setFontSize,
    colorScheme,
    customPrimaryHex,
    setColorScheme,
    activeHexColor
  } = useTheme();
  const pomodoro = usePomodoro();
  const [tab, setTab] = useState<SettingsTab>('appearance');
  const [isMobileOrTablet, setIsMobileOrTablet] = useState<boolean>(false);
  const [customHexInput, setCustomHexInput] = useState<string>(customPrimaryHex);

  useEffect(() => {
    setCustomHexInput(customPrimaryHex);
  }, [customPrimaryHex]);

  // Detect mobile / tablet / coarse pointer
  useEffect(() => {
    const checkDevice = () => {
      const isTouch = window.matchMedia('(pointer: coarse)').matches;
      const isSmall = window.innerWidth < 1024;
      setIsMobileOrTablet(isTouch || isSmall);
    };
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // Handle URL hash changes
  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (TABS.some((item) => item.id === hash)) {
        if (hash === 'shortcuts' && (window.innerWidth < 1024 || window.matchMedia('(pointer: coarse)').matches)) {
          setTab('appearance');
        } else {
          setTab(hash as SettingsTab);
        }
      }
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  // Switch away from shortcuts if on mobile/tablet
  useEffect(() => {
    if (isMobileOrTablet && tab === 'shortcuts') {
      setTab('appearance');
    }
  }, [isMobileOrTablet, tab]);

  const selectTab = (next: SettingsTab) => {
    setTab(next);
    window.history.replaceState(null, '', `#${next}`);
  };

  const visibleTabs = TABS.filter((t) => !t.desktopOnly || !isMobileOrTablet);

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
              Theme, profile, reading font size, focus defaults{!isMobileOrTablet && ', and keyboard shortcuts'}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-1 overflow-x-auto no-scrollbar p-1 rounded-xl bg-surface-container-low border border-border">
          {visibleTabs.map(({ id, label, icon: Icon, desktopOnly }) => (
            <button
              key={id}
              onClick={() => selectTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                desktopOnly ? 'hidden lg:flex' : ''
              } ${
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
      <div className="space-y-6">
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

        {/* ── COLOR SCHEME & ACCENT PALETTE ───────────────────────────── */}
        <div className="p-6 rounded-2xl bg-card border border-border shadow-notion-soft space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Palette className="w-4 h-4 text-primary" />
                <span>Site Accent & Color Scheme</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Customize the primary accent color across buttons, cards, focus rings, and study highlights
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded-full ring-2 ring-border shrink-0"
                style={{ backgroundColor: activeHexColor }}
              />
              <span className="text-xs font-mono font-bold text-muted-foreground">
                {activeHexColor.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Starter Palettes Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {COLOR_SCHEMES.map((scheme) => {
              const isSelected = colorScheme === scheme.id;
              return (
                <div
                  key={scheme.id}
                  onClick={() => setColorScheme(scheme.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-4 h-4 rounded-full shrink-0 shadow-sm ring-1 ring-black/10"
                        style={{ backgroundColor: scheme.hex }}
                      />
                      <span className="font-bold text-xs text-foreground">{scheme.name}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {scheme.description}
                  </p>
                </div>
              );
            })}

            {/* Custom Color Option Card */}
            <div
              className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                colorScheme === 'custom'
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border bg-card hover:bg-muted/30'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full shrink-0 shadow-sm ring-1 ring-black/10 cursor-pointer overflow-hidden relative"
                    style={{ backgroundColor: customPrimaryHex }}
                  >
                    <input
                      type="color"
                      value={customPrimaryHex}
                      onChange={(e) => {
                        setCustomHexInput(e.target.value);
                        setColorScheme('custom', e.target.value);
                      }}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      title="Pick custom color"
                    />
                  </div>
                  <span className="font-bold text-xs text-foreground">Custom Color</span>
                </div>
                {colorScheme === 'custom' && <Check className="w-3.5 h-3.5 text-primary" />}
              </div>

              <div className="space-y-2 mt-1">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={customHexInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomHexInput(val);
                        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                          setColorScheme('custom', val);
                        }
                      }}
                      placeholder="#6366F1"
                      maxLength={7}
                      className="w-full text-xs font-mono bg-surface-container-low px-2 py-1.5 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                    />
                  </div>
                  <label className="p-1.5 rounded-lg border border-border bg-surface-container-low hover:bg-surface-container cursor-pointer transition-colors shrink-0 flex items-center justify-center">
                    <Pipette className="w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      type="color"
                      value={customPrimaryHex}
                      onChange={(e) => {
                        setCustomHexInput(e.target.value);
                        setColorScheme('custom', e.target.value);
                      }}
                      className="sr-only"
                    />
                  </label>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Pick any custom brand or aesthetic tone.
                </p>
              </div>
            </div>
          </div>

          {/* Real-time Theme Accent Preview Strip */}
          <div className="p-4 rounded-xl bg-surface-container-low border border-border/80 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Live Color Scheme Preview
              </span>
              <span className="text-[11px] font-mono">{activeHexColor}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-sm hover:opacity-95 transition-opacity"
              >
                Primary Button
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-primary/10 text-primary font-bold text-xs border border-primary/20 hover:bg-primary/20 transition-colors"
              >
                Subtle Accent
              </button>
              <span className="px-3 py-1 rounded-full bg-primary/15 text-primary font-bold text-[11px]">
                Active Badge
              </span>
              <div className="px-3 py-1.5 rounded-lg border-2 border-primary bg-card text-xs font-medium text-foreground">
                Focus Ring Highlight
              </div>
            </div>
          </div>
        </div>

        {/* ── FONT SIZE SETTINGS ────────────────────────────────────────────── */}
        <div className="p-6 rounded-2xl bg-card border border-border shadow-notion-soft space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <span>Reading & Interface Font Size</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Scale text size across study documents, notes, flashcards, and navigation
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-primary/10 text-primary uppercase tracking-wider">
              {fontSize} ({FONT_SIZES.find((f) => f.id === fontSize)?.scale || '100%'})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {FONT_SIZES.map((f) => {
              const isSelected = fontSize === f.id;
              return (
                <div
                  key={f.id}
                  onClick={() => setFontSize(f.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-foreground">{f.label}</span>
                    {isSelected && <Check className="w-4 h-4 text-primary" />}
                  </div>
                  <div className="text-[11px] font-mono text-primary font-bold mb-1.5">
                    {f.scale} · {f.px}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {f.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Live sample preview */}
          <div className="p-4 rounded-xl bg-surface-container-low border border-border space-y-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Live Reading Preview
            </span>
            <p className="text-foreground leading-relaxed">
              &ldquo;Active recall and spaced repetition are the highest-yield evidence-based study techniques for long-term retention.&rdquo;
            </p>
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

      {!isMobileOrTablet && tab === 'shortcuts' && <ShortcutsManager />}

      {/* Privacy & Storage Preferences Card */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-notion-soft flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
            <Cookie className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-foreground">
              Cookie & Privacy Preferences
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage essential storage, study analytics, and AI personalization settings
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCookiePreferences}
          className="px-4 py-2.5 rounded-xl border border-border bg-surface-container-low hover:bg-surface-container text-xs font-bold text-foreground transition-colors shrink-0 shadow-2xs"
        >
          Manage Cookies
        </button>
      </div>
    </div>
  );
}
