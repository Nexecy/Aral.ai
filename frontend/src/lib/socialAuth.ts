'use client';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://eiyqtczxmovmgbodpvzu.supabase.co';

export type SocialProvider = 'google' | 'facebook';

/**
 * Open OAuth provider in a centered popup window so the main page is never navigated away.
 */
export function signInWithSocialPopup(
  provider: SocialProvider,
  onSuccess?: () => void,
  onError?: (err: string) => void
) {
  if (typeof window === 'undefined') return;

  const origin = window.location.origin;
  const redirectTo = `${origin}/confirm/?popup=1`;

  const params = new URLSearchParams({
    provider,
    redirect_to: redirectTo
  });

  if (provider === 'google') {
    params.set('prompt', 'select_account');
  }

  const oauthUrl = `${SUPABASE_URL}/auth/v1/authorize?${params.toString()}`;

  const width = 560;
  const height = 650;
  const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
  const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);

  const popup = window.open(
    oauthUrl,
    `${provider}_auth_popup`,
    `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
  );

  // Fallback if browser popup blocker intervened
  if (!popup || popup.closed || typeof popup.closed === 'undefined') {
    window.location.href = oauthUrl;
    return;
  }

  let finished = false;
  const cleanup = () => {
    finished = true;
    window.removeEventListener('message', handleMessage);
    if (pollTimer) clearInterval(pollTimer);
  };

  const handleMessage = (event: MessageEvent) => {
    if (event.origin !== origin) return;
    if (event.data?.type === 'ARAL_OAUTH_SUCCESS') {
      cleanup();
      try {
        if (!popup.closed) popup.close();
      } catch {}
      onSuccess?.();
    } else if (event.data?.type === 'ARAL_OAUTH_ERROR') {
      cleanup();
      try {
        if (!popup.closed) popup.close();
      } catch {}
      onError?.(event.data?.error || 'Authentication was cancelled or failed.');
    }
  };

  window.addEventListener('message', handleMessage);

  // Poll for popup closing or token appearing in storage
  const pollTimer = setInterval(() => {
    if (finished) return;
    try {
      if (popup.closed) {
        cleanup();
        const savedToken = localStorage.getItem('aral_auth_token');
        if (savedToken) {
          onSuccess?.();
        }
      }
    } catch {
      // Cross-origin check while on external provider
    }
  }, 500);
}

/**
 * Default social sign-in (delegates to popup).
 */
export function signInWithSocial(provider: SocialProvider) {
  signInWithSocialPopup(provider, () => {
    if (typeof window !== 'undefined') {
      window.location.replace('/');
    }
  });
}
