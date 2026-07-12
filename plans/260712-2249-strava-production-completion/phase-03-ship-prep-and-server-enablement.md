# Phase 3 — Ship Prep + Server Enablement (Big-Bang Deploy)

## Context Links

- Plan: [plan.md](plan.md) · blocked by Phase 1 + Phase 2
- Server: VPS `72.61.125.159` (root, SSH key), project `/opt/maf-tool/full-maf-coaching-tool` (NOT a git repo — deploy = file copy + `docker compose build`)
- Local compose: `docker-compose.yml` · API image: `api/Dockerfile` (runtime bundles `prisma/` + prisma CLI via prod deps)

## Overview

- **Priority:** P1 · **Status:** pending · **Effort:** 0.7d
- Commit the WordPress SSO fix, pass local gates, then ship. This is a **big-bang** update: prod runs an API image predating current code (missing `GARMIN_ENCRYPTION_KEY` proves it) → SSO, admin, garmin, strava, shared all go live at once. Order: hygiene → discover → backup → keys/env → rsync → **bridge+baseline migrate** → staged build/up → admin-enable → verify.

## Key Insights

- Joi requires `GARMIN_ENCRYPTION_KEY` (64-hex) **unconditionally** and `STRAVA_ENCRYPTION_KEY` (64-hex) when `FEATURE_STRAVA=true`. Prod `.env` has neither → API refuses to boot until added. Generate both.
- > 🔴 **RED TEAM #C2 (Critical):** Prod DB almost certainly has core tables (`User`, …) but **no `_prisma_migrations`**, and its schema is a *partial subset* of `0001_init` (authored 2026-04-08 as a from-scratch squash that already includes strava/garmin/AppSetting tables; the running image predates it). So: a naive `migrate deploy` fresh-apply dies on `CREATE TABLE "User"` already exists (wedged **P3009**); a blind `resolve --applied 0001` skips creating the *new* tables → runtime "relation AppSetting does not exist". Correct path = **schema-diff bridge + baseline** (step 13). The "fresh apply" branch is REMOVED for a DB that already holds user data.
- > 🔴 **RED TEAM #C3 (Critical):** The feature is **dead-on-arrival with env vars alone.** `featureEnabled` = `AppSetting 'strava.enabled'` (default `'false'`, **no env fallback**, app-settings.service.ts:133) and the connect card renders `null` when false; `/admin/settings` reads DB only. Env creds only feed the boot-time webhook registration attempt. **Must** log into `/admin/settings` post-boot, paste creds + toggle `strava.enabled` ON, save (this save also triggers webhook resubscribe-on-save → recovery for #H7).
- `StravaWebhookService.onModuleInit()` `await`s subscription creation **before** `app.listen()` → on first boot Strava's challenge hits a refused port → warn + no retry (🔴 H7). The admin-save resubscribe (while listening) is the reliable registration path.
- Frontend Strava gating is **build-time** (`VITE_FEATURE_STRAVA` build arg) → `maf-app` must be rebuilt, not just restarted.
- > 🔴 **RED TEAM #H8:** `cloudflared` `depends_on` maf-app/maf-api healthy and is the single ingress (possibly for maf.run too); `redis` has **no volume** → recreation wipes refresh tokens (all users logged out) + in-flight OAuth nonces. Stage the bring-up; touch tunnel last.
- Secrets: `STRAVA_CLIENT_ID/SECRET` pasted by the user → server `.env` and/or `/admin/settings` only, NEVER committed, logged, or echoed on a command line where avoidable.

## ✅ Discovery Results (2026-07-12, executed early) — SUPERSEDES assumptions above

Pre-deploy discovery ran while P1/P2 coded. Reality is FAR simpler than red-team worst case:

