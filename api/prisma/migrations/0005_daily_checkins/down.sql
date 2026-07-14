-- Rollback for 0005_daily_checkins (RED TEAM FIX #8).
-- Drops the DailyCheckin table + its indexes/FK. Destructive: any check-in
-- vitals recorded since the migration was applied are lost — only run this
-- during the rollout gap before real user data accumulates, or as part of a
-- deliberate rollback decision.

BEGIN;

DROP TABLE IF EXISTS "DailyCheckin";

COMMIT;
