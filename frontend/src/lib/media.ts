const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export function resolveMediaUrl(url?: string | null): string | null {
  if (!url) return null;
  if (/^(https?:|blob:|data:)/i.test(url)) return url;
  const origin = API_BASE.replace(/\/api\/?$/, '');
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`;
}
