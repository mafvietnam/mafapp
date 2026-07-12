<?php
/**
 * Plugin Name: MAF SSO Provider
 * Description: Custom SSO endpoints for app.maf.run authentication. Provides credential validation
 *              and one-time code exchange flow. No third-party plugin dependencies.
 * Version: 1.0.0
 * Author: MAF Running
 *
 * Endpoints:
 *   POST /wp-json/maf/v1/auth          — validate username+password, return WP user info
 *   GET  /wp-json/maf/v1/sso/verify    — exchange one-time code for WP user info
 *
 * Login redirect:
 *   After WP login, if redirect_uri query param points to app.maf.run,
 *   generates a one-time code and redirects: {redirect_uri}?code={code}
 *
 * Security:
 *   - Codes are single-use, expire in 5 minutes, stored as WP transients
 *   - HMAC-SHA256 integrity check on code payload
 *   - Rate limiting on auth endpoint (5 attempts/minute per IP)
 *   - Only whitelisted redirect_uri origins allowed
 *   - Codes are 64-char hex (32 bytes of entropy)
 */

if (!defined('ABSPATH')) exit;

// --- Configuration ---
define('MAF_SSO_CODE_TTL', 300); // 5 minutes
define('MAF_SSO_RATE_LIMIT', 5); // max attempts per minute per IP
define('MAF_SSO_ALLOWED_ORIGINS', [
    'https://app.maf.run',
    'http://localhost:5173', // dev
]);

/**
 * Register custom REST API routes for MAF SSO
 */
add_action('rest_api_init', function () {
    // POST /wp-json/maf/v1/auth — credential validation
    register_rest_route('maf/v1', '/auth', [
        'methods'             => 'POST',
        'callback'            => 'maf_sso_auth_handler',
        'permission_callback' => '__return_true',
    ]);

    // GET /wp-json/maf/v1/sso/verify — one-time code exchange
    register_rest_route('maf/v1', '/sso/verify', [
        'methods'             => 'GET',
        'callback'            => 'maf_sso_verify_handler',
        'permission_callback' => '__return_true',
        'args' => [
            'code' => [
                'required'          => true,
                'sanitize_callback' => 'sanitize_text_field',
            ],
        ],
    ]);
});

/**
 * Validate username+password against WordPress user database.
 * Returns WP user info on success, 401 on failure.
 */
function maf_sso_auth_handler(WP_REST_Request $request): WP_REST_Response {
    $ip = maf_sso_get_client_ip();

    // Rate limiting
    if (maf_sso_is_rate_limited($ip)) {
        return new WP_REST_Response(
            ['error' => 'Too many login attempts. Try again later.'],
            429
        );
    }

    $body = $request->get_json_params();
    $username = $body['username'] ?? '';
    $password = $body['password'] ?? '';

    if (empty($username) || empty($password)) {
        maf_sso_increment_rate($ip);
        return new WP_REST_Response(['error' => 'Missing credentials'], 400);
    }

    $user = wp_authenticate($username, $password);

    if (is_wp_error($user)) {
        maf_sso_increment_rate($ip);
        return new WP_REST_Response(['error' => 'Invalid credentials'], 401);
    }

    // Reset rate limit on success
    delete_transient("maf_sso_rate_{$ip}");

    return new WP_REST_Response(maf_sso_format_user($user), 200);
}

/**
 * Verify a one-time SSO code and return user info.
 * Code is single-use — deleted immediately after verification.
 */
function maf_sso_verify_handler(WP_REST_Request $request): WP_REST_Response {
    $code = $request->get_param('code');

    if (empty($code) || !preg_match('/^[a-f0-9]{64}$/', $code)) {
        return new WP_REST_Response(['error' => 'Invalid code format'], 400);
    }

    $transient_key = 'maf_sso_code_' . hash('sha256', $code);
    $data = get_transient($transient_key);

    // Debug logging
    error_log("[MAF SSO] verify: code_prefix=" . substr($code, 0, 16) . " key=$transient_key found=" . ($data !== false ? 'YES' : 'NO'));

    if ($data === false) {
        return new WP_REST_Response(['error' => 'Invalid or expired code'], 401);
    }

    // Single-use: delete immediately
    delete_transient($transient_key);

    // Verify HMAC integrity
    $payload = json_decode($data, true);
    if (!$payload || !isset($payload['user_id'], $payload['hmac'])) {
        return new WP_REST_Response(['error' => 'Corrupted code data'], 401);
    }

    $expected_hmac = maf_sso_compute_hmac($payload['user_id'], $payload['created_at']);
    if (!hash_equals($expected_hmac, $payload['hmac'])) {
        return new WP_REST_Response(['error' => 'Code integrity check failed'], 401);
    }

    $user = get_user_by('ID', $payload['user_id']);
    if (!$user) {
        return new WP_REST_Response(['error' => 'User not found'], 404);
    }

    return new WP_REST_Response(maf_sso_format_user($user), 200);
}

