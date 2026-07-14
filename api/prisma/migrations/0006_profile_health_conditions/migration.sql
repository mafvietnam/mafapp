-- Migration: profile_health_conditions
-- Extends UserProfile with health-condition screening + consent + clearance-audit
-- fields (Phase 3 — RED TEAM FIX #8 / #9 / #10 / #11):
--   healthConditions   TEXT[] whitelist codes (CARDIOVASCULAR|HYPERTENSION|JOINT_ISSUES).
--                       Whitelist is enforced in the app layer at WRITE time
--                       (api/src/profile/profile.dto.ts @IsEnum(HealthCondition,{each:true})
--                       + @ArrayMaxSize(3)) — this column has no DB-level CHECK constraint,
--                       matching the existing `experience`/`commitment` plain-String columns.
--   healthScreenedAt   when the screening questionnaire was last submitted.
--   healthConsentAt    explicit consent timestamp (FIX #11) — screening data is only ever
--                       written together with consent; profile.service.ts wipes
--                       healthConditions when consent is withdrawn.
--   clearedAt/clearedBy medical-clearance AUDIT (who/when), not a bare self-attested
--                       boolean (FIX #10) — server-enforces the commitment gate using
--                       this pair, not a client-trusted flag.
--
-- Additive-only (5 new nullable/defaulted columns on an existing table) — safe to apply
-- without downtime; PG11+ fast-default column-add (metadata-only, no table rewrite),
-- matching the pattern used in 0004_add_activity_source. Wrapped in a transaction
-- (all-or-nothing), matching prior migrations.
--
-- DDL below is PRISMA-GENERATED ground truth — produced via
--   npx prisma migrate diff --from-schema-datamodel <schema-before> \
--                            --to-schema-datamodel <schema-after> --script
-- (prisma 6.19.3, postgresql provider — same version pinned in api/package.json).
-- Hand-copied into this migration folder (rather than `prisma migrate dev`) because no
-- live dev database was reachable in the authoring sandbox — see phase-03 impl report
-- for the DB-first prod-apply protocol (apply this SQL via psql -> verify columns with
-- \d "UserProfile" -> `npx prisma migrate resolve --applied 0006_profile_health_conditions`
-- -> THEN deploy code). profile.service.ts guards column-absent errors defensively
-- during the rollout gap (mirrors checkin.service.ts's existing table-absent guard).

BEGIN;

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "clearedAt" TIMESTAMP(3),
ADD COLUMN     "clearedBy" TEXT,
ADD COLUMN     "healthConditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "healthConsentAt" TIMESTAMP(3),
ADD COLUMN     "healthScreenedAt" TIMESTAMP(3);

COMMIT;
