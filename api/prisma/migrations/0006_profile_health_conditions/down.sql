-- Rollback for 0006_profile_health_conditions (RED TEAM FIX #8).
-- Drops the 5 health-screening/consent/clearance-audit columns. Destructive: any
-- screening data (health conditions, consent timestamp, clearance audit) recorded
-- since the migration was applied is lost — only run this during the rollout gap
-- before real user data accumulates, or as part of a deliberate rollback decision.

BEGIN;

ALTER TABLE "UserProfile"
  DROP COLUMN IF EXISTS "clearedAt",
  DROP COLUMN IF EXISTS "clearedBy",
  DROP COLUMN IF EXISTS "healthConditions",
  DROP COLUMN IF EXISTS "healthConsentAt",
  DROP COLUMN IF EXISTS "healthScreenedAt";

COMMIT;
