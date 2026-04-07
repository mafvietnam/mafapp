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
 * After WordPress login, if redirect_uri points to allowed origin,
 * generate one-time code and redirect back to app.
 */
add_filter('login_redirect', function (string $redirect_to, string $requested, $user): string {
    // Only act when a real user logged in
    if (is_wp_error($user) || !($user instanceof WP_User)) {
        return $redirect_to;
    }

    // Check if redirect_uri was passed (GET on initial load, POST after form submit)
    $redirect_uri = isset($_REQUEST['redirect_uri']) ? esc_url_raw($_REQUEST['redirect_uri']) : '';

    if (empty($redirect_uri)) {
        return $redirect_to;
    }

    // Validate origin against whitelist
    if (!maf_sso_is_allowed_origin($redirect_uri)) {
        return $redirect_to;
    }

    // Generate one-time code
    $code = maf_sso_generate_code($user->ID);

    // Append code to redirect URI
    $separator = (strpos($redirect_uri, '?') !== false) ? '&' : '?';
    return $redirect_uri . $separator . 'code=' . $code;
}, 10, 3);

/**
 * Pass redirect_uri through WordPress login form so it survives form submission.
 */
add_action('login_form', function () {
    if (isset($_GET['redirect_uri'])) {
        $uri = esc_url($_GET['redirect_uri']);
        echo '<input type="hidden" name="redirect_uri" value="' . esc_attr($uri) . '" />';
    }
});

/**
 * Preserve redirect_uri in login URL query params after form POST.
 */
add_filter('login_url', function (string $login_url, string $redirect): string {
    if (isset($_REQUEST['redirect_uri'])) {
        $login_url = add_query_arg('redirect_uri', urlencode($_REQUEST['redirect_uri']), $login_url);
    }
    return $login_url;
}, 10, 2);

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
    set_transient($transient_key, $payload, MAF_SSO_CODE_TTL);

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
