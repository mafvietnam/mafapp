---
title: "Garmin Integration — Auto-fill MAF Lab + Dashboard + Activity Sync"
description: "Two-track Garmin integration: unofficial garmin-connect for MVP, official Health/Activity API later"
status: in-progress
priority: P1
effort: 13d
branch: dev
tags: [garmin, oauth, sync, dashboard, maf-lab]
created: 2026-04-07
---

# Garmin Integration Plan

## Summary

Add Garmin device data sync to MAF Running Coach app. Users connect their Garmin account via OAuth, app syncs activities + daily health data, auto-fills MAF Lab HR fields, and displays health widgets on dashboard.

**Approach:** Two-Track — ship fast with `garmin-connect` npm lib (unofficial), migrate to official Garmin Health/Activity API after developer program approval.

## Data Flow

```
Garmin Cloud --> garmin-connect lib --> GarminSyncService --> PostgreSQL
                                                          --> Redis (OAuth state)
Frontend <-- REST API <-- GarminController <-- GarminService <-- PostgreSQL
```

## Phases

| # | Phase | Key Deliverable | Effort | Status |
|---|-------|-----------------|--------|--------|
| 1 | [Foundation & Prisma Models](phase-01-foundation-and-prisma-models.md) | DB schema, GarminModule skeleton, encryption util | 2d | Complete |
| 2 | [OAuth & Connection Flow](phase-02-oauth-and-connection-flow.md) | Connect/disconnect endpoints, frontend button | 3d | Complete |
| 3 | [Data Sync Engine](phase-03-data-sync-engine.md) | Activity + health sync, cron, API endpoints | 3d | Complete |
| 4 | [MAF Lab Integration & Dashboard](phase-04-maf-lab-integration-and-dashboard.md) | MAF Lab auto-fill + connect card (simplified — dashboard widgets deferred) | 2d | Complete |
| 5 | [Official API Migration](phase-05-official-api-migration.md) | Swap to official Garmin Health/Activity API, webhooks | 5-7d | Pending |

## Dependencies

- Phase 2 depends on Phase 1 (needs DB models + module skeleton)
- Phase 3 depends on Phase 2 (needs working OAuth tokens)
- Phase 4 depends on Phase 3 (needs synced data in DB)
- Phase 5 independent (can start after Garmin Developer Program approval)

## Env Vars Required

| Variable | Purpose |
|----------|---------|
| `GARMIN_EMAIL` | Garmin Connect account email (MVP auth) |
| `GARMIN_PASSWORD` | Garmin Connect account password (MVP auth) |
| `GARMIN_ENCRYPTION_KEY` | AES-256 key for token encryption at rest (required, 64 hex chars) |
| `GARMIN_CLIENT_ID` | Official API client ID (Phase 5) |
| `GARMIN_CLIENT_SECRET` | Official API client secret (Phase 5) |
| `FEATURE_GARMIN` | Feature flag — set to `true` to enable Garmin UI + routes (default: false) |

## Rollback

**Phases 1-3**: Additive (new module, new tables). Rollback = revert migration + remove GarminModule import.
**Phase 4+**: Modifies core files (maf-lab.tsx, dashboard-page.tsx, profile-page.tsx). Rollback requires reverting file-level changes. All Garmin hooks must be crash-safe (return null on error, never throw) to prevent breaking non-Garmin users.

<!-- RED TEAM: Finding #13 — Rollback claim corrected. Phase 4+ requires file-level reverts, not just module removal. -->

## Success Criteria

- User can connect/disconnect Garmin from Profile page (when FEATURE_GARMIN=true)
- Activities sync automatically every 2 hours
- MAF Lab auto-populates HR from latest Garmin run
- All endpoints return proper errors on token expiry/disconnect

## Reports

- [Design](../reports/brainstorm-260407-0733-garmin-integration-design.md)
- [API Research](../reports/researcher-260407-0732-garmin-api-research.md)

## Red Team Review

