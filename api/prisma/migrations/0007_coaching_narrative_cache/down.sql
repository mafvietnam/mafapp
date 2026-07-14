-- Rollback for 0007_coaching_narrative_cache.
-- Drops the CoachingNarrative table entirely. Destructive: any cached narratives
-- generated since the migration was applied are lost — safe to re-generate on demand
-- (it is a cache, not a source of truth), but run this only during the rollout gap
-- before you care about that cache history, or as part of a deliberate rollback decision.

BEGIN;

ALTER TABLE "CoachingNarrative" DROP CONSTRAINT IF EXISTS "CoachingNarrative_userId_fkey";

DROP TABLE IF EXISTS "CoachingNarrative";

COMMIT;
