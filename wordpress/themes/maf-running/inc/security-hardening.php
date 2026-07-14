<?php
/**
 * Security hardening for maf.run WordPress site.
 * Disables unnecessary endpoints and features to reduce attack surface.
 */

// 1. Disable REST API user enumeration (prevents username discovery)
add_filter( 'rest_endpoints', function( $endpoints ) {
    if ( ! is_user_logged_in() ) {
        unset( $endpoints['/wp/v2/users'] );
        unset( $endpoints['/wp/v2/users/(?P<id>[\d]+)'] );
    }
    return $endpoints;
} );

// 2. Disable author archives (another username enumeration vector)
add_action( 'template_redirect', function() {
    if ( is_author() && ! is_user_logged_in() ) {
        wp_redirect( home_url(), 301 );
        exit;
    }
} );

// 3. Block ?author=N enumeration
add_action( 'template_redirect', function() {
    if ( isset( $_GET['author'] ) && ! is_user_logged_in() ) {
        wp_redirect( home_url(), 301 );
        exit;
    }
} );

// 4. Remove WordPress version from head (info disclosure)
remove_action( 'wp_head', 'wp_generator' );

// 5. Disable XML-RPC (already blocked at Cloudflare, belt-and-suspenders)
add_filter( 'xmlrpc_enabled', '__return_false' );

// 6. Remove unnecessary head links
remove_action( 'wp_head', 'rsd_link' );
remove_action( 'wp_head', 'wlwmanifest_link' );
remove_action( 'wp_head', 'wp_shortlink_wp_head' );

// 7. Remove REST API and oEmbed discovery links from <head> (WP fingerprints)
remove_action( 'wp_head', 'rest_output_link_wp_head' );
remove_action( 'wp_head', 'wp_oembed_add_discovery_links' );
remove_action( 'wp_head', 'wp_oembed_add_host_js' );

// 8. Strip ?ver= query strings from enqueued styles/scripts (version fingerprinting)
//    EXCEPT for theme-owned assets, which need filemtime-based cache busting after each deploy.
add_filter( 'style_loader_src', 'maf_remove_ver_query', 10, 2 );
add_filter( 'script_loader_src', 'maf_remove_ver_query', 10, 2 );
function maf_remove_ver_query( $src, $handle ) {
    // Preserve ?ver= for theme-owned assets so browsers/CDNs pick up new builds.
    if ( strpos( $src, get_template_directory_uri() ) === 0 ) {
        return $src;
    }
    if ( strpos( $src, '?ver=' ) ) {
        $src = remove_query_arg( 'ver', $src );
    }
    return $src;
}

// 9. Disable WP-Cron on page load (use system cron instead if needed)
if ( ! defined( 'DISABLE_WP_CRON' ) ) {
    define( 'DISABLE_WP_CRON', false );
}

// 10. Limit login attempts (simple in-theme rate limiter)
add_filter( 'authenticate', function( $user, $username, $password ) {
    if ( empty( $username ) ) {
        return $user;
    }

    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $transient_key = 'login_attempts_' . md5( $ip );
    $attempts = (int) get_transient( $transient_key );

    if ( $attempts >= 5 ) {
        return new WP_Error( 'too_many_attempts',
            'Too many login attempts. Please try again in 15 minutes.' );
    }

    return $user;
}, 30, 3 );

add_action( 'wp_login_failed', function( $username ) {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $transient_key = 'login_attempts_' . md5( $ip );
    $attempts = (int) get_transient( $transient_key );
    set_transient( $transient_key, $attempts + 1, 15 * MINUTE_IN_SECONDS );
} );
