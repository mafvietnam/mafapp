# Phase 06 — Production Deploy + Prod E2E + Fix/Redeploy Loop

## Context Links
- Deploy target: VPS `root@72.61.125.159`, project `/opt/maf-tool/full-maf-coaching-tool`, Docker Compose + Cloudflare Tunnel. Public: `https://app.maf.run` (FE), `https://api.maf.run` (API).
- `docs/deployment-guide.md` → "Updates" (git pull + compose build/up). `api/Dockerfile` CMD = `node dist/main.js` (NO auto-migrate — migration is a manual step).
- NOTE: the `tony:deploy` skill targets a DIFFERENT repo (Packer Lab / 72.60.211.23) — do NOT use it here. Use the maf.run compose flow below.

## Overview
- **Priority:** P1
- **Status:** pending
- **Description:** Merge/push code, deploy API + FE images to prod, run the new `0003` migration against prod DB, verify all detail-page features on `https://app.maf.run` with real data, and loop fix→redeploy until green.

## Key Insights
- **Migration is manual AND must precede the serving code.** `prisma` is a runtime dependency (in api `dependencies`, not devDeps) and `/app/prisma` is copied into the image. **[Red-team] Run the migration BEFORE bringing up the new api/FE** — if the new code (which queries `StravaActivityDetail`) serves before the table exists, any click on the freshly-deployed dashboard `<Link>` → Prisma "relation does not exist" → 500. Use a one-off container against the NEW image to migrate, THEN `up -d` the serving containers:
  ```bash
  docker compose build maf-api maf-app                              # build new images first
  docker compose run --rm maf-api npx prisma migrate deploy         # migrate BEFORE serving
  docker compose up -d maf-api maf-app                              # now serve new code (table exists)
  ```
- **Tag the current images before deploy for a real rollback** — `docker compose build` rebuilds from the checkout, so without a tag there is no previous image to revert to. `docker tag` api+app to `:pre-detail` before rebuilding; rollback = re-tag/up the saved images + `git checkout` prior commit.
- FE Vite inlines env at build → rebuild `maf-app` image to ship the new route/bundle. recharts is bundled into the lazy chunk.
- Cache-first design keeps prod Strava quota safe during E2E; still limit E2E to ≤5 activities.
- Migration is purely additive (new table only) → **forward-fix preferred**: rollback = `DROP TABLE StravaActivityDetail` + revert images. A full DB restore is a last resort (it would also clobber user data written since the snapshot).

## Requirements
### Functional
- Prod `/activities/:id` works end-to-end with real synced activities: hydrates on first open, caches after, MAF sections + chart render, degradation paths behave, dashboard links navigate.
### Non-functional
- No downtime beyond container restart. No 500s. No secrets in logs. Existing dashboard/profile/admin unaffected.

## Implementation Steps
1. **Commit + push** (conventional commits, no AI refs):
   ```bash
   git add -A
   git commit -m "feat(strava): activity detail page with MAF analysis + lazy detail cache"
   git push origin dev
   ```
2. **Snapshot prod DB** (safety — additive migration, so this is a fallback not the primary rollback). Write compressed, mode-600, OUTSIDE the deploy tree, and delete after successful deploy (dump contains all-user PII):
   ```bash
   ssh root@72.61.125.159
   cd /opt/maf-tool/full-maf-coaching-tool
   umask 077
   docker compose exec -T postgres pg_dump -Fc -U maf_user maf > /root/secure-backups/backup-pre-detail-$(date +%Y%m%d).dump
   # after a confirmed-green deploy (step 6): shred -u the dump
   ```
3. **Build new images + tag current for rollback** (on VPS):
   ```bash
   git pull origin dev
   docker tag maf-api:latest maf-api:pre-detail 2>/dev/null || true   # save rollback point
   docker tag maf-app:latest maf-app:pre-detail 2>/dev/null || true
   docker compose build maf-api maf-app                                # build BEFORE migrate/serve
   ```
4. **Migrate BEFORE serving, then bring up** (one-off container on new image → table exists before code serves):
   ```bash
   docker compose run --rm maf-api npx prisma migrate deploy          # migrate first
   docker compose exec -T postgres psql -U maf_user -d maf -c '\d "StravaActivityDetail"'   # verify table
   docker compose up -d maf-api maf-app                               # now serve new code
   docker compose ps                                                  # both healthy
   ```
