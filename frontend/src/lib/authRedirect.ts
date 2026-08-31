export type AuthRedirectParams = {
  accessToken: string | null;
  refreshToken: string | null;
  code: string | null;
  type: string | null;
  error: string | null;
  errorDescription: string | null;
};

export function readAuthRedirect(): AuthRedirectParams {
  if (typeof window === 'undefined') {
    return {
      accessToken: null,
      refreshToken: null,
      code: null,
      type: null,
      error: null,
      errorDescription: null
    };
  }

  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);

  return {
    accessToken: hash.get('access_token') || query.get('access_token'),
    refreshToken: hash.get('refresh_token') || query.get('refresh_token'),
    code: query.get('code') || hash.get('code'),
    type: hash.get('type') || query.get('type'),
    error: query.get('error') || hash.get('error'),
    errorDescription:
      query.get('error_description') || hash.get('error_description')
  };
}

export function clearAuthRedirectFromUrl() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.hash = '';
  ['code', 'access_token', 'refresh_token', 'type', 'error', 'error_description'].forEach((key) => {
    url.searchParams.delete(key);
  });
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
}
