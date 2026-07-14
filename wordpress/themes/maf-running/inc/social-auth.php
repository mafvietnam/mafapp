<?php
/**
 * Social Authentication — Custom Google OAuth 2.0 + password login.
 *
 * No third-party plugins. Implements OAuth 2.0 Authorization Code flow
 * directly using Google's APIs and WordPress user system.
 *
 * Security: reCAPTCHA v3, honeypot, IP rate limiting, nonce, CSRF state param.
 */

// Google OAuth 2.0 + reCAPTCHA credentials.
//
// Public identifiers (OAuth client ID, reCAPTCHA site key) are safe to ship —
// they are exposed to the browser / in redirect URLs anyway. The two SECRETS
// (OAuth client secret, reCAPTCHA secret key) are loaded from the environment or
// wp-config.php constants and MUST NOT be committed to the repo. Set them on the
// server in wp-config.php:
//   define( 'MAF_GOOGLE_CLIENT_SECRET', '...' );
//   define( 'MAF_RECAPTCHA_SECRET_KEY', '...' );
// or export MAF_GOOGLE_CLIENT_SECRET / MAF_RECAPTCHA_SECRET_KEY in the environment.
// NOTE: the previously hardcoded secrets are compromised — rotate them in Google
// Cloud Console + reCAPTCHA admin before/after wiring the new values.
define( 'MAF_GOOGLE_CLIENT_ID', '433937968617-2upac3hrov3847k8r3jhqna8o00mip4p.apps.googleusercontent.com' );
if ( ! defined( 'MAF_GOOGLE_CLIENT_SECRET' ) ) {
    define( 'MAF_GOOGLE_CLIENT_SECRET', getenv( 'MAF_GOOGLE_CLIENT_SECRET' ) ?: '' );
}
define( 'MAF_GOOGLE_REDIRECT_URI', home_url( '/maf-google-callback' ) );

// reCAPTCHA v3 — site key is public; secret key loaded from env / wp-config.
define( 'MAF_RECAPTCHA_SITE_KEY', '6LfMOJ0sAAAAAMmEniVlQ03RlxeK9dF_jNlAoHwA' );
if ( ! defined( 'MAF_RECAPTCHA_SECRET_KEY' ) ) {
    define( 'MAF_RECAPTCHA_SECRET_KEY', getenv( 'MAF_RECAPTCHA_SECRET_KEY' ) ?: '' );
}

/**
 * Check if Google OAuth is configured. Now that the secret is env/wp-config-driven,
 * this genuinely reflects whether the deployment supplied a client secret — the
 * Google button hides itself when the secret is missing instead of 500-ing later.
 */
function maf_is_social_login_active(): bool {
    return ! empty( MAF_GOOGLE_CLIENT_ID ) && ! empty( MAF_GOOGLE_CLIENT_SECRET );
}

/**
 * Resolve the real client IP behind the Cloudflare Tunnel.
 *
 * maf.run is reachable ONLY through cloudflared (no directly-exposed origin), so
 * REMOTE_ADDR is always the tunnel's private/loopback address and Cloudflare sets
 * the real visitor IP in CF-Connecting-IP. We only trust that header when
 * REMOTE_ADDR is a private/reserved range (i.e. the request really came through
 * the tunnel), so a direct hit to the origin cannot spoof the visitor IP. Falls
 * back to REMOTE_ADDR otherwise.
 */
function maf_client_ip(): string {
    $remote = sanitize_text_field( $_SERVER['REMOTE_ADDR'] ?? '' );
    $cf     = sanitize_text_field( $_SERVER['HTTP_CF_CONNECTING_IP'] ?? '' );

    // REMOTE_ADDR is the trusted proxy when it is a private/reserved address.
    $remote_is_trusted_proxy = $remote === '' || ! filter_var(
        $remote,
        FILTER_VALIDATE_IP,
        FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
    );

    if ( $cf !== '' && filter_var( $cf, FILTER_VALIDATE_IP ) && $remote_is_trusted_proxy ) {
        return $cf;
    }
    return $remote;
}

