# Phase 07 — E2E + Deploy Prod

**Priority:** P0 (ship) | **Status:** pending | **Depends:** 01-06 pass

## Overview
Build → deploy staged lên VPS (drift-safe migration) → E2E Playwright TẤT CẢ tính năng (upload + regression sync/detail/coaching). Bug → fix → redeploy → lặp đến hoàn tất.

## Deploy topology (memory: vps-deployment-server + prod-prisma-migration-drift)
- SSH: `ssh root@72.61.125.159` (key-auth passwordless).
- Source repo: `/opt/maf-tool/repo` (git origin/dev). LIVE compose: `/opt/maf-tool/full-maf-coaching-tool` (có .env).
- Images: `maf-api:v1` (context repo/api, CMD `node dist/main.js` — KHÔNG auto-migrate), `maf-app:v6-sso`.

## Migration prod (DRIFT — KHÔNG blind migrate deploy)
1. `cat api/prisma/migrations/<ts>_add_activity_source/migration.sql | docker compose exec -T postgres sh -c "psql -U \$POSTGRES_USER -d maf -v ON_ERROR_STOP=1"`
2. `docker compose exec -T maf-api npx prisma migrate resolve --applied <ts>_add_activity_source`
   (additive ALTER TABLE ADD COLUMN + CREATE TYPE — an toàn, không đụng data cũ; default STRAVA nên rows cũ hợp lệ)

## Deploy steps
1. Commit + push dev (git-manager / tony-ship lo phần này).
2. `cd /opt/maf-tool/repo && git pull --ff-only origin dev`
3. `docker tag maf-api:v1 maf-api:pre-upload && docker tag maf-app:v6-sso maf-app:pre-upload` (rollback point)
4. `cd /opt/maf-tool/full-maf-coaching-tool && docker compose build maf-api maf-app`
5. **Migration** (bước trên) TRƯỚC khi up api mới.
6. `docker compose up -d maf-api` → verify healthy (`docker compose ps`, `curl https://api.maf.run/health`)
7. `docker compose up -d maf-app`. **NEVER bare `up -d`** (recreate tunnel/wordpress).
8. `echo <sha> > /opt/maf-tool/full-maf-coaching-tool/DEPLOYED_SHA`

## E2E (Playwright, prod app.maf.run)
Auth: mint owner JWT trong maf-api container (userId `ff9be803-61b1-4e8f-924c-79f624e7a9ec`), inject cookie `maf_access` (httpOnly) qua `context.addCookies`.

**Upload feature:**
- [ ] Dashboard hiển thị card upload. Upload 1 GPX Strava thật (có HR) → "✓ Đã nhập" + link.
- [ ] Activity upload xuất hiện trong danh sách dashboard (pace, MAF zone màu).
- [ ] Mở detail → HR chart render, MAF zone band, coaching insights card, `hydrated:true`, network KHÔNG có call tới strava.com.
- [ ] Re-upload cùng file → không nhân bản (count không tăng).
- [ ] Upload TCX treadmill → distance>0 (từ DistanceMeters).
- [ ] Upload file .txt → báo lỗi rõ, không crash.
- [ ] File >5MB → bị chặn.

**Regression (không hồi quy):**
- [ ] Sync Strava OAuth vẫn chạy (owner đã connect) — manual sync ok.
- [ ] Detail page activity SYNC (numeric ID) vẫn hydrate từ Strava.
- [ ] Disconnect OAuth (test acct) → activity SYNC bị xoá, activity UPLOAD CÒN.

## Bug-fix loop
Mỗi bug: debug → fix code → chạy lại test liên quan → rebuild ảnh đụng → deploy staged → E2E lại. Lặp đến khi mọi checkbox pass.

## Todo
- [ ] Migration prod applied + resolve
- [ ] Deploy staged api→app, DEPLOYED_SHA cập nhật
- [ ] Toàn bộ E2E upload pass
- [ ] Regression pass
- [ ] Rollback tag `:pre-upload` tồn tại

## Success criteria
Mọi checkbox E2E pass trên prod; upload → MAF analysis đầy đủ; sync/detail/disconnect không hồi quy; DEPLOYED_SHA = commit mới.
