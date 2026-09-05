'use client';

import { api } from '@/lib/api';

export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  '686935671952-7nu38r853mtqrtifcntvhlrcv03bl96l.apps.googleusercontent.com';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            context?: 'signin' | 'signup' | 'use';
          }) => void;
          prompt: (momentListener?: (moment: any) => void) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number | string;
            }
          ) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

/**
 * Initialize Google Identity Services on the page.
 */
export function initGoogleIdentity(
  onSuccess: (accessToken: string) => Promise<void>,
  onError: (errMsg: string) => void
) {
  if (typeof window === 'undefined' || !window.google?.accounts?.id) {
    return false;
  }

  try {
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      auto_select: false,
      callback: async (response) => {
        if (!response.credential) {
          onError('Google sign-in was cancelled or failed.');
          return;
        }
        try {
          const session = await api.loginWithGoogle(response.credential);
          if (session.access_token) {
            await onSuccess(session.access_token);
          } else {
            onError('Could not create an active session.');
          }
        } catch (err: any) {
          onError(err?.message || 'Google sign-in failed.');
        }
      }
    });
    return true;
  } catch (err: any) {
    console.warn('Google Identity initialization notice:', err);
    return false;
  }
}