/**
 * SSO Logout — destroy WP session and redirect back to app or maf.run homepage.
 * URL: https://maf.run/?maf_sso_logout=REDIRECT_URL
 *
 * Called by app.maf.run after clearing its own JWT cookies.
 * Clears WP auth cookies so user is fully logged out of both systems.
 */
add_action('template_redirect', function () {
    $redirect_to = isset($_GET['maf_sso_logout']) ? esc_url_raw($_GET['maf_sso_logout']) : '';

    if (empty($redirect_to)) {
        return; // Not a logout request
    }

    maf_sso_send_nocache_headers();

    error_log("[MAF SSO] LOGOUT: redirect_to=$redirect_to logged_in=" . (is_user_logged_in() ? 'YES' : 'NO'));

    // Validate origin — only allow redirect to whitelisted domains
    if (!maf_sso_is_allowed_origin($redirect_to)) {
        $redirect_to = home_url('/');
    }

    // Destroy WP session
    wp_logout();

    // Clear any pending SSO cookie
    setcookie('maf_sso_pending', '', [
        'expires'  => time() - 3600,
        'path'     => '/',
        'secure'   => is_ssl(),
        'httponly'  => true,
        'samesite' => 'Lax',
    ]);

    wp_redirect($redirect_to);
    exit;
}, 5); // Priority 5 — run before SSO gateway (default 10)

/**
 * SSO Gateway — entry point for app.maf.run authentication.
 * URL: https://maf.run/?maf_sso_redirect=CALLBACK_URL
 *
 * If user is already logged in at maf.run → generate code, redirect immediately.
 * If not logged in → redirect to homepage (custom login modal will open).
 * After login via custom modal, the login_redirect filter handles the SSO flow.
 */
add_action('template_redirect', function () {
    $redirect_to = isset($_GET['maf_sso_redirect']) ? esc_url_raw($_GET['maf_sso_redirect']) : '';

    if (empty($redirect_to)) {
        return; // Not an SSO request, proceed normally
    }

    // Validate origin
    if (!maf_sso_is_allowed_origin($redirect_to)) {
        return;
    }

    // CRITICAL: prevent caching of SSO gateway responses. Without this, Cloudflare/browsers
    // cache the unauthenticated response and serve it even after the user logs in, breaking
    // the SSO redirect-back flow.
    maf_sso_send_nocache_headers();

    error_log("[MAF SSO] GATEWAY: redirect_to=$redirect_to logged_in=" . (is_user_logged_in() ? 'YES' : 'NO') . " user_id=" . get_current_user_id());

    // User already logged in — generate code and redirect immediately
    if (is_user_logged_in()) {
        $user = wp_get_current_user();
        $code = maf_sso_generate_code($user->ID);
        $separator = (strpos($redirect_to, '?') !== false) ? '&' : '?';
        wp_redirect($redirect_to . $separator . 'code=' . $code);
        exit;
    }

    // Not logged in — store redirect target in session cookie for after-login pickup
    // The custom login modal AJAX handler or login_redirect filter will use this
    setcookie('maf_sso_pending', $redirect_to, [
        'expires'  => time() + 600, // 10 minutes
        'path'     => '/',
        'secure'   => is_ssl(),
        'httponly'  => true,
        'samesite' => 'Lax',
    ]);

    // Mark the request so wp_footer can inject the auto-open-modal script.
    // Stay on the current page; the theme's login modal will be triggered open client-side.
    $GLOBALS['maf_sso_show_login_modal'] = true;
});

/**
 * Auto-open the theme's login modal when the user arrived via an SSO gateway redirect
 * and is not logged in. Without this, the user sees the homepage with no obvious next step.
 */
add_action('wp_footer', function () {
    if (empty($GLOBALS['maf_sso_show_login_modal'])) {
        return;
    }
    ?>
    <script>
    (function () {
      function openLoginModalNow() {
        var trigger = document.querySelector('[data-open-login]');
        if (trigger) { trigger.click(); return true; }
        var modal = document.getElementById('login-modal');
        if (modal) { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; return true; }
        return false;
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(openLoginModalNow, 50); });
      } else {
        setTimeout(openLoginModalNow, 50);
      }
    })();
    </script>
    <?php
}, 99);

/**
 * Send strict no-cache headers so SSO gateway/logout responses are never cached
 * by browsers or upstream CDNs (Cloudflare). Required for the redirect-back flow
 * to work correctly after the user authenticates.
 */
function maf_sso_send_nocache_headers(): void {
    if (headers_sent()) {
        return;
    }
    // Use WP's helper, then override with stronger directives for CDN bypass.
    nocache_headers();
    header('Cache-Control: no-store, no-cache, must-revalidate, private, max-age=0', true);
    header('Pragma: no-cache', true);
    header('Expires: 0', true);
    // Cloudflare-specific: bypass cache regardless of page rules.
    header('CDN-Cache-Control: no-store', true);
    header('Cloudflare-CDN-Cache-Control: no-store', true);
}

/**
 * After any WP login (wp-login.php or custom AJAX modal), check for pending SSO redirect.
 * Picks up from maf_sso_pending cookie or redirect_to form param.
 */
