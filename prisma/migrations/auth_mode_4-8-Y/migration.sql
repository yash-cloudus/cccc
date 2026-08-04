-- Per-community login mode + encrypted provider credentials.
--
-- APPLY THIS BY HAND, NOT WITH `prisma migrate deploy`:
--
--   npx prisma db execute --file prisma/migrations/auth_mode_4-8-Y/migration.sql \
--     --schema prisma/schema.prisma
--
-- Two reasons `migrate deploy` will not work on this project:
--
--  1. The live database's `_prisma_migrations` table records a migration
--     (`20260716000000_init`) that does not exist in this folder, and none of
--     the folders here have ever been applied to it — the schema got there via
--     a phpMyAdmin dump import (see docs/DATABASE_IMPORT.md). `migrate deploy`
--     would try to replay `final_30-7-Y` and fail on "table already exists".
--
--  2. None of these folders carry the timestamp prefix Prisma sorts on, so they
--     run in plain alphabetical order — `album_description_en` already sorts
--     ahead of the `final_30-7-Y` baseline that creates the table it alters.
--
-- `prisma db push` is also the wrong tool here: this database has pre-existing
-- drift (orphan `ResultDrive.isPublished` and `ResultEntry.schoolName`, holding
-- 22 rows between them) that push resolves by DROPPING those columns.
--
-- Everything below is additive — one new enum column with a default, one new
-- nullable column, one new table. No data is read, changed, or removed.

-- AlterTable
-- Defaults to WHATSAPP_API so every community that existed before this column
-- keeps behaving exactly as it did: mobile + OTP, WhatsApp notifications live.
ALTER TABLE `Community`
    ADD COLUMN `authMode` ENUM('MOBILE_PASSWORD', 'WHATSAPP_API', 'SMS') NOT NULL DEFAULT 'WHATSAPP_API';

-- AlterTable
-- MOBILE_PASSWORD mode: which member's number the whole household signs in with.
-- The credential itself stays on the matching `User` row.
ALTER TABLE `Family`
    ADD COLUMN `loginMobile` VARCHAR(191) NULL;

-- CreateTable
-- Provider credentials live in their own table rather than on `Community`,
-- because Community rows get handed around whole (getActiveCommunity returns the
-- model, the platform API spreads it into JSON). Prisma will not load a relation
-- unless asked, so a secret parked here cannot ride along by accident.
-- `*Enc` columns hold AES-256-GCM ciphertext from lib/security/crypto.ts.
CREATE TABLE `CommunityIntegration` (
    `id` VARCHAR(191) NOT NULL,
    `communityId` VARCHAR(191) NOT NULL,
    `waApiKeyEnc` TEXT NULL,
    `waFirmIdEnc` TEXT NULL,
    `waSenderMobile` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CommunityIntegration_communityId_key`(`communityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CommunityIntegration`
    ADD CONSTRAINT `CommunityIntegration_communityId_fkey`
    FOREIGN KEY (`communityId`) REFERENCES `Community`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
