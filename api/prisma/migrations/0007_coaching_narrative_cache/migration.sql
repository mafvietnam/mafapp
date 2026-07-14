-- Migration: coaching_narrative_cache
-- Phase 4 — AI Narrative Layer. Adds `CoachingNarrative`, a per-user/per-day cache of the
-- warm Vietnamese narrative wrapping the server-recomputed structured "Today" recommendation
-- (see api/src/coaching/coaching.service.ts):
--   date        SERVER-derived Asia/Ho_Chi_Minh calendar date (mirrors DailyCheckin.date,
--               RED TEAM FIX #7) — the client never supplies the authoritative cache date.
--   inputHash   derived SERVER-SIDE from the server-recomputed structured recommendation
--               (RED TEAM FIX #2) — never a client-sent hash; regenerates only when the
--               server's own inputs (profile/activities/check-in) actually change.
--   narrative   the rendered VN text (AI or template) — contains NO raw check-in free text
--               (note/soreness) or health-condition specifics beyond enum-derived phrasing.
--   model       the model id used ('template' for the non-AI fallback).
--   source      'ai' | 'template', kept for observability.
--   @@unique([userId, date]) — at most one cached row per user per day; a Redis SETNX
--               single-flight lock around generation (coaching.service.ts) prevents the
--               concurrent-request P2002 race on this constraint.
--
-- New table only (no existing table touched) — safe to apply without downtime.
--
-- DDL below is PRISMA-GENERATED ground truth — produced via
--   npx prisma migrate diff --from-schema-datamodel <schema-before> \
--                            --to-schema-datamodel <schema-after> --script
-- (prisma 6.19.3, postgresql provider — same version pinned in api/package.json).
-- Hand-copied into this migration folder (rather than `prisma migrate dev`) because no
-- live dev database was reachable in the authoring sandbox (same as 0006) — see the
-- phase-04 impl report for the DB-first prod-apply protocol (apply this SQL via psql ->
-- verify with \d "CoachingNarrative" -> `npx prisma migrate resolve --applied
-- 0007_coaching_narrative_cache` -> THEN deploy code). coaching.service.ts guards
-- table-absent errors defensively during the rollout gap (mirrors checkin.service.ts /
-- profile.service.ts's existing table-absent guards) — falls back to the template
-- narrative with no persisted cache row rather than a 500.

BEGIN;

-- CreateTable
CREATE TABLE "CoachingNarrative" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "inputHash" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachingNarrative_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachingNarrative_userId_date_idx" ON "CoachingNarrative"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CoachingNarrative_userId_date_key" ON "CoachingNarrative"("userId", "date");

-- AddForeignKey
ALTER TABLE "CoachingNarrative" ADD CONSTRAINT "CoachingNarrative_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