add_filter('login_redirect', function (string $redirect_to, string $requested, $user): string {
    // Only act when a real user logged in
    if (is_wp_error($user) || !($user instanceof WP_User)) {
        return $redirect_to;
    }

    // Check sources for SSO callback URL (in priority order):
    // 1. redirect_to form param (from wp-login.php flow)
    // 2. maf_sso_pending cookie (from custom login modal flow)
    $target = !empty($requested) ? $requested : $redirect_to;

    if (!maf_sso_is_allowed_origin($target)) {
        // Fallback: check pending SSO cookie from gateway
        $pending = $_COOKIE['maf_sso_pending'] ?? '';
        if (!empty($pending) && maf_sso_is_allowed_origin($pending)) {
            $target = $pending;
            // Clear the cookie
            setcookie('maf_sso_pending', '', [
                'expires'  => time() - 3600,
                'path'     => '/',
                'secure'   => is_ssl(),
                'httponly'  => true,
                'samesite' => 'Lax',
            ]);
        } else {
            return $redirect_to;
        }
    }

    // Generate one-time code and redirect to app callback
    $code = maf_sso_generate_code($user->ID);
    $separator = (strpos($target, '?') !== false) ? '&' : '?';
    return $target . $separator . 'code=' . $code;
}, 10, 3);

/**
 * Allow external redirect to app.maf.run after login.
 * By default WP blocks redirects to external domains via wp_safe_redirect.
 */
add_filter('allowed_redirect_hosts', function (array $hosts): array {
    $hosts[] = 'app.maf.run';
    $hosts[] = 'localhost';
    return $hosts;
});

// --- Helper Functions ---

/**
 * Generate a cryptographically secure one-time SSO code.
 * Stores code hash as transient with HMAC integrity check.
 */
function maf_sso_generate_code(int $user_id): string {
    $code = bin2hex(random_bytes(32)); // 64-char hex
    $created_at = time();

    $payload = json_encode([
        'user_id'    => $user_id,
        'created_at' => $created_at,
        'hmac'       => maf_sso_compute_hmac($user_id, $created_at),
    ]);

    // Store by hash of code (not the code itself) for extra safety
    $transient_key = 'maf_sso_code_' . hash('sha256', $code);
    $stored = set_transient($transient_key, $payload, MAF_SSO_CODE_TTL);

    // Debug logging
    error_log("[MAF SSO] generate_code: user=$user_id code_prefix=" . substr($code, 0, 16) . " key=$transient_key stored=" . ($stored ? 'YES' : 'NO'));

    return $code;
}

/**
 * Compute HMAC-SHA256 for code payload integrity.
 * Uses WordPress AUTH_KEY as secret (unique per WP install).
 */
function maf_sso_compute_hmac(int $user_id, int $created_at): string {
    $secret = defined('AUTH_KEY') ? AUTH_KEY : wp_salt('auth');
    return hash_hmac('sha256', "{$user_id}:{$created_at}", $secret);
}

/**
 * Format WP_User into the standard response shape expected by NestJS.
 */
function maf_sso_format_user(WP_User $user): array {
    return [
        'id'          => $user->ID,
        'name'        => $user->display_name,
        'email'       => $user->user_email,
        'avatar_urls' => maf_sso_get_avatar_urls($user),
    ];
}

/**
 * Get avatar URLs at standard sizes (matches WP REST API format).
 */
function maf_sso_get_avatar_urls(WP_User $user): array {
    $urls = [];
    foreach ([24, 48, 96] as $size) {
        $urls[(string) $size] = get_avatar_url($user->ID, ['size' => $size]);
    }
    return $urls;
}

/**
 * Check if a redirect URI origin is in the allowed whitelist.
 */
function maf_sso_is_allowed_origin(string $url): bool {
    $parsed = wp_parse_url($url);
    if (!$parsed || !isset($parsed['scheme'], $parsed['host'])) {
        return false;
    }

    $origin = $parsed['scheme'] . '://' . $parsed['host'];
    if (isset($parsed['port'])) {
        $origin .= ':' . $parsed['port'];
    }

    return in_array($origin, MAF_SSO_ALLOWED_ORIGINS, true);
}

/**
 * Rate limiting: check if IP has exceeded max attempts.
 */
function maf_sso_is_rate_limited(string $ip): bool {
    $key = "maf_sso_rate_{$ip}";
    $attempts = (int) get_transient($key);
    return $attempts >= MAF_SSO_RATE_LIMIT;
}

/**
 * Rate limiting: increment attempt counter for IP.
 */
function maf_sso_increment_rate(string $ip): void {
    $key = "maf_sso_rate_{$ip}";
    $attempts = (int) get_transient($key);
    set_transient($key, $attempts + 1, 60); // 1 minute window
}

/**
 * Get client IP, respecting Cloudflare proxy headers.
 */
function maf_sso_get_client_ip(): string {
    // Cloudflare passes real IP in CF-Connecting-IP
    if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        return sanitize_text_field($_SERVER['HTTP_CF_CONNECTING_IP']);
    }
    return sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
}
