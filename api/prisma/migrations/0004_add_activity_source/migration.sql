-- Migration: add_activity_source
-- Adds ActivitySource enum + StravaActivity.source discriminator (STRAVA sync vs UPLOAD tracklog).
-- Additive: CREATE TYPE + ADD COLUMN NOT NULL DEFAULT 'STRAVA' (PG11+ fast default, metadata-only,
-- no table rewrite) — existing rows become source='STRAVA'. Wrapped in a transaction (all-or-nothing).

BEGIN;

-- CreateEnum
CREATE TYPE "ActivitySource" AS ENUM ('STRAVA', 'UPLOAD');

-- AlterTable
ALTER TABLE "StravaActivity" ADD COLUMN "source" "ActivitySource" NOT NULL DEFAULT 'STRAVA';

-- CreateIndex
CREATE INDEX "StravaActivity_userId_source_idx" ON "StravaActivity"("userId", "source");

COMMIT;
