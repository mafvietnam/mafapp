---
title: "Strava OAuth2 Integration — Activity Sync + MAF Lab"
description: "Connect Strava via OAuth2, sync running activities via webhook+cron, mirror Garmin integration pattern"
status: in-progress
priority: P1
effort: 8d
branch: dev
tags: [strava, oauth2, webhook, sync, maf-lab]
created: 2026-04-07
---

# Strava Integration Plan

## Summary

Add Strava OAuth2 connection so users can link their Strava account and sync running activities into the MAF app. Mirrors Garmin integration architecture with key difference: OAuth2 tokens (not credentials) + official webhook support.

**Approach:** OAuth2 PKCE-compatible flow → hybrid sync (webhook real-time + manual + daily cron fallback).

## Data Flow

```
Strava Cloud --> StravaWebhookService (POST /strava/webhook)
             --> StravaSyncService (manual/cron)
                --> PostgreSQL (StravaActivity upsert)
                --> Redis (sync locks, token state)
Frontend <-- REST API <-- StravaController <-- StravaService <-- PostgreSQL
```

## Phases

| # | Phase | Key Deliverable | Effort | Status |
|---|-------|-----------------|--------|--------|
| 1 | [Foundation & Prisma Models](phase-01-foundation-and-prisma-models.md) | DB schema, StravaModule skeleton, encryption, feature flag | 1d | Complete (migration pending) |
| 2 | [OAuth2 Connection Flow](phase-02-oauth2-connection-flow.md) | Connect/disconnect endpoints, token exchange, frontend card | 2d | Pending |
| 3 | [Webhook & Sync Engine](phase-03-webhook-and-sync-engine.md) | Webhook subscription, event handler, sync service, dedup | 3d | Complete |
| 4 | [Cron Fallback & MAF Lab](phase-04-cron-and-maf-lab-integration.md) | Daily cron, activity list endpoint, MAF Lab auto-fill hook | 2d | Complete |

## Dependencies

- Phase 2 depends on Phase 1 (needs DB models + module skeleton)
- Phase 3 depends on Phase 2 (needs working OAuth tokens to call Strava API)
- Phase 4 depends on Phase 3 (needs synced activities in DB)

## Env Vars Required

| Variable | Purpose |
|----------|---------|
| `STRAVA_CLIENT_ID` | Strava API application client ID |
| `STRAVA_CLIENT_SECRET` | Strava API application client secret |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | Random string for webhook subscription verification |
| `STRAVA_ENCRYPTION_KEY` | AES-256 key for token encryption at rest (64 hex chars) |
| `FEATURE_STRAVA` | Feature flag — set to `true` to enable Strava UI + routes (default: false) |

## Key Differences from Garmin

| Aspect | Garmin | Strava |
|--------|--------|--------|
| Auth | Encrypted credentials | OAuth2 access + refresh tokens |
| Token expiry | N/A (credentials) | 6 hours — must auto-refresh |
| Real-time sync | No webhook support | Official webhook push |
| Sync frequency | 2-hour cron | Webhook + daily cron fallback |
| Daily health data | HR/steps/sleep summaries | None (activities only) |

## Rollback

**Phases 1-3**: Additive (new module, new tables). Rollback = revert migration + remove StravaModule import from app.module.ts.
**Phase 4**: Modifies profile-page.tsx, maf-lab.tsx. Rollback requires file-level reverts. All Strava hooks must be crash-safe (return null on error).

## Success Criteria

- User can connect/disconnect Strava from Profile page (when FEATURE_STRAVA=true)
- New Strava run appears in app within 60s of upload (webhook path)
- Manual sync imports last 30 days of running activities
- Duplicate Garmin+Strava runs show once in MAF analysis (Strava wins)
- Token refresh is transparent — no user action required

## Reports

- [Brainstorm](../reports/brainstorm-260407-1549-strava-integration.md)