1. **Server layout:** compose lives in `/opt/maf-tool/full-maf-coaching-tool` (drifted, server-authoritative), source lives in **`/opt/maf-tool/repo` — a git clone of `github.com/mafvietnam/mafapp.git` at `4cfd655` (== local dev HEAD pre-session)**. Deploy = `git push` (local) → `git pull` (server) → `docker compose build`. **NO rsync needed** — C1/M12 rsync risks dissolve; clean-tree gate + DEPLOYED_SHA still apply (git provides both).
2. **Prod DB fully migrated:** `_prisma_migrations` has 6 rows (old pre-squash names + `0002_strava_admin_sync_columns` applied 2026-05-17). All tables exist (AppSetting, Strava*, Garmin*, User…). Local adds NO new migration → **skip migrate entirely this cycle** (C2 bridge unnecessary). ⚠️ Future note: local `0001_init` squash is "pending" by name — running `migrate deploy` would P3009; run `migrate resolve --applied 0001_init` in a future cycle if a new migration is ever added.
3. **Strava already configured on prod:** server compose maf-api env has `FEATURE_STRAVA=true`, GARMIN_ENCRYPTION_KEY + STRAVA_ENCRYPTION_KEY set (**DO NOT regenerate — existing encrypted data depends on them**), old app creds `STRAVA_CLIENT_ID=222309` as boot fallback. Frontend image already built with `VITE_FEATURE_STRAVA: "true"`. `.env` seeding (step 10-12) NOT needed; instead **update compose env creds old app 222309 → new app 221736** (user-provided).
4. **AppSetting DB already holds the NEW app:** `strava.clientId=221736`, `strava.enabled=true` (set 2026-05-18 via admin UI). C3 partially pre-satisfied; still **re-save the new secret via /admin/settings** (validates creds + triggers webhook resubscribe = H7 recovery).
5. **5 StravaConnection rows, ALL status ERROR** — May test remnants (1-athlete era). With H6 counting ALL rows, these eat 5 of 10 slots → **delete them during deploy** (+ note: revoke old-app access in the athlete's Strava settings if present).
6. **WP mu-plugins:** `mafweb` uses named volume `wp_data:/var/www/html` (no bind mount) → deploy via `docker cp`, backup current file first (M13 unchanged).
7. **Tunnel:** token-run (ingress in CF dashboard). WP + MySQL are in the SAME compose file → never run bare `docker compose up -d`; always name services explicitly (`up -d maf-api maf-app`) so cloudflared/mafweb/redis/postgres are not recreated (H8 satisfied; no session wipe, no tunnel restart).
8. **API healthy** (`https://api.maf.run/health` 200), running images `maf-api:v1` / `maf-app:v6-sso` built 7 weeks ago.

**Revised deploy sequence (replaces steps B/D/E below):** local commits + gates + push → pg_dump backup (container-env pattern) → retag images `:prev` → server `git pull` → update compose maf-api env (new creds) → `docker compose build maf-api maf-app` → `up -d maf-api` → health → `up -d maf-app` → health → delete ERROR connections → `docker cp` mu-plugin (with `.pre` backup) → CF purge (user) → admin UI re-save creds + verify → webhook subscription check via Strava API (server-side curl) → write DEPLOYED_SHA.

## Requirements

- WP SSO fix committed (conventional, no AI refs) and deployed to the `mafweb` container with rollback backup.
- Local gates green (lint + test + build, both `api/` and root); **clean git tree** before rsync.
- Both DBs backed up to `/root/maf-backups` (outside the sync root) before any migration; backups content-verified.
- New env vars persisted in server `.env`; new keys generated on server; `.env` backed up off-server.
- Prod schema bridged + baselined, rebuilt, healthy; admin enables feature; webhook subscription confirmed on Strava side; admin shows credentials status.

## Related Code Files

**Modify** — `wordpress/mu-plugins/maf-sso-provider.php` (commit it); `.gitignore` (🔴 C4).
**Create** — none in repo. Server-side: `/opt/maf-tool/full-maf-coaching-tool/.env`, `/root/maf-backups/*`, `$DIR/DEPLOYED_SHA`, `$DIR/bridge.sql`.
**Delete** — untrack `.claude/hooks/.logs` + `.claude/session-state` from git (🔴 C4).

## Implementation Steps

### A. Local ship prep

1. **🔴 RED TEAM #C4 — secret-log hygiene BEFORE any deploy commit.** `.claude/hooks/.logs/hook-log.jsonl` + `.claude/session-state` are git-tracked; commands that echo secrets would land in repo history via hooks. Untrack + ignore first:
   ```bash
   git rm -r --cached .claude/hooks/.logs .claude/session-state
   printf '.claude/hooks/.logs/\n.claude/session-state/\n' >> .gitignore
   git add .gitignore && git commit -m "chore: stop tracking local hook logs and session state"
   ```
2. **Commit WP SSO fix (separate commit):**
   ```bash
   git add wordpress/mu-plugins/maf-sso-provider.php
   git commit -m "fix(sso): add no-cache headers for gateway/logout and auto-open login modal"
   ```
3. **Commit Phase 1 + Phase 2 code** (separate conventional commits, e.g. `feat(strava): server-side athlete slot cap guard + deauthorize + slot status` and `feat(dashboard): render real Strava activities + slot-full UX`).
4. **Gates (must all pass):**
   ```bash
   cd api && npm run lint && npm test && npm run build          # backend
   cd .. && npx tsc --noEmit && npm run lint && npm test && npm run build   # frontend
   ```
   Fix failures before proceeding — do NOT deploy red.

### B. Pre-deploy discovery (read-only on server)

> Set `SRV=root@72.61.125.159`, `DIR=/opt/maf-tool/full-maf-coaching-tool`.

5. **🔴 RED TEAM #H8 — compose drift with an ACTION branch (not eyeball-only):**
   ```bash
   ssh $SRV "cat $DIR/docker-compose.yml" > /tmp/server-compose.yml
   diff /tmp/server-compose.yml docker-compose.yml || true
   ssh $SRV "docker inspect maf-cloudflare-tunnel --format '{{json .Config.Cmd}}'; docker exec maf-cloudflare-tunnel cloudflared tunnel info 2>/dev/null || true"
   ```
   Enumerate cloudflared ingress hostnames (does the tunnel also serve `maf.run`?). **If server compose has deltas → port them into the repo compose BEFORE rsync, or HALT.** rsync must not silently overwrite server-only tunnel/ingress config.
6. **🔴 RED TEAM #C2/#H5 — migration state + prod schema, using CONTAINER-INTERNAL env** (remote `$MAF_DB_USER` is empty in the ssh shell):
   ```bash
   ssh $SRV "docker exec maf-postgres sh -c 'psql -U \"\$POSTGRES_USER\" -d maf -c \"SELECT to_regclass('\''public._prisma_migrations'\'') ;\"'"
   ssh $SRV "docker exec maf-postgres sh -c 'psql -U \"\$POSTGRES_USER\" -d maf -c \"SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at;\"' 2>/dev/null || echo 'NO _prisma_migrations'"
   ssh $SRV "docker exec maf-postgres sh -c 'psql -U \"\$POSTGRES_USER\" -d maf -c \"\\dt public.*\"'"
   ```
   Record which tables exist. Expected outcome: core tables present, `_prisma_migrations` absent → **bridge+baseline** path (step 13). No "fresh apply".
7. **mu-plugins mount** for the WordPress container:
   ```bash
   ssh $SRV "docker inspect mafweb --format '{{json .Mounts}}'" | tr ',' '\n' | grep -i mu-plugins || true
   ssh $SRV "docker exec mafweb ls -la /var/www/html/wp-content/mu-plugins" || true
   ```
8. **Tunnel route** — confirm `api.maf.run` reaches the API: `curl -s -o /dev/null -w '%{http_code}\n' https://api.maf.run/health` (expect 200).

### C. Backup (mandatory gate) — 🔴 RED TEAM #C1 + #H5

9. **pg_dump BOTH DBs to `/root/maf-backups` (OUTSIDE the rsync root so `--delete` can't destroy them), container-internal env, content-verified:**
   ```bash
   ssh $SRV "mkdir -p /root/maf-backups && \
     docker exec maf-postgres sh -c 'pg_dump -U \"\$POSTGRES_USER\" -d maf' > /root/maf-backups/maf-\$(date +%Y%m%d-%H%M).sql && \
     docker exec mafweb-db sh -c 'mysqldump -u root -p\"\$MYSQL_ROOT_PASSWORD\" --all-databases' > /root/maf-backups/wp-\$(date +%Y%m%d-%H%M).sql"
   # MECHANICAL verify — never eyeball only:
   ssh $SRV "for f in /root/maf-backups/maf-*.sql; do test -s \$f && head -c 200 \$f | grep -q 'PostgreSQL database dump' && echo OK \$f || echo FAIL \$f; done"
   ```
   (WP DB creds/tool: if unknown, `docker exec mafweb-db env | grep MYSQL`.) **Gate: do not proceed unless both dumps print OK.**
10. **Tag current images for rollback:**
    ```bash
    ssh $SRV "docker image tag maf-api:latest maf-api:prev && docker image tag maf-app:latest maf-app:prev"
    ```

### D. Keys + env (server `.env`) — 🔴 RED TEAM #M11

11. **Audit before seeding** (redact values): `ssh $SRV "cd $DIR && grep -E '^(FEATURE_|VITE_FEATURE_|GARMIN_ENCRYPTION|STRAVA_)' .env | sed 's/=.*/=<redacted>/' || echo 'none set'"`.
12. **Anchored, value-checked seeding** (substring/empty-value greps are unsafe — match the exact intended line, else replace):
    ```bash
    ssh $SRV "cd $DIR && \
      grep -qE '^GARMIN_ENCRYPTION_KEY=[0-9a-f]{64}$' .env || { sed -i '/^#*GARMIN_ENCRYPTION_KEY=/d' .env; echo GARMIN_ENCRYPTION_KEY=\$(openssl rand -hex 32) >> .env; } && \
      grep -qE '^STRAVA_ENCRYPTION_KEY=[0-9a-f]{64}$' .env || { sed -i '/^#*STRAVA_ENCRYPTION_KEY=/d' .env; echo STRAVA_ENCRYPTION_KEY=\$(openssl rand -hex 32) >> .env; } && \
      grep -qE '^STRAVA_WEBHOOK_VERIFY_TOKEN=.+$' .env || { sed -i '/^#*STRAVA_WEBHOOK_VERIFY_TOKEN=/d' .env; echo STRAVA_WEBHOOK_VERIFY_TOKEN=\$(openssl rand -hex 24) >> .env; } && \
      grep -qE '^FEATURE_STRAVA=true$' .env || { sed -i '/^#*FEATURE_STRAVA=/d' .env; echo FEATURE_STRAVA=true >> .env; } && \
      grep -qE '^VITE_FEATURE_STRAVA=true$' .env || { sed -i '/^#*VITE_FEATURE_STRAVA=/d' .env; echo VITE_FEATURE_STRAVA=true >> .env; }"
    ```
13. **Strava app credentials — 🔴 RED TEAM #C4: write server-side WITHOUT putting the secret on a command line.** Prefer the admin UI (step 19) for the secret; if env is needed for boot-time webhook, pipe via ssh stdin heredoc:
    ```bash
    ssh $SRV "cd $DIR && cat >> .env" <<'EOF'
    STRAVA_CLIENT_ID=<PLACEHOLDER>
    STRAVA_CLIENT_SECRET=<PLACEHOLDER>
    EOF
    ```
    Then back up `.env` off-server (now holds permanent encryption keys). **User action (out of band):** set Strava app **Authorization Callback Domain = `api.maf.run`**. Note: any secret that transited chat must be rotated later via `/admin/settings`.

### E. Deploy — 🔴 RED TEAM #M12 + #C1 + #C2 + #H8

14. **Clean-tree gate + full rsync (SHA-pinned, hardened excludes):**
    ```bash
    test -z "$(git status --porcelain)" || { echo 'DIRTY TREE — commit first'; exit 1; }
    rsync -az --delete \
      --exclude .git --exclude node_modules --exclude .env --exclude dist --exclude 'api/dist' \
      --exclude build --exclude coverage --exclude backups --exclude .claude --exclude plans \
      --exclude docs --exclude .playwright-mcp --exclude '*.png' --exclude repomix-output.xml \
      ./ $SRV:$DIR/
    git rev-parse HEAD | ssh $SRV "cat > $DIR/DEPLOYED_SHA"
    ssh $SRV "test -s $DIR/.env && echo '.env intact'"   # post-rsync assertion (🔴 C1)
    ```
    (Windows: run from Git Bash / WSL. `backups` is excluded AND now lives in `/root/maf-backups` outside the sync root — 🔴 C1.)
15. **Build images:** `ssh $SRV "cd $DIR && docker compose build maf-api maf-app"`.
16. **🔴 RED TEAM #C2 — bridge + baseline migration (NOT fresh apply):**
    ```bash
    ssh $SRV "cd $DIR && docker compose up -d postgres redis"        # DB up, sessions preserved
    # (contingency) clear any prior wedged migration: docker compose run --rm maf-api node_modules/.bin/prisma migrate resolve --rolled-back 0001_init
    ssh $SRV "cd $DIR && docker compose run --rm -T maf-api sh -c 'node_modules/.bin/prisma migrate diff --from-url \"\$DATABASE_URL\" --to-schema-datamodel prisma/schema.prisma --script'" > bridge.sql
    # REVIEW bridge.sql (expect only additive CREATE/ALTER for strava/admin/AppSetting; NO DROP of user data). HALT if it drops/truncates.
    scp bridge.sql $SRV:$DIR/bridge.sql
    ssh $SRV "docker cp $DIR/bridge.sql maf-postgres:/tmp/bridge.sql && docker exec maf-postgres sh -c 'psql -U \"\$POSTGRES_USER\" -d maf -f /tmp/bridge.sql'"
    # baseline BOTH migrations as applied (history now matches schema):
    ssh $SRV "cd $DIR && docker compose run --rm maf-api node_modules/.bin/prisma migrate resolve --applied 0001_init"
    ssh $SRV "cd $DIR && docker compose run --rm maf-api node_modules/.bin/prisma migrate resolve --applied 0002_strava_admin_sync_columns"
    ssh $SRV "cd $DIR && docker compose run --rm maf-api node_modules/.bin/prisma migrate deploy"   # expect: No pending migrations
    ```
    Un-wedge reference: `prisma migrate resolve --rolled-back <name>` clears a failed (P3009) record.
17. **🔴 RED TEAM #H8 — staged bring-up (tunnel last, verify each tier in-network):**
    ```bash
    ssh $SRV "cd $DIR && docker compose up -d maf-api"
    ssh $SRV "docker exec maf-api wget -qO- http://localhost:3001/health && echo ' api-ok'"
    ssh $SRV "cd $DIR && docker compose up -d maf-app"
    ssh $SRV "docker exec maf-app wget -qO- http://localhost:80/health && echo ' app-ok'"
    ssh $SRV "cd $DIR && docker compose up -d"    # cloudflared + rest last
    ssh $SRV "docker ps --format '{{.Names}}\t{{.CreatedAt}}'"   # attribute session resets to redis recreation if any
    ```
    Known impact: if `redis` was recreated, all users must re-login + in-flight OAuth nonces drop — **schedule off-peak**, acceptable at current user scale.
18. **Deploy WP mu-plugin with rollback backup — 🔴 RED TEAM #M13:**
    ```bash
    ssh $SRV "docker cp mafweb:/var/www/html/wp-content/mu-plugins/maf-sso-provider.php /root/maf-backups/maf-sso-provider.php.pre || echo 'no prior plugin'"
    ssh $SRV "docker cp $DIR/wordpress/mu-plugins/maf-sso-provider.php mafweb:/var/www/html/wp-content/mu-plugins/maf-sso-provider.php"
    ssh $SRV "docker exec mafweb ls -l /var/www/html/wp-content/mu-plugins/maf-sso-provider.php"
    ```
    Immediately SSO smoke-check: load login, complete one login, confirm no redirect loop — BEFORE declaring Phase 3 done.
19. **🔴 RED TEAM #H10 — Cloudflare cache for the SSO fix:** origin no-cache headers do NOT purge existing edge cache, and a cached gateway page implies a Cache-Everything rule that overrides `Cache-Control`. After step 18: purge CF cache for `maf.run` (CF dashboard/API) + check for Cache Everything page/cache rules on gateway/logout paths (add a Bypass rule if present — user action via CF dashboard). Verify before Phase 4:
    ```bash
    curl -sI https://maf.run/<gateway-path> | grep -i cf-cache-status   # expect BYPASS or DYNAMIC
    ```

### F. Admin-enable + verify — 🔴 RED TEAM #C3 + #H7 + #C4

20. **Enable feature via admin (mandatory — env alone is dead-on-arrival, #C3):** log in as admin → `/admin/settings` → paste `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, webhook verify token → toggle `strava.enabled` **ON** → Save. This save triggers `refreshSubscription()` while the app is listening (reliable webhook registration, #H7). Confirm the response reports `webhookResubscribed: true` (or note `webhookResubscribeError`).
21. **Health + logs:**
    ```bash
    curl -s -o /dev/null -w 'api %{http_code}\n' https://api.maf.run/health
    curl -s -o /dev/null -w 'app %{http_code}\n' https://app.maf.run/health
    ssh $SRV "cd $DIR && docker compose logs --since 5m maf-api | grep -iE 'webhook|error|nest application successfully started'"
    ```
22. **🔴 RED TEAM #H7/#C4 — verify subscription EXISTS on Strava's side (don't trust the boot log or a local echo), secret read from `.env` server-side:**
    ```bash
    ssh $SRV "cd $DIR && set -a && . ./.env && set +a && \
      curl -s 'https://www.strava.com/api/v3/push_subscriptions?client_id='\$STRAVA_CLIENT_ID'&client_secret='\$STRAVA_CLIENT_SECRET"
    # expect a subscription whose callback_url = https://api.maf.run/strava/webhook
    # internal challenge (token never leaves the server):
    ssh $SRV "cd $DIR && set -a && . ./.env && set +a && \
      curl -s 'http://localhost:3001/strava/webhook?hub.mode=subscribe&hub.verify_token='\$STRAVA_WEBHOOK_VERIFY_TOKEN'&hub.challenge=ping123'"
    # optional external reachability (no token in chat): curl -s -o /dev/null -w '%{http_code}' 'https://api.maf.run/strava/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=x'  # expect 400
    ```
23. **Admin credentials status:** `/admin/settings` shows Strava Client ID/secret masked + `hasClientSecret=true`; `/admin/strava` shows feature enabled. (Full E2E is Phase 4.)

## Todo List

- [ ] 🔴 C4: untrack `.claude/hooks/.logs` + `session-state`, `.gitignore`, commit — BEFORE deploy commits
- [ ] Commit WP SSO fix (separate) + Phase 1/2 commits (conventional, no AI refs)
- [ ] Local gates green (api + frontend: lint/test/build/tsc)
- [ ] 🔴 H8: compose/tunnel-ingress drift discovered + ported-or-halted; 🔴 C2/H5: migration state via container env
- [ ] mu-plugins mount discovered; tunnel `api.maf.run` 200
- [ ] 🔴 C1/H5: pg_dump both DBs → `/root/maf-backups`, content-verified OK; tag `:prev` images
- [ ] 🔴 M11: audit `.env`, anchored value-checked seeding of keys/flags
- [ ] 🔴 C4: creds via admin UI / ssh-stdin (no secret on command line); `.env` backed up; user sets callback domain
- [ ] 🔴 M12: clean-tree gate + hardened-exclude rsync + `DEPLOYED_SHA`; `.env` intact assertion
- [ ] 🔴 C2: bridge.sql (migrate diff) reviewed + applied + baseline `resolve --applied` both + `migrate deploy` no-op
- [ ] 🔴 H8: staged bring-up (api→app→tunnel), per-tier in-network health, redis-reset impact noted
- [ ] 🔴 M13: mu-plugin backup `.pre` + deploy + SSO smoke check
- [ ] 🔴 H10: CF cache purge + Cache-Everything bypass; `cf-cache-status` BYPASS/DYNAMIC
- [ ] 🔴 C3/H7: admin enable (`strava.enabled` ON + creds save → resubscribe); verify sub on Strava side

## Success Criteria

- `https://api.maf.run/health` + `https://app.maf.run/health` → 200; API log "Nest application successfully started".
- `_prisma_migrations` shows `0001_init` + `0002_strava_admin_sync_columns` applied; strava/admin/AppSetting tables exist; `migrate deploy` reports no pending — with **zero user-data loss** (bridge reviewed additive-only).
- Admin toggled `strava.enabled` ON; connect card renders on prod; webhook subscription present on Strava's `push_subscriptions` list with the correct callback URL.
- SSO login works post-CF-purge (`cf-cache-status` BYPASS/DYNAMIC); mu-plugin `.pre` backup exists.
- No secrets in git (hook logs untracked) or reports; `.env` backed up off-server; `DEPLOYED_SHA` matches local HEAD.

## Risk Assessment

| Risk | L×I | Mitigation |
|------|-----|------------|
| 🔴 C2: fresh-apply wedges P3009 / baseline skips new tables | High×High | Schema-diff bridge + baseline both migrations; review bridge.sql additive-only; `resolve --rolled-back` un-wedge |
| 🔴 C1: `--delete` rsync destroys backups | Was High×High | Backups moved to `/root/maf-backups` outside sync root + `--exclude backups` + `.env` intact assertion |
| 🔴 C3: feature dead-on-arrival (DB-only enable) | High×High | Mandatory admin-enable step 20 (toggle + creds save) |
| 🔴 C4: secrets leak to git-tracked hook logs | Med×High | Untrack logs first; creds via admin UI / ssh-stdin; server-side env-sourced curls |
| 🔴 H7: boot webhook registration fails first boot | High×Med | Admin-save resubscribe (listening) + verify on Strava's push_subscriptions API |
| 🔴 H8: tunnel recreate / redis session wipe / compose drift | Med×High | Staged bring-up tunnel-last; compose drift ported-or-halt; off-peak; redis-reset impact documented |
| 🔴 H5: empty remote `$MAF_DB_USER` breaks dumps | Was High×High | Container-internal `$POSTGRES_USER`; mechanical content grep gate |
| 🔴 H10: CF Cache-Everything serves stale SSO page | Med×Med | Purge + Bypass rule; verify `cf-cache-status` |
| API refuses boot (missing 64-hex keys) | Med×High | Generate keys BEFORE build/up (step 12); verify boot log |
| 🔴 M13: no WP plugin rollback | Low×Med | `.pre` backup before overwrite + immediate SSO smoke check |

## Security Considerations

- `STRAVA_CLIENT_ID/SECRET` + encryption keys live only in server `.env` (0600) / DB (encrypted) — never committed, logged, or in reports. Hook logs untracked first (🔴 C4).
- Webhook + subscription curls source secrets from `.env` **on the server**; no token appears in a chat/command transcript (🔴 C4).
- Preserve Red Team invariants: HMAC state (via `GARMIN_ENCRYPTION_KEY`), single-use nonce, webhook resubscribe-on-save — untouched by ops.
- `migrate deploy`/`resolve` only (never `migrate dev`/`reset`) on prod. Content-verified backups precede all mutations.
- Rotate any secret that transited chat via `/admin/settings` post-launch.

## Next Steps

- Hand off to Phase 4 (E2E). Provide the E2E runner: admin login (WP creds `madm`), a **second never-connected** prod account for the slot-guard scenario, and either a Strava test account or a user for the one authorize click.
</content>
