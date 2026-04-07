const WP_LOGIN_URL = import.meta.env.VITE_WP_LOGIN_URL || 'https://maf.run/wp-login.php';
const APP_CALLBACK_URL = `${window.location.origin}/auth/callback`;

/** Build WP login URL using native redirect_to param — WP passes it through login form */
export function getWpLoginUrl(): string {
  return `${WP_LOGIN_URL}?redirect_to=${encodeURIComponent(APP_CALLBACK_URL)}`;
}
