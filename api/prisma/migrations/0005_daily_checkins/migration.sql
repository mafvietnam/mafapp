-- Migration: daily_checkins
-- Adds the DailyCheckin table (RED TEAM FIX #8 / #11) — optional morning
-- check-in (sleepQuality, fatigue, soreness, restingHr) feeding the "Today"
-- readiness engine (phase-01). `date` is the SERVER-derived Asia/Ho_Chi_Minh
-- calendar date (RED TEAM FIX #7) — one row per (userId, date).
-- `onDelete: Cascade` on the User FK satisfies PII erasure (RED TEAM FIX #11):
-- deleting a User purges their check-in vitals.
-- Additive-only (new table, no existing-table changes) — safe to apply without
-- downtime. Wrapped in a transaction (all-or-nothing), matching prior migrations.

BEGIN;

-- CreateTable
CREATE TABLE "DailyCheckin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "sleepQuality" INTEGER NOT NULL,
    "fatigue" INTEGER NOT NULL,
    "soreness" TEXT,
    "note" TEXT,
    "restingHr" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyCheckin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyCheckin_userId_date_idx" ON "DailyCheckin"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCheckin_userId_date_key" ON "DailyCheckin"("userId", "date");

-- AddForeignKey
ALTER TABLE "DailyCheckin" ADD CONSTRAINT "DailyCheckin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
