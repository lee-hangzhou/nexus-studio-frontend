import { getAccessToken } from '../../api/base';

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}

/** Build login path that returns to `from` after success. */
export function loginUrl(from?: string): string {
  const target =
    from
    ?? (typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : '/');
  return `/login?from=${encodeURIComponent(target)}`;
}
