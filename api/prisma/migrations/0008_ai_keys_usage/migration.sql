-- Migration: ai_keys_usage
-- Phase 5 — Multi-provider AI + BYOK + Admin Budget. Adds:
--   AiProvider   enum(OPENROUTER|ANTHROPIC|OPENAI|GEMINI) — supported BYOK/system providers.
--   UserAiKey    one active BYOK key per user (@@unique([userId])). `encryptedKey` is
--                AES-256-GCM ciphertext (garmin-encryption.service.ts, reused — see
--                api/src/ai/user-ai-key.service.ts). A present row makes AiProviderService
--                always prefer the user's own key over the shared system quota.
--   AiUsage      system-tier (shared OpenRouter key) monthly generation counter, keyed by
--                server-derived ICT yearMonth (@@unique([userId, yearMonth])). BYOK requests
--                never touch this table — see api/src/ai/ai-provider.service.ts.
-- Both tables `onDelete: Cascade` on userId — satisfies PII-erasure (deleting a User purges
-- their stored key + usage history).
--
-- New tables + new enum only (no existing table touched) — safe to apply without downtime.
--
-- DDL below is PRISMA-GENERATED ground truth — produced via
--   npx prisma migrate diff --from-schema-datamodel <schema-before> \
--                            --to-schema-datamodel <schema-after> --script
-- (prisma 6.19.3, postgresql provider — same version pinned in api/package.json).
-- Hand-copied into this migration folder (rather than `prisma migrate dev`) because no
-- live dev database was reachable in the authoring sandbox (same as 0006/0007) — see the
-- phase-04 impl report for the DB-first prod-apply protocol (apply this SQL via psql ->
-- verify with \d "UserAiKey" / \d "AiUsage" -> `npx prisma migrate resolve --applied
-- 0008_ai_keys_usage` -> THEN deploy code). AiProviderService / UserAiKeyService / AdminAiService
-- all guard table-absent errors defensively during the rollout gap (mirrors
-- checkin.service.ts / coaching-cache.service.ts's existing table-absent guards) — a
-- missing table degrades to "no BYOK key" / "no usage" rather than a 500.

BEGIN;

-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('OPENROUTER', 'ANTHROPIC', 'OPENAI', 'GEMINI');

-- CreateTable
CREATE TABLE "UserAiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAiKey_userId_key" ON "UserAiKey"("userId");

-- CreateIndex
CREATE INDEX "AiUsage_userId_yearMonth_idx" ON "AiUsage"("userId", "yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "AiUsage_userId_yearMonth_key" ON "AiUsage"("userId", "yearMonth");

-- AddForeignKey
ALTER TABLE "UserAiKey" ADD CONSTRAINT "UserAiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
