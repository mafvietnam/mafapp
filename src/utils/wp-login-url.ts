const WP_LOGIN_URL = import.meta.env.VITE_WP_LOGIN_URL || 'https://maf.run/login';
const APP_CALLBACK_URL = `${window.location.origin}/auth/callback`;

/** Build the WordPress login URL with redirect_uri back to app SSO callback */
export function getWpLoginUrl(): string {
  return `${WP_LOGIN_URL}?redirect_uri=${encodeURIComponent(APP_CALLBACK_URL)}`;
}
