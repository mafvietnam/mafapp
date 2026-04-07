-- CreateEnum
CREATE TYPE "GarminConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'TOKEN_EXPIRED', 'ERROR');

-- CreateTable
CREATE TABLE "GarminConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "garminUserId" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiry" TIMESTAMP(3),
    "status" "GarminConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "backfillStatus" TEXT NOT NULL DEFAULT 'NONE',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GarminConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GarminActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "garminActivityId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "distance" DOUBLE PRECISION,
    "avgHeartRate" INTEGER,
    "maxHeartRate" INTEGER,
    "minHeartRate" INTEGER,
    "avgPace" DOUBLE PRECISION,
    "calories" INTEGER,
    "vo2Max" DOUBLE PRECISION,
    "trainingEffect" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GarminActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GarminDailySummary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "steps" INTEGER,
    "restingHeartRate" INTEGER,
    "avgHeartRate" INTEGER,
    "maxHeartRate" INTEGER,
    "minHeartRate" INTEGER,
    "sleepDuration" INTEGER,
    "sleepScore" DOUBLE PRECISION,
    "stressAvg" INTEGER,
    "calories" INTEGER,
    "activeMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GarminDailySummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GarminConnection_userId_key" ON "GarminConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GarminActivity_garminActivityId_key" ON "GarminActivity"("garminActivityId");

-- CreateIndex
CREATE INDEX "GarminActivity_userId_startTime_idx" ON "GarminActivity"("userId", "startTime");

-- CreateIndex
CREATE INDEX "GarminDailySummary_userId_date_idx" ON "GarminDailySummary"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "GarminDailySummary_userId_date_key" ON "GarminDailySummary"("userId", "date");

-- AddForeignKey
ALTER TABLE "GarminConnection" ADD CONSTRAINT "GarminConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarminActivity" ADD CONSTRAINT "GarminActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarminDailySummary" ADD CONSTRAINT "GarminDailySummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
