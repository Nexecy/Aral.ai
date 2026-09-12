// Fallback only if Vercel is missing NEXT_PUBLIC_API_URL.
export const DEFAULT_PRODUCTION_API_URL =
  'https://aral-ai-api-686935671952.us-central1.run.app/api';
export const DEFAULT_DEV_API_URL = 'http://127.0.0.1:8000/api';

type ApiEnv = {
  NEXT_PUBLIC_API_URL?: string;
  NODE_ENV?: string;
};

export function resolveApiBase(
  env: ApiEnv = {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NODE_ENV: process.env.NODE_ENV,
  }
): string {
  const fromEnv = (env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  return env.NODE_ENV === 'production' ? DEFAULT_PRODUCTION_API_URL : DEFAULT_DEV_API_URL;
}

export function apiBaseMisconfiguredForHost(apiBase: string, hostname: string): boolean {
  const localHost = hostname === 'localhost' || hostname === '127.0.0.1';
  const localApi = /localhost|127\.0\.0\.1/.test(apiBase);
  return Boolean(hostname) && !localHost && localApi;
}

export function warnIfApiBaseMisconfigured(apiBase: string = resolveApiBase()): void {
  if (typeof window === 'undefined') return;
  if (apiBaseMisconfiguredForHost(apiBase, window.location.hostname)) {
    console.error(
      `[Aral.ai] API URL is ${apiBase} but this page is ${window.location.origin}. ` +
        'Set NEXT_PUBLIC_API_URL to the hosted FastAPI origin (e.g. https://aral-ai-api-686935671952.us-central1.run.app/api) in Vercel.'
    );
  }
}
