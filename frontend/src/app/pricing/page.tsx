'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import type { BillingPlan } from '@/lib/types';

const FALLBACK_PLANS: BillingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price_php: 0,
    description: 'Start studying with daily AI caps. No card required.',
    limits: { notes: 3, flashcards: 3, quizzes: 3, chat: 20, uploads: 3 }
  },
  {
    id: 'student',
    name: 'Student',
    price_php: 199,
    description: 'Higher daily AI limits for serious exam prep.',
    limits: { notes: 40, flashcards: 40, quizzes: 40, chat: 300, uploads: 30 }
  }
];

export default function PricingPage() {
  const { user, refreshUser } = useAuth();
  const [plans, setPlans] = useState<BillingPlan[]>(FALLBACK_PLANS);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void api
      .getBillingPlans()
      .then((res) => setPlans(res.plans))
      .catch(() => undefined);
  }, []);

  const upgrade = async () => {
    if (!user) {
      window.location.href = '/signup/';
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await api.upgradePlan('student');
      setMessage(res.message);
      await refreshUser();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Upgrade failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-10">
        <div className="flex items-center justify-between gap-4">
          <Link href="/">
            <BrandLogo size={34} wordmarkClassName="text-lg font-extrabold" />
          </Link>
          <Link href={user ? '/settings/#plan' : '/signup/'} className="text-sm font-semibold text-primary">
            {user ? 'Manage plan' : 'Create free account'}
          </Link>
        </div>

        <div className="space-y-3 max-w-2xl">
          <p className="text-xs font-mono uppercase tracking-wider text-primary font-bold">Pricing</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Start free. Upgrade when you need more AI.
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Built for Philippine students — priced in pesos, capped so our Gemini bill stays under control while you
            learn.
          </p>
        </div>

        {message && (
          <p className="text-sm rounded-xl border border-border bg-card px-4 py-3">{message}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {plans.map((plan) => {
            const featured = plan.id === 'student';
            return (
              <div
                key={plan.id}
                className={`rounded-2xl border p-6 space-y-5 ${
                  featured
                    ? 'border-primary bg-primary/5 shadow-notion-soft'
                    : 'border-border bg-card'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-extrabold">{plan.name}</h2>
                    {featured && <Sparkles className="w-4 h-4 text-primary" />}
                  </div>
                  <p className="text-3xl font-extrabold tabular-nums">
                    ₱{plan.price_php}
                    <span className="text-sm font-semibold text-muted-foreground">
                      {plan.price_php === 0 ? '' : '/mo'}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">{plan.description}</p>
                </div>

                <ul className="space-y-2 text-sm">
                  {(
                    [
                      ['Notes', plan.limits.notes],
                      ['Flashcards', plan.limits.flashcards],
                      ['Quizzes', plan.limits.quizzes],
                      ['AI chat', plan.limits.chat],
                      ['Uploads', plan.limits.uploads]
                    ] as const
                  ).map(([label, n]) => (
                    <li key={label} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary shrink-0" />
                      <span>
                        {n}/day {label.toLowerCase()}
                      </span>
                    </li>
                  ))}
                </ul>

                {plan.id === 'free' ? (
                  <Link
                    href="/signup/"
                    className="inline-flex justify-center w-full px-4 py-2.5 rounded-xl border border-border text-sm font-bold hover:bg-muted/30"
                  >
                    Get started free
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={busy || user?.plan === 'student'}
                    onClick={() => void upgrade()}
                    className="inline-flex justify-center items-center gap-2 w-full px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-60"
                  >
                    {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                    {user?.plan === 'student' ? 'Current plan' : `Upgrade · ₱${plan.price_php}/mo`}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground max-w-2xl">
          Prefer to pay Google directly? Add your own Gemini API key under Settings → Plan. BYOK bypasses platform
          daily caps.
        </p>
      </div>
    </div>
  );
}