/**
 * Render Google login button — points to /maf-google-login which generates
 * a fresh CSRF state token and redirects to Google. Cache-safe.
 */
function maf_render_social_buttons(): void {
    if ( ! maf_is_social_login_active() ) {
        return;
    }
    ?>
    <a href="<?php echo esc_url( home_url( '/maf-google-login' ) ); ?>"
       class="flex items-center justify-center gap-3 w-full px-4 py-3 bg-white border border-gray-200 rounded-full font-display font-bold text-sm text-ink-dark hover:border-blue-400 hover:shadow-md transition-all">
        <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path fill="#4285F4" d="M20.64 12.2c0-.64-.06-1.25-.16-1.84H12v3.48h4.84c-.21 1.13-.84 2.08-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.87 2.69-6.62z"/>
            <path fill="#34A853" d="M12 21c2.43 0 4.47-.81 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H3.96v2.33C5.44 18.98 8.48 21 12 21z"/>
            <path fill="#FBBC05" d="M6.96 13.71c-.18-.54-.28-1.12-.28-1.71s.1-1.17.28-1.71V7.96H3.96A9 9 0 003 12c0 1.45.35 2.83.96 4.04l3-2.33z"/>
            <path fill="#EA4335" d="M12 6.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C16.46 3.89 14.43 3 12 3 8.48 3 5.44 5.02 3.96 7.96l3 2.33C7.67 8.16 9.66 6.58 12 6.58z"/>
        </svg>
        Đăng nhập với Google
    </a>
    <?php
}

/**
 * Register custom rewrite rules for Google OAuth login + callback.
 */
add_action( 'init', function () {
    add_rewrite_rule( '^maf-google-login/?$', 'index.php?maf_google_login=1', 'top' );
    add_rewrite_rule( '^maf-google-callback/?$', 'index.php?maf_google_callback=1', 'top' );
} );

add_filter( 'query_vars', function ( array $vars ): array {
    $vars[] = 'maf_google_login';
    $vars[] = 'maf_google_callback';
    return $vars;
} );

/**
 * Handle /maf-google-login — generates fresh CSRF state, redirects to Google.
 * This endpoint is NOT cached, so state is always fresh.
 */
add_action( 'template_redirect', function () {
    if ( ! get_query_var( 'maf_google_login' ) ) {
        return;
    }

    $state = bin2hex( random_bytes( 16 ) );
    set_transient( 'maf_oauth_state_' . $state, '1', 10 * MINUTE_IN_SECONDS );

    $url = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query( [
        'client_id'     => MAF_GOOGLE_CLIENT_ID,
        'redirect_uri'  => MAF_GOOGLE_REDIRECT_URI,
        'response_type' => 'code',
        'scope'         => 'openid email profile',
        'state'         => $state,
        'prompt'        => 'select_account',
    ] );

    wp_redirect( $url );
    exit;
}, 5 );

/**
 * Handle Google OAuth callback — exchange code for token, get user info,
 * create/link WordPress user, set auth cookie, redirect.
 */
