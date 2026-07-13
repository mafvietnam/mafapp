-- Migration: strava_activity_detail
-- Adds StravaActivityDetail cache table — lazily-hydrated detail + streams for a StravaActivity

-- CreateTable
CREATE TABLE "StravaActivityDetail" (
    "id" TEXT NOT NULL,
    "stravaActivityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "detailJson" JSONB NOT NULL,
    "streamsJson" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StravaActivityDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StravaActivityDetail_stravaActivityId_key" ON "StravaActivityDetail"("stravaActivityId");

-- CreateIndex
CREATE INDEX "StravaActivityDetail_userId_idx" ON "StravaActivityDetail"("userId");

-- AddForeignKey
ALTER TABLE "StravaActivityDetail" ADD CONSTRAINT "StravaActivityDetail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
