'use client';

import React, { useEffect, useState } from 'react';
import { usePomodoro } from '@/context/PomodoroContext';
import { sound } from '@/lib/sound';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Minimize2, 
  X, 
  Coffee, 
  Brain, 
  Sparkles,
  Flame,
  Settings as SettingsIcon,
  Volume2,
  Square,
  Check,
  Music,
  Bell,
  Monitor,
  AudioLines,
  type LucideIcon
} from 'lucide-react';

const CHIMES: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'zen',     label: 'Zen',     icon: Music },
  { id: 'bell',    label: 'Bell',    icon: Bell },
  { id: 'digital', label: 'Digital', icon: Monitor },
  { id: 'harp',    label: 'Harp',    icon: AudioLines },
];

export function PomodoroWidget() {
  const {
    mode,
    isRunning,
    isWidgetOpen,
    isMinimized,
    cyclesCompleted,
    settings,
    startTimer,
    pauseTimer,
    resetTimer,
    toggleWidget,
    toggleMinimize,
    setTimerMode,
    updateSettings,
    formattedTime,
    timeLeft
  } = usePomodoro();

  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [previewingSound, setPreviewingSound] = useState<string | null>(null);

  // Esc backs out of the sound picker / settings drawer before anything else.
  useEffect(() => {
    if (!isWidgetOpen || !showSettings) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        sound.stopPreview();
        setPreviewingSound(null);
        setShowSettings(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isWidgetOpen, showSettings]);

  if (!isWidgetOpen) return null;

  const totalTime = mode === 'work' 
    ? settings.study_minutes * 60 
    : mode === 'long_break'
    ? settings.long_break_minutes * 60
    : settings.short_break_minutes * 60;

  const progressPercent = Math.min(100, Math.max(0, ((totalTime - timeLeft) / totalTime) * 100));

  const handlePreview = (chimeId: string) => {
    if (previewingSound === chimeId) {
      // Stop current preview
      sound.stopPreview();
      setPreviewingSound(null);
    } else {
      // Start new preview (sound.previewSound auto-stops previous)
      sound.previewSound(chimeId);
      setPreviewingSound(chimeId);
      // Auto-clear the "playing" state after 3s
      setTimeout(() => setPreviewingSound((cur) => cur === chimeId ? null : cur), 3100);
    }
  };

  // Minimized Floating Pill Mode
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4">
        <div 
          onClick={toggleMinimize}
          className={`flex items-center gap-3 px-5 py-3 rounded-full shadow-lg border cursor-pointer backdrop-blur-2xl transition-all hover:scale-105 ${
            mode === 'work'
              ? 'bg-card/95 border-border text-foreground'
              : 'bg-primary/10 border-primary/30 text-primary'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-primary animate-ping' : 'bg-primary'}`} />
            <span className="font-mono font-bold text-sm tracking-tight">{formattedTime}</span>
          </div>

          <div className="flex items-center gap-1.5 border-l border-border pl-3 text-xs text-muted-foreground font-medium">
            {mode === 'work' ? <Brain className="w-3.5 h-3.5 text-primary" /> : <Coffee className="w-3.5 h-3.5 text-primary" />}
            <span className="capitalize">{mode === 'work' ? 'Study' : mode === 'long_break' ? 'Long Break' : 'Break'}</span>
          </div>

          <button 
            onClick={(e) => { e.stopPropagation(); isRunning ? pauseTimer() : startTimer(); }}
            className="p-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary-container transition-colors ml-1 shadow-sm"
          >
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />}
          </button>
        </div>
      </div>
    );
  }

  // Expanded Full Card Mode
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4">
      <div className="w-84 sm:w-96 bg-card/95 backdrop-blur-2xl border border-border rounded-3xl shadow-xl overflow-hidden">
        {/* Companion Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-container-lowest">
          <div className="flex items-center gap-2.5 text-foreground font-semibold text-sm">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Brain className="w-4 h-4" />
            </div>
            <span>Focus Companion</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded-lg transition-colors ${
                showSettings ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-surface-container'
              }`}
              title="Customize Durations & Sounds"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
            <button
              onClick={toggleMinimize}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-container transition-colors"
              title="Minimize to floating pill"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              onClick={toggleWidget}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-container transition-colors"
              title="Close widget"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Settings Drawer Mode */}
        {showSettings ? (
          <div className="p-6 space-y-4 max-h-[480px] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Timer Settings</h4>
              <button 
                onClick={() => setShowSettings(false)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Done
              </button>
            </div>

            {/* Study Duration */}
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1.5">Study Duration (minutes)</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[15, 25, 30, 45].map((m) => (
                  <button
                    key={m}
                    onClick={() => updateSettings({ study_minutes: m })}
                    className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      settings.study_minutes === m
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-foreground hover:bg-surface-container'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>

            {/* Short Break */}
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1.5">Short Break (minutes)</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[3, 5, 10].map((m) => (
                  <button
                    key={m}
                    onClick={() => updateSettings({ short_break_minutes: m })}
                    className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      settings.short_break_minutes === m
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-foreground hover:bg-surface-container'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>

            {/* Long Break */}
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1.5">Long Break (minutes)</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[10, 15, 20].map((m) => (
                  <button
                    key={m}
                    onClick={() => updateSettings({ long_break_minutes: m })}
                    className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      settings.long_break_minutes === m
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-foreground hover:bg-surface-container'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>

            {/* Sound Selection with Preview */}
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-2">Completion Chime</label>
              <div className="space-y-1.5">
                {CHIMES.map((chime) => {
                  const isSelected = settings.sound_choice === chime.id;
                  const isPreviewing = previewingSound === chime.id;
                  const ChimeIcon = chime.icon;
                  return (
                    <div
                      key={chime.id}
                      className={`flex items-center gap-2 rounded-xl border transition-all px-3 py-2 ${
                        isSelected
                          ? 'bg-primary/10 border-primary/40'
                          : 'border-border hover:bg-surface-container'
                      }`}
                    >
                      {/* Select chime */}
                      <button
                        onClick={() => updateSettings({ sound_choice: chime.id })}
                        className="flex items-center gap-2 flex-1 text-left"
                      >
                        <ChimeIcon className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className={`text-xs font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                          {chime.label}
                        </span>
                        {isSelected && <Check className="w-3 h-3 text-primary ml-auto" />}
                      </button>

                      {/* Preview toggle */}
                      <button
                        onClick={() => handlePreview(chime.id)}
                        title={isPreviewing ? `Stop ${chime.label} preview` : `Preview ${chime.label}`}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                          isPreviewing
                            ? 'bg-primary text-on-primary shadow-sm'
                            : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-highest hover:text-primary'
                        }`}
                      >
                        {isPreviewing
                          ? <Square className="w-3 h-3 fill-current" />
                          : <Play className="w-3 h-3 fill-current ml-0.5" />
                        }
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                <Volume2 className="w-3 h-3" />
                Click play to preview before selecting
              </p>
            </div>

            {/* Auto Start Next */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-xs text-foreground font-medium">Auto-start intervals</span>
              <button
                onClick={() => updateSettings({ auto_start_next: !settings.auto_start_next })}
                className={`w-10 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                  settings.auto_start_next ? 'bg-primary justify-end' : 'bg-surface-container-highest justify-start'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
              </button>
            </div>
          </div>
        ) : (
          /* Companion Content Body */
          <div className="p-6 flex flex-col items-center">
            {/* Mode Toggle Pills */}
            <div className="flex bg-surface-container rounded-full p-1 mb-6 w-full relative border border-border/60">
              <button
                onClick={() => setTimerMode('work')}
                className={`flex-1 flex justify-center items-center gap-1.5 py-2 text-xs font-semibold rounded-full transition-all duration-200 ${
                  mode === 'work'
                    ? 'bg-card text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                <span>Study ({settings.study_minutes}m)</span>
              </button>
              <button
                onClick={() => setTimerMode('short_break')}
                className={`flex-1 flex justify-center items-center gap-1.5 py-2 text-xs font-semibold rounded-full transition-all duration-200 ${
                  mode === 'short_break'
                    ? 'bg-card text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Coffee className="w-3.5 h-3.5" />
                <span>Break ({settings.short_break_minutes}m)</span>
              </button>
            </div>

            {/* Large Tabular Display */}
            <div 
              className="text-5xl sm:text-6xl font-black text-foreground leading-none tracking-tighter mb-2 font-mono" 
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formattedTime}
            </div>

            {/* Progress indicator */}
            <div className="w-full bg-surface-container h-1.5 rounded-full my-3 overflow-hidden">
              <div 
                className="bg-primary h-full transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Cycles Stats Badge */}
            <div className="flex items-center gap-2 text-muted-foreground bg-surface-container px-4 py-1.5 rounded-full text-xs font-medium mb-6 border border-border/50">
              <Flame className="w-3.5 h-3.5 text-primary" />
              <span>Completed Today: <strong className="text-foreground">{cyclesCompleted} cycles</strong></span>
            </div>

            {/* Action Controls */}
            <div className="flex items-center gap-3 w-full">
              <button
                onClick={resetTimer}
                className="w-12 h-12 rounded-full border border-border text-muted-foreground flex items-center justify-center hover:bg-surface-container hover:text-foreground transition-colors shrink-0"
                title="Reset Timer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={isRunning ? pauseTimer : startTimer}
                className="flex-1 h-12 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary-container active:scale-95 transition-all shadow-sm"
              >
                {isRunning ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>Pause Focus</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Start Focus</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