add_action( 'template_redirect', function () {
    if ( ! get_query_var( 'maf_google_callback' ) ) {
        return;
    }

    // Verify CSRF state via transient (survives redirect to Google and back)
    $state         = sanitize_text_field( $_GET['state'] ?? '' );
    $transient_key = 'maf_oauth_state_' . $state;
    if ( empty( $state ) || ! get_transient( $transient_key ) ) {
        wp_die( 'Xác minh bảo mật thất bại. Vui lòng thử lại.', 'Lỗi đăng nhập', [ 'response' => 403 ] );
    }
    delete_transient( $transient_key );

    // Check for error from Google
    if ( ! empty( $_GET['error'] ) ) {
        wp_safe_redirect( home_url( '/' ) );
        exit;
    }

    $code = sanitize_text_field( $_GET['code'] ?? '' );
    if ( empty( $code ) ) {
        wp_die( 'Mã xác thực không hợp lệ.', 'Lỗi đăng nhập', [ 'response' => 400 ] );
    }

    // Exchange authorization code for access token
    $token_response = wp_remote_post( 'https://oauth2.googleapis.com/token', [
        'body' => [
            'code'          => $code,
            'client_id'     => MAF_GOOGLE_CLIENT_ID,
            'client_secret' => MAF_GOOGLE_CLIENT_SECRET,
            'redirect_uri'  => MAF_GOOGLE_REDIRECT_URI,
            'grant_type'    => 'authorization_code',
        ],
    ] );

    if ( is_wp_error( $token_response ) ) {
        wp_die( 'Không thể kết nối đến Google. Vui lòng thử lại.', 'Lỗi đăng nhập', [ 'response' => 500 ] );
    }

    $token_data = json_decode( wp_remote_retrieve_body( $token_response ), true );
    if ( empty( $token_data['access_token'] ) ) {
        wp_die( 'Không nhận được token từ Google.', 'Lỗi đăng nhập', [ 'response' => 500 ] );
    }

    // Get user profile from Google
    $profile_response = wp_remote_get( 'https://www.googleapis.com/oauth2/v2/userinfo', [
        'headers' => [ 'Authorization' => 'Bearer ' . $token_data['access_token'] ],
    ] );

    if ( is_wp_error( $profile_response ) ) {
        wp_die( 'Không thể lấy thông tin tài khoản Google.', 'Lỗi đăng nhập', [ 'response' => 500 ] );
    }

    $profile = json_decode( wp_remote_retrieve_body( $profile_response ), true );
    if ( empty( $profile['email'] ) ) {
        wp_die( 'Không nhận được email từ Google.', 'Lỗi đăng nhập', [ 'response' => 500 ] );
    }

    // Reject unverified Google emails (OAuth account-takeover guard). Below we link
    // by email via get_user_by('email', ...); if Google has not proven the caller
    // owns this address, that link would let an attacker log into an existing WP
    // account by email alone. Google's oauth2/v2/userinfo returns `verified_email`.
    if ( empty( $profile['verified_email'] ) ) {
        wp_die( 'Email Google chưa được xác minh. Không thể đăng nhập.', 'Lỗi đăng nhập', [ 'response' => 403 ] );
    }

    // Find or create WordPress user
    $email      = sanitize_email( $profile['email'] );
    $google_id  = sanitize_text_field( $profile['id'] ?? '' );
    $name       = sanitize_text_field( $profile['name'] ?? '' );
    $avatar_url = esc_url_raw( $profile['picture'] ?? '' );

    $user = get_user_by( 'email', $email );

    if ( ! $user ) {
        // Create new user with random password (they login via Google)
        $username = sanitize_user( strtolower( explode( '@', $email )[0] ) );

        // Ensure unique username
        $base_username = $username;
        $counter       = 1;
        while ( username_exists( $username ) ) {
            $username = $base_username . $counter;
            $counter++;
        }

        $user_id = wp_insert_user( [
            'user_login'   => $username,
            'user_email'   => $email,
            'user_pass'    => wp_generate_password( 24 ),
            'display_name' => $name ?: $username,
            'role'         => 'subscriber',
        ] );

        if ( is_wp_error( $user_id ) ) {
            wp_die( 'Không thể tạo tài khoản. Vui lòng thử lại.', 'Lỗi đăng nhập', [ 'response' => 500 ] );
        }

        $user = get_user_by( 'id', $user_id );
    }

    // Store Google metadata
    update_user_meta( $user->ID, '_maf_google_id', $google_id );
    if ( $avatar_url ) {
        update_user_meta( $user->ID, '_maf_social_avatar', $avatar_url );
    }

    // Log the user in
    wp_clear_auth_cookie();
    wp_set_current_user( $user->ID );
    wp_set_auth_cookie( $user->ID, true );

    // Honor SSO redirect target if the user came from app.maf.run via the SSO gateway.
    $redirect = maf_sso_post_login_redirect( $user->ID );
    // wp_safe_redirect blocks external hosts; the mu-plugin already whitelists app.maf.run
    // via the allowed_redirect_hosts filter, so this is safe.
    wp_safe_redirect( $redirect );
    exit;
} );

