-- `nextSpecialization` on ResultEntry — third level under `nextCourse`,
-- mirroring the existing `specialization` column (College → BE → this).
--
-- APPLY THIS BY HAND, NOT WITH `prisma migrate deploy` — same reason as
-- prisma/migrations/auth_mode_4-8-Y/migration.sql: this database's history
-- doesn't line up with `_prisma_migrations`, so `migrate deploy` would try to
-- replay the whole `final_30-7-Y` baseline and fail on "table already exists".
--
--   npx prisma db execute --file prisma/migrations/next_specialization_4-8-Y/migration.sql \
--     --schema prisma/schema.prisma
--
-- Additive only — one new nullable column. No data is read, changed, or removed.

-- AlterTable
ALTER TABLE `ResultEntry`
    ADD COLUMN `nextSpecialization` VARCHAR(191) NULL;