### Session — 2026-04-07
**Findings:** 15 (13 accepted, 1 rejected, 1 N/A)
**Severity breakdown:** 5 Critical, 8 High, 2 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | garmin-connect missing methods (getHeartRate, getStressData) | Critical | Accept | Phase 3 |
| 2 | Storing Garmin passwords — security liability | Critical | Accept | Phase 2 |
| 3 | Encryption key defaults to empty string | Critical | Accept | Phase 1 |
| 4 | Webhook endpoint unauthenticated | Critical | Accept | Phase 5 |
| 5 | Phase 5 effort underestimated (2d → 5-7d) | Critical | Accept | Phase 5, plan.md |
| 6 | Sequential sync cascading timeouts | High | Accept | Phase 3 |
| 7 | OAuth callback no session binding | High | Accept | Phase 5 |
| 8 | rawData leaks PII to frontend | High | Accept | Phase 3, 4 |
| 9 | Design doc contradicts Phase 2 on auth | High | Accept | Design doc |
| 10 | URL param injection in MAF Lab | High | Accept | Phase 4 |
| 11 | Fire-and-forget backfill silent failures | High | Accept | Phase 3 |
| 12 | Garmin TOS violation (credential auth) | High | Reject | — |
| 13 | Rollback claim false after Phase 4 | High | Accept | plan.md |
| 14 | Disconnect doesn't clean up properly | Medium | Accept | Phase 2 |
| 15 | Phase 5 migration silently disconnects users | Medium | Accept | Phase 5 |

## Validation Log

### Session 1 — 2026-04-07
**Trigger:** Post-red-team validation before implementation
**Questions asked:** 7

#### Questions & Answers

1. **[Assumption]** garmin-connect lib may not have getHeartRate()/getStressData(). What's the plan?
   - Options: Verify first then decide | Skip daily HR in MVP | Find alternative
   - **Answer:** Verify first, then decide
   - **Rationale:** Must check actual TypeScript types before coding Phase 3. May reduce scope.

2. **[Tradeoff]** Is the throwaway credential flow worth building vs waiting for official API?
   - Options: Keep two-track | Skip MVP wait for official | Time-box 2 weeks
   - **Answer:** Keep two-track
   - **Rationale:** Credential MVP gives immediate testability. Official API pursued in parallel.

3. **[Architecture]** Add FEATURE_GARMIN env var to gate all Garmin UI?
   - Options: Yes add flag | No hooks handle it | Use connection status
   - **Answer:** Yes, add FEATURE_GARMIN env var
   - **Rationale:** Instant rollback without code changes. Backend module + frontend conditionally loaded.

4. **[Architecture]** Add BullMQ job queue for async processing?
   - Options: Fire-and-forget + tracking | Add BullMQ now | Defer to Phase 5
   - **Answer:** Fire-and-forget + error tracking
   - **Rationale:** YAGNI. Track backfillStatus + sync errors in DB. Add queue later if needed.

5. **[Scope]** Store rawData JSON in database?
   - Options: Strip don't store | Store auto-delete 30d | Store exclude from API
   - **Answer:** Strip and don't store
   - **Rationale:** No PII risk, no unbounded storage. Extract only needed fields during sync.

6. **[Scope]** Phase 4 creates 8 components + 2 hooks. Too much for social project MVP?
   - Options: Simplify | Keep full | Split 4a + 4b
   - **Answer:** Simplify Phase 4
   - **Rationale:** MAF Lab auto-fill + connect card only. Dashboard widgets + activity list deferred.

7. **[Architecture]** Admin UI for sync monitoring?
   - Options: Backend logs only | Admin panel section | JSON endpoint
   - **Answer:** Backend logs only
   - **Rationale:** YAGNI. PM2/Docker logs sufficient. No admin UI overhead.

#### Confirmed Decisions
- **Feature flag**: FEATURE_GARMIN env var gates backend module + frontend UI
- **rawData**: Removed from schema — extract only structured fields
- **Phase 4 simplified**: MAF Lab auto-fill + connect card only (2 days, not 3)
- **No job queue**: Fire-and-forget + DB error tracking for MVP
- **No admin UI**: Backend logs only for sync monitoring
- **Library verification**: MUST check garmin-connect methods before Phase 3

#### Impact on Phases
- Phase 1: rawData columns removed from schema, FEATURE_GARMIN added to env, module conditionally loaded
- Phase 3: Must verify library methods first, rawData not stored in sync
- Phase 4: Simplified to 2 days — only MAF Lab auto-fill + connect card
- All phases: FEATURE_GARMIN flag gates everything