/**
 * Get user avatar URL — prefer Google avatar, fall back to Gravatar.
 */
function maf_get_user_avatar_url( int $user_id = 0, int $size = 40 ): string {
    if ( ! $user_id ) {
        $user_id = get_current_user_id();
    }
    if ( ! $user_id ) {
        return '';
    }

    $social_avatar = get_user_meta( $user_id, '_maf_social_avatar', true );
    if ( $social_avatar ) {
        return esc_url( $social_avatar );
    }

    return get_avatar_url( $user_id, [ 'size' => $size ] );
}

/**
 * Get logout URL that redirects back to current page (or homepage).
 */
function maf_get_logout_url(): string {
    $redirect = is_front_page() ? home_url( '/' ) : get_permalink();
    return wp_logout_url( $redirect ?: home_url( '/' ) );
}

/**
 * Verify reCAPTCHA v3 token with Google's API.
 *
 * Returns the score on success, false when Google judged the token invalid
 * (likely bot), or null when verification itself is unavailable (misconfigured
 * keys / Google unreachable) — a config failure must not be treated as a bot.
 */
function maf_verify_recaptcha( string $token ): float|false|null {
    $response = wp_remote_post( 'https://www.google.com/recaptcha/api/siteverify', [
        'body' => [
            'secret'   => MAF_RECAPTCHA_SECRET_KEY,
            'response' => $token,
            'remoteip' => maf_client_ip(),
        ],
    ] );

    if ( is_wp_error( $response ) ) {
        return null;
    }

    $body = json_decode( wp_remote_retrieve_body( $response ), true );
    if ( empty( $body['success'] ) ) {
        $codes = (array) ( $body['error-codes'] ?? [] );
        if ( in_array( 'invalid-input-secret', $codes, true ) ) {
            return null; // keys misconfigured — unavailable, not a bot verdict
        }
        return false;
    }

    return (float) ( $body['score'] ?? 0 );
}

/**
 * AJAX login handler — password form with reCAPTCHA v3 + honeypot + rate limiting.
 */
