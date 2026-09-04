'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie, ShieldCheck, SlidersHorizontal, Check, X, ChevronRight, Lock } from 'lucide-react';
import { Portal } from '@/components/ui/Portal';

export interface CookiePreferences {
  essential: boolean; // Always true
  analytics: boolean;
  personalization: boolean;
  timestamp: string;
}

const STORAGE_KEY = 'aral_cookie_consent';

export function getStoredCookiePreferences(): CookiePreferences | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function openCookiePreferences() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('aral_open_cookie_preferences'));
  }
}

export function CookieConsent() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [personalization, setPersonalization] = useState(true);

  useEffect(() => {
    setMounted(true);
    const existing = getStoredCookiePreferences();
    if (!existing) {
      // Small delay for smooth entry on initial page load
      const timer = setTimeout(() => {
        setOpen(true);
      }, 700);
      return () => clearTimeout(timer);
    } else {
      setAnalytics(existing.analytics ?? true);
      setPersonalization(existing.personalization ?? true);
    }
  }, []);

  useEffect(() => {
    const handleReopen = () => {
      const existing = getStoredCookiePreferences();
      if (existing) {
        setAnalytics(existing.analytics ?? true);
        setPersonalization(existing.personalization ?? true);
      }
      setShowDetails(true);
      setOpen(true);
    };

    window.addEventListener('aral_open_cookie_preferences', handleReopen);
    return () => window.removeEventListener('aral_open_cookie_preferences', handleReopen);
  }, []);

  if (!mounted || !open) return null;

  const savePreferences = (prefs: { analytics: boolean; personalization: boolean }) => {
    const payload: CookiePreferences = {
      essential: true,
      analytics: prefs.analytics,
      personalization: prefs.personalization,
      timestamp: new Date().toISOString()
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore quota error
    }
    setOpen(false);
    setShowDetails(false);
  };

  const handleAcceptAll = () => {
    setAnalytics(true);
    setPersonalization(true);
    savePreferences({ analytics: true, personalization: true });
  };

  const handleEssentialOnly = () => {
    setAnalytics(false);
    setPersonalization(false);
    savePreferences({ analytics: false, personalization: false });
  };

  const handleSaveCustom = () => {
    savePreferences({ analytics, personalization });
  };

  return (
    <Portal>
      {/* If showing full customization dialog, display backdrop */}
      {showDetails && (
        <div
          className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[9998] bg-black/40 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowDetails(false)}
        />
      )}

      <div
        role="dialog"
        aria-live="polite"
        aria-label="Cookie & Privacy Preferences"
        className={`fixed z-[9999] transition-all duration-300 ${
          showDetails
            ? 'inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 top-1/2 -translate-y-1/2 max-w-lg w-full'
            : 'bottom-4 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md w-auto'
        }`}
      >
        <div className="bg-card/95 backdrop-blur-xl border border-border rounded-3xl shadow-2xl overflow-hidden p-5 sm:p-6 text-foreground animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Cookie className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-foreground">
                  {showDetails ? 'Cookie & Privacy Preferences' : 'We respect your privacy'}
                </h2>
                <p className="text-[11px] text-muted-foreground font-medium">
                  {showDetails ? 'Choose which cookies you allow' : 'Aral.ai uses cookies & local storage'}
                </p>
              </div>
            </div>

            {showDetails && (
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-container transition-colors"
                aria-label="Close preferences"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {!showDetails ? (
            /* Compact Mode */
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                We use cookies and local storage to remember your study sessions, keep you signed in, preserve your theme, and measure focus metrics. We never sell your data.
              </p>

              <div className="flex items-center justify-between gap-2 pt-1 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => setShowDetails(true)}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground underline flex items-center gap-1 py-1"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Customize</span>
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleEssentialOnly}
                    className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl border border-border hover:bg-surface-container text-xs font-bold text-foreground transition-colors"
                  >
                    Essential Only
                  </button>
                  <button
                    type="button"
                    onClick={handleAcceptAll}
                    className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-bold transition-all shadow-xs"
                  >
                    Accept All
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Granular Customization Mode */
            <div className="space-y-4 mt-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Customize your cookie preferences below. Essential cookies are required for basic site functions like logging in and saving study documents.
              </p>

              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
                {/* Category 1: Strictly Necessary */}
                <div className="p-3 rounded-2xl bg-surface-container-low border border-border/70 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-bold text-foreground">Strictly Necessary</span>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded-md">
                        Always Active
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-normal">
                      Required for login sessions, security tokens, study notes caching, and theme display.
                    </p>
                  </div>
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={true}
                      disabled
                      className="w-4 h-4 rounded text-primary focus:ring-primary opacity-60 cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Category 2: Performance & Analytics */}
                <div className="p-3 rounded-2xl bg-surface-container-low border border-border/70 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-foreground">Performance & Study Metrics</span>
                    <p className="text-[11px] text-muted-foreground leading-normal">
                      Anonymized analytics to measure Pomodoro streak accuracy, PDF viewer loading speed, and error diagnostics.
                    </p>
                  </div>
                  <div className="pt-1">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={analytics}
                        onChange={(e) => setAnalytics(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>

                {/* Category 3: AI & Study Personalization */}
                <div className="p-3 rounded-2xl bg-surface-container-low border border-border/70 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-foreground">AI Tutor Personalization</span>
                    <p className="text-[11px] text-muted-foreground leading-normal">
                      Remembers your preferred explanation tone (e.g. conversational Taglish, academic) and active study goals.
                    </p>
                  </div>
                  <div className="pt-1">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={personalization}
                        onChange={(e) => setPersonalization(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                <Link
                  href="/terms"
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground underline"
                >
                  Terms & Privacy
                </Link>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleEssentialOnly}
                    className="px-3.5 py-2 rounded-xl border border-border hover:bg-surface-container text-xs font-bold text-foreground transition-colors"
                  >
                    Reject Optional
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCustom}
                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-bold transition-all shadow-xs"
                  >
                    Save Preferences
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
