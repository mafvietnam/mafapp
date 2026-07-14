-- Rollback for 0008_ai_keys_usage.
-- Drops AiUsage + UserAiKey entirely and the AiProvider enum. Destructive: any stored
-- BYOK keys and usage counters are lost — BYOK keys are re-enterable by the user at any
-- time (not a source-of-truth loss beyond that), usage counters are a monthly cache
-- (safe to reset). Run only during the rollout gap before real data accumulates, or as
-- part of a deliberate rollback decision.

BEGIN;

ALTER TABLE "UserAiKey" DROP CONSTRAINT IF EXISTS "UserAiKey_userId_fkey";
ALTER TABLE "AiUsage" DROP CONSTRAINT IF EXISTS "AiUsage_userId_fkey";

DROP TABLE IF EXISTS "UserAiKey";
DROP TABLE IF EXISTS "AiUsage";

DROP TYPE IF EXISTS "AiProvider";

COMMIT;