add_action( 'wp_ajax_nopriv_maf_ajax_login', 'maf_handle_ajax_login' );
function maf_handle_ajax_login(): void {
    if ( ! check_ajax_referer( 'maf_ajax_login', 'maf_login_nonce', false ) ) {
        wp_send_json_error( [ 'message' => 'Phiên đăng nhập đã hết hạn. Vui lòng tải lại trang.' ] );
    }

    if ( ! empty( $_POST['maf_website_url'] ) ) {
        wp_send_json_error( [ 'message' => 'Yêu cầu không hợp lệ.' ] );
    }

    // reCAPTCHA v3 — advisory when unavailable. An empty token means the browser
    // could not obtain one (blocked script or invalid site key); a null verdict
    // means Google/keys are misconfigured. Neither may lock out real users:
    // nonce + honeypot + IP rate limiting below remain enforced regardless.
    $recaptcha_token = sanitize_text_field( $_POST['recaptcha_token'] ?? '' );
    if ( $recaptcha_token !== '' ) {
        $score = maf_verify_recaptcha( $recaptcha_token );
        if ( $score === null ) {
            error_log( '[MAF LOGIN] reCAPTCHA verification unavailable (misconfigured keys?) — proceeding with rate limiting only' );
        } elseif ( $score === false || $score < 0.5 ) {
            wp_send_json_error( [ 'message' => 'Xác minh bảo mật thất bại. Vui lòng thử lại.' ] );
        }
    } else {
        error_log( '[MAF LOGIN] reCAPTCHA token missing (script blocked or invalid site key) — proceeding with rate limiting only' );
    }

    // Read credentials first so the rate-limit key can be account-scoped.
    $username = sanitize_user( $_POST['log'] ?? '' );
    $password = $_POST['pwd'] ?? '';
    $remember = ! empty( $_POST['rememberme'] );

    if ( empty( $username ) || empty( $password ) ) {
        wp_send_json_error( [ 'message' => 'Vui lòng nhập tên đăng nhập và mật khẩu.' ] );
    }

    // Rate limiting — key on the real Cloudflare client IP (not the spoofable
    // REMOTE_ADDR / shared tunnel IP) AND the target username, so repeated
    // failures against one account cannot lock out other users behind the same IP.
    $client_ip  = maf_client_ip();
    $transient  = 'maf_login_fails_' . md5( $client_ip . '|' . strtolower( $username ) );
    $fail_count = (int) get_transient( $transient );
    if ( $fail_count >= 5 ) {
        wp_send_json_error( [ 'message' => 'Quá nhiều lần thử. Vui lòng đợi 15 phút.' ] );
    }

    $user = wp_signon( [
        'user_login'    => $username,
        'user_password' => $password,
        'remember'      => $remember,
    ], is_ssl() );

    if ( is_wp_error( $user ) ) {
        set_transient( $transient, $fail_count + 1, 15 * MINUTE_IN_SECONDS );
        wp_send_json_error( [ 'message' => 'Tên đăng nhập hoặc mật khẩu không đúng.' ] );
    }

    delete_transient( $transient );

    // If user arrived via SSO gateway (app.maf.run redirect), generate a one-time SSO code
    // and send them straight to the app callback. Otherwise default to homepage.
    $redirect = maf_sso_post_login_redirect( $user->ID );
    wp_send_json_success( [ 'redirect' => $redirect ] );
}

/**
 * Resolve the post-login redirect target. If the user arrived via the SSO gateway
 * (which sets the maf_sso_pending cookie), mint an SSO code and return the app
 * callback URL. Otherwise return the WordPress homepage.
 *
 * Lives in the theme but depends on helpers from the maf-sso-provider mu-plugin.
 */
function maf_sso_post_login_redirect( int $user_id ): string {
    $home = home_url( '/' );

    $pending = isset( $_COOKIE['maf_sso_pending'] ) ? esc_url_raw( wp_unslash( $_COOKIE['maf_sso_pending'] ) ) : '';
    if ( empty( $pending ) ) {
        return $home;
    }

    if ( ! function_exists( 'maf_sso_is_allowed_origin' ) || ! function_exists( 'maf_sso_generate_code' ) ) {
        return $home;
    }
    if ( ! maf_sso_is_allowed_origin( $pending ) ) {
        return $home;
    }

    // Consume the cookie so a stale value doesn't keep redirecting the user.
    setcookie( 'maf_sso_pending', '', [
        'expires'  => time() - 3600,
        'path'     => '/',
        'secure'   => is_ssl(),
        'httponly' => true,
        'samesite' => 'Lax',
    ] );

    $code      = maf_sso_generate_code( $user_id );
    $separator = ( strpos( $pending, '?' ) !== false ) ? '&' : '?';
    return $pending . $separator . 'code=' . $code;
}

/**
 * Enqueue reCAPTCHA v3 script and login config for frontend.
 */
add_action( 'wp_enqueue_scripts', function () {
    if ( is_user_logged_in() ) {
        return;
    }
    wp_enqueue_script(
        'google-recaptcha',
        'https://www.google.com/recaptcha/api.js?render=' . MAF_RECAPTCHA_SITE_KEY,
        [],
        null,
        true
    );
    wp_localize_script( 'maf-main', 'mafLogin', [
        'ajaxUrl'       => admin_url( 'admin-ajax.php' ),
        'recaptchaSite' => MAF_RECAPTCHA_SITE_KEY,
    ] );
} );
