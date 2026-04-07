-- AlterTable: Add isActive column to User (default true so existing users remain active)
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
