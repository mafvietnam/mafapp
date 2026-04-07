const WP_BASE_URL = import.meta.env.VITE_WP_URL || 'https://maf.run';
const APP_CALLBACK_URL = `${window.location.origin}/auth/callback`;

/**
 * Build WP SSO gateway URL.
 * If user is already logged in at maf.run → auto-generates code and redirects back.
 * If not logged in → lands on maf.run homepage where custom login modal opens.
 */
export function getWpLoginUrl(): string {
  return `${WP_BASE_URL}/?maf_sso_redirect=${encodeURIComponent(APP_CALLBACK_URL)}`;
}
