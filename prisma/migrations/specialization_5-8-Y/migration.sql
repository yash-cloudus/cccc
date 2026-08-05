-- The two `specialization` columns the schema gained alongside
-- `ResultEntry.nextSpecialization`.
--
-- Why a second file: next_specialization_4-8-Y adds `nextSpecialization` only,
-- but the same change also introduced `FamilyMember.specialization` and
-- `ResultEntry.specialization`. Without these two the merged code cannot read a
-- member or a result row at all — Prisma selects every column it knows about,
-- so a missing one is not a degraded feature, it is every query failing.
--
-- APPLY BY HAND — see prisma/migrations/auth_mode_4-8-Y/migration.sql for why
-- `migrate deploy` and `db push` are both wrong on this project:
--
--   npx prisma db execute --file prisma/migrations/specialization_5-8-Y/migration.sql \
--     --schema prisma/schema.prisma
--
-- Run next_specialization_4-8-Y as well; the two are one change in two files.
--
-- Additive only: two nullable columns, nothing read, changed or removed. Every
-- row that exists today answered the two-level question (College → BBA) and
-- simply has no third level.

-- AlterTable — the third level under a member's `course`
ALTER TABLE `FamilyMember`
    ADD COLUMN `specialization` VARCHAR(191) NULL;

-- AlterTable — the same third level on a submitted result
ALTER TABLE `ResultEntry`
    ADD COLUMN `specialization` VARCHAR(191) NULL;
