-- Migration: strava_admin_sync_columns
-- Adds admin sync tracking columns to StravaConnection

ALTER TABLE "StravaConnection"
  ADD COLUMN "lastSyncStartedAt" TIMESTAMP(3),
  ADD COLUMN "lastSyncFinishedAt" TIMESTAMP(3),
  ADD COLUMN "lastSyncError" TEXT;
