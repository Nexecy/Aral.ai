'use client';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://eiyqtczxmovmgbodpvzu.supabase.co';

export type SocialProvider = 'google' | 'facebook';

/**
 * Trigger Supabase OAuth redirect for Google or Facebook.
 * Once authorized, Supabase redirects the browser back to /confirm/ with tokens.
 */
export function signInWithSocial(provider: SocialProvider) {
  if (typeof window === 'undefined') return;

  const origin = window.location.origin;
  const redirectTo = `${origin}/confirm/`;

  // Build Supabase OAuth authorization URL
  const params = new URLSearchParams({
    provider,
    redirect_to: redirectTo
  });

  if (provider === 'google') {
    params.set('prompt', 'select_account');
  }

  const oauthUrl = `${SUPABASE_URL}/auth/v1/authorize?${params.toString()}`;
  window.location.href = oauthUrl;
}
