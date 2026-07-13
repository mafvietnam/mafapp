# Post-Activation Verification Runbook — Strava sync/webhook (scenarios #9, #18, #19)

Everything code-side is done and deployed (prod = HEAD). These 3 scenarios are blocked ONLY by the Strava app being **"Inactive"** (Strava subscriber-only policy; owner account `mafvietnam2021@gmail.com` is Free). The moment the app is **Active**, run this — no code/deploy changes needed.

## Step 0 — Confirm the app is Active (30 sec)

Run locally or on the server:
```bash
curl -s "https://www.strava.com/api/v3/push_subscriptions?client_id=221736&client_secret=d7109702ad86627981451378dfcdd86a5f146a97"
```
- **Inactive (still blocked):** `{"errors":[{"resource":"Application","field":"Status","code":"Inactive"}]}`
- **Active (ready):** `[]` (empty array — no subscriptions yet) or a subscription list. Proceed.

## Step 1 — Register the webhook subscription (scenario #19)

Admin re-saves Strava settings (triggers `refreshSubscription()` while the API is listening — the reliable registration path):
1. Log in as admin → `/admin/settings` → Strava section → click **Save** (credentials already stored).
2. Confirm on Strava side:
```bash
curl -s "https://www.strava.com/api/v3/push_subscriptions?client_id=221736&client_secret=d7109702ad86627981451378dfcdd86a5f146a97"
# expect a subscription with callback_url = https://api.maf.run/strava/webhook
```

## Step 2 — Connect + sync a real athlete (scenarios #8→#12, #9)

1. Log in → `/profile` → **Kết nối Strava** → authorize on Strava (consent screen shows, `activity:read_all` checked → Authorize).
2. Back on profile with `?strava_connected=1`. Click **Đồng bộ** (or wait for the auto-sync on connect).
3. Confirm activities landed:
```bash
# on server:
docker exec maf-postgres sh -c 'psql -U "$POSTGRES_USER" -d maf -tAc "SELECT count(*) FROM \"StravaActivity\";"'
# in browser (logged in): GET /api/strava/activities  → total > 0
```
4. **Dashboard** → real activities render (pace M:SS /km, MAF-zone HR colors).
5. **MAF Lab** (`/plan` → Phòng MAF Test → step 2) → "Powered by Strava" banner offers the latest run's HR.

## Step 3 — Webhook live event (scenario #19)

Record/upload a new Run on Strava (or edit one) → Strava pushes an event → confirm:
```bash
docker exec ... # or:
ssh root@72.61.125.159 'cd /opt/maf-tool/full-maf-coaching-tool && docker compose logs --since 5m maf-api | grep -i "Webhook"'
# expect a processed activity + it appears via /api/strava/activities
```

## Step 4 — Admin manual sync (scenario #18)

`/admin/strava` → the connected user's row → **Sync** button → timestamps update, activity count rises.

## Step 5 — Housekeeping

- The Strava app shows **6 athletes currently connected** (stale authorizations from earlier testing) vs. our DB. Once Active, `disconnect()` will successfully deauthorize on the Strava side too. To free slots proactively, the athletes can revoke at strava.com/settings/apps, or an admin "force-disconnect + deauthorize" action can be added (backlog).
- Confirm `strava.maxAthletes` = 10 (already set).

## Expected end state: 20/20 E2E green

All code paths are already proven (unit tests + live receiver/security-gate + fixture-verified display). Step 0 going green is the only precondition.
