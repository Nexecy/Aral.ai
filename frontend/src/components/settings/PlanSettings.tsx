'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CreditCard, KeyRound, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import type { UsageSnapshot } from '@/lib/types';

const meterLabels: { key: keyof UsageSnapshot['used']; label: string }[] = [
  { key: 'notes', label: 'Notes' },
  { key: 'flashcards', label: 'Flashcards' },
  { key: 'quizzes', label: 'Quizzes' },
  { key: 'chat', label: 'AI chat' },
  { key: 'uploads', label: 'Uploads' }
];

function MeterRow({
  label,
  used,
  limit,
  bypass
}: {
  label: string;
  used: number;
  limit: number;
  bypass: boolean;
}) {
  const pct = bypass ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {bypass ? 'BYOK · unlimited platform caps' : `${used} / ${limit} today`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-container-low overflow-hidden border border-border/60">
        <div
          className={`h-full rounded-full transition-all ${
            pct >= 100 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-primary'
          }`}
          style={{ width: bypass ? '8%' : `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function PlanSettings() {
  const { refreshUser } = useAuth();
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [byokInput, setByokInput] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUsage();
      setUsage(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load plan usage.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const upgrade = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api.upgradePlan('student');
      setUsage(res.usage);
      setMessage(res.message);
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upgrade failed.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api.cancelPlan();
      setUsage(res.usage);
      setMessage(res.message);
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not switch plans.');
    } finally {
      setBusy(false);
    }
  };

  const saveByok = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api.saveByokKey(byokInput.trim() || null);
      setUsage(res.usage);
      setMessage(res.message);
      setByokInput('');
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save API key.');
    } finally {
      setBusy(false);
    }
  };

  const clearByok = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api.saveByokKey(null);
      setUsage(res.usage);
      setMessage(res.message);
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear API key.');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !usage) {
    return (
      <div className="p-8 rounded-2xl bg-card border border-border flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading plan…
      </div>
    );
  }

  const isStudent = usage?.plan === 'student';
  const price = usage?.student_price_php ?? 199;

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-card border border-border shadow-notion-soft space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              Plan & daily AI usage
            </h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              Free keeps burn low while you grow. Student unlocks higher daily caps. Limits reset at UTC midnight.
            </p>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold">
            {usage?.plan_label ?? 'Free'}
            {!isStudent && ` · ₱0`}
            {isStudent && ` · ₱${price}/mo`}
          </div>
        </div>

        {message && (
          <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            {message}
          </p>
        )}
        {error && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="space-y-3 pt-1">
          {usage &&
            meterLabels.map(({ key, label }) => (
              <MeterRow
                key={key}
                label={label}
                used={usage.used[key]}
                limit={usage.limits[key]}
                bypass={usage.byok_bypasses_limits}
              />
            ))}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {!isStudent ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void upgrade()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Upgrade to Student · ₱{price}/mo
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void cancel()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-xs font-semibold hover:bg-muted/40 disabled:opacity-60"
            >
              Switch to Free
            </button>
          )}
          <Link
            href="/pricing/"
            className="inline-flex items-center px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Compare plans
          </Link>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Early launch uses stub checkout (no card charge yet). PayMongo / GCash wiring comes next.
        </p>
      </div>

      <div className="p-6 rounded-2xl bg-card border border-border shadow-notion-soft space-y-4">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary" />
          Bring your own Gemini key (BYOK)
        </h2>
        <p className="text-xs text-muted-foreground">
          Paste a Google AI Studio key to bypass platform daily caps. Your key is stored obfuscated and never shown
          again in the UI.
        </p>
        <input
          type="password"
          value={byokInput}
          onChange={(e) => setByokInput(e.target.value)}
          placeholder={usage?.has_byok ? 'Key on file — paste a new one to replace' : 'AIza…'}
          className="w-full text-sm bg-surface-container-low px-4 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground"
          autoComplete="off"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !byokInput.trim()}
            onClick={() => void saveByok()}
            className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-60"
          >
            Save key
          </button>
          {usage?.has_byok && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void clearByok()}
              className="px-4 py-2.5 rounded-xl border border-border text-xs font-semibold"
            >
              Remove key
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