5. **Smoke API directly** (optional, from VPS): hit `/strava/activities` then `/strava/activities/:id/detail` with a valid JWT; confirm shape + no token leak.
6. **Prod E2E** on `https://app.maf.run` (logged-in real user, ≤5 activities):
   | Check | Expected |
   |---|---|
   | Dashboard mobile card + desktop row click | Route to `/activities/:id` |
   | First open (HR activity) | Hydrates <2s; verdict + time-in-zone + HR chart + MAF band + splits + drift + efficiency |
   | Reload | Instant, cache hit (api logs no Strava fetch) |
   | No-HR / manual activity | NoHrNotice; HR sections hidden; stats/splits render |
   | HR chart actually renders (not blank) | recharts v3 draws line + MAF band (blank = React 19 mismatch — see phase-04) |
   | "Xem trên Strava" + PoweredByStrava | Correct link + attribution visible (API compliance) |
   | Deleted/unauthorized (if reproducible) | Reason notice + retry; no 500 |
   | Invalid id | Error state, no crash |
   | Existing dashboard / profile / admin | Unchanged |
7. **Fix/redeploy loop:** on any failure → capture `docker compose logs --tail=50 maf-api`, fix code locally, re-run phase-05 gate, repeat steps 1-6. Do NOT retry blindly.
8. **Docs:** update `docs/project-changelog.md` (feature entry) + `docs/system-architecture.md` (new table + endpoint + lazy-hydration flow). Note `StravaActivityDetail` in schema docs. (Delegate to docs-manager per workflow.)

## Todo List
- [ ] Commit + push to dev
- [ ] Prod DB snapshot (compressed, mode-600, outside deploy tree)
- [ ] `git pull` + `docker tag :pre-detail` rollback point + build maf-api/maf-app
- [ ] `migrate deploy` via one-off container BEFORE `up -d`; table verified; THEN serve
- [ ] Prod E2E matrix all pass (≤5 activities) incl. HR chart actually renders
- [ ] Shred snapshot after green
- [ ] Cache-hit confirmed on reload
- [ ] Degradation states confirmed
- [ ] Existing features regression-free
- [ ] Changelog + architecture docs updated

## Success Criteria
- `https://app.maf.run/activities/:id` fully functional on real data: <2s first load, instant cached, MAF analysis renders, all degradation states graceful, zero 500s, dashboard links work.
- `StravaActivityDetail` table present in prod; migration recorded in `_prisma_migrations`.
- No existing feature regressed. Docs updated.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Migration fails on prod (schema drift) | Low | High | Snapshot first; `migrate deploy` is additive; rollback = drop new table + re-tag prior images |
| New code serves before table exists → 500 storm | Med | High | `run --rm ... migrate deploy` BEFORE `up -d`; verify table before serving |
| Bad image, no rollback point | Med | Med | `docker tag :pre-detail` before rebuild; rollback = re-up saved tag + `git checkout` prior |
| Strava quota hit during E2E | Low | Med | Cache-first; throttle 30/min; ≤5 activities; retry disabled on rate_limited |
| Real Strava shape mismatch surfaces only in prod | Low | Med | Whitelist single-file patch → phase-05 gate → redeploy |
| Cloudflare caches old FE bundle | Med | Low | Hashed Vite asset names bust cache; purge CF cache if needed |
| Container `prisma` CLI missing | Low | Med | Confirmed `prisma` in api dependencies + prisma/ copied into image |

## Security Considerations
- Verify prod `/detail` response omits tokens + raw blob (network tab / curl).
- Migration run via `exec` inside container — no new port/secret exposure.
- Do NOT paste DB password / JWT / Strava secrets into logs, commits, or this plan.
- Confirm edge tiers (deleted/unauthorized/rate_limited) return graceful JSON, never stack traces, in prod.

## Next Steps
- Feature complete. Deferred follow-ups (separate plans): map/polyline view, MAF pace trend across activities, Garmin detail parity.
</content>
