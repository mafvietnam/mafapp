# WordPress MU-Plugin: MAF SSO Provider

## Deployment

Copy `mu-plugins/maf-sso-provider.php` to your WordPress installation:

```bash
scp mu-plugins/maf-sso-provider.php user@server:/path/to/wordpress/wp-content/mu-plugins/
```

MU-plugins are auto-loaded by WordPress — no activation needed.

## Custom Login Page Integration

If maf.run uses a custom login modal (not wp-login.php), the custom login handler must:

1. Accept `redirect_uri` query param on the login page URL
2. After successful authentication, call `maf_sso_generate_code($user_id)` 
3. Redirect to: `{redirect_uri}?code={generated_code}`

Example for custom AJAX login handler:
```php
// In your custom login AJAX handler, after wp_signon() succeeds:
if (isset($_POST['redirect_uri']) && !empty($_POST['redirect_uri'])) {
    $redirect_uri = esc_url_raw($_POST['redirect_uri']);
    if (maf_sso_is_allowed_origin($redirect_uri)) {
        $code = maf_sso_generate_code($user->ID);
        $separator = (strpos($redirect_uri, '?') !== false) ? '&' : '?';
        wp_send_json_success(['redirect' => $redirect_uri . $separator . 'code=' . $code]);
    }
}
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/wp-json/maf/v1/auth` | Validate credentials, return user info |
| GET | `/wp-json/maf/v1/sso/verify?code=XXX` | Exchange one-time code for user info |

## Security

- One-time codes: 32 bytes entropy, SHA-256 stored, HMAC integrity, 5min TTL
- Rate limiting: 5 attempts/min per IP on auth endpoint
- Origin whitelist: only `app.maf.run` and `localhost:5173` (dev)
