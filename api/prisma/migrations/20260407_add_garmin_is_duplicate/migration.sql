-- AlterTable: add isDuplicate to GarminActivity for Strava dedup
ALTER TABLE "GarminActivity" ADD COLUMN "isDuplicate" BOOLEAN NOT NULL DEFAULT false;
